'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

export default function InvoicingPage() {
  const [acknowledgedWOs, setAcknowledgedWOs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ready');
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [previewWO, setPreviewWO] = useState(null);
  const [previewLineItems, setPreviewLineItems] = useState([]);
  const [customLineItem, setCustomLineItem] = useState({
  description: '',
  quantity: 1,
  unit_price: 0
});

  // Initialize Supabase client inside component
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

    console.log('Acknowledged WOs query result:', { data, error });
    console.log('Number of acknowledged WOs:', data?.length || 0);

    if (error) {
      console.error('Error fetching acknowledged work orders:', error);
    } else {
      setAcknowledgedWOs(data || []);
    }
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
    // Fetch team members
    const { data: teamAssignments } = await supabase
      .from('work_order_assignments')
      .select(`
        *,
        user:users(first_name, last_name, hourly_rate_regular, hourly_rate_overtime)
      `)
      .eq('wo_id', woId);

    // Fetch comments
    const { data: comments } = await supabase
      .from('work_order_comments')
      .select(`
        comment,
        created_at,
        user:users(first_name, last_name)
      `)
      .eq('wo_id', woId)
      .eq('comment_type', 'note')
      .order('created_at', { ascending: true });

    // Build line items preview with MARKUPS
const items = [];

// Labor - Lead Tech
const leadRegular = (wo.hours_regular || 0) * 64;
const leadOvertime = (wo.hours_overtime || 0) * 96;

if (wo.hours_regular > 0) {
  items.push({
    description: `Lead Tech Labor - Regular Time (${wo.hours_regular} hrs @ $64/hr)`,
    quantity: wo.hours_regular,
    unit_price: 64,
    amount: leadRegular,
    line_type: 'labor',
    editable: true
  });
}

if (wo.hours_overtime > 0) {
  items.push({
    description: `Lead Tech Labor - Overtime (${wo.hours_overtime} hrs @ $96/hr)`,
    quantity: wo.hours_overtime,
    unit_price: 96,
    amount: leadOvertime,
    line_type: 'labor',
    editable: true
  });
}

// Team member labor
if (teamAssignments && teamAssignments.length > 0) {
  const laborByRole = {};
  
  teamAssignments.forEach(member => {
    const roleTitle = member.role === 'lead_tech' ? 'Tech' : 
                      member.role === 'tech' ? 'Tech' : 
                      'Helper';
    
    if (!laborByRole[roleTitle]) {
      laborByRole[roleTitle] = {
        regular_hours: 0,
        overtime_hours: 0,
        regular_rate: member.user?.hourly_rate_regular || 64,
        overtime_rate: member.user?.hourly_rate_overtime || 96
      };
    }
    
    laborByRole[roleTitle].regular_hours += member.hours_regular || 0;
    laborByRole[roleTitle].overtime_hours += member.hours_overtime || 0;
  });
  
  Object.entries(laborByRole).forEach(([role, data]) => {
    if (data.regular_hours > 0) {
      items.push({
        description: `${role} - Regular Time (${data.regular_hours} hrs @ $${data.regular_rate}/hr)`,
        quantity: data.regular_hours,
        unit_price: data.regular_rate,
        amount: data.regular_hours * data.regular_rate,
        line_type: 'labor',
        editable: true
      });
    }
    if (data.overtime_hours > 0) {
      items.push({
        description: `${role} - Overtime (${data.overtime_hours} hrs @ $${data.overtime_rate}/hr)`,
        quantity: data.overtime_hours,
        unit_price: data.overtime_rate,
        amount: data.overtime_hours * data.overtime_rate,
        line_type: 'labor',
        editable: true
      });
    }
  });
}

// *** ADD ADMIN HOURS HERE ***
items.push({
  description: 'Administrative Hours (2 hrs @ $64/hr)',
  quantity: 2,
  unit_price: 64,
  amount: 128,
  line_type: 'labor',
  editable: true
});

// Mileage
const teamMiles = (teamAssignments || []).reduce((sum, m) => sum + (m.miles || 0), 0);
const totalMiles = (wo.miles || 0) + teamMiles;
if (totalMiles > 0) {
  items.push({
    description: `Mileage (${totalMiles} miles @ $1.00/mile)`,
    quantity: totalMiles,
    unit_price: 1.00,
    amount: totalMiles * 1.00,
    line_type: 'mileage',
    editable: true
  });
}

// Materials WITH 25% MARKUP
if (wo.material_cost > 0) {
  const markedUpMaterials = wo.material_cost * 1.25;
  items.push({
    description: `Materials (Base: $${wo.material_cost.toFixed(2)} + 25% markup)`,
    quantity: 1,
    unit_price: markedUpMaterials,
    amount: markedUpMaterials,
    line_type: 'material',
    editable: true
  });
}

// Equipment WITH 15% MARKUP
if (wo.emf_equipment_cost > 0) {
  const markedUpEquipment = wo.emf_equipment_cost * 1.15;
  items.push({
    description: `Equipment (Base: $${wo.emf_equipment_cost.toFixed(2)} + 15% markup)`,
    quantity: 1,
    unit_price: markedUpEquipment,
    amount: markedUpEquipment,
    line_type: 'equipment',
    editable: true
  });
}

// Trailer (NO MARKUP)
if (wo.trailer_cost > 0) {
  items.push({
    description: 'Trailer',
    quantity: 1,
    unit_price: wo.trailer_cost,
    amount: wo.trailer_cost,
    line_type: 'equipment',
    editable: true
  });
}

// Rental WITH 15% MARKUP
if (wo.rental_cost > 0) {
  const markedUpRental = wo.rental_cost * 1.15;
  items.push({
    description: `Rental (Base: $${wo.rental_cost.toFixed(2)} + 15% markup)`,
    quantity: 1,
    unit_price: markedUpRental,
    amount: markedUpRental,
    line_type: 'rental',
    editable: true
  });
}

// Work Performed Description
let workPerformed = wo.work_order_description;
if (comments && comments.length > 0) {
  workPerformed += '\n\nWork Notes:\n';
  comments.forEach(comment => {
    const timestamp = new Date(comment.created_at).toLocaleString();
    workPerformed += `\n[${timestamp}] ${comment.user?.first_name} ${comment.user?.last_name}:\n${comment.comment}\n`;
  });
}

items.push({
  description: workPerformed,
  quantity: 1,
  unit_price: 0,
  amount: 0,
  line_type: 'description',
  editable: false
});

    setPreviewWO(wo);
    setPreviewLineItems(items);
    setShowInvoicePreview(true);
    setSelectedItem(null);
  } catch (error) {
    console.error('Error generating preview:', error);
    alert('❌ Failed to generate preview');
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
    // Calculate totals from preview line items
    const costItems = previewLineItems.filter(item => item.line_type !== 'description');
    const subtotal = costItems.reduce((sum, item) => sum + item.amount, 0);
    const tax = 0;
    const total = subtotal + tax;

    // Generate invoice number
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

    // Create invoice
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

    // Insert line items
    const lineItemsToInsert = previewLineItems.map(item => ({
      invoice_id: invoice.invoice_id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount,
      line_type: item.line_type
    }));

    const { error: lineItemsError } = await supabase
      .from('invoice_line_items')
      .insert(lineItemsToInsert);

    if (lineItemsError) throw lineItemsError;

    // Lock the work order
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
          acknowledged_by: null,
          status: 'needs_return'
        })
        .eq('wo_id', woId);

      if (updateError) {
        alert('Error updating work order: ' + updateError.message);
        return;
      }

      alert('✅ Work order returned to tech for review!\n\nStatus changed to "Needs Return" and will appear in their mobile app.');
      
      setSelectedItem(null);
      fetchData();
    } catch (err) {
      console.error('Error returning work order:', err);
      alert('Failed to return work order: ' + err.message);
    }
  };

  const updateInvoiceStatus = async (invoiceId, newStatus) => {
    if (!confirm(`Change invoice status to "${newStatus.toUpperCase()}"?`)) {
      return;
    }

    const { error } = await supabase
      .from('invoices')
      .update({ status: newStatus })
      .eq('invoice_id', invoiceId);

    if (error) {
      alert('Failed to update invoice status');
      console.error(error);
    } else {
      alert('✅ Invoice status updated!');
      fetchData();
      if (selectedItem?.type === 'invoice' && selectedItem.data.invoice_id === invoiceId) {
        setSelectedItem({
          ...selectedItem,
          data: { ...selectedItem.data, status: newStatus }
        });
      }
    }
  };

  const deleteInvoice = async (invoiceId, woId) => {
    const password = prompt('⚠️ ADMIN ACTION REQUIRED\n\nEnter admin password to delete this invoice:');
    
    if (!password) {
      return;
    }

    if (password !== 'admin123') {
      alert('❌ Incorrect password. Invoice deletion cancelled.');
      return;
    }

    if (!confirm('🗑️ DELETE INVOICE?\n\nThis will:\n- Permanently delete the invoice\n- Delete all line items\n- Unlock the work order\n\nThis action CANNOT be undone!\n\nAre you absolutely sure?')) {
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

      const { error: unlockError } = await supabase
        .from('work_orders')
        .update({
          is_locked: false,
          locked_at: null,
          locked_by: null
        })
        .eq('wo_id', woId);

      if (unlockError) {
        console.error('Error unlocking work order:', unlockError);
      }

      alert('✅ Invoice deleted successfully!\n\nThe work order has been unlocked and can be invoiced again.');
      
      setSelectedItem(null);
      fetchData();
    } catch (err) {
      console.error('Error deleting invoice:', err);
      alert('Failed to delete invoice: ' + err.message);
    }
  };

  const printInvoice = (invoice) => {
  window.open(`/invoices/${invoice.invoice_id}/print`, '_blank');
};

  const shareInvoice = (invoice) => {
    const shareUrl = `${window.location.origin}/invoices/${invoice.invoice_id}`;
    
    if (navigator.share) {
      navigator.share({
        title: `Invoice ${invoice.invoice_number}`,
        text: `Invoice for Work Order ${invoice.work_order?.wo_number}`,
        url: shareUrl
      }).catch(err => console.log('Share cancelled'));
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => {
        alert('📋 Invoice link copied to clipboard!');
      });
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-yellow-600',
      approved: 'bg-blue-600',
      synced: 'bg-green-600',
      paid: 'bg-green-600',
      cancelled: 'bg-red-600',
      rejected: 'bg-red-600'
    };
    return colors[status] || 'bg-gray-600';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">💰 Invoicing</h1>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-semibold transition"
          >
            ← Back to Dashboard
          </button>
        </div>

        <div className="bg-gray-800 rounded-lg mb-6">
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab('ready')}
              className={`flex-1 px-6 py-4 font-semibold transition ${
                activeTab === 'ready' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Ready for Invoice ({acknowledgedWOs.length})
            </button>
            <button
              onClick={() => setActiveTab('invoiced')}
              className={`flex-1 px-6 py-4 font-semibold transition ${
                activeTab === 'invoiced' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Generated Invoices ({invoices.length})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
            Loading...
          </div>
        ) : activeTab === 'ready' ? (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            {acknowledgedWOs.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                No work orders ready for invoicing.
                <br />
                <span className="text-sm">Acknowledged work orders will appear here.</span>
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
                      <th className="px-4 py-3 text-left">Status</th>
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
                          {wo.lead_tech 
                            ? `${wo.lead_tech.first_name} ${wo.lead_tech.last_name}`
                            : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {new Date(wo.acknowledged_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-green-600">
                            READY
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => selectWorkOrder(wo)}
                            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold transition"
                          >
                            View & Generate Invoice
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            {invoices.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
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
                </div>
              </div>

              <div className="bg-blue-900 text-blue-200 p-4 rounded-lg">
  <div className="font-bold mb-2">✓ Ready to Generate Invoice</div>
  <div className="text-sm">
    This work order has been completed and acknowledged. Click below to generate an invoice:
    <ul className="list-disc list-inside mt-2 text-xs">
      <li>All labor, materials, and costs will be included</li>
      <li>Comments will be included as work performed</li>
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

      {/* Invoice Preview Modal - MUST be separate from work order modal */}
      {/* Invoice Preview Modal - MUST be separate from work order modal */}
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
                      className={`p-4 rounded-lg ${item.line_type === 'description' ? 'bg-blue-900 text-blue-100' : 'bg-gray-600'}`}
                    >
                      {item.line_type === 'description' ? (
                        <div>
                          <div className="font-bold mb-2">Work Performed:</div>
                          <div className="text-sm whitespace-pre-wrap">{item.description}</div>
                        </div>
                      ) : (
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
                              placeholder="Unit Price"
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
                      )}
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
                      placeholder="0.00"
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
                        
                        // Insert before the description item
                        const descIndex = previewLineItems.findIndex(item => item.line_type === 'description');
                        const updated = [...previewLineItems];
                        if (descIndex >= 0) {
                          updated.splice(descIndex, 0, newItem);
                        } else {
                          updated.push(newItem);
                        }
                        
                        setPreviewLineItems(updated);
                        setCustomLineItem({ description: '', quantity: 1, unit_price: 0 });
                      }}
                      className="w-full bg-green-600 hover:bg-green-700 px-3 py-2 rounded font-bold"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Totals */}
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex justify-end">
                  <div className="w-80">
                    <div className="flex justify-between py-2 text-lg">
                      <span className="font-semibold">Subtotal:</span>
                      <span>
                        ${previewLineItems
                          .filter(item => item.line_type !== 'description')
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
                          .filter(item => item.line_type !== 'description')
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