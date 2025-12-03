// app/dashboard/components/WorkOrderDetailModal.js
'use client';

import { useState, useEffect } from 'react';
import TeamMemberModal from './TeamMemberModal';
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
  const [newHoursEntry, setNewHoursEntry] = useState({
    user_id: '',
    work_date: new Date().toISOString().split('T')[0],
    hours_regular: 0,
    hours_overtime: 0,
    miles: 0,
    notes: ''
  });
  const adminPassword = 'admin123';

  useEffect(() => {
    checkCanGenerateInvoice();
    loadDailyHoursLog();
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

      // Reset form
      setNewHoursEntry({
        user_id: '',
        work_date: new Date().toISOString().split('T')[0],
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
    if (!confirm('Assign this work order to field workers?\n\nThis will make it visible in the mobile app.')) {
      return;
    }

    try {
      await assignToField(supabase, selectedWO.wo_id);
      alert('✅ Work order assigned to field workers!');
      onClose();
      refreshWorkOrders();
    } catch (error) {
      alert('❌ Error assigning to field: ' + error.message);
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
  const downloadCompletionCertificate = () => {
    const leadTech = selectedWO.lead_tech || {};
    const completionDate = selectedWO.date_completed ? formatDateTime(selectedWO.date_completed) : formatDateTime(new Date().toISOString());
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Work Order Completion - ${selectedWO.wo_number}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 40px; background: white; color: #333; }
          .certificate { max-width: 800px; margin: 0 auto; border: 3px solid #1e40af; padding: 40px; background: white; }
          .header { text-align: center; border-bottom: 2px solid #1e40af; padding-bottom: 20px; margin-bottom: 30px; }
          .header h1 { color: #1e40af; font-size: 28px; margin-bottom: 10px; }
          .header .company { font-size: 18px; color: #666; }
          .badge { display: inline-block; background: #22c55e; color: white; padding: 8px 20px; border-radius: 20px; font-weight: bold; margin-top: 15px; }
          .section { margin-bottom: 25px; }
          .section-title { font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
          .section-content { font-size: 16px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
          .info-label { color: #666; font-weight: 500; }
          .info-value { font-weight: bold; color: #333; }
          .signature-section { margin-top: 40px; padding-top: 30px; border-top: 2px solid #1e40af; }
          .signature-box { display: flex; align-items: flex-start; gap: 30px; margin-top: 20px; }
          .signature-image { border: 2px solid #e5e7eb; padding: 10px; background: #f9fafb; border-radius: 8px; }
          .signature-image img { max-width: 300px; height: auto; }
          .signature-details { flex: 1; }
          .signature-details p { margin-bottom: 10px; }
          .verification { background: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 15px; margin-top: 20px; text-align: center; }
          .verification-text { color: #166534; font-weight: bold; }
          .hours-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .hours-table th, .hours-table td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
          .hours-table th { background: #f3f4f6; }
          .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
          @media print { body { padding: 20px; } .certificate { border: 2px solid #1e40af; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="certificate">
          <div class="header">
            <h1>WORK ORDER COMPLETION CERTIFICATE</h1>
            <div class="company">EMF Contracting LLC</div>
            <div class="badge">✓ COMPLETED</div>
          </div>
          
          <div class="section">
            <div class="section-title">Work Order Information</div>
            <div class="grid">
              <div>
                <div class="info-row">
                  <span class="info-label">Work Order #:</span>
                  <span class="info-value">${selectedWO.wo_number}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Building:</span>
                  <span class="info-value">${selectedWO.building || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Requestor:</span>
                  <span class="info-value">${selectedWO.requestor || 'N/A'}</span>
                </div>
              </div>
              <div>
                <div class="info-row">
                  <span class="info-label">Date Entered:</span>
                  <span class="info-value">${formatDate(selectedWO.date_entered)}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Date Completed:</span>
                  <span class="info-value">${completionDate}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">NTE Budget:</span>
                  <span class="info-value">$${(selectedWO.nte || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Work Description</div>
            <div class="section-content">${selectedWO.work_order_description || 'N/A'}</div>
          </div>
          
          <div class="section">
            <div class="section-title">Service Team</div>
            <div class="info-row">
              <span class="info-label">Lead Technician:</span>
              <span class="info-value">${leadTech.first_name || ''} ${leadTech.last_name || ''}</span>
            </div>
            ${(selectedWO.teamMembers || []).map((member, idx) => `
              <div class="info-row">
                <span class="info-label">Team Member ${idx + 1}:</span>
                <span class="info-value">${member.user?.first_name || ''} ${member.user?.last_name || ''}</span>
              </div>
            `).join('')}
          </div>

          <div class="section">
            <div class="section-title">Hours Summary</div>
            <table class="hours-table">
              <tr>
                <th>Category</th>
                <th>Amount</th>
                <th>Rate</th>
                <th>Total</th>
              </tr>
              <tr>
                <td>Regular Hours</td>
                <td>${dailyTotals.totalRT.toFixed(2)} hrs</td>
                <td>$64.00/hr</td>
                <td>$${(dailyTotals.totalRT * 64).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Overtime Hours</td>
                <td>${dailyTotals.totalOT.toFixed(2)} hrs</td>
                <td>$96.00/hr</td>
                <td>$${(dailyTotals.totalOT * 96).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Mileage</td>
                <td>${dailyTotals.totalMiles.toFixed(1)} mi</td>
                <td>$1.00/mi</td>
                <td>$${dailyTotals.totalMiles.toFixed(2)}</td>
              </tr>
            </table>
          </div>
          
          ${selectedWO.customer_signature ? `
            <div class="signature-section">
              <div class="section-title">Customer Acceptance & Signature</div>
              <div class="signature-box">
                <div class="signature-image">
                  <img src="${selectedWO.customer_signature}" alt="Customer Signature" />
                </div>
                <div class="signature-details">
                  <p><strong>Signed By:</strong> ${selectedWO.customer_name || 'N/A'}</p>
                  <p><strong>Date Signed:</strong> ${formatDateTime(selectedWO.signature_date)}</p>
                  <p><strong>Work Order:</strong> ${selectedWO.wo_number}</p>
                </div>
              </div>
              <div class="verification">
                <span class="verification-text">✓ This work order has been verified and signed by the customer</span>
              </div>
            </div>
          ` : `
            <div class="signature-section">
              <div class="section-title">Customer Signature</div>
              <p style="color: #666; margin: 20px 0;">No signature collected</p>
              <div style="margin-top: 30px;">
                <p><strong>Signature:</strong> _________________________________</p>
                <p style="margin-top: 20px;"><strong>Printed Name:</strong> _________________________________</p>
                <p style="margin-top: 20px;"><strong>Date:</strong> _________________________________</p>
              </div>
            </div>
          `}
          
          <div class="footer">
            <p>EMF Contracting LLC - Field Service Management</p>
            <p>This document serves as proof of work completion</p>
            <p>Generated: ${new Date().toLocaleString()}</p>
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
              <label className="block text-sm text-gray-400 mb-1">Status</label>
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

          {/* Customer Signature Section */}
          {selectedWO.customer_signature && (
            <div className="bg-green-900 rounded-lg p-4">
              <h3 className="font-bold mb-3 text-lg text-green-300">✍️ Customer Signature</h3>
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
                  <div className="bg-green-800 rounded-lg p-2 mt-2">
                    <p className="text-green-200 text-sm">✓ Work verified and signed by customer</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Daily Hours Log Section - EDITABLE */}
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-lg">📅 Daily Hours Log (Admin Editable)</h3>
              <div className="flex items-center gap-2">
                <div className="text-sm mr-4">
                  <span className="text-gray-400">Total: </span>
                  <span className="text-green-400 font-bold">{dailyTotals.totalRT.toFixed(1)} RT</span>
                  <span className="text-gray-500 mx-1">|</span>
                  <span className="text-orange-400 font-bold">{dailyTotals.totalOT.toFixed(1)} OT</span>
                  <span className="text-gray-500 mx-1">|</span>
                  <span className="text-blue-400 font-bold">{dailyTotals.totalMiles.toFixed(1)} mi</span>
                </div>
                <button
                  onClick={() => setShowAddHoursForm(!showAddHoursForm)}
                  className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm font-semibold"
                >
                  + Add Hours
                </button>
                <button
                  onClick={loadDailyHoursLog}
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  🔄
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
              <div className="text-center py-4 text-gray-400">Loading hours...</div>
            ) : dailyHoursLog.length === 0 ? (
              <div className="text-center py-4 text-gray-400">
                No daily hours logged yet. Use "Add Hours" button above or field workers can log from mobile app.
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
                            {new Date(entry.work_date).toLocaleDateString('en-US', { 
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

          {/* Team Members */}
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-lg">👥 Team Members</h3>
              <button
                onClick={() => setShowTeamModal(true)}
                className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm font-semibold"
              >
                + Add Team Member
              </button>
            </div>

            <div className="space-y-3">
              {(!selectedWO.teamMembers || selectedWO.teamMembers.length === 0) ? (
                <div className="text-center text-gray-400 py-4 text-sm">
                  No additional team members assigned
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
    </div>
  );
}
