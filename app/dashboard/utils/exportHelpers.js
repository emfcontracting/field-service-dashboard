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