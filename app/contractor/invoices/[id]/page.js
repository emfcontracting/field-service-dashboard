'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import Link from 'next/link';

const supabase = getSupabase();

// Helper function to format date without timezone shift
function formatDateLocal(dateString) {
  if (!dateString) return '-';
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ViewInvoice() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id;

  const [user, setUser] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const userData = sessionStorage.getItem('contractor_user');
    if (!userData) {
      router.push('/contractor');
      return;
    }
    
    try {
      const parsed = JSON.parse(userData);
      setUser(parsed);
      loadInvoice(invoiceId);
    } catch (e) {
      console.error('Error parsing user data:', e);
      router.push('/contractor');
    }
  }, [router, invoiceId]);

  async function loadInvoice(id) {
    try {
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('subcontractor_invoices')
        .select('*')
        .eq('invoice_id', id)
        .single();

      if (invoiceError) throw invoiceError;
      setInvoice(invoiceData);

      const { data: itemsData, error: itemsError } = await supabase
        .from('subcontractor_invoice_items')
        .select(`
          *,
          work_order:work_orders(wo_number, building)
        `)
        .eq('invoice_id', id)
        .order('work_date', { ascending: true });

      if (itemsError) {
        console.error('Error loading line items:', itemsError);
      }
      setLineItems(itemsData || []);

    } catch (error) {
      console.error('Error loading invoice:', error);
      setMessage({ type: 'error', text: 'Failed to load invoice' });
    } finally {
      setLoading(false);
    }
  }

  // Download PDF directly from server (works on all devices)
  function downloadPDF() {
    // Direct link to server-generated PDF
    window.location.href = `/api/contractor/invoice-pdf/${invoiceId}`;
    setMessage({ type: 'success', text: 'PDF downloading...' });
  }

  async function markAsSent() {
    if (!confirm('Mark this invoice as sent to EMF Contracting?')) {
      return;
    }
    
    try {
      const { error: updateError } = await supabase
        .from('subcontractor_invoices')
        .update({
          status: 'sent',
          sent_to_email: 'emfcontractingsc2@gmail.com',
          sent_at: new Date().toISOString()
        })
        .eq('invoice_id', invoice.invoice_id);

      if (updateError) throw updateError;

      setInvoice({ ...invoice, status: 'sent', sent_at: new Date().toISOString() });
      setMessage({ type: 'success', text: 'Invoice marked as sent!' });
    } catch (error) {
      console.error('Error updating invoice status:', error);
      setMessage({ type: 'error', text: 'Failed to update invoice status' });
    }
  }

  async function deleteInvoice() {
    if (!confirm('Are you sure you want to delete this invoice? This cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('subcontractor_invoices')
        .delete()
        .eq('invoice_id', invoice.invoice_id);

      if (error) throw error;

      router.push('/contractor/invoices');
    } catch (error) {
      console.error('Error deleting invoice:', error);
      setMessage({ type: 'error', text: 'Failed to delete invoice' });
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'white' }}>Loading...</div>
      </div>
    );
  }

  if (!user || !invoice) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'white' }}>Invoice not found</div>
      </div>
    );
  }

  const hoursItems = lineItems.filter(i => i.item_type === 'hours');
  const mileageItems = lineItems.filter(i => i.item_type === 'mileage');
  const materialItems = lineItems.filter(i => i.item_type === 'material');
  const customItems = lineItems.filter(i => i.item_type === 'custom');
  const businessName = user.profile?.business_name || `${user.first_name} ${user.last_name}`;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#111827', color: 'white' }}>

      {/* Header */}
      <header style={{ backgroundColor: '#1f2937', borderBottom: '1px solid #374151', padding: '16px' }}>
        <div style={{ maxWidth: '896px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Link href="/contractor/invoices" style={{ padding: '8px 12px', backgroundColor: '#374151', borderRadius: '8px', fontSize: '14px', color: 'white', textDecoration: 'none' }}>
              ← Back
            </Link>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>{invoice.invoice_number}</h1>
              <span style={{
                fontSize: '12px',
                padding: '4px 8px',
                borderRadius: '9999px',
                backgroundColor: invoice.status === 'paid' ? 'rgba(34, 197, 94, 0.2)' : invoice.status === 'sent' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                color: invoice.status === 'paid' ? '#4ade80' : invoice.status === 'sent' ? '#facc15' : '#9ca3af'
              }}>
                {invoice.status.toUpperCase()}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {/* Download PDF - direct download */}
            <button
              onClick={downloadPDF}
              style={{ 
                padding: '10px 16px', 
                backgroundColor: '#2563eb', 
                borderRadius: '8px', 
                fontSize: '14px', 
                fontWeight: 'bold',
                color: 'white', 
                border: 'none', 
                cursor: 'pointer'
              }}
            >
              📄 Download PDF
            </button>
            
            {/* Draft actions */}
            {invoice.status === 'draft' && (
              <>
                <button 
                  onClick={markAsSent}
                  style={{ padding: '10px 16px', backgroundColor: '#16a34a', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', color: 'white', border: 'none', cursor: 'pointer' }}
                >
                  ✓ Mark as Sent
                </button>
                <button 
                  onClick={deleteInvoice} 
                  style={{ padding: '10px 16px', backgroundColor: '#dc2626', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', color: 'white', border: 'none', cursor: 'pointer' }}
                >
                  🗑️ Delete
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Message */}
      {message && (
        <div style={{ 
          position: 'fixed', 
          top: '80px', 
          left: '50%', 
          transform: 'translateX(-50%)', 
          padding: '12px 24px', 
          borderRadius: '8px', 
          boxShadow: '0 10px 15px rgba(0,0,0,0.1)', 
          zIndex: 50, 
          maxWidth: '400px', 
          textAlign: 'center', 
          backgroundColor: message.type === 'success' ? '#16a34a' : '#dc2626', 
          color: 'white' 
        }}>
          {message.text}
        </div>
      )}

      <div style={{ maxWidth: '896px', margin: '0 auto', padding: '16px' }}>
        
        {/* Instructions for draft invoices */}
        {invoice.status === 'draft' && (
          <div style={{ backgroundColor: 'rgba(30, 58, 138, 0.3)', border: '1px solid rgba(59, 130, 246, 0.5)', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
            <h3 style={{ fontWeight: 'bold', color: '#60a5fa', marginBottom: '8px' }}>📋 How to Send Your Invoice</h3>
            <ol style={{ color: '#d1d5db', fontSize: '14px', margin: 0, paddingLeft: '20px' }}>
              <li>Click <strong>"Download PDF"</strong> to save the invoice</li>
              <li>Email the PDF to <strong>emfcontractingsc2@gmail.com</strong></li>
              <li>Click <strong>"Mark as Sent"</strong> when done</li>
            </ol>
          </div>
        )}
        
        {/* Invoice Preview */}
        <div 
          style={{
            backgroundColor: '#ffffff',
            color: '#111827',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            fontFamily: 'Arial, Helvetica, sans-serif'
          }}
        >
          {/* Invoice Header */}
          <div style={{ backgroundColor: '#1f2937', color: 'white', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0 }}>INVOICE</h2>
                <p style={{ color: '#9ca3af', marginTop: '4px' }}>{invoice.invoice_number}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>Period</p>
                <p style={{ fontWeight: '500', margin: '4px 0 0 0' }}>
                  {formatDateLocal(invoice.period_start)} - {formatDateLocal(invoice.period_end)}
                </p>
              </div>
            </div>
          </div>

          <div style={{ padding: '24px' }}>
            {/* From / To */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
              <div>
                <p style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '8px' }}>From</p>
                <p style={{ fontWeight: 'bold', fontSize: '16px', margin: 0 }}>{businessName}</p>
                {user.profile?.business_address && (
                  <p style={{ color: '#4b5563', fontSize: '13px', whiteSpace: 'pre-line', margin: '4px 0 0 0' }}>{user.profile.business_address}</p>
                )}
                <p style={{ color: '#4b5563', fontSize: '13px', margin: '4px 0 0 0' }}>{user.email}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '8px' }}>To</p>
                <p style={{ fontWeight: 'bold', fontSize: '16px', margin: 0 }}>EMF Contracting LLC</p>
                <p style={{ color: '#4b5563', fontSize: '13px', margin: '4px 0 0 0' }}>565 Pine Plain Rd</p>
                <p style={{ color: '#4b5563', fontSize: '13px', margin: '2px 0 0 0' }}>Gaston, SC 29075</p>
                <p style={{ color: '#4b5563', fontSize: '13px', margin: '4px 0 0 0' }}>emfcontractingsc2@gmail.com</p>
              </div>
            </div>

            {/* Rates Used */}
            <div style={{ backgroundColor: '#f3f4f6', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
              <p style={{ fontSize: '13px', color: '#4b5563', margin: 0 }}>
                <strong>Rates:</strong> ${parseFloat(invoice.hourly_rate_used || 0).toFixed(2)}/hr regular | ${parseFloat(invoice.ot_rate_used || 0).toFixed(2)}/hr OT | ${parseFloat(invoice.mileage_rate_used || 0).toFixed(4)}/mile
              </p>
            </div>

            {/* Labor Section */}
            {hoursItems.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontWeight: 'bold', color: '#374151', borderBottom: '2px solid #e5e7eb', paddingBottom: '8px', marginBottom: '12px' }}>Labor</h3>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: '#6b7280', textAlign: 'left' }}>
                      <th style={{ paddingBottom: '8px' }}>Date</th>
                      <th style={{ paddingBottom: '8px' }}>Description</th>
                      <th style={{ paddingBottom: '8px', textAlign: 'right' }}>Hours</th>
                      <th style={{ paddingBottom: '8px', textAlign: 'right' }}>Rate</th>
                      <th style={{ paddingBottom: '8px', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hoursItems.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 0' }}>{item.work_date ? formatDateLocal(item.work_date) : '-'}</td>
                        <td style={{ padding: '8px 0' }}>{item.description}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right' }}>{parseFloat(item.quantity || 0).toFixed(1)}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right' }}>${parseFloat(item.rate || 0).toFixed(2)}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: '500' }}>${parseFloat(item.amount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Mileage Section */}
            {mileageItems.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontWeight: 'bold', color: '#374151', borderBottom: '2px solid #e5e7eb', paddingBottom: '8px', marginBottom: '12px' }}>Mileage</h3>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: '#6b7280', textAlign: 'left' }}>
                      <th style={{ paddingBottom: '8px' }}>Date</th>
                      <th style={{ paddingBottom: '8px' }}>Description</th>
                      <th style={{ paddingBottom: '8px', textAlign: 'right' }}>Miles</th>
                      <th style={{ paddingBottom: '8px', textAlign: 'right' }}>Rate</th>
                      <th style={{ paddingBottom: '8px', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mileageItems.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 0' }}>{item.work_date ? formatDateLocal(item.work_date) : '-'}</td>
                        <td style={{ padding: '8px 0' }}>{item.description || 'Mileage'}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right' }}>{parseFloat(item.quantity || 0).toFixed(0)}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right' }}>${parseFloat(item.rate || 0).toFixed(4)}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: '500' }}>${parseFloat(item.amount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Material Reimbursement Section */}
            {materialItems.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontWeight: 'bold', color: '#ea580c', borderBottom: '2px solid #fed7aa', paddingBottom: '8px', marginBottom: '12px' }}>Material Reimbursement</h3>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: '#6b7280', textAlign: 'left' }}>
                      <th style={{ paddingBottom: '8px' }}>Date</th>
                      <th style={{ paddingBottom: '8px' }}>Description</th>
                      <th style={{ paddingBottom: '8px', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialItems.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 0' }}>{item.work_date ? formatDateLocal(item.work_date) : '-'}</td>
                        <td style={{ padding: '8px 0' }}>{item.description}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: '500', color: '#ea580c' }}>${parseFloat(item.amount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Custom Items Section */}
            {customItems.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontWeight: 'bold', color: '#374151', borderBottom: '2px solid #e5e7eb', paddingBottom: '8px', marginBottom: '12px' }}>Additional Items</h3>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: '#6b7280', textAlign: 'left' }}>
                      <th style={{ paddingBottom: '8px' }}>Description</th>
                      <th style={{ paddingBottom: '8px', textAlign: 'right' }}>Qty</th>
                      <th style={{ paddingBottom: '8px', textAlign: 'right' }}>Rate</th>
                      <th style={{ paddingBottom: '8px', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customItems.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 0' }}>{item.description}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right' }}>{parseFloat(item.quantity || 0).toFixed(1)}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right' }}>${parseFloat(item.rate || 0).toFixed(2)}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: '500' }}>${parseFloat(item.amount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals */}
            <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '16px', marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                <span style={{ color: '#4b5563' }}>Labor ({parseFloat(invoice.total_regular_hours || 0).toFixed(1)}h reg + {parseFloat(invoice.total_ot_hours || 0).toFixed(1)}h OT)</span>
                <span>${parseFloat(invoice.total_hours_amount || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                <span style={{ color: '#4b5563' }}>Mileage ({parseFloat(invoice.total_miles || 0).toFixed(0)} miles)</span>
                <span>${parseFloat(invoice.total_mileage_amount || 0).toFixed(2)}</span>
              </div>
              {parseFloat(invoice.total_tech_material || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                  <span style={{ color: '#ea580c' }}>Material Reimbursement</span>
                  <span style={{ color: '#ea580c' }}>${parseFloat(invoice.total_tech_material || 0).toFixed(2)}</span>
                </div>
              )}
              {parseFloat(invoice.total_line_items_amount || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                  <span style={{ color: '#4b5563' }}>Additional Items</span>
                  <span>${parseFloat(invoice.total_line_items_amount || 0).toFixed(2)}</span>
                </div>
              )}
              <div style={{ borderTop: '2px solid #d1d5db', paddingTop: '12px', marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: 'bold' }}>
                  <span>TOTAL DUE</span>
                  <span style={{ color: '#059669' }}>${parseFloat(invoice.grand_total || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Sent info */}
            {invoice.sent_at && (
              <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>
                Sent to {invoice.sent_to_email} on {new Date(invoice.sent_at).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
