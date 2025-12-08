'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

export default function InvoicingPage() {
  const [acknowledgedWOs, setAcknowledgedWOs] = useState([]);
  const [woTotals, setWoTotals] = useState({}); // Store calculated totals for each WO
  const [invoices, setInvoices] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ready');
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [previewWO, setPreviewWO] = useState(null);
  const [previewLineItems, setPreviewLineItems] = useState([]);
  const [workPerformedText, setWorkPerformedText] = useState('');
  const [customLineItem, setCustomLineItem] = useState({
    description: '',
    quantity: 1,
    unit_price: 0
  });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchAcknowledgedWorkOrders(),
      fetchInvoices()
    ]);
    setLoading(false);
  };

  const fetchAcknowledgedWorkOrders = async () => {
    console.log('Fetching acknowledged work orders...');
    
    const { data, error } = await supabase
      .from('work_orders')
      .select(`
        *,
        lead_tech:users!lead_tech_id(first_name, last_name, email)
      `)
      .eq('acknowledged', true)
      .eq('is_locked', false)
      .order('acknowledged_at', { ascending: false });

    if (error) {
      console.error('Error fetching acknowledged work orders:', error);
    } else {
      setAcknowledgedWOs(data || []);
      
      // Calculate totals for each work order
      if (data && data.length > 0) {
        calculateAllTotals(data);
      }
    }
  };

  // Calculate totals for all work orders
  const calculateAllTotals = async (workOrders) => {
    const totals = {};
    
    for (const wo of workOrders) {
      try {
        // 1. Legacy totals from work_orders table
        const primaryRT = parseFloat(wo.hours_regular) || 0;
        const primaryOT = parseFloat(wo.hours_overtime) || 0;
        const primaryMiles = parseFloat(wo.miles) || 0;

        // 2. Team member legacy totals from work_order_assignments
        const { data: teamAssignments } = await supabase
          .from('work_order_assignments')
          .select('hours_regular, hours_overtime, miles')
          .eq('wo_id', wo.wo_id);

        let teamRT = 0, teamOT = 0, teamMiles = 0;
        if (teamAssignments) {
          teamAssignments.forEach(member => {
            teamRT += parseFloat(member.hours_regular) || 0;
            teamOT += parseFloat(member.hours_overtime) || 0;
            teamMiles += parseFloat(member.miles) || 0;
          });
        }

        // 3. Daily hours log totals
        const { data: dailyData } = await supabase
          .from('daily_hours_log')
          .select('hours_regular, hours_overtime, miles')
          .eq('wo_id', wo.wo_id);

        let dailyRT = 0, dailyOT = 0, dailyMiles = 0;
        if (dailyData) {
          dailyData.forEach(log => {
            dailyRT += parseFloat(log.hours_regular) || 0;
            dailyOT += parseFloat(log.hours_overtime) || 0;
            dailyMiles += parseFloat(log.miles) || 0;
          });
        }

        // Combined totals
        const totalRT = primaryRT + teamRT + dailyRT;
        const totalOT = primaryOT + teamOT + dailyOT;
        const totalMiles = primaryMiles + teamMiles + dailyMiles;

        // Calculate costs
        const laborCost = (totalRT * 64) + (totalOT * 96) + 128; // +128 for admin hours
        const mileageCost = totalMiles * 1.00;
        const materialWithMarkup = (parseFloat(wo.material_cost) || 0) * 1.25;
        const equipmentWithMarkup = (parseFloat(wo.emf_equipment_cost) || 0) * 1.25;
        const trailerWithMarkup = (parseFloat(wo.trailer_cost) || 0) * 1.25;
        const rentalWithMarkup = (parseFloat(wo.rental_cost) || 0) * 1.25;

        totals[wo.wo_id] = laborCost + mileageCost + materialWithMarkup + equipmentWithMarkup + trailerWithMarkup + rentalWithMarkup;
      } catch (error) {
        console.error('Error calculating total for WO:', wo.wo_id, error);
        totals[wo.wo_id] = 128; // Default to admin hours only
      }
    }
    
    setWoTotals(totals);
  };

  const fetchInvoices = async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        work_order:work_orders(
          wo_number,
          building,
          work_order_description,
          comments,
          lead_tech:users!lead_tech_id(first_name, last_name)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invoices:', error);
    } else {
      setInvoices(data || []);
    }
  };

  const selectWorkOrder = async (wo) => {
    setSelectedItem({ type: 'work_order', data: wo });
  };

  const selectInvoice = async (invoice) => {
    const { data, error } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoice.invoice_id)
      .order('line_item_id', { ascending: true });

    if (error) {
      console.error('Error fetching line items:', error);
    } else {
      setLineItems(data || []);
    }
    
    setSelectedItem({ type: 'invoice', data: invoice });
  };

  const generateInvoicePreview = async (woId) => {
    const wo = acknowledgedWOs.find(w => w.wo_id === woId);
    if (!wo) return;

    setGeneratingInvoice(true);

    try {
      console.log('=== INVOICE PREVIEW DEBUG ===');
      console.log('Work Order ID:', woId);

      // 1. Get legacy totals from work_orders table
      const primaryRT = parseFloat(wo.hours_regular) || 0;
      const primaryOT = parseFloat(wo.hours_overtime) || 0;
      const primaryMiles = parseFloat(wo.miles) || 0;
      console.log('Legacy WO data - RT:', primaryRT, 'OT:', primaryOT, 'Miles:', primaryMiles);

      // 2. Get team member data from work_order_assignments
      const { data: teamAssignments, error: teamError } = await supabase
        .from('work_order_assignments')
        .select(`
          *,
          user:users(first_name, last_name, hourly_rate_regular, hourly_rate_overtime)
        `)
        .eq('wo_id', woId);

      console.log('Team Assignments:', teamAssignments);
      if (teamError) console.error('Team fetch error:', teamError);

      let teamRT = 0, teamOT = 0, teamMiles = 0;
      if (teamAssignments) {
        teamAssignments.forEach(member => {
          teamRT += parseFloat(member.hours_regular) || 0;
          teamOT += parseFloat(member.hours_overtime) || 0;
          teamMiles += parseFloat(member.miles) || 0;
        });
      }
      console.log('Team legacy totals - RT:', teamRT, 'OT:', teamOT, 'Miles:', teamMiles);

      // 3. Get daily hours log data (THIS IS WHERE THE HOURS ACTUALLY ARE!)
      const { data: dailyHoursData, error: dailyError } = await supabase
        .from('daily_hours_log')
        .select('*')
        .eq('wo_id', woId);

      console.log('Daily Hours Log Data:', dailyHoursData);
      if (dailyError) console.error('Daily hours fetch error:', dailyError);

      let dailyRT = 0, dailyOT = 0, dailyMiles = 0;
      if (dailyHoursData) {
        dailyHoursData.forEach(log => {
          dailyRT += parseFloat(log.hours_regular) || 0;
          dailyOT += parseFloat(log.hours_overtime) || 0;
          dailyMiles += parseFloat(log.miles) || 0;
        });
      }
      console.log('Daily log totals - RT:', dailyRT, 'OT:', dailyOT, 'Miles:', dailyMiles);

      // 4. Combined totals (legacy + daily hours)
      const totalRT = primaryRT + teamRT + dailyRT;
      const totalOT = primaryOT + teamOT + dailyOT;
      const totalMiles = primaryMiles + teamMiles + dailyMiles;
      console.log('=== COMBINED TOTALS ===');
      console.log('Total RT:', totalRT, '| Total OT:', totalOT, '| Total Miles:', totalMiles);

      // Build line items
      const items = [];

      // Labor - Combined hours
      if (totalRT > 0) {
        items.push({
          description: `Labor - Regular Time (${totalRT} hrs @ $64/hr)`,
          quantity: totalRT,
          unit_price: 64,
          amount: totalRT * 64,
          line_type: 'labor',
          editable: true
        });
        console.log('Added RT Labor:', totalRT * 64);
      }

      if (totalOT > 0) {
        items.push({
          description: `Labor - Overtime (${totalOT} hrs @ $96/hr)`,
          quantity: totalOT,
          unit_price: 96,
          amount: totalOT * 96,
          line_type: 'labor',
          editable: true
        });
        console.log('Added OT Labor:', totalOT * 96);
      }

      // Admin Hours - ALWAYS ADD
      items.push({
        description: 'Administrative Hours (2 hrs @ $64/hr)',
        quantity: 2,
        unit_price: 64,
        amount: 128,
        line_type: 'labor',
        editable: true
      });
      console.log('Added Admin Hours: 128');

      // Mileage
      if (totalMiles > 0) {
        items.push({
          description: `Mileage (${totalMiles} miles @ $1.00/mile)`,
          quantity: totalMiles,
          unit_price: 1.00,
          amount: totalMiles * 1.00,
          line_type: 'mileage',
          editable: true
        });
        console.log('Added Mileage:', totalMiles);
      }

      // Materials WITH 25% MARKUP
      const materialCost = parseFloat(wo.material_cost) || 0;
      if (materialCost > 0) {
        const markedUpMaterials = materialCost * 1.25;
        items.push({
          description: 'Materials',
          quantity: 1,
          unit_price: markedUpMaterials,
          amount: markedUpMaterials,
          line_type: 'material',
          editable: true
        });
        console.log('Added Materials (with 25% markup):', markedUpMaterials);
      }

      // Equipment WITH 25% MARKUP
      const equipmentCost = parseFloat(wo.emf_equipment_cost) || 0;
      if (equipmentCost > 0) {
        const markedUpEquipment = equipmentCost * 1.25;
        items.push({
          description: 'Equipment',
          quantity: 1,
          unit_price: markedUpEquipment,
          amount: markedUpEquipment,
          line_type: 'equipment',
          editable: true
        });
        console.log('Added Equipment (with 25% markup):', markedUpEquipment);
      }

      // Trailer WITH 25% MARKUP
      const trailerCost = parseFloat(wo.trailer_cost) || 0;
      if (trailerCost > 0) {
        const markedUpTrailer = trailerCost * 1.25;
        items.push({
          description: 'Trailer',
          quantity: 1,
          unit_price: markedUpTrailer,
          amount: markedUpTrailer,
          line_type: 'equipment',
          editable: true
        });
        console.log('Added Trailer (with 25% markup):', markedUpTrailer);
      }

      // Rental WITH 25% MARKUP
      const rentalCost = parseFloat(wo.rental_cost) || 0;
      if (rentalCost > 0) {
        const markedUpRental = rentalCost * 1.25;
        items.push({
          description: 'Rental',
          quantity: 1,
          unit_price: markedUpRental,
          amount: markedUpRental,
          line_type: 'rental',
          editable: true
        });
        console.log('Added Rental (with 25% markup):', markedUpRental);
      }

      // Calculate and log total
      const previewTotal = items.reduce((sum, item) => sum + item.amount, 0);
      console.log('=== PREVIEW TOTAL ===', previewTotal);
      console.log('Number of line items:', items.length);

      // Work Performed - Use tech's comments field
      let workPerformed = '';
      if (wo.comments && wo.comments.trim()) {
        workPerformed = wo.comments;
      } else if (wo.comments_english && wo.comments_english.trim()) {
        workPerformed = wo.comments_english;
      } else {
        workPerformed = wo.work_order_description || 'Work completed as requested.';
      }

      setWorkPerformedText(workPerformed);
      setPreviewWO(wo);
      setPreviewLineItems(items);
      setShowInvoicePreview(true);
      setSelectedItem(null);
      
      console.log('=== PREVIEW COMPLETE ===');
    } catch (error) {
      console.error('Error generating preview:', error);
      alert('❌ Failed to generate preview: ' + error.message);
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const finalizeInvoice = async () => {
    if (!previewWO) return;

    if (!confirm('Finalize and generate this invoice?\n\nThis will lock the work order.')) {
      return;
    }

    setGeneratingInvoice(true);

    try {
      const costItems = previewLineItems.filter(item => item.line_type !== 'description');
      const subtotal = costItems.reduce((sum, item) => sum + item.amount, 0);
      const tax = 0;
      const total = subtotal + tax;

      const year = new Date().getFullYear();
      const { data: lastInvoice } = await supabase
        .from('invoices')
        .select('invoice_number')
        .like('invoice_number', `INV-${year}-%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      let invoiceNumber;
      if (lastInvoice) {
        const lastNumber = parseInt(lastInvoice.invoice_number.split('-')[2]);
        invoiceNumber = `INV-${year}-${String(lastNumber + 1).padStart(5, '0')}`;
      } else {
        invoiceNumber = `INV-${year}-00001`;
      }

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invoiceNumber,
          wo_id: previewWO.wo_id,
          invoice_date: new Date().toISOString(),
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          subtotal: subtotal,
          tax: tax,
          total: total,
          status: 'draft',
          notes: 'Invoice generated from preview'
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      const lineItemsToInsert = [
        ...previewLineItems.map(item => ({
          invoice_id: invoice.invoice_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount,
          line_type: item.line_type
        })),
        {
          invoice_id: invoice.invoice_id,
          description: workPerformedText,
          quantity: 1,
          unit_price: 0,
          amount: 0,
          line_type: 'description'
        }
      ];

      const { error: lineItemsError } = await supabase
        .from('invoice_line_items')
        .insert(lineItemsToInsert);

      if (lineItemsError) throw lineItemsError;

      const { error: lockError } = await supabase
        .from('work_orders')
        .update({
          is_locked: true,
          locked_at: new Date().toISOString(),
          locked_by: null
        })
        .eq('wo_id', previewWO.wo_id);

      if (lockError) throw lockError;

      alert('✅ Invoice generated successfully!\n\nInvoice Total: $' + total.toFixed(2));
      
      setShowInvoicePreview(false);
      setPreviewWO(null);
      setPreviewLineItems([]);
      setWorkPerformedText('');
      setAcknowledgedWOs(prev => prev.filter(wo => wo.wo_id !== previewWO.wo_id));
      await fetchData();
      setActiveTab('invoiced');
    } catch (error) {
      console.error('Error finalizing invoice:', error);
      alert('❌ Failed to generate invoice: ' + error.message);
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const returnToTech = async (woId, invoiceId) => {
    const reason = prompt('Enter reason for returning to tech (optional):');
    
    if (!confirm('Return this work order to the lead tech for review?\n\nThis will:\n- Delete the draft invoice\n- Unlock the work order\n- Remove acknowledgment\n- Change status to "needs_return"\n\nThe tech can make changes and mark as completed again.')) {
      return;
    }

    try {
      const { error: lineItemsError } = await supabase
        .from('invoice_line_items')
        .delete()
        .eq('invoice_id', invoiceId);

      if (lineItemsError) {
        alert('Error deleting invoice line items: ' + lineItemsError.message);
        return;
      }

      const { error: invoiceError } = await supabase
        .from('invoices')
        .delete()
        .eq('invoice_id', invoiceId);

      if (invoiceError) {
        alert('Error deleting invoice: ' + invoiceError.message);
        return;
      }

      if (reason && reason.trim()) {
        await supabase
          .from('work_order_comments')
          .insert({
            wo_id: woId,
            user_id: null,
            comment: `RETURNED FROM INVOICING:\n${reason}`,
            comment_type: 'admin_note'
          });
      }

      const { error: updateError } = await supabase
        .from('work_orders')
        .update({
          is_locked: false,
          locked_at: null,
          locked_by: null,
          acknowledged: false,
          acknowledged_at: null,
          status: 'needs_return'
        })
        .eq('wo_id', woId);

      if (updateError) {
        alert('Error updating work order: ' + updateError.message);
        return;
      }

      alert('✅ Work order returned to tech for review');
      setSelectedItem(null);
      await fetchData();
    } catch (error) {
      alert('❌ Error: ' + error.message);
    }
  };

  const updateInvoiceStatus = async (invoiceId, newStatus) => {
    const { error } = await supabase
      .from('invoices')
      .update({ status: newStatus })
      .eq('invoice_id', invoiceId);

    if (error) {
      alert('Error updating status: ' + error.message);
    } else {
      alert(`✅ Invoice marked as ${newStatus}`);
      await fetchData();
      setSelectedItem(null);
    }
  };

  const deleteInvoice = async (invoiceId, woId) => {
    const adminPassword = prompt('Enter admin password to delete this invoice:');
    
    if (adminPassword !== 'EMF2024!') {
      alert('❌ Invalid admin password');
      return;
    }

    if (!confirm('Are you absolutely sure you want to delete this invoice?\n\nThis will:\n- Delete the invoice and all line items\n- Unlock the work order\n- Remove acknowledgment\n\nThis action CANNOT be undone.')) {
      return;
    }

    try {
      const { error: lineItemsError } = await supabase
        .from('invoice_line_items')
        .delete()
        .eq('invoice_id', invoiceId);

      if (lineItemsError) throw lineItemsError;

      const { error: invoiceError } = await supabase
        .from('invoices')
        .delete()
        .eq('invoice_id', invoiceId);

      if (invoiceError) throw invoiceError;

      const { error: updateError } = await supabase
        .from('work_orders')
        .update({
          is_locked: false,
          locked_at: null,
          locked_by: null,
          acknowledged: false,
          acknowledged_at: null
        })
        .eq('wo_id', woId);

      if (updateError) throw updateError;

      alert('✅ Invoice deleted successfully');
      setSelectedItem(null);
      await fetchData();
    } catch (error) {
      alert('❌ Error deleting invoice: ' + error.message);
    }
  };

  const printInvoice = (invoice) => {
    window.open(`/invoices/${invoice.invoice_id}/print`, '_blank');
  };

  const shareInvoice = async (invoice) => {
    const shareUrl = `${window.location.origin}/invoices/${invoice.invoice_id}/print`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invoice ${invoice.invoice_number}`,
          text: `Invoice for Work Order - Total: $${invoice.total.toFixed(2)}`,
          url: shareUrl
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert('📋 Invoice link copied to clipboard!');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return 'bg-yellow-600';
      case 'approved': return 'bg-blue-600';
      case 'synced': return 'bg-green-600';
      case 'paid': return 'bg-green-600';
      default: return 'bg-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Loading invoices...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">💰 Invoicing</h1>
            <p className="text-gray-400 mt-1">Generate and manage invoices for completed work orders</p>
          </div>
          <div className="flex gap-3">
            <a
              href="/invoices/cbre"
              className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg font-semibold"
            >
              🏢 CBRE Workflow
            </a>
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-700">
          <button
            onClick={() => setActiveTab('ready')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'ready'
                ? 'text-green-400 border-b-2 border-green-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Ready to Invoice ({acknowledgedWOs.length})
          </button>
          <button
            onClick={() => setActiveTab('invoiced')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'invoiced'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Invoices ({invoices.length})
          </button>
        </div>

        {/* Content */}
        {activeTab === 'ready' && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Acknowledged Work Orders - Ready for Invoice</h2>
            
            {acknowledgedWOs.length === 0 ? (
              <div className="text-gray-400 text-center py-8">
                No work orders ready for invoicing.
                <br />
                <span className="text-sm">Work orders must be completed and acknowledged first.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left">WO #</th>
                      <th className="px-4 py-3 text-left">Building</th>
                      <th className="px-4 py-3 text-left">Lead Tech</th>
                      <th className="px-4 py-3 text-left">Acknowledged</th>
                      <th className="px-4 py-3 text-right">Est. Total</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acknowledgedWOs.map(wo => (
                      <tr
                        key={wo.wo_id}
                        className="border-t border-gray-700 hover:bg-gray-700 transition"
                      >
                        <td className="px-4 py-3 font-semibold">{wo.wo_number}</td>
                        <td className="px-4 py-3">{wo.building}</td>
                        <td className="px-4 py-3">
                          {wo.lead_tech ? `${wo.lead_tech.first_name} ${wo.lead_tech.last_name}` : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {wo.acknowledged_at ? new Date(wo.acknowledged_at).toLocaleString() : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-green-400">
                          {woTotals[wo.wo_id] !== undefined 
                            ? `$${woTotals[wo.wo_id].toFixed(2)}`
                            : <span className="text-gray-500">calculating...</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => selectWorkOrder(wo)}
                            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-semibold"
                          >
                            Generate Invoice
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'invoiced' && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Generated Invoices</h2>
            
            {invoices.length === 0 ? (
              <div className="text-gray-400 text-center py-8">
                No invoices generated yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left">Invoice #</th>
                      <th className="px-4 py-3 text-left">Work Order</th>
                      <th className="px-4 py-3 text-left">Building</th>
                      <th className="px-4 py-3 text-left">Invoice Date</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-center">View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(invoice => (
                      <tr
                        key={invoice.invoice_id}
                        onClick={() => selectInvoice(invoice)}
                        className="border-t border-gray-700 hover:bg-gray-700 transition cursor-pointer"
                      >
                        <td className="px-4 py-3 font-semibold">{invoice.invoice_number}</td>
                        <td className="px-4 py-3">{invoice.work_order?.wo_number}</td>
                        <td className="px-4 py-3">{invoice.work_order?.building}</td>
                        <td className="px-4 py-3 text-sm">
                          {new Date(invoice.invoice_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-green-400">
                          ${invoice.total.toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${getStatusColor(invoice.status)}`}>
                            {invoice.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-400">
                          →
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedItem?.type === 'work_order' && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-800 rounded-lg max-w-4xl w-full my-8">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex justify-between items-start z-10 rounded-t-lg">
              <div>
                <h2 className="text-2xl font-bold">Work Order #{selectedItem.data.wo_number}</h2>
                <p className="text-gray-400 text-sm mt-1">
                  {selectedItem.data.building} - Ready for Invoice
                </p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-gray-400 hover:text-white text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="font-bold mb-3">Work Order Details</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-400">Description:</span>
                    <div className="mt-1">{selectedItem.data.work_order_description}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Lead Tech:</span>
                    <span className="ml-2 font-semibold">
                      {selectedItem.data.lead_tech 
                        ? `${selectedItem.data.lead_tech.first_name} ${selectedItem.data.lead_tech.last_name}`
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Acknowledged:</span>
                    <span className="ml-2">{new Date(selectedItem.data.acknowledged_at).toLocaleString()}</span>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <span className="text-gray-400">NTE Budget:</span>
                      <span className="ml-2 font-bold text-yellow-400">${(selectedItem.data.nte || 0).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Est. Invoice Total:</span>
                      <span className="ml-2 font-bold text-green-400">
                        {woTotals[selectedItem.data.wo_id] !== undefined 
                          ? `$${woTotals[selectedItem.data.wo_id].toFixed(2)}`
                          : 'calculating...'
                        }
                      </span>
                    </div>
                  </div>

                  {selectedItem.data.comments && (
                    <div className="mt-4 pt-4 border-t border-gray-600">
                      <span className="text-gray-400">Tech's Work Notes (Work Performed):</span>
                      <div className="mt-2 bg-gray-800 rounded p-3 text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {selectedItem.data.comments}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-blue-900 text-blue-200 p-4 rounded-lg">
                <div className="font-bold mb-2">✓ Ready to Generate Invoice</div>
                <div className="text-sm">
                  Click below to generate an invoice preview. The system will pull all hours from the daily hours log, team assignments, materials, and equipment costs.
                  <ul className="list-disc list-inside mt-2 text-xs">
                    <li>Labor hours from daily_hours_log table will be included</li>
                    <li>Materials, Equipment, Trailer, Rental with 25% markup</li>
                    <li>You can edit line items before finalizing</li>
                  </ul>
                </div>
              </div>

              <button
                onClick={() => generateInvoicePreview(selectedItem.data.wo_id)}
                disabled={generatingInvoice}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-4 rounded-lg font-bold text-lg transition"
              >
                {generatingInvoice ? '⏳ Loading Preview...' : '📄 Preview & Generate Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Preview Modal */}
      {showInvoicePreview && previewWO && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-800 rounded-lg max-w-5xl w-full my-8">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex justify-between items-start z-10 rounded-t-lg">
              <div>
                <h2 className="text-2xl font-bold">📄 Invoice Preview</h2>
                <p className="text-gray-400 text-sm mt-1">
                  WO #{previewWO.wo_number} - {previewWO.building}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowInvoicePreview(false);
                  setPreviewWO(null);
                  setPreviewLineItems([]);
                  setWorkPerformedText('');
                }}
                className="text-gray-400 hover:text-white text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
              
              <div className="bg-blue-900 text-blue-200 p-4 rounded-lg">
                <div className="font-bold mb-2">Review & Edit Line Items</div>
                <div className="text-sm">
                  Review the line items below. You can edit quantities and prices, or add custom line items before finalizing the invoice.
                </div>
              </div>

              {/* Line Items */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="font-bold text-lg mb-4">Line Items</h3>
                
                <div className="space-y-3">
                  {previewLineItems.map((item, index) => (
                    <div 
                      key={index}
                      className="p-4 rounded-lg bg-gray-600"
                    >
                      <div className="grid grid-cols-12 gap-3 items-center">
                        <div className="col-span-5">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => {
                              const updated = [...previewLineItems];
                              updated[index].description = e.target.value;
                              setPreviewLineItems(updated);
                            }}
                            className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => {
                              const updated = [...previewLineItems];
                              updated[index].quantity = parseFloat(e.target.value) || 0;
                              updated[index].amount = updated[index].quantity * updated[index].unit_price;
                              setPreviewLineItems(updated);
                            }}
                            className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm text-right"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => {
                              const updated = [...previewLineItems];
                              updated[index].unit_price = parseFloat(e.target.value) || 0;
                              updated[index].amount = updated[index].quantity * updated[index].unit_price;
                              setPreviewLineItems(updated);
                            }}
                            className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm text-right"
                          />
                        </div>
                        <div className="col-span-2 text-right font-bold">
                          ${item.amount.toFixed(2)}
                        </div>
                        <div className="col-span-1 text-center">
                          <button
                            onClick={() => {
                              setPreviewLineItems(previewLineItems.filter((_, i) => i !== index));
                            }}
                            className="text-red-400 hover:text-red-300 text-lg"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add Custom Line Item */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="font-bold mb-3">➕ Add Custom Line Item</h3>
                
                <div className="grid grid-cols-12 gap-3 items-end">
                  <div className="col-span-6">
                    <label className="block text-xs text-gray-400 mb-1">Description</label>
                    <input
                      type="text"
                      value={customLineItem.description}
                      onChange={(e) => setCustomLineItem({ ...customLineItem, description: e.target.value })}
                      className="w-full bg-gray-600 text-white px-3 py-2 rounded text-sm"
                      placeholder="e.g., Additional Service"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-400 mb-1">Quantity</label>
                    <input
                      type="number"
                      step="0.01"
                      value={customLineItem.quantity}
                      onChange={(e) => setCustomLineItem({ ...customLineItem, quantity: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-gray-600 text-white px-3 py-2 rounded text-sm text-right"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-400 mb-1">Unit Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={customLineItem.unit_price}
                      onChange={(e) => setCustomLineItem({ ...customLineItem, unit_price: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-gray-600 text-white px-3 py-2 rounded text-sm text-right"
                    />
                  </div>
                  <div className="col-span-2">
                    <button
                      onClick={() => {
                        if (!customLineItem.description.trim()) {
                          alert('Please enter a description');
                          return;
                        }
                        
                        const newItem = {
                          description: customLineItem.description,
                          quantity: customLineItem.quantity,
                          unit_price: customLineItem.unit_price,
                          amount: customLineItem.quantity * customLineItem.unit_price,
                          line_type: 'custom',
                          editable: true
                        };
                        
                        setPreviewLineItems([...previewLineItems, newItem]);
                        setCustomLineItem({ description: '', quantity: 1, unit_price: 0 });
                      }}
                      className="w-full bg-green-600 hover:bg-green-700 px-3 py-2 rounded font-bold"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Editable Work Performed Section */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="font-bold text-lg mb-2">📝 Work Performed</h3>
                <p className="text-gray-400 text-sm mb-3">
                  This text (from tech's comments) will appear on the invoice as "Work Performed". Edit as needed.
                </p>
                <textarea
                  value={workPerformedText}
                  onChange={(e) => setWorkPerformedText(e.target.value)}
                  className="w-full bg-gray-600 text-white px-4 py-3 rounded-lg text-sm"
                  rows={8}
                  placeholder="Enter work performed description..."
                />
              </div>

              {/* Totals */}
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex justify-end">
                  <div className="w-80">
                    <div className="flex justify-between py-2 text-lg">
                      <span className="font-semibold">Subtotal:</span>
                      <span>
                        ${previewLineItems
                          .reduce((sum, item) => sum + item.amount, 0)
                          .toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 text-sm text-gray-400">
                      <span>Tax:</span>
                      <span>$0.00</span>
                    </div>
                    <div className="flex justify-between py-3 bg-green-900 px-4 font-bold text-xl border-2 border-green-500 mt-2 rounded">
                      <span>TOTAL:</span>
                      <span className="text-green-400">
                        ${previewLineItems
                          .reduce((sum, item) => sum + item.amount, 0)
                          .toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-700">
                <button
                  onClick={finalizeInvoice}
                  disabled={generatingInvoice}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-4 rounded-lg font-bold text-lg transition"
                >
                  {generatingInvoice ? '⏳ Generating...' : '✅ Finalize & Generate Invoice'}
                </button>
                <button
                  onClick={() => {
                    setShowInvoicePreview(false);
                    setPreviewWO(null);
                    setPreviewLineItems([]);
                    setWorkPerformedText('');
                  }}
                  className="bg-gray-600 hover:bg-gray-700 px-6 py-4 rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedItem?.type === 'invoice' && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-800 rounded-lg max-w-4xl w-full my-8">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex justify-between items-start z-10 rounded-t-lg">
              <div>
                <h2 className="text-2xl font-bold">Invoice #{selectedItem.data.invoice_number}</h2>
                <p className="text-gray-400 text-sm mt-1">
                  WO #{selectedItem.data.work_order?.wo_number} - {selectedItem.data.work_order?.building}
                </p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-gray-400 hover:text-white text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Status:</span>
                    <span className={`ml-2 px-3 py-1 rounded-lg text-xs font-semibold ${getStatusColor(selectedItem.data.status)}`}>
                      {selectedItem.data.status.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Invoice Date:</span>
                    <span className="ml-2 font-semibold">
                      {new Date(selectedItem.data.invoice_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Due Date:</span>
                    <span className="ml-2 font-semibold">
                      {new Date(selectedItem.data.due_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Lead Tech:</span>
                    <span className="ml-2 font-semibold">
                      {selectedItem.data.work_order?.lead_tech 
                        ? `${selectedItem.data.work_order.lead_tech.first_name} ${selectedItem.data.work_order.lead_tech.last_name}`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="font-bold text-lg mb-4">Line Items</h3>
                <div className="space-y-2">
                  {lineItems.map(item => (
                    <div 
                      key={item.line_item_id} 
                      className={`p-3 rounded ${item.line_type === 'description' ? 'bg-gray-800' : 'bg-gray-600'}`}
                    >
                      {item.line_type === 'description' ? (
                        <div>
                          <div className="font-bold mb-2">Work Performed:</div>
                          <div className="text-sm whitespace-pre-wrap">{item.description}</div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-semibold">{item.description}</div>
                            <div className="text-xs text-gray-400 mt-1">
                              {item.line_type?.toUpperCase()}
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <div className="font-bold">${item.amount.toFixed(2)}</div>
                            {item.quantity > 0 && item.unit_price > 0 && (
                              <div className="text-xs text-gray-400">
                                {item.quantity} × ${item.unit_price.toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-700 rounded-lg p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-lg">
                    <span className="text-gray-400">Subtotal:</span>
                    <span className="font-semibold">${selectedItem.data.subtotal.toFixed(2)}</span>
                  </div>
                  {selectedItem.data.tax > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Tax:</span>
                      <span className="font-semibold">${selectedItem.data.tax.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-600 pt-2 flex justify-between text-2xl">
                    <span className="font-bold">Total:</span>
                    <span className="font-bold text-green-400">${selectedItem.data.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => printInvoice(selectedItem.data)}
                    className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg font-semibold transition"
                  >
                    🖨️ Print
                  </button>
                  <button
                    onClick={() => shareInvoice(selectedItem.data)}
                    className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg font-semibold transition"
                  >
                    📤 Share
                  </button>
                </div>
                
                {selectedItem.data.status === 'draft' && (
                  <>
                    <button
                      onClick={() => returnToTech(selectedItem.data.wo_id, selectedItem.data.invoice_id)}
                      className="w-full bg-orange-600 hover:bg-orange-700 px-6 py-3 rounded-lg font-bold text-lg transition"
                    >
                      🔄 Return to Tech for Review
                    </button>
                    
                    <button
                      onClick={() => updateInvoiceStatus(selectedItem.data.invoice_id, 'approved')}
                      className="w-full bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-bold text-lg transition"
                    >
                      ✅ Mark as Approved
                    </button>
                  </>
                )}

                {selectedItem.data.status === 'approved' && (
                  <button
                    onClick={() => updateInvoiceStatus(selectedItem.data.invoice_id, 'synced')}
                    className="w-full bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-bold text-lg transition"
                  >
                    💰 Mark as Synced/Paid
                  </button>
                )}

                <div className="border-t border-gray-600 pt-3 mt-2">
                  <button
                    onClick={() => deleteInvoice(selectedItem.data.invoice_id, selectedItem.data.wo_id)}
                    className="w-full bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-bold text-lg transition"
                  >
                    🗑️ Delete Invoice (Admin)
                  </button>
                  <p className="text-xs text-gray-400 text-center mt-2">
                    ⚠️ Requires admin password. This action cannot be undone.
                  </p>
                </div>

                <button
                  onClick={() => setSelectedItem(null)}
                  className="w-full bg-gray-600 hover:bg-gray-700 px-6 py-3 rounded-lg font-semibold transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
