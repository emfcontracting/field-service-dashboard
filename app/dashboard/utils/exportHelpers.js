// app/dashboard/utils/exportHelpers.js

/**
 * Convert work orders to CSV format
 */
export const convertWorkOrdersToCSV = (workOrders) => {
  if (!workOrders || workOrders.length === 0) {
    return '';
  }

  // Define CSV headers
  const headers = [
    'WO#',
    'Date Entered',
    'Building',
    'Priority',
    'Status',
    'Description',
    'Requestor',
    'Lead Tech',
    'NTE',
    'Hours RT',
    'Hours OT',
    'Miles',
    'Material Cost',
    'Equipment Cost',
    'Trailer Cost',
    'Rental Cost',
    'Total Cost',
    'Comments'
  ];

  // Create CSV rows
  const rows = workOrders.map(wo => {
    // Calculate total cost
    const labor = ((wo.hours_regular || 0) * 64) + ((wo.hours_overtime || 0) * 96);
    const materials = wo.material_cost || 0;
    const equipment = wo.emf_equipment_cost || 0;
    const trailer = wo.trailer_cost || 0;
    const rental = wo.rental_cost || 0;
    const mileage = (wo.miles || 0) * 1.00;
    const totalCost = labor + materials + equipment + trailer + rental + mileage;

    // Format date
    const dateEntered = wo.date_entered 
      ? new Date(wo.date_entered).toLocaleDateString('en-US')
      : 'N/A';

    // Get lead tech name
    const leadTech = wo.lead_tech 
      ? `${wo.lead_tech.first_name} ${wo.lead_tech.last_name}`
      : 'Unassigned';

    return [
      wo.wo_number || '',
      dateEntered,
      wo.building || '',
      wo.priority || '',
      wo.status || '',
      `"${(wo.work_order_description || '').replace(/"/g, '""')}"`, // Escape quotes
      wo.requestor || '',
      leadTech,
      (wo.nte || 0).toFixed(2),
      (wo.hours_regular || 0).toFixed(2),
      (wo.hours_overtime || 0).toFixed(2),
      (wo.miles || 0).toFixed(2),
      (wo.material_cost || 0).toFixed(2),
      (wo.emf_equipment_cost || 0).toFixed(2),
      (wo.trailer_cost || 0).toFixed(2),
      (wo.rental_cost || 0).toFixed(2),
      totalCost.toFixed(2),
      `"${(wo.comments || '').replace(/"/g, '""')}"` // Escape quotes
    ];
  });

  // Combine headers and rows
  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return csv;
};

/**
 * Download CSV file
 */
export const downloadCSV = (csv, filename) => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

/**
 * Export active work orders
 */
export const exportActiveWorkOrders = (workOrders) => {
  const activeStatuses = ['pending', 'assigned', 'in_progress', 'needs_return'];
  const activeOrders = workOrders.filter(wo => 
    activeStatuses.includes(wo.status) && !wo.is_locked
  );

  if (activeOrders.length === 0) {
    alert('No active work orders to export.');
    return;
  }

  const csv = convertWorkOrdersToCSV(activeOrders);
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `active-work-orders-${timestamp}.csv`;
  
  downloadCSV(csv, filename);
  alert(`✅ Exported ${activeOrders.length} active work orders!`);
};

/**
 * Export completed work orders
 */
export const exportCompletedWorkOrders = (workOrders) => {
  const completedOrders = workOrders.filter(wo => 
    wo.status === 'completed' || wo.is_locked
  );

  if (completedOrders.length === 0) {
    alert('No completed work orders to export.');
    return;
  }

  const csv = convertWorkOrdersToCSV(completedOrders);
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `completed-work-orders-${timestamp}.csv`;
  
  downloadCSV(csv, filename);
  alert(`✅ Exported ${completedOrders.length} completed work orders!`);
};

/**
 * Export all work orders
 */
export const exportAllWorkOrders = (workOrders) => {
  if (workOrders.length === 0) {
    alert('No work orders to export.');
    return;
  }

  const csv = convertWorkOrdersToCSV(workOrders);
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `all-work-orders-${timestamp}.csv`;
  
  downloadCSV(csv, filename);
  alert(`✅ Exported ${workOrders.length} work orders!`);
};

/**
 * Helper: Escape CSV field
 */
const escapeCSV = (val) => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Export detailed cost breakdown CSV for multiple work orders
 * Each row = one line item (tech labor entry, mileage, material, equipment, etc.)
 * Designed for Excel/Sheets filtering and pivot tables
 */
export const exportCostDetailCSV = async (supabase, workOrders) => {
  if (!workOrders || workOrders.length === 0) {
    alert('No work orders to export.');
    return;
  }

  try {
    const woIds = workOrders.map(wo => wo.wo_id);

    // Fetch all daily hours logs with tech names
    const { data: dailyLogs, error: logsError } = await supabase
      .from('daily_hours_log')
      .select(`
        *,
        user:users(first_name, last_name)
      `)
      .in('wo_id', woIds)
      .order('work_date', { ascending: true });

    if (logsError) throw logsError;

    // Fetch legacy team assignments
    const { data: assignments, error: assignError } = await supabase
      .from('work_order_assignments')
      .select(`
        *,
        user:users(first_name, last_name)
      `)
      .in('wo_id', woIds);

    if (assignError) throw assignError;

    // Build a lookup: wo_id -> work order
    const woLookup = {};
    workOrders.forEach(wo => { woLookup[wo.wo_id] = wo; });

    // CSV headers
    const headers = [
      'WO#',
      'Building',
      'NTE',
      'Category',
      'Tech Name',
      'Date',
      'Hours RT',
      'Hours OT',
      'Miles',
      'Rate',
      'Base Cost',
      'Markup %',
      'Total Cost',
      'Notes'
    ];

    const rows = [];

    // Running totals per WO for the summary
    const woTotals = {};
    const initTotals = () => ({
      laborCost: 0, mileageCost: 0, materialCost: 0, equipmentCost: 0,
      trailerCost: 0, rentalCost: 0, adminCost: 0, totalRT: 0, totalOT: 0, totalMiles: 0
    });

    // ---- DAILY HOURS LOG ENTRIES (per tech per day) ----
    (dailyLogs || []).forEach(log => {
      const wo = woLookup[log.wo_id];
      if (!wo) return;

      if (!woTotals[wo.wo_id]) woTotals[wo.wo_id] = initTotals();

      const techName = log.user ? `${log.user.first_name} ${log.user.last_name}` : 'Unknown';
      const rt = parseFloat(log.hours_regular) || 0;
      const ot = parseFloat(log.hours_overtime) || 0;
      const miles = parseFloat(log.miles) || 0;
      const laborCost = (rt * 64) + (ot * 96);
      const mileageCost = miles * 1.00;
      const techMaterial = parseFloat(log.tech_material_cost) || 0;
      const date = log.work_date || '';

      // Labor row
      if (rt > 0 || ot > 0) {
        rows.push([
          wo.wo_number, wo.building || '', (wo.nte || 0).toFixed(2),
          'Labor', techName, date,
          rt.toFixed(2), ot.toFixed(2), '',
          rt > 0 && ot > 0 ? '$64/$96' : rt > 0 ? '$64/hr' : '$96/hr',
          laborCost.toFixed(2), '0%', laborCost.toFixed(2),
          log.notes || ''
        ]);
        woTotals[wo.wo_id].laborCost += laborCost;
        woTotals[wo.wo_id].totalRT += rt;
        woTotals[wo.wo_id].totalOT += ot;
      }

      // Mileage row
      if (miles > 0) {
        rows.push([
          wo.wo_number, wo.building || '', (wo.nte || 0).toFixed(2),
          'Mileage', techName, date,
          '', '', miles.toFixed(1),
          '$1.00/mi', mileageCost.toFixed(2), '0%', mileageCost.toFixed(2),
          ''
        ]);
        woTotals[wo.wo_id].mileageCost += mileageCost;
        woTotals[wo.wo_id].totalMiles += miles;
      }

      // Tech material row
      if (techMaterial > 0) {
        const withMarkup = techMaterial * 1.25;
        rows.push([
          wo.wo_number, wo.building || '', (wo.nte || 0).toFixed(2),
          'Tech Material', techName, date,
          '', '', '',
          '', techMaterial.toFixed(2), '25%', withMarkup.toFixed(2),
          'Purchased by tech'
        ]);
        woTotals[wo.wo_id].materialCost += withMarkup;
      }
    });

    // ---- LEGACY TEAM ASSIGNMENTS (if no daily logs exist for that WO) ----
    (assignments || []).forEach(assign => {
      const wo = woLookup[assign.wo_id];
      if (!wo) return;

      // Check if this WO already has daily logs (skip legacy if so)
      const hasDailyLogs = (dailyLogs || []).some(l => l.wo_id === assign.wo_id);
      if (hasDailyLogs) return;

      if (!woTotals[wo.wo_id]) woTotals[wo.wo_id] = initTotals();

      const techName = assign.user ? `${assign.user.first_name} ${assign.user.last_name}` : 'Unknown';
      const rt = parseFloat(assign.hours_regular) || 0;
      const ot = parseFloat(assign.hours_overtime) || 0;
      const miles = parseFloat(assign.miles) || 0;
      const laborCost = (rt * 64) + (ot * 96);
      const mileageCost = miles * 1.00;

      if (rt > 0 || ot > 0) {
        rows.push([
          wo.wo_number, wo.building || '', (wo.nte || 0).toFixed(2),
          'Labor', techName, '(legacy)',
          rt.toFixed(2), ot.toFixed(2), '',
          rt > 0 && ot > 0 ? '$64/$96' : rt > 0 ? '$64/hr' : '$96/hr',
          laborCost.toFixed(2), '0%', laborCost.toFixed(2),
          'Legacy assignment'
        ]);
        woTotals[wo.wo_id].laborCost += laborCost;
        woTotals[wo.wo_id].totalRT += rt;
        woTotals[wo.wo_id].totalOT += ot;
      }

      if (miles > 0) {
        rows.push([
          wo.wo_number, wo.building || '', (wo.nte || 0).toFixed(2),
          'Mileage', techName, '(legacy)',
          '', '', miles.toFixed(1),
          '$1.00/mi', mileageCost.toFixed(2), '0%', mileageCost.toFixed(2),
          'Legacy assignment'
        ]);
        woTotals[wo.wo_id].mileageCost += mileageCost;
        woTotals[wo.wo_id].totalMiles += miles;
      }
    });

    // ---- WO-LEVEL COSTS (materials, equipment, trailer, rental, admin) ----
    workOrders.forEach(wo => {
      if (!woTotals[wo.wo_id]) woTotals[wo.wo_id] = initTotals();

      const leadTech = wo.lead_tech 
        ? `${wo.lead_tech.first_name} ${wo.lead_tech.last_name}` 
        : 'N/A';

      // Legacy lead tech hours (only if no daily logs)
      const hasDailyLogs = (dailyLogs || []).some(l => l.wo_id === wo.wo_id);
      if (!hasDailyLogs) {
        const rt = parseFloat(wo.hours_regular) || 0;
        const ot = parseFloat(wo.hours_overtime) || 0;
        const miles = parseFloat(wo.miles) || 0;
        const laborCost = (rt * 64) + (ot * 96);
        const mileageCost = miles * 1.00;

        if (rt > 0 || ot > 0) {
          rows.push([
            wo.wo_number, wo.building || '', (wo.nte || 0).toFixed(2),
            'Labor', leadTech, '(legacy)',
            rt.toFixed(2), ot.toFixed(2), '',
            rt > 0 && ot > 0 ? '$64/$96' : rt > 0 ? '$64/hr' : '$96/hr',
            laborCost.toFixed(2), '0%', laborCost.toFixed(2),
            'Lead tech legacy hours'
          ]);
          woTotals[wo.wo_id].laborCost += laborCost;
          woTotals[wo.wo_id].totalRT += rt;
          woTotals[wo.wo_id].totalOT += ot;
        }

        if (miles > 0) {
          rows.push([
            wo.wo_number, wo.building || '', (wo.nte || 0).toFixed(2),
            'Mileage', leadTech, '(legacy)',
            '', '', miles.toFixed(1),
            '$1.00/mi', mileageCost.toFixed(2), '0%', mileageCost.toFixed(2),
            'Lead tech legacy mileage'
          ]);
          woTotals[wo.wo_id].mileageCost += mileageCost;
          woTotals[wo.wo_id].totalMiles += miles;
        }
      }

      // Material cost (EMF company-purchased)
      const materialBase = parseFloat(wo.material_cost) || 0;
      if (materialBase > 0) {
        const materialMarkup = materialBase * 1.25;
        rows.push([
          wo.wo_number, wo.building || '', (wo.nte || 0).toFixed(2),
          'Material (EMF)', 'Company', '',
          '', '', '',
          '', materialBase.toFixed(2), '25%', materialMarkup.toFixed(2),
          'EMF purchased material'
        ]);
        woTotals[wo.wo_id].materialCost += materialMarkup;
      }

      // Equipment cost
      const equipBase = parseFloat(wo.emf_equipment_cost) || 0;
      if (equipBase > 0) {
        const equipMarkup = equipBase * 1.25;
        rows.push([
          wo.wo_number, wo.building || '', (wo.nte || 0).toFixed(2),
          'Equipment', 'Company', '',
          '', '', '',
          '', equipBase.toFixed(2), '25%', equipMarkup.toFixed(2),
          ''
        ]);
        woTotals[wo.wo_id].equipmentCost += equipMarkup;
      }

      // Trailer cost
      const trailerBase = parseFloat(wo.trailer_cost) || 0;
      if (trailerBase > 0) {
        const trailerMarkup = trailerBase * 1.25;
        rows.push([
          wo.wo_number, wo.building || '', (wo.nte || 0).toFixed(2),
          'Trailer', 'Company', '',
          '', '', '',
          '', trailerBase.toFixed(2), '25%', trailerMarkup.toFixed(2),
          ''
        ]);
        woTotals[wo.wo_id].trailerCost += trailerMarkup;
      }

      // Rental cost
      const rentalBase = parseFloat(wo.rental_cost) || 0;
      if (rentalBase > 0) {
        const rentalMarkup = rentalBase * 1.25;
        rows.push([
          wo.wo_number, wo.building || '', (wo.nte || 0).toFixed(2),
          'Rental', 'Company', '',
          '', '', '',
          '', rentalBase.toFixed(2), '25%', rentalMarkup.toFixed(2),
          ''
        ]);
        woTotals[wo.wo_id].rentalCost += rentalMarkup;
      }

      // Admin hours (always 2 hrs @ $64 = $128)
      rows.push([
        wo.wo_number, wo.building || '', (wo.nte || 0).toFixed(2),
        'Admin', 'Office', '',
        '2.00', '', '',
        '$64/hr', '128.00', '0%', '128.00',
        '2 admin hours'
      ]);
      woTotals[wo.wo_id].adminCost = 128;
    });

    // Sort rows by WO#, then by category
    const categoryOrder = { 'Labor': 1, 'Mileage': 2, 'Tech Material': 3, 'Material (EMF)': 4, 'Equipment': 5, 'Trailer': 6, 'Rental': 7, 'Admin': 8 };
    rows.sort((a, b) => {
      if (a[0] !== b[0]) return a[0].localeCompare(b[0]);
      return (categoryOrder[a[3]] || 99) - (categoryOrder[b[3]] || 99);
    });

    // ---- BUILD CSV ----
    const csvLines = [];

    // Title row
    csvLines.push(`EMF Contracting LLC - Cost Detail Report`);
    csvLines.push(`Generated: ${new Date().toLocaleString()}`);
    csvLines.push(`Work Orders: ${workOrders.length}`);
    csvLines.push('');  // blank line

    // Headers
    csvLines.push(headers.map(escapeCSV).join(','));

    // Data rows
    rows.forEach(row => {
      csvLines.push(row.map(escapeCSV).join(','));
    });

    // ---- SUMMARY SECTION ----
    csvLines.push('');  // blank line
    csvLines.push('--- SUMMARY BY WORK ORDER ---');
    csvLines.push(['WO#', 'Building', 'NTE', 'Total RT Hrs', 'Total OT Hrs', 'Total Miles', 'Labor Cost', 'Mileage Cost', 'Material Cost', 'Equipment Cost', 'Trailer Cost', 'Rental Cost', 'Admin Cost', 'GRAND TOTAL', 'Remaining NTE'].map(escapeCSV).join(','));

    let grandTotalAll = 0;
    workOrders.forEach(wo => {
      const t = woTotals[wo.wo_id] || initTotals();
      const grandTotal = t.laborCost + t.mileageCost + t.materialCost + t.equipmentCost + t.trailerCost + t.rentalCost + t.adminCost;
      const remaining = (wo.nte || 0) - grandTotal;
      grandTotalAll += grandTotal;

      csvLines.push([
        wo.wo_number,
        wo.building || '',
        (wo.nte || 0).toFixed(2),
        t.totalRT.toFixed(2),
        t.totalOT.toFixed(2),
        t.totalMiles.toFixed(1),
        t.laborCost.toFixed(2),
        t.mileageCost.toFixed(2),
        t.materialCost.toFixed(2),
        t.equipmentCost.toFixed(2),
        t.trailerCost.toFixed(2),
        t.rentalCost.toFixed(2),
        t.adminCost.toFixed(2),
        grandTotal.toFixed(2),
        remaining.toFixed(2)
      ].map(escapeCSV).join(','));
    });

    // Grand total row
    csvLines.push('');
    csvLines.push(`,,,,,,,,,,,,,,GRAND TOTAL ALL: ${grandTotalAll.toFixed(2)}`);

    const csv = csvLines.join('\n');
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `cost-detail-report-${timestamp}.csv`;

    downloadCSV(csv, filename);
    alert(`✅ Exported cost detail for ${workOrders.length} work orders with ${rows.length} line items!`);

  } catch (err) {
    console.error('Error exporting cost detail:', err);
    alert('❌ Error exporting cost detail: ' + err.message);
  }
};

/**
 * Export cost detail for a SINGLE work order
 * (Used from the Work Order Detail Modal)
 */
export const exportSingleWOCostDetail = async (supabase, workOrder, dailyHoursLog, teamMembers) => {
  if (!workOrder) {
    alert('No work order selected.');
    return;
  }

  // Wrap in array and use the bulk function
  await exportCostDetailCSV(supabase, [workOrder]);
};