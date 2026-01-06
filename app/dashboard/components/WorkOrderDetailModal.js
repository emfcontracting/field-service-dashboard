// app/dashboard/components/WorkOrderDetailModal.js
'use client';

import { useState, useEffect } from 'react';
import TeamMemberModal from './TeamMemberModal';
import NTEIncreaseModal from './NTEIncreaseModal';
import { 
  updateWorkOrder, 
  deleteWorkOrder, 
  acknowledgeWorkOrder,
  assignToField,
  unassignFromField,
  removeTeamMember,
  updateTeamMember
} from '../utils/dataFetchers';
import { calculateInvoiceTotal } from '../utils/calculations';
import { getStatusColor, getPriorityColor, formatDate } from '../utils/styleHelpers';

export default function WorkOrderDetailModal({ 
  workOrder, 
  users, 
  supabase, 
  onClose, 
  refreshWorkOrders 
}) {
  const [selectedWO, setSelectedWO] = useState(workOrder);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showInvoiceButton, setShowInvoiceButton] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [dailyHoursLog, setDailyHoursLog] = useState([]);
  const [loadingHours, setLoadingHours] = useState(true);
  const [dailyTotals, setDailyTotals] = useState({ totalRT: 0, totalOT: 0, totalMiles: 0 });
  const [editingHours, setEditingHours] = useState({}); // Track editing state for each entry
  const [savingHours, setSavingHours] = useState(false);
  const [showAddHoursForm, setShowAddHoursForm] = useState(false);
  
  // Helper function to get local date string in YYYY-MM-DD format
  // This prevents timezone issues where UTC conversion shifts the date
  const getLocalDateString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper function to parse date string without timezone issues
  // work_date is stored as YYYY-MM-DD, parse it as local date
  const parseLocalDate = (dateStr) => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    if (parts.length !== 3) return new Date(dateStr);
    return new Date(
      parseInt(parts[0]), 
      parseInt(parts[1]) - 1, 
      parseInt(parts[2])
    );
  };
  
  const [newHoursEntry, setNewHoursEntry] = useState({
    user_id: '',
    work_date: getLocalDateString(),
    hours_regular: 0,
    hours_overtime: 0,
    miles: 0,
    notes: ''
  });
  // NTE Increases state
  const [nteIncreases, setNteIncreases] = useState([]);
  const [loadingNteIncreases, setLoadingNteIncreases] = useState(true);
  const [editingNTE, setEditingNTE] = useState(null); // Track which NTE is being edited
  const [savingNTE, setSavingNTE] = useState(false);
  const [showNTEModal, setShowNTEModal] = useState(false);
  const adminPassword = 'admin123';

  useEffect(() => {
    checkCanGenerateInvoice();
    loadDailyHoursLog();
    loadNteIncreases();
  }, [selectedWO]);

  const loadDailyHoursLog = async () => {
    try {
      setLoadingHours(true);
      const { data, error } = await supabase
        .from('daily_hours_log')
        .select(`
          *,
          user:users(first_name, last_name)
        `)
        .eq('wo_id', selectedWO.wo_id)
        .order('work_date', { ascending: false });

      if (error) throw error;

      setDailyHoursLog(data || []);
      calculateTotals(data || []);

    } catch (err) {
      console.error('Error loading daily hours:', err);
    } finally {
      setLoadingHours(false);
    }
  };

  const calculateTotals = (data) => {
    let totalRT = 0, totalOT = 0, totalMiles = 0;
    (data || []).forEach(entry => {
      totalRT += parseFloat(entry.hours_regular) || 0;
      totalOT += parseFloat(entry.hours_overtime) || 0;
      totalMiles += parseFloat(entry.miles) || 0;
    });
    setDailyTotals({ totalRT, totalOT, totalMiles });
  };

  const loadNteIncreases = async () => {
    try {
      setLoadingNteIncreases(true);
      const { data, error } = await supabase
        .from('work_order_quotes')
        .select(`
          *,
          creator:users!work_order_quotes_created_by_fkey(first_name, last_name)
        `)
        .eq('wo_id', selectedWO.wo_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNteIncreases(data || []);
    } catch (err) {
      console.error('Error loading NTE increases:', err);
    } finally {
      setLoadingNteIncreases(false);
    }
  };

  // Handle updating an NTE increase (EMF internal tracking only - does NOT auto-update work order NTE)
  // Work order NTE is updated via Gmail sync when CBRE sends quote approval email
  const handleUpdateNTEIncrease = async (quoteId, updates) => {
    try {
      setSavingNTE(true);
      
      const quote = nteIncreases.find(q => q.quote_id === quoteId);
      const updatedQuote = { ...quote, ...updates };
      
      // Calculate grand total including ALL components: labor + materials + equipment + rental + trailer + mileage
      const laborTotal = parseFloat(updatedQuote.labor_total) || 0;
      const materialsWithMarkup = parseFloat(updatedQuote.materials_with_markup) || 0;
      const equipmentWithMarkup = parseFloat(updatedQuote.equipment_with_markup) || 0;
      const rentalWithMarkup = parseFloat(updatedQuote.rental_with_markup) || 0;
      const trailerWithMarkup = parseFloat(updatedQuote.trailer_with_markup) || 0;
      const mileageTotal = parseFloat(updatedQuote.mileage_total) || 0;
      const grandTotal = laborTotal + materialsWithMarkup + equipmentWithMarkup + rentalWithMarkup + trailerWithMarkup + mileageTotal;
      
      const finalUpdates = { ...updates, grand_total: grandTotal };
      
      const { error } = await supabase
        .from('work_order_quotes')
        .update(finalUpdates)
        .eq('quote_id', quoteId);

      if (error) throw error;

      // Update local state for quotes
      setNteIncreases(nteIncreases.map(q => 
        q.quote_id === quoteId ? { ...q, ...finalUpdates } : q
      ));
      
    } catch (err) {
      alert('Error updating NTE: ' + err.message);
    } finally {
      setSavingNTE(false);
    }
  };

  // Handle deleting an NTE increase
  const handleDeleteNTEIncrease = async (quoteId) => {
    if (!confirm('Delete this NTE increase request? This cannot be undone.')) return;

    try {
      setSavingNTE(true);
      
      const { error } = await supabase
        .from('work_order_quotes')
        .delete()
        .eq('quote_id', quoteId);

      if (error) throw error;

      setNteIncreases(nteIncreases.filter(q => q.quote_id !== quoteId));
      alert('✅ NTE increase deleted');
    } catch (err) {
      alert('Error deleting NTE: ' + err.message);
    } finally {
      setSavingNTE(false);
    }
  };

  // Print NTE Increase - CORRECTED VERSION
  // Shows: Current Accrued + Additional Estimate = Projected Total (New NTE Needed)
  // Printable version shows final costs only - NO markup percentages displayed
  const printNTEIncrease = async (quote) => {
    // Calculate existing/accrued costs from the work order
    let existingCostsTotal = 0;
    let existingBreakdown = {
      labor: 0,
      materials: 0,
      equipment: 0,
      rental: 0,
      trailer: 0,
      mileage: 0,
      admin: 128
    };
    
    try {
      // Get daily hours logs for this work order
      const { data: dailyLogs } = await supabase
        .from('daily_hours_log')
        .select('*')
        .eq('wo_id', selectedWO.wo_id);
      
      // Get team member assignments  
      const { data: teamMembers } = await supabase
        .from('work_order_assignments')
        .select('*')
        .eq('wo_id', selectedWO.wo_id);
      
      // Calculate labor and mileage from daily logs or legacy fields
      let totalRT = 0;
      let totalOT = 0;
      let totalMileage = 0;
      
      if (dailyLogs && dailyLogs.length > 0) {
        // Use daily logs for hours AND mileage
        dailyLogs.forEach(log => {
          totalRT += parseFloat(log.hours_regular) || 0;
          totalOT += parseFloat(log.hours_overtime) || 0;
          totalMileage += parseFloat(log.miles) || 0;
        });
      } else {
        // Legacy fields
        totalRT = parseFloat(selectedWO.hours_regular) || 0;
        totalOT = parseFloat(selectedWO.hours_overtime) || 0;
        totalMileage = parseFloat(selectedWO.miles) || 0;
        
        if (teamMembers) {
          teamMembers.forEach(tm => {
            totalRT += parseFloat(tm.hours_regular) || 0;
            totalOT += parseFloat(tm.hours_overtime) || 0;
            totalMileage += parseFloat(tm.miles) || 0;
          });
        }
      }
      
      existingBreakdown.labor = (totalRT * 64) + (totalOT * 96);
      existingBreakdown.materials = (parseFloat(selectedWO.material_cost) || 0) * 1.25;
      existingBreakdown.equipment = (parseFloat(selectedWO.emf_equipment_cost) || 0) * 1.25;
      existingBreakdown.rental = (parseFloat(selectedWO.rental_cost) || 0) * 1.25;
      existingBreakdown.trailer = (parseFloat(selectedWO.trailer_cost) || 0) * 1.25;
      existingBreakdown.mileage = totalMileage * 1.00;
      
      existingCostsTotal = existingBreakdown.labor + existingBreakdown.materials + 
                           existingBreakdown.equipment + existingBreakdown.rental + 
                           existingBreakdown.trailer + existingBreakdown.mileage + 
                           existingBreakdown.admin;
    } catch (err) {
      console.error('Error calculating existing costs:', err);
    }
    
    // Additional work estimate from the quote - calculate from individual fields (NO admin fee)
    // MUST include ALL components: labor + materials + equipment + rental + trailer + mileage
    const laborTotal = parseFloat(quote.labor_total) || 0;
    const materialsWithMarkup = parseFloat(quote.materials_with_markup) || 0;
    const equipmentWithMarkup = parseFloat(quote.equipment_with_markup) || 0;
    const rentalWithMarkup = parseFloat(quote.rental_with_markup) || 0;
    const trailerWithMarkup = parseFloat(quote.trailer_with_markup) || 0;
    const mileageTotal = parseFloat(quote.mileage_total) || 0;
    // NO admin fee in additional work - it's already in current/accrued costs
    const additionalTotal = laborTotal + materialsWithMarkup + equipmentWithMarkup + rentalWithMarkup + trailerWithMarkup + mileageTotal;
    
    // Projected total = existing + additional
    const projectedTotal = existingCostsTotal + additionalTotal;
    
    // Original NTE budget
    const originalNTE = parseFloat(selectedWO.nte) || 0;
    
    // New NTE needed = projected total cost
    const newNTENeeded = projectedTotal;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>NTE Increase Request - ${selectedWO.wo_number}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 30px; background: white; color: #333; font-size: 12px; }
          .header { text-align: center; border-bottom: 3px solid #1e40af; padding-bottom: 15px; margin-bottom: 20px; }
          .header h1 { color: #1e40af; font-size: 22px; margin-bottom: 5px; }
          .header .company { font-size: 14px; color: #666; }
          .badge { display: inline-block; padding: 5px 15px; border-radius: 15px; font-weight: bold; font-size: 11px; margin-top: 10px; }
          .badge-written { background: #3b82f6; color: white; }
          .badge-verbal { background: #f59e0b; color: white; }
          .section { margin-bottom: 20px; }
          .section-title { font-size: 13px; font-weight: bold; color: #1e40af; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; margin-bottom: 10px; text-transform: uppercase; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .info-item { padding: 8px; background: #f9fafb; border-radius: 5px; }
          .info-label { font-size: 9px; color: #666; text-transform: uppercase; }
          .info-value { font-size: 12px; font-weight: 600; }
          .cost-box { border: 2px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 15px 0; }
          .cost-box-blue { border-color: #3b82f6; background: #eff6ff; }
          .cost-box-yellow { border-color: #f59e0b; background: #fffbeb; }
          .cost-box-green { border-color: #10b981; background: #d1fae5; }
          .cost-box-title { font-weight: bold; font-size: 12px; margin-bottom: 10px; color: #1e40af; }
          .summary-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb; }
          .summary-row:last-child { border-bottom: none; }
          .summary-total { font-size: 14px; font-weight: bold; padding-top: 10px; border-top: 2px solid #333; margin-top: 10px; }
          .new-nte-box { background: #065f46; color: white; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
          .new-nte-value { font-size: 28px; font-weight: bold; }
          .new-nte-label { font-size: 12px; margin-bottom: 5px; }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 10px; border-top: 1px solid #e5e7eb; padding-top: 15px; }
          @media print { body { padding: 20px; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>NTE INCREASE REQUEST</h1>
          <div class="company">EMF Contracting LLC</div>
          <div class="badge ${quote.is_verbal_nte ? 'badge-verbal' : 'badge-written'}">
            ${quote.is_verbal_nte ? '📞 VERBAL NTE' : '📄 WRITTEN NTE'}
          </div>
        </div>

        <div class="section">
          <div class="section-title">Work Order Information</div>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Work Order #</div>
              <div class="info-value">${selectedWO.wo_number}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Building</div>
              <div class="info-value">${selectedWO.building || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Original NTE Budget</div>
              <div class="info-value">${originalNTE.toFixed(2)}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Date Submitted</div>
              <div class="info-value">${new Date(quote.created_at).toLocaleDateString()}</div>
            </div>
          </div>
        </div>

        ${quote.is_verbal_nte && quote.verbal_approved_by ? `
        <div class="section">
          <div class="section-title">Verbal Approval</div>
          <div class="info-item">
            <div class="info-label">Approved By</div>
            <div class="info-value">${quote.verbal_approved_by}</div>
          </div>
        </div>
        ` : ''}

        ${quote.description ? `
        <div class="section">
          <div class="section-title">Description of Additional Work</div>
          <p style="padding: 10px; background: #f9fafb; border-radius: 5px;">${quote.description}</p>
        </div>
        ` : ''}

        <!-- Current Costs Accrued -->
        <div class="cost-box cost-box-blue">
          <div class="cost-box-title">CURRENT COSTS ACCRUED (Work Completed So Far)</div>
          <div class="summary-row">
            <span>Labor</span>
            <span>${existingBreakdown.labor.toFixed(2)}</span>
          </div>
          <div class="summary-row">
            <span>Materials</span>
            <span>${existingBreakdown.materials.toFixed(2)}</span>
          </div>
          <div class="summary-row">
            <span>Equipment</span>
            <span>${existingBreakdown.equipment.toFixed(2)}</span>
          </div>
          <div class="summary-row">
            <span>Rental</span>
            <span>${existingBreakdown.rental.toFixed(2)}</span>
          </div>
          <div class="summary-row">
            <span>Trailer</span>
            <span>${existingBreakdown.trailer.toFixed(2)}</span>
          </div>
          <div class="summary-row">
            <span>Mileage</span>
            <span>${existingBreakdown.mileage.toFixed(2)}</span>
          </div>
          <div class="summary-row">
            <span>Admin Fee</span>
            <span>${existingBreakdown.admin.toFixed(2)}</span>
          </div>
          <div class="summary-total">
            <div class="summary-row" style="border: none;">
              <span>CURRENT TOTAL</span>
              <span>${existingCostsTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <!-- Additional Work Estimate -->
        <div class="cost-box cost-box-yellow">
          <div class="cost-box-title" style="color: #b45309;">ADDITIONAL WORK ESTIMATE</div>
          <div class="summary-row">
            <span>Labor</span>
            <span>${(parseFloat(quote.labor_total) || 0).toFixed(2)}</span>
          </div>
          <div class="summary-row">
            <span>Materials</span>
            <span>${(parseFloat(quote.materials_with_markup) || 0).toFixed(2)}</span>
          </div>
          <div class="summary-row">
            <span>Equipment</span>
            <span>${(parseFloat(quote.equipment_with_markup) || 0).toFixed(2)}</span>
          </div>
          <div class="summary-row">
            <span>Rental</span>
            <span>${(parseFloat(quote.rental_with_markup) || 0).toFixed(2)}</span>
          </div>
          <div class="summary-row">
            <span>Trailer</span>
            <span>${(parseFloat(quote.trailer_with_markup) || 0).toFixed(2)}</span>
          </div>
          <div class="summary-row">
            <span>Mileage</span>
            <span>${(parseFloat(quote.mileage_total) || 0).toFixed(2)}</span>
          </div>
          <div class="summary-total">
            <div class="summary-row" style="border: none;">
              <span>ADDITIONAL WORK TOTAL</span>
              <span>${additionalTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <!-- NTE Increase Summary -->
        <div class="cost-box cost-box-green">
          <div class="cost-box-title" style="color: #065f46;">NTE INCREASE SUMMARY</div>
          <div class="summary-row">
            <span>Current Costs Accrued</span>
            <span>${existingCostsTotal.toFixed(2)}</span>
          </div>
          <div class="summary-row">
            <span>Additional Work Estimate</span>
            <span>${additionalTotal.toFixed(2)}</span>
          </div>
          <div class="summary-total">
            <div class="summary-row" style="border: none; font-size: 14px;">
              <span>PROJECTED TOTAL COST</span>
              <span>${projectedTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <!-- New NTE Needed -->
        <div class="new-nte-box">
          <div class="new-nte-label">Original NTE Budget: ${originalNTE.toFixed(2)}</div>
          <div class="new-nte-label" style="font-size: 14px; margin-top: 10px;">NEW NTE BUDGET NEEDED:</div>
          <div class="new-nte-value">${newNTENeeded.toFixed(2)}</div>
        </div>

        ${quote.notes ? `
        <div class="section">
          <div class="section-title">Additional Notes</div>
          <p style="padding: 10px; background: #f9fafb; border-radius: 5px;">${quote.notes}</p>
        </div>
        ` : ''}

        <div class="footer">
          <p><strong>EMF Contracting LLC</strong></p>
          <p>Created by: ${quote.creator?.first_name || ''} ${quote.creator?.last_name || ''}</p>
          <p>Generated: ${new Date().toLocaleString()}</p>
        </div>

        <div class="no-print" style="text-align: center; margin-top: 20px;">
          <button onclick="window.print()" style="background: #1e40af; color: white; padding: 12px 30px; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; margin-right: 10px;">
            🖨️ Print
          </button>
          <button onclick="window.close()" style="background: #6b7280; color: white; padding: 12px 30px; border: none; border-radius: 6px; font-size: 14px; cursor: pointer;">
            Close
          </button>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
  };

  const checkCanGenerateInvoice = async () => {
    const { data: invoice } = await supabase
      .from('invoices')
      .select('invoice_id, status')
      .eq('wo_id', selectedWO.wo_id)
      .single();

    setShowInvoiceButton(selectedWO?.acknowledged && !invoice && !selectedWO?.is_locked);
  };

  // Handle updating a daily hours entry
  // FIXED: Use log_id instead of id (matches database schema)
  const handleUpdateDailyHours = async (logId, field, value) => {
    try {
      setSavingHours(true);
      
      const { error } = await supabase
        .from('daily_hours_log')
        .update({ [field]: value })
        .eq('log_id', logId);

      if (error) throw error;

      // Update local state - use log_id for matching
      const updatedLog = dailyHoursLog.map(entry => 
        (entry.log_id || entry.id) === logId ? { ...entry, [field]: value } : entry
      );
      setDailyHoursLog(updatedLog);
      calculateTotals(updatedLog);

      // Clear editing state for this field
      setEditingHours(prev => {
        const key = `${logId}_${field}`;
        const { [key]: removed, ...rest } = prev;
        return rest;
      });

    } catch (err) {
      alert('Error updating hours: ' + err.message);
    } finally {
      setSavingHours(false);
    }
  };

  // Handle deleting a daily hours entry
  // FIXED: Use log_id instead of id (matches database schema)
  const handleDeleteDailyHours = async (logId) => {
    if (!confirm('Delete this hours entry? This cannot be undone.')) return;

    try {
      setSavingHours(true);
      
      const { error } = await supabase
        .from('daily_hours_log')
        .delete()
        .eq('log_id', logId);

      if (error) throw error;

      // Update local state - use log_id for matching
      const updatedLog = dailyHoursLog.filter(entry => (entry.log_id || entry.id) !== logId);
      setDailyHoursLog(updatedLog);
      calculateTotals(updatedLog);

      alert('✅ Hours entry deleted');
    } catch (err) {
      alert('Error deleting hours: ' + err.message);
    } finally {
      setSavingHours(false);
    }
  };

  // Handle adding new hours entry
  const handleAddHoursEntry = async () => {
    if (!newHoursEntry.user_id) {
      alert('Please select a team member');
      return;
    }

    try {
      setSavingHours(true);

      const { data, error } = await supabase
        .from('daily_hours_log')
        .insert({
          wo_id: selectedWO.wo_id,
          user_id: newHoursEntry.user_id,
          work_date: newHoursEntry.work_date,
          hours_regular: parseFloat(newHoursEntry.hours_regular) || 0,
          hours_overtime: parseFloat(newHoursEntry.hours_overtime) || 0,
          miles: parseFloat(newHoursEntry.miles) || 0,
          notes: newHoursEntry.notes || '[Added by Admin]'
        })
        .select(`*, user:users(first_name, last_name)`)
        .single();

      if (error) throw error;

      // Update local state
      const updatedLog = [data, ...dailyHoursLog];
      setDailyHoursLog(updatedLog);
      calculateTotals(updatedLog);

      // Reset form - FIXED: Use getLocalDateString() instead of toISOString()
      setNewHoursEntry({
        user_id: '',
        work_date: getLocalDateString(),
        hours_regular: 0,
        hours_overtime: 0,
        miles: 0,
        notes: ''
      });
      setShowAddHoursForm(false);

      alert('✅ Hours entry added');
    } catch (err) {
      alert('Error adding hours: ' + err.message);
    } finally {
      setSavingHours(false);
    }
  };

  // Get field value for editing - FIXED: use log_id consistently
  const getHoursFieldValue = (logId, field, originalValue) => {
    const key = `${logId}_${field}`;
    return editingHours.hasOwnProperty(key) ? editingHours[key] : originalValue;
  };

  // Handle field change for editing - FIXED: use log_id consistently
  const handleHoursFieldChange = (logId, field, value) => {
    const key = `${logId}_${field}`;
    setEditingHours(prev => ({ ...prev, [key]: value }));
  };

  const handleUpdateField = async (field, value) => {
    try {
      await updateWorkOrder(supabase, selectedWO.wo_id, { [field]: value });
      setSelectedWO({ ...selectedWO, [field]: value });
      refreshWorkOrders();
    } catch (error) {
      alert('Failed to update field: ' + error.message);
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    await handleUpdateField('status', newStatus);
    if (newStatus === 'completed' && !selectedWO.is_locked) {
      alert('✅ Work Order marked as Completed! Please acknowledge to lock it.');
    }
  };

  const handleDeleteWorkOrder = async () => {
    const password = prompt('Enter admin password to delete:');
    if (password !== adminPassword) {
      alert('❌ Incorrect password');
      return;
    }

    const confirmText = prompt('Type DELETE to confirm deletion:');
    if (confirmText !== 'DELETE') {
      alert('Deletion cancelled');
      return;
    }

    try {
      await deleteWorkOrder(supabase, selectedWO.wo_id);
      alert('✅ Work order deleted');
      onClose();
      refreshWorkOrders();
    } catch (error) {
      alert('Failed to delete work order: ' + error.message);
    }
  };

  const handleAcknowledge = async () => {
    if (!confirm('Acknowledge this completed work order?\n\nThis will prepare it for invoicing.')) {
      return;
    }

    try {
      await acknowledgeWorkOrder(supabase, selectedWO.wo_id);
      alert('✅ Work order acknowledged and ready for invoicing!');
      setSelectedWO({ ...selectedWO, acknowledged: true, acknowledged_at: new Date().toISOString() });
      refreshWorkOrders();
    } catch (error) {
      alert('Failed to acknowledge work order: ' + error.message);
    }
  };

  const handleAssignToField = async () => {
    if (!confirm('Assign this work order to field workers?\n\nThis will make it visible in the mobile app and send email notifications to the lead tech and team members.')) {
      return;
    }

    try {
      await assignToField(supabase, selectedWO.wo_id);
      
      // Send email notifications to lead tech and team members
      await sendAssignmentNotifications();
      
      alert('✅ Work order assigned to field workers!\nEmail notifications sent.');
      onClose();
      refreshWorkOrders();
    } catch (error) {
      alert('❌ Error assigning to field: ' + error.message);
    }
  };

const sendAssignmentNotifications = async () => {
    try {
      // Gather recipients: lead tech + team members
      const recipients = [];
      
      // Add lead tech if exists
      if (selectedWO.lead_tech_id) {
        const { data: leadTech } = await supabase
          .from('users')
          .select('user_id, first_name, last_name, email')
          .eq('user_id', selectedWO.lead_tech_id)
          .single();
        
        if (leadTech) {
          recipients.push(leadTech);
        }
      }
      
      // Add team members
      if (selectedWO.teamMembers && selectedWO.teamMembers.length > 0) {
        for (const member of selectedWO.teamMembers) {
          const { data: teamMember } = await supabase
            .from('users')
            .select('user_id, first_name, last_name, email')
            .eq('user_id', member.user_id)
            .single();
          
          if (teamMember) {
            // Avoid duplicates
            if (!recipients.find(r => r.user_id === teamMember.user_id)) {
              recipients.push(teamMember);
            }
          }
        }
      }
      
      if (recipients.length === 0) {
        console.log('No recipients found for notifications');
        return;
      }

      console.log('Sending notifications to:', recipients.map(r => `${r.first_name} ${r.last_name}`));
      
      // Send notifications (email + push)
      const notificationType = selectedWO.priority === 'emergency' ? 
        'emergency_work_order' : 'work_order_assigned';
      
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: notificationType,
          recipients,
          workOrder: {
            wo_id: selectedWO.wo_id,
            wo_number: selectedWO.wo_number,
            building: selectedWO.building,
            priority: selectedWO.priority,
            work_order_description: selectedWO.work_order_description
          }
        })
      });
      
      const result = await response.json();
      console.log('Notification result:', result);
      
      // Show summary if there were failures
      if (result.summary) {
        const { email, push } = result.summary;
        if (email.failed > 0 || push.failed > 0) {
          console.warn(`Notifications: Email ${email.sent}/${email.sent + email.failed}, Push ${push.sent}/${push.sent + push.failed}`);
        }
      }
      
    } catch (error) {
      console.error('Error sending notifications:', error);
      // Don't throw - notification failure shouldn't block assignment
    }
  };

  const handleUnassignFromField = async () => {
    if (!confirm('Remove this work order from field workers?\n\nThis will hide it from the mobile app.')) {
      return;
    }

    try {
      await unassignFromField(supabase, selectedWO.wo_id);
      alert('✅ Work order removed from field workers!');
      onClose();
      refreshWorkOrders();
    } catch (error) {
      alert('❌ Error unassigning from field: ' + error.message);
    }
  };

  const handleRemoveTeamMember = async (assignmentId) => {
    if (!confirm('Remove this team member?')) return;
    
    try {
      await removeTeamMember(supabase, assignmentId);
      alert('✅ Team member removed');
      const updatedMembers = selectedWO.teamMembers.filter(m => m.assignment_id !== assignmentId);
      setSelectedWO({ ...selectedWO, teamMembers: updatedMembers });
    } catch (error) {
      alert('Failed to remove team member: ' + error.message);
    }
  };

  // Handle deleting customer signature
  const handleDeleteSignature = async () => {
    const password = prompt('Enter admin password to delete signature:');
    if (password !== adminPassword) {
      alert('❌ Incorrect password');
      return;
    }

    if (!confirm('Delete the customer signature?\n\nThis will remove:\n- Signature image\n- Customer name\n- Signature date\n- GPS location\n\nThis cannot be undone. Continue?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('work_orders')
        .update({
          customer_signature: null,
          customer_name: null,
          signature_date: null,
          signature_location: null
        })
        .eq('wo_id', selectedWO.wo_id);

      if (error) throw error;

      setSelectedWO({
        ...selectedWO,
        customer_signature: null,
        customer_name: null,
        signature_date: null,
        signature_location: null
      });
      refreshWorkOrders();
      alert('✅ Signature deleted successfully');
    } catch (error) {
      alert('Failed to delete signature: ' + error.message);
    }
  };

  const handleGenerateInvoice = async () => {
    if (!confirm('Generate invoice for this work order?\n\nThis will:\n- Create a draft invoice\n- Lock the work order\n- Send to invoicing for review\n\nContinue?')) {
      return;
    }

    setGeneratingInvoice(true);

    try {
      const response = await fetch('/api/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wo_id: selectedWO.wo_id })
      });

      const result = await response.json();

      if (result.success) {
        alert('✅ Invoice generated successfully!\n\nThe work order is now locked and ready for review in the Invoicing section.');
        onClose();
        refreshWorkOrders();
      } else {
        alert('❌ Error generating invoice:\n' + result.error);
      }
    } catch (error) {
      alert('❌ Failed to generate invoice');
    } finally {
      setGeneratingInvoice(false);
    }
  };

  // Format date/time helper
  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Get all available team members (lead tech + team members)
  const getAvailableWorkers = () => {
    const workers = [];
    
    // Add lead tech if exists
    if (selectedWO.lead_tech_id) {
      const leadTech = users.find(u => u.user_id === selectedWO.lead_tech_id);
      if (leadTech) {
        workers.push({ ...leadTech, role_label: 'Lead Tech' });
      }
    }
    
    // Add team members
    (selectedWO.teamMembers || []).forEach(member => {
      if (member.user) {
        workers.push({ 
          user_id: member.user_id, 
          first_name: member.user.first_name, 
          last_name: member.user.last_name,
          role_label: 'Team Member'
        });
      }
    });

    // Also add all techs/helpers from users list for flexibility
    users.filter(u => ['tech', 'helper', 'lead_tech'].includes(u.role)).forEach(user => {
      if (!workers.find(w => w.user_id === user.user_id)) {
        workers.push({ ...user, role_label: user.role.replace('_', ' ') });
      }
    });

    return workers;
  };

  // Download Completion Certificate
  // Download Completion Certificate - MATCHES MOBILE APP VERSION
  const downloadCompletionCertificate = () => {
    const completionDate = selectedWO.date_completed ? formatDateTime(selectedWO.date_completed) : formatDateTime(new Date().toISOString());
    const signatureDateTime = selectedWO.signature_date ? formatDateTime(selectedWO.signature_date) : 'N/A';
    
    // Parse GPS location if available
    let locationDisplay = '';
    if (selectedWO.signature_location) {
      const [lat, lng] = selectedWO.signature_location.split(',');
      locationDisplay = `${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}`;
    }
    
    // Escape HTML in comments to prevent XSS
    const escapedComments = (selectedWO.comments || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    const escapedDescription = (selectedWO.work_order_description || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Work Order Completion Certificate - ${selectedWO.wo_number}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 40px; background: white; color: #333; }
          .certificate { max-width: 800px; margin: 0 auto; border: 3px solid #1e40af; padding: 40px; background: white; }
          .header { text-align: center; border-bottom: 2px solid #1e40af; padding-bottom: 20px; margin-bottom: 30px; }
          .header h1 { color: #1e40af; font-size: 24px; margin-bottom: 10px; }
          .header .company { font-size: 18px; color: #666; }
          .badge { display: inline-block; background: #22c55e; color: white; padding: 8px 20px; border-radius: 20px; font-weight: bold; margin-top: 15px; }
          .section { margin-bottom: 25px; }
          .section-title { font-size: 14px; color: #1e40af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; font-weight: bold; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
          .info-item { padding: 10px; background: #f9fafb; border-radius: 6px; }
          .info-label { font-size: 11px; color: #666; text-transform: uppercase; margin-bottom: 4px; }
          .info-value { font-size: 14px; font-weight: 600; color: #333; }
          .description-box { background: #f9fafb; border-radius: 8px; padding: 15px; margin-top: 10px; }
          .description-text { font-size: 14px; line-height: 1.6; color: #333; }
          .comments-box { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 15px; margin-top: 10px; max-height: 200px; overflow-y: auto; }
          .comments-text { font-size: 12px; line-height: 1.5; color: #333; white-space: pre-wrap; font-family: inherit; }
          .signature-section { margin-top: 30px; padding-top: 25px; border-top: 2px solid #1e40af; }
          .signature-grid { display: grid; grid-template-columns: auto 1fr; gap: 30px; align-items: start; }
          .signature-image { border: 2px solid #e5e7eb; padding: 10px; background: #f9fafb; border-radius: 8px; }
          .signature-image img { max-width: 250px; height: auto; display: block; }
          .signature-details { }
          .signature-item { margin-bottom: 12px; }
          .signature-label { font-size: 11px; color: #666; text-transform: uppercase; margin-bottom: 2px; }
          .signature-value { font-size: 14px; font-weight: 600; color: #333; }
          .location-link { color: #1e40af; text-decoration: none; }
          .location-link:hover { text-decoration: underline; }
          .verification { background: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 15px; margin-top: 20px; text-align: center; }
          .verification-text { color: #166534; font-weight: bold; font-size: 14px; }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 11px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
          @media print { 
            body { padding: 20px; } 
            .certificate { border: 2px solid #1e40af; } 
            .no-print { display: none; }
            .comments-box { max-height: none; }
          }
        </style>
      </head>
      <body>
        <div class="certificate">
          <div class="header">
            <h1>WORK ORDER COMPLETION CERTIFICATE</h1>
            <div class="company">EMF Contracting LLC</div>
            <div class="badge">✓ COMPLETED</div>
          </div>
          
          <!-- Work Order Info -->
          <div class="section">
            <div class="section-title">Work Order Information</div>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Work Order #</div>
                <div class="info-value">${selectedWO.wo_number}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Building</div>
                <div class="info-value">${selectedWO.building || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Requestor</div>
                <div class="info-value">${selectedWO.requestor || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Date Completed</div>
                <div class="info-value">${completionDate}</div>
              </div>
            </div>
          </div>
          
          <!-- Job Description -->
          <div class="section">
            <div class="section-title">Job Description</div>
            <div class="description-box">
              <p class="description-text">${escapedDescription || 'No description provided'}</p>
            </div>
          </div>
          
          <!-- Comments/Notes -->
          ${selectedWO.comments ? `
          <div class="section">
            <div class="section-title">Work Notes & Comments</div>
            <div class="comments-box">
              <div class="comments-text">${escapedComments}</div>
            </div>
          </div>
          ` : ''}
          
          <!-- Signature Section -->
          ${selectedWO.customer_signature ? `
            <div class="signature-section">
              <div class="section-title">Customer Verification & Signature</div>
              <div class="signature-grid">
                <div class="signature-image">
                  <img src="${selectedWO.customer_signature}" alt="Customer Signature" />
                </div>
                <div class="signature-details">
                  <div class="signature-item">
                    <div class="signature-label">Signed By</div>
                    <div class="signature-value">${selectedWO.customer_name || 'N/A'}</div>
                  </div>
                  <div class="signature-item">
                    <div class="signature-label">Date & Time Signed</div>
                    <div class="signature-value">${signatureDateTime}</div>
                  </div>
                  ${locationDisplay ? `
                  <div class="signature-item">
                    <div class="signature-label">Location (GPS)</div>
                    <div class="signature-value">
                      <a href="https://www.google.com/maps?q=${selectedWO.signature_location}" target="_blank" class="location-link">
                        📍 ${locationDisplay}
                      </a>
                    </div>
                  </div>
                  ` : ''}
                </div>
              </div>
              <div class="verification">
                <span class="verification-text">✓ Work completed and verified by customer signature</span>
              </div>
            </div>
          ` : `
            <div class="section">
              <div class="section-title">Signature</div>
              <p style="color: #666; font-style: italic;">No customer signature on file</p>
            </div>
          `}
          
          <div class="footer">
            <p><strong>EMF Contracting LLC</strong></p>
            <p>Certificate Generated: ${new Date().toLocaleString()}</p>
          </div>
        </div>
        
        <div class="no-print" style="text-align: center; margin-top: 30px;">
          <button onclick="window.print()" style="background: #1e40af; color: white; padding: 15px 40px; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; margin-right: 10px;">
            🖨️ Print Certificate
          </button>
          <button onclick="window.close()" style="background: #6b7280; color: white; padding: 15px 40px; border: none; border-radius: 8px; font-size: 16px; cursor: pointer;">
            Close
          </button>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Unable to open window. Please check popup settings.');
      return;
    }
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Calculate cost summary with daily hours
  const calculateCostSummaryWithDailyHours = () => {
    // Legacy hours from work_orders table
    const legacyRT = parseFloat(selectedWO.hours_regular) || 0;
    const legacyOT = parseFloat(selectedWO.hours_overtime) || 0;
    const legacyMiles = parseFloat(selectedWO.miles) || 0;

    // Legacy team hours
    let legacyTeamRT = 0, legacyTeamOT = 0, legacyTeamMiles = 0;
    (selectedWO.teamMembers || []).forEach(m => {
      legacyTeamRT += parseFloat(m.hours_regular) || 0;
      legacyTeamOT += parseFloat(m.hours_overtime) || 0;
      legacyTeamMiles += parseFloat(m.miles) || 0;
    });

    // Combined totals
    const totalRT = legacyRT + legacyTeamRT + dailyTotals.totalRT;
    const totalOT = legacyOT + legacyTeamOT + dailyTotals.totalOT;
    const totalMiles = legacyMiles + legacyTeamMiles + dailyTotals.totalMiles;

    const adminHours = 2;
    const laborCost = (totalRT * 64) + (totalOT * 96) + (adminHours * 64);

    const materialBase = parseFloat(selectedWO.material_cost) || 0;
    const materialWithMarkup = materialBase * 1.25;
    const equipmentBase = parseFloat(selectedWO.emf_equipment_cost) || 0;
    const equipmentWithMarkup = equipmentBase * 1.25;
    const trailerBase = parseFloat(selectedWO.trailer_cost) || 0;
    const trailerWithMarkup = trailerBase * 1.25;
    const rentalBase = parseFloat(selectedWO.rental_cost) || 0;
    const rentalWithMarkup = rentalBase * 1.25;
    const mileageCost = totalMiles * 1.00;

    const grandTotal = laborCost + materialWithMarkup + equipmentWithMarkup + trailerWithMarkup + rentalWithMarkup + mileageCost;
    const remaining = (selectedWO.nte || 0) - grandTotal;

    return {
      totalRT,
      totalOT,
      totalMiles,
      laborCost,
      materialBase,
      materialWithMarkup,
      equipmentBase,
      equipmentWithMarkup,
      trailerBase,
      trailerWithMarkup,
      rentalBase,
      rentalWithMarkup,
      mileageCost,
      grandTotal,
      remaining,
      isOverBudget: remaining < 0,
      hasLegacy: (legacyRT + legacyOT + legacyMiles + legacyTeamRT + legacyTeamOT + legacyTeamMiles) > 0,
      hasDaily: dailyTotals.totalRT + dailyTotals.totalOT + dailyTotals.totalMiles > 0
    };
  };

  const costSummary = calculateCostSummaryWithDailyHours();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-800 rounded-lg max-w-6xl w-full my-8">
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex justify-between items-start z-10 rounded-t-lg">
          <div>
            <h2 className="text-2xl font-bold">{selectedWO.wo_number}</h2>
            <div className="flex gap-2 mt-2 flex-wrap">
              {selectedWO.acknowledged && (
                <div className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm inline-block">
                  ✅ Acknowledged
                </div>
              )}
              {selectedWO.is_locked && (
                <div className="bg-red-900 text-red-200 px-3 py-1 rounded-lg text-sm inline-block">
                  🔒 Locked
                </div>
              )}
              {selectedWO.customer_signature && (
                <div className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm inline-block">
                  ✍️ Signed
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={downloadCompletionCertificate}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-semibold"
            >
              📄 Completion Cert
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-3xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Work Order #</label>
              <input
                type="text"
                value={selectedWO.wo_number}
                onChange={(e) => setSelectedWO({ ...selectedWO, wo_number: e.target.value })}
                onBlur={() => handleUpdateField('wo_number', selectedWO.wo_number)}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Date & Time Entered</label>
              <input
                type="datetime-local"
                value={(() => {
                  if (!selectedWO.date_entered) return '';
                  const date = new Date(selectedWO.date_entered);
                  if (isNaN(date.getTime())) return '';
                  return date.toISOString().slice(0, 16);
                })()}
                onChange={(e) => setSelectedWO({ ...selectedWO, date_entered: new Date(e.target.value).toISOString() })}
                onBlur={() => handleUpdateField('date_entered', selectedWO.date_entered)}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Building</label>
            <input
              type="text"
              value={selectedWO.building}
              onChange={(e) => setSelectedWO({ ...selectedWO, building: e.target.value })}
              onBlur={() => handleUpdateField('building', selectedWO.building)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              value={selectedWO.work_order_description}
              onChange={(e) => setSelectedWO({ ...selectedWO, work_order_description: e.target.value })}
              onBlur={() => handleUpdateField('work_order_description', selectedWO.work_order_description)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
              rows="3"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Requestor</label>
            <input
              type="text"
              value={selectedWO.requestor || ''}
              onChange={(e) => setSelectedWO({ ...selectedWO, requestor: e.target.value })}
              onBlur={() => handleUpdateField('requestor', selectedWO.requestor)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
            />
          </div>

          {/* Status, Priority, Lead Tech */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Work Status</label>
              <select
                value={selectedWO.status}
                onChange={(e) => handleUpdateStatus(e.target.value)}
                disabled={selectedWO.is_locked || selectedWO.acknowledged}
                className={`w-full px-4 py-2 rounded-lg font-semibold ${getStatusColor(selectedWO.status)} ${
                  (selectedWO.is_locked || selectedWO.acknowledged) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <option value="pending">Pending</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="needs_return">Needs Return</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Priority</label>
              <select
                value={selectedWO.priority}
                onChange={(e) => handleUpdateField('priority', e.target.value)}
                className={`w-full px-4 py-2 rounded-lg font-semibold ${getPriorityColor(selectedWO.priority)}`}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Lead Tech</label>
              <select
                value={selectedWO.lead_tech_id || ''}
                onChange={(e) => handleUpdateField('lead_tech_id', e.target.value || null)}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
              >
                <option value="">Unassigned</option>
                {users.filter(u => u.role === 'lead_tech' || u.role === 'admin').map(user => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.first_name} {user.last_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* CBRE Status - Synced from Gmail Labels */}
          <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <label className="block text-sm text-gray-300 font-semibold mb-1">📧 CBRE Status</label>
                <p className="text-xs text-gray-400">Status from Gmail labels (auto-synced or manual)</p>
              </div>
              <select
                value={selectedWO.cbre_status || ''}
                onChange={(e) => handleUpdateField('cbre_status', e.target.value || null)}
                className={`px-4 py-2 rounded-lg font-semibold ${
                  selectedWO.cbre_status === 'escalation' ? 'bg-red-600 text-white' :
                  selectedWO.cbre_status === 'quote_rejected' ? 'bg-red-700 text-white' :
                  selectedWO.cbre_status === 'invoice_rejected' ? 'bg-red-800 text-white' :
                  selectedWO.cbre_status === 'cancelled' ? 'bg-gray-600 text-white' :
                  selectedWO.cbre_status === 'pending_quote' ? 'bg-orange-600 text-white' :
                  selectedWO.cbre_status === 'quote_submitted' ? 'bg-blue-600 text-white' :
                  selectedWO.cbre_status === 'quote_approved' ? 'bg-green-600 text-white' :
                  selectedWO.cbre_status === 'reassigned' ? 'bg-purple-600 text-white' :
                  'bg-gray-600 text-white'
                }`}
              >
                <option value="">— No CBRE Status —</option>
                <option value="escalation">🚨 Escalation</option>
                <option value="pending_quote">📋 Pending Quote</option>
                <option value="quote_submitted">📤 Quote Submitted</option>
                <option value="quote_approved">✅ Quote Approved</option>
                <option value="quote_rejected">❌ Quote Rejected</option>
                <option value="reassigned">🔄 Reassigned</option>
                <option value="invoice_rejected">❌ Invoice Rejected</option>
                <option value="cancelled">🚫 Cancelled</option>
              </select>
            </div>
            {selectedWO.cbre_status === 'escalation' && (
              <div className="mt-3 bg-red-800/50 rounded p-2 text-sm text-red-200 animate-pulse">
                🚨 ESCALATION - This ticket requires immediate attention!
              </div>
            )}
            {selectedWO.cbre_status === 'quote_rejected' && (
              <div className="mt-3 bg-red-800/50 rounded p-2 text-sm text-red-200">
                ❌ Quote was rejected by CBRE. Review and resubmit if needed.
              </div>
            )}
            {selectedWO.cbre_status === 'pending_quote' && (
              <div className="mt-3 bg-orange-800/50 rounded p-2 text-sm text-orange-200">
                📋 This ticket requires a CBRE quote submission.
              </div>
            )}
            {selectedWO.cbre_status === 'invoice_rejected' && (
              <div className="mt-3 bg-red-800/50 rounded p-2 text-sm text-red-200">
                ❌ Invoice was rejected by CBRE. Review the invoice and resubmit.
              </div>
            )}
            {selectedWO.cbre_status === 'cancelled' && (
              <div className="mt-3 bg-gray-700/50 rounded p-2 text-sm text-gray-200">
                🚫 This work order has been cancelled by CBRE.
              </div>
            )}
            {selectedWO.cbre_status_updated_at && (
              <div className="mt-2 text-xs text-gray-500">
                Last updated: {new Date(selectedWO.cbre_status_updated_at).toLocaleString()}
              </div>
            )}
          </div>

          {/* Customer Signature Section */}
          {selectedWO.customer_signature && (
            <div className="bg-green-900 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-lg text-green-300">✍️ Customer Signature</h3>
                <button
                  onClick={handleDeleteSignature}
                  className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm font-semibold"
                  title="Delete Signature (Admin Only)"
                >
                  🗑️ Delete Signature
                </button>
              </div>
              <div className="flex gap-4 items-start">
                <div className="bg-white rounded-lg p-3 flex-shrink-0">
                  <img 
                    src={selectedWO.customer_signature} 
                    alt="Customer Signature" 
                    className="max-w-[250px] h-auto"
                  />
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-gray-400 text-sm">Signed By:</span>
                    <p className="font-semibold text-white">{selectedWO.customer_name || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-sm">Signed On:</span>
                    <p className="font-semibold text-white">{formatDateTime(selectedWO.signature_date)}</p>
                  </div>
                  {selectedWO.signature_location && (
                    <div>
                      <span className="text-gray-400 text-sm">Location (GPS):</span>
                      <p className="font-semibold text-white">
                        <a 
                          href={`https://www.google.com/maps?q=${selectedWO.signature_location}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 underline"
                        >
                          📍 View on Map
                        </a>
                      </p>
                    </div>
                  )}
                  <div className="bg-green-800 rounded-lg p-2 mt-2">
                    <p className="text-green-200 text-sm">✓ Work verified and signed by customer</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Daily Hours Log Section - EDITABLE - Compact */}
          <div className="bg-gray-700 rounded-lg p-2 md:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h3 className="font-bold text-sm md:text-base">📅 Daily Hours Log <span className="text-xs text-gray-400 font-normal hidden md:inline">(Admin Editable)</span></h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-green-400 font-bold">{dailyTotals.totalRT.toFixed(1)} RT</span>
                <span className="text-gray-500">|</span>
                <span className="text-xs text-orange-400 font-bold">{dailyTotals.totalOT.toFixed(1)} OT</span>
                <button
                  onClick={() => setShowAddHoursForm(!showAddHoursForm)}
                  className="bg-green-600 hover:bg-green-700 px-2 py-0.5 rounded text-xs font-semibold"
                >
                  + Add
                </button>
              </div>
            </div>

            {/* Add New Hours Form */}
            {showAddHoursForm && (
              <div className="bg-gray-600 rounded-lg p-4 mb-4">
                <h4 className="font-semibold mb-3 text-yellow-400">➕ Add New Hours Entry</h4>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-gray-400">Team Member</label>
                    <select
                      value={newHoursEntry.user_id}
                      onChange={(e) => setNewHoursEntry({ ...newHoursEntry, user_id: e.target.value })}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded mt-1"
                    >
                      <option value="">Select Worker...</option>
                      {getAvailableWorkers().map(worker => (
                        <option key={worker.user_id} value={worker.user_id}>
                          {worker.first_name} {worker.last_name} ({worker.role_label})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Work Date</label>
                    <input
                      type="date"
                      value={newHoursEntry.work_date}
                      onChange={(e) => setNewHoursEntry({ ...newHoursEntry, work_date: e.target.value })}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-gray-400">RT Hours</label>
                    <input
                      type="number"
                      step="0.5"
                      value={newHoursEntry.hours_regular}
                      onChange={(e) => setNewHoursEntry({ ...newHoursEntry, hours_regular: e.target.value })}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded mt-1"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">OT Hours</label>
                    <input
                      type="number"
                      step="0.5"
                      value={newHoursEntry.hours_overtime}
                      onChange={(e) => setNewHoursEntry({ ...newHoursEntry, hours_overtime: e.target.value })}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded mt-1"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Miles</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newHoursEntry.miles}
                      onChange={(e) => setNewHoursEntry({ ...newHoursEntry, miles: e.target.value })}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded mt-1"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="text-xs text-gray-400">Notes (optional)</label>
                  <input
                    type="text"
                    value={newHoursEntry.notes}
                    onChange={(e) => setNewHoursEntry({ ...newHoursEntry, notes: e.target.value })}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded mt-1"
                    placeholder="Add notes..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddHoursEntry}
                    disabled={savingHours}
                    className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded font-semibold disabled:bg-gray-500"
                  >
                    {savingHours ? 'Saving...' : '✓ Add Entry'}
                  </button>
                  <button
                    onClick={() => setShowAddHoursForm(false)}
                    className="bg-gray-500 hover:bg-gray-600 px-4 py-2 rounded font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {loadingHours ? (
              <div className="text-center py-2 text-gray-400 text-xs">Loading...</div>
            ) : dailyHoursLog.length === 0 ? (
              <div className="text-center py-2 text-gray-500 text-xs">
                No hours logged yet
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {dailyHoursLog.map((entry) => {
                  // FIXED: Use log_id as the unique identifier
                  const entryId = entry.log_id || entry.id;
                  
                  return (
                    <div key={entryId} className="bg-gray-600 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-semibold text-white">
                            {entry.user?.first_name} {entry.user?.last_name}
                          </span>
                          <span className="text-gray-400 text-sm ml-2">
                            {/* FIXED: Use parseLocalDate to prevent timezone shift */}
                            {parseLocalDate(entry.work_date).toLocaleDateString('en-US', { 
                              weekday: 'short', 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </span>
                          {entry.notes?.includes('[MIGRATED]') && (
                            <span className="text-yellow-400 text-xs ml-2">📋 Migrated</span>
                          )}
                          {entry.notes?.includes('[Added by Admin]') && (
                            <span className="text-blue-400 text-xs ml-2">👤 Admin Added</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteDailyHours(entryId)}
                          disabled={savingHours}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          🗑️
                        </button>
                      </div>
                      
                      {/* Editable Fields - FIXED: Each entry uses its own log_id for state */}
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-gray-400">RT Hours</label>
                          <input
                            type="number"
                            step="0.5"
                            value={getHoursFieldValue(entryId, 'hours_regular', entry.hours_regular || 0)}
                            onChange={(e) => handleHoursFieldChange(entryId, 'hours_regular', e.target.value)}
                            onBlur={(e) => handleUpdateDailyHours(entryId, 'hours_regular', parseFloat(e.target.value) || 0)}
                            disabled={savingHours}
                            className="w-full bg-gray-700 text-white px-2 py-1 rounded mt-1 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400">OT Hours</label>
                          <input
                            type="number"
                            step="0.5"
                            value={getHoursFieldValue(entryId, 'hours_overtime', entry.hours_overtime || 0)}
                            onChange={(e) => handleHoursFieldChange(entryId, 'hours_overtime', e.target.value)}
                            onBlur={(e) => handleUpdateDailyHours(entryId, 'hours_overtime', parseFloat(e.target.value) || 0)}
                            disabled={savingHours}
                            className="w-full bg-gray-700 text-white px-2 py-1 rounded mt-1 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400">Miles</label>
                          <input
                            type="number"
                            step="0.1"
                            value={getHoursFieldValue(entryId, 'miles', entry.miles || 0)}
                            onChange={(e) => handleHoursFieldChange(entryId, 'miles', e.target.value)}
                            onBlur={(e) => handleUpdateDailyHours(entryId, 'miles', parseFloat(e.target.value) || 0)}
                            disabled={savingHours}
                            className="w-full bg-gray-700 text-white px-2 py-1 rounded mt-1 text-sm"
                          />
                        </div>
                      </div>

                      {/* Labor Cost Display */}
                      <div className="mt-2 flex justify-between text-xs">
                        <span className="text-gray-400">
                          Labor: ${(((parseFloat(entry.hours_regular) || 0) * 64) + ((parseFloat(entry.hours_overtime) || 0) * 96)).toFixed(2)}
                        </span>
                        {entry.notes && !entry.notes.includes('[MIGRATED]') && !entry.notes.includes('[Added by Admin]') && (
                          <span className="text-gray-400">📝 {entry.notes}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* NTE INCREASES SECTION - Compact */}
          <div className="bg-yellow-900 rounded-lg p-2 md:p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-sm md:text-base text-yellow-300">💰 NTE Increase Requests</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowNTEModal(true)}
                  className="bg-green-600 hover:bg-green-700 px-2 py-0.5 rounded text-xs font-semibold"
                >
                  + Create
                </button>
                <button
                  onClick={loadNteIncreases}
                  className="text-yellow-400 hover:text-yellow-300 text-xs"
                >
                  🔄
                </button>
              </div>
            </div>

            {loadingNteIncreases ? (
              <div className="text-center py-2 text-gray-400 text-xs">Loading...</div>
            ) : nteIncreases.length === 0 ? (
              <div className="text-center py-2 text-gray-400 text-xs">
                No NTE increase requests
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {nteIncreases.map((quote) => (
                  <div key={quote.quote_id} className="bg-gray-700 rounded-lg p-4">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className={`inline-block px-3 py-1 rounded text-xs font-bold mr-2 ${
                          quote.is_verbal_nte 
                            ? 'bg-yellow-600 text-yellow-100' 
                            : 'bg-blue-600 text-blue-100'
                        }`}>
                          {quote.is_verbal_nte ? '📞 Verbal NTE' : '📄 Written NTE'}
                        </span>
                        <span className="text-gray-400 text-sm">
                          {new Date(quote.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => printNTEIncrease(quote)}
                          className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs"
                          title="Print"
                        >
                          🖨️
                        </button>
                        <button
                          onClick={() => setEditingNTE(editingNTE === quote.quote_id ? null : quote.quote_id)}
                          className="bg-yellow-600 hover:bg-yellow-700 px-2 py-1 rounded text-xs"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteNTEIncrease(quote.quote_id)}
                          disabled={savingNTE}
                          className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Verbal Approval Info */}
                    {quote.is_verbal_nte && (
                      <div className="mb-3">
                        <label className="text-xs text-gray-400">Approved By:</label>
                        {editingNTE === quote.quote_id ? (
                          <input
                            type="text"
                            value={quote.verbal_approved_by || ''}
                            onChange={(e) => {
                              const updated = nteIncreases.map(q => 
                                q.quote_id === quote.quote_id ? { ...q, verbal_approved_by: e.target.value } : q
                              );
                              setNteIncreases(updated);
                            }}
                            onBlur={(e) => handleUpdateNTEIncrease(quote.quote_id, { verbal_approved_by: e.target.value })}
                            className="w-full bg-gray-600 text-white px-3 py-1 rounded mt-1 text-sm"
                          />
                        ) : (
                          <p className="text-yellow-300">{quote.verbal_approved_by || 'Not specified'}</p>
                        )}
                      </div>
                    )}

                    {/* Description */}
                    {(quote.description || editingNTE === quote.quote_id) && (
                      <div className="mb-3">
                        <label className="text-xs text-gray-400">Description:</label>
                        {editingNTE === quote.quote_id ? (
                          <textarea
                            value={quote.description || ''}
                            onChange={(e) => {
                              const updated = nteIncreases.map(q => 
                                q.quote_id === quote.quote_id ? { ...q, description: e.target.value } : q
                              );
                              setNteIncreases(updated);
                            }}
                            onBlur={(e) => handleUpdateNTEIncrease(quote.quote_id, { description: e.target.value })}
                            className="w-full bg-gray-600 text-white px-3 py-2 rounded mt-1 text-sm"
                            rows="2"
                          />
                        ) : (
                          <p className="text-gray-300 text-sm">{quote.description}</p>
                        )}
                      </div>
                    )}

                    {/* Cost Fields */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                      <div>
                        <label className="text-xs text-gray-400">Labor Total</label>
                        {editingNTE === quote.quote_id ? (
                          <input
                            type="number"
                            step="0.01"
                            value={quote.labor_total || 0}
                            onChange={(e) => {
                              const updated = nteIncreases.map(q => 
                                q.quote_id === quote.quote_id ? { ...q, labor_total: parseFloat(e.target.value) || 0 } : q
                              );
                              setNteIncreases(updated);
                            }}
                            onBlur={(e) => handleUpdateNTEIncrease(quote.quote_id, { labor_total: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-gray-600 text-white px-2 py-1 rounded mt-1 text-sm"
                          />
                        ) : (
                          <p className="text-white font-semibold">${(quote.labor_total || 0).toFixed(2)}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Materials (w/ markup)</label>
                        {editingNTE === quote.quote_id ? (
                          <input
                            type="number"
                            step="0.01"
                            value={quote.materials_with_markup || 0}
                            onChange={(e) => {
                              const updated = nteIncreases.map(q => 
                                q.quote_id === quote.quote_id ? { ...q, materials_with_markup: parseFloat(e.target.value) || 0 } : q
                              );
                              setNteIncreases(updated);
                            }}
                            onBlur={(e) => handleUpdateNTEIncrease(quote.quote_id, { materials_with_markup: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-gray-600 text-white px-2 py-1 rounded mt-1 text-sm"
                          />
                        ) : (
                          <p className="text-white font-semibold">${(quote.materials_with_markup || 0).toFixed(2)}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Equipment (w/ markup)</label>
                        {editingNTE === quote.quote_id ? (
                          <input
                            type="number"
                            step="0.01"
                            value={quote.equipment_with_markup || 0}
                            onChange={(e) => {
                              const updated = nteIncreases.map(q => 
                                q.quote_id === quote.quote_id ? { ...q, equipment_with_markup: parseFloat(e.target.value) || 0 } : q
                              );
                              setNteIncreases(updated);
                            }}
                            onBlur={(e) => handleUpdateNTEIncrease(quote.quote_id, { equipment_with_markup: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-gray-600 text-white px-2 py-1 rounded mt-1 text-sm"
                          />
                        ) : (
                          <p className="text-white font-semibold">${(quote.equipment_with_markup || 0).toFixed(2)}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Mileage</label>
                        {editingNTE === quote.quote_id ? (
                          <input
                            type="number"
                            step="0.01"
                            value={quote.mileage_total || 0}
                            onChange={(e) => {
                              const updated = nteIncreases.map(q => 
                                q.quote_id === quote.quote_id ? { ...q, mileage_total: parseFloat(e.target.value) || 0 } : q
                              );
                              setNteIncreases(updated);
                            }}
                            onBlur={(e) => handleUpdateNTEIncrease(quote.quote_id, { mileage_total: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-gray-600 text-white px-2 py-1 rounded mt-1 text-sm"
                          />
                        ) : (
                          <p className="text-white font-semibold">${(quote.mileage_total || 0).toFixed(2)}</p>
                        )}
                      </div>
                    </div>

                    {/* NTE Summary - Shows STORED SNAPSHOT values (read-only) */}
                    {/* If snapshot exists, use it. Otherwise fall back to calculation for legacy quotes */}
                    {(() => {
                      // Check if this quote has stored snapshot values (new system)
                      const hasSnapshot = quote.current_costs_snapshot !== null && quote.current_costs_snapshot !== undefined;
                      
                      // Additional work total from quote
                      const additionalTotal = 
                        (parseFloat(quote.labor_total) || 0) +
                        (parseFloat(quote.materials_with_markup) || 0) +
                        (parseFloat(quote.equipment_with_markup) || 0) +
                        (parseFloat(quote.rental_with_markup) || 0) +
                        (parseFloat(quote.trailer_with_markup) || 0) +
                        (parseFloat(quote.mileage_total) || 0);
                      
                      let currentCosts;
                      let newNTENeeded;
                      
                      if (hasSnapshot) {
                        // USE STORED SNAPSHOT VALUES (new system - read-only)
                        currentCosts = parseFloat(quote.current_costs_snapshot) || 0;
                        newNTENeeded = parseFloat(quote.new_nte_amount) || (currentCosts + additionalTotal);
                      } else {
                        // LEGACY: Calculate for old quotes that don't have snapshot
                        let laborRT = 0;
                        let laborOT = 0;
                        let totalMileageFromLogs = 0;
                        
                        if (dailyHoursLog && dailyHoursLog.length > 0) {
                          dailyHoursLog.forEach(log => {
                            laborRT += parseFloat(log.hours_regular) || 0;
                            laborOT += parseFloat(log.hours_overtime) || 0;
                            totalMileageFromLogs += parseFloat(log.miles) || 0;
                          });
                        } else {
                          laborRT = parseFloat(selectedWO.hours_regular) || 0;
                          laborOT = parseFloat(selectedWO.hours_overtime) || 0;
                          totalMileageFromLogs = parseFloat(selectedWO.miles) || 0;
                          
                          (selectedWO.teamMembers || []).forEach(tm => {
                            laborRT += parseFloat(tm.hours_regular) || 0;
                            laborOT += parseFloat(tm.hours_overtime) || 0;
                            totalMileageFromLogs += parseFloat(tm.miles) || 0;
                          });
                        }
                        
                        const laborCost = (laborRT * 64) + (laborOT * 96);
                        const materialsCost = (parseFloat(selectedWO.material_cost) || 0) * 1.25;
                        const equipmentCost = (parseFloat(selectedWO.emf_equipment_cost) || 0) * 1.25;
                        const rentalCost = (parseFloat(selectedWO.rental_cost) || 0) * 1.25;
                        const trailerCost = (parseFloat(selectedWO.trailer_cost) || 0) * 1.25;
                        const mileageCost = totalMileageFromLogs * 1.00;
                        const adminFee = 128;
                        
                        currentCosts = laborCost + materialsCost + equipmentCost + rentalCost + trailerCost + mileageCost + adminFee;
                        newNTENeeded = currentCosts + additionalTotal;
                      }
                      
                      return (
                        <div className="border-t border-gray-600 pt-3 mt-3 space-y-2">
                          {/* Snapshot indicator */}
                          {hasSnapshot && (
                            <div className="text-xs text-gray-500 text-center mb-2">
                              📸 Snapshot from {new Date(quote.created_at).toLocaleDateString()}
                            </div>
                          )}
                          
                          {/* Current Costs */}
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-blue-400">
                              Current Costs {hasSnapshot ? '(at submission)' : 'Accrued'}:
                            </span>
                            <span className="text-blue-400 font-semibold">${currentCosts.toFixed(2)}</span>
                          </div>
                          
                          {/* Additional Work */}
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-yellow-400">+ Additional Work Estimate:</span>
                            <span className="text-yellow-400 font-semibold">${additionalTotal.toFixed(2)}</span>
                          </div>
                          
                          {/* Divider */}
                          <div className="border-t border-gray-500 my-2"></div>
                          
                          {/* New NTE Needed */}
                          <div className="flex justify-between items-center text-lg">
                            <span className="text-green-400 font-bold">NEW NTE:</span>
                            <span className="text-green-400 font-bold">${newNTENeeded.toFixed(2)}</span>
                          </div>
                          
                          {/* Work Order's Current NTE for reference */}
                          <div className="flex justify-between items-center text-xs text-gray-500">
                            <span>Work Order NTE:</span>
                            <span>${(selectedWO.nte || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* NTE Status Dropdown */}
                    <div className="mt-3 pt-3 border-t border-gray-600">
                      <div className="flex justify-between items-center">
                        <label className="text-xs text-gray-400 font-semibold">NTE Status:</label>
                        <select
                          value={quote.nte_status || 'pending'}
                          onChange={(e) => handleUpdateNTEIncrease(quote.quote_id, { nte_status: e.target.value })}
                          disabled={savingNTE}
                          className={`px-3 py-1 rounded text-sm font-bold ${
                            quote.nte_status === 'approved' 
                              ? 'bg-green-600 text-white' 
                              : quote.nte_status === 'verbal_approved'
                              ? 'bg-yellow-600 text-white'
                              : quote.nte_status === 'submitted'
                              ? 'bg-blue-600 text-white'
                              : 'bg-orange-600 text-white'
                          }`}
                        >
                          <option value="pending">📋 Pending - Needs to Send</option>
                          <option value="submitted">📤 Submitted to CBRE</option>
                          <option value="verbal_approved">📞 Verbal Approved</option>
                          <option value="approved">✅ Approved by CBRE</option>
                        </select>
                      </div>
                    </div>

                    {/* Creator Info */}
                    <div className="text-xs text-gray-400 mt-3">
                      Created by: {quote.creator?.first_name} {quote.creator?.last_name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Team Members - Compact */}
          <div className="bg-gray-700 rounded-lg p-2 md:p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-sm md:text-base">👥 Team Members</h3>
              <button
                onClick={() => setShowTeamModal(true)}
                className="bg-blue-600 hover:bg-blue-700 px-2 py-0.5 rounded text-xs font-semibold"
              >
                + Add Team
              </button>
            </div>

            <div className="space-y-2">
              {(!selectedWO.teamMembers || selectedWO.teamMembers.length === 0) ? (
                <div className="text-center text-gray-500 py-2 text-xs">
                  No team members assigned
                </div>
              ) : (
                selectedWO.teamMembers.map(member => (
                  <div key={member.assignment_id} className="bg-gray-600 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold">
                          {member.user?.first_name} {member.user?.last_name}
                        </div>
                        <div className="text-xs text-gray-400">
                          {member.user?.email} • {member.user?.role?.replace('_', ' ').toUpperCase()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveTeamMember(member.assignment_id)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Materials & Equipment */}
          <div className="bg-gray-700 rounded-lg p-4">
            <h3 className="font-bold mb-3 text-lg">🛠️ Materials & Equipment</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Material Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={selectedWO.material_cost || 0}
                  onChange={(e) => setSelectedWO({ ...selectedWO, material_cost: parseFloat(e.target.value) || 0 })}
                  onBlur={() => handleUpdateField('material_cost', selectedWO.material_cost)}
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Equipment Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={selectedWO.emf_equipment_cost || 0}
                  onChange={(e) => setSelectedWO({ ...selectedWO, emf_equipment_cost: parseFloat(e.target.value) || 0 })}
                  onBlur={() => handleUpdateField('emf_equipment_cost', selectedWO.emf_equipment_cost)}
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Trailer Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={selectedWO.trailer_cost || 0}
                  onChange={(e) => setSelectedWO({ ...selectedWO, trailer_cost: parseFloat(e.target.value) || 0 })}
                  onBlur={() => handleUpdateField('trailer_cost', selectedWO.trailer_cost)}
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Rental Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={selectedWO.rental_cost || 0}
                  onChange={(e) => setSelectedWO({ ...selectedWO, rental_cost: parseFloat(e.target.value) || 0 })}
                  onBlur={() => handleUpdateField('rental_cost', selectedWO.rental_cost)}
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Budget & Cost Summary */}
          <div className="bg-gray-700 rounded-lg p-4">
            <h3 className="font-bold mb-3 text-lg">💰 Budget & Cost Summary</h3>

            {(costSummary.hasLegacy && costSummary.hasDaily) && (
              <div className="bg-blue-900 text-blue-200 rounded-lg p-2 mb-3 text-sm text-center">
                ℹ️ Includes legacy hours + daily log entries
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">NTE (Not To Exceed)</label>
                <input
                  type="number"
                  step="0.01"
                  value={selectedWO.nte || ''}
                  onChange={(e) => setSelectedWO({ ...selectedWO, nte: parseFloat(e.target.value) || 0 })}
                  onBlur={() => handleUpdateField('nte', selectedWO.nte)}
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Estimated Invoice Total</label>
                <div className="bg-gray-600 px-4 py-2 rounded-lg font-bold text-2xl text-green-400">
                  ${costSummary.grandTotal.toFixed(2)}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Includes all markups & admin hours
                </div>
              </div>
            </div>

            <div className="bg-blue-900 text-blue-100 rounded-lg p-3 mb-3">
              <div className="font-bold mb-2">LABOR (with 2 Admin Hours)</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Regular Hours ({costSummary.totalRT.toFixed(1)} hrs × $64)</span>
                  <span>${(costSummary.totalRT * 64).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Overtime Hours ({costSummary.totalOT.toFixed(1)} hrs × $96)</span>
                  <span>${(costSummary.totalOT * 96).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-yellow-300">
                  <span>+ Admin Hours</span>
                  <span>2 hrs × $64 = $128.00</span>
                </div>
                <div className="border-t border-blue-700 pt-1 mt-1 flex justify-between font-bold">
                  <span>Total Labor:</span>
                  <span>${costSummary.laborCost.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Materials:</span>
                <span>${costSummary.materialBase.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-yellow-300">
                <span className="text-gray-400">+ 25% Markup:</span>
                <span>= ${costSummary.materialWithMarkup.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Equipment:</span>
                <span>${costSummary.equipmentBase.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-yellow-300">
                <span className="text-gray-400">+ 25% Markup:</span>
                <span>= ${costSummary.equipmentWithMarkup.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Trailer:</span>
                <span>${costSummary.trailerBase.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-yellow-300">
                <span className="text-gray-400">+ 25% Markup:</span>
                <span>= ${costSummary.trailerWithMarkup.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Rental:</span>
                <span>${costSummary.rentalBase.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-yellow-300">
                <span className="text-gray-400">+ 25% Markup:</span>
                <span>= ${costSummary.rentalWithMarkup.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between col-span-2">
                <span className="text-gray-400">Total Mileage:</span>
                <span>{costSummary.totalMiles.toFixed(1)} mi × $1.00 = ${costSummary.mileageCost.toFixed(2)}</span>
              </div>
            </div>

            <div className="border-t border-gray-600 pt-3 mt-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">NTE Budget:</span>
                <span>${(selectedWO.nte || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Remaining:</span>
                <span className={costSummary.isOverBudget ? 'text-red-400 font-bold' : 'text-green-400'}>
                  ${costSummary.remaining.toFixed(2)}
                </span>
              </div>
            </div>

            {costSummary.isOverBudget && (
              <div className="bg-red-900 text-red-200 p-3 rounded-lg mt-3 text-sm">
                ⚠️ Over budget by ${Math.abs(costSummary.remaining).toFixed(2)}
              </div>
            )}
          </div>

          {/* Comments */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Comments / Notes</label>
            <textarea
              value={selectedWO.comments || ''}
              onChange={(e) => setSelectedWO({ ...selectedWO, comments: e.target.value })}
              onBlur={() => handleUpdateField('comments', selectedWO.comments)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
              rows="4"
              placeholder="Add any notes or comments..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-4 border-t border-gray-700">
            {selectedWO.status === 'completed' && !selectedWO.acknowledged && !selectedWO.is_locked && (
              <button
                onClick={handleAcknowledge}
                className="w-full bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-bold text-lg transition"
              >
                ✅ Acknowledge Completion & Lock
              </button>
            )}

            {selectedWO.acknowledged && !selectedWO.is_locked && (
              <div className="bg-blue-900 text-blue-200 p-4 rounded-lg text-center">
                <div className="font-bold">✅ Acknowledged - Ready for Invoice</div>
                <div className="text-sm mt-1">
                  Acknowledged on {new Date(selectedWO.acknowledged_at).toLocaleString()}
                </div>
              </div>
            )}

            {selectedWO.lead_tech_id && !selectedWO.assigned_to_field && (
              <button
                onClick={handleAssignToField}
                className="w-full bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-bold text-lg transition"
              >
                📱 Assign to Field Workers
              </button>
            )}

            {selectedWO.assigned_to_field && (
              <div className="space-y-2">
                <div className="bg-blue-900 text-blue-200 p-4 rounded-lg text-center">
                  <div className="font-bold">📱 Assigned to Field Workers</div>
                  <div className="text-sm mt-1">
                    {selectedWO.assigned_to_field_at && (
                      <>Assigned on {new Date(selectedWO.assigned_to_field_at).toLocaleString()}</>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleUnassignFromField}
                  className="w-full bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-semibold transition"
                >
                  ❌ Remove from Field Workers
                </button>
              </div>
            )}

            {selectedWO.acknowledged && !selectedWO.is_locked && showInvoiceButton && (
              <button
                onClick={handleGenerateInvoice}
                disabled={generatingInvoice}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-bold text-lg transition"
              >
                {generatingInvoice ? '⏳ Generating...' : '📄 Generate Invoice'}
              </button>
            )}

            {selectedWO.is_locked && selectedWO.acknowledged && (
              <div className="bg-purple-900 text-purple-200 p-4 rounded-lg text-center">
                <div className="font-bold">🔒 Invoice Generated</div>
                <div className="text-sm mt-1">
                  <button 
                    onClick={() => window.location.href = '/invoices'}
                    className="underline hover:text-purple-100"
                  >
                    View in Invoicing →
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleDeleteWorkOrder}
              className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-semibold transition"
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      </div>

      {/* Team Member Modal */}
      {showTeamModal && (
        <TeamMemberModal
          workOrder={selectedWO}
          users={users}
          supabase={supabase}
          onClose={() => setShowTeamModal(false)}
          onTeamMemberAdded={(updatedWO) => {
            setSelectedWO(updatedWO);
            setShowTeamModal(false);
          }}
        />
      )}

      {/* NTE Increase Modal */}
      {showNTEModal && (
        <NTEIncreaseModal
          workOrder={selectedWO}
          currentUser={users.find(u => u.role === 'admin' || u.role === 'office_staff')}
          supabase={supabase}
          onClose={() => setShowNTEModal(false)}
          onSave={(newNTE) => {
            setNteIncreases([newNTE, ...nteIncreases]);
            setShowNTEModal(false);
          }}
        />
      )}
    </div>
  );
}
