'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import Link from 'next/link';
import Script from 'next/script';

const supabase = getSupabase();

export default function ViewInvoice() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id;
  const invoiceRef = useRef(null);

  const [user, setUser] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState(null);
  const [html2pdfLoaded, setHtml2pdfLoaded] = useState(false);

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

  async function downloadPDF() {
    if (!html2pdfLoaded || !invoiceRef.current) {
      setMessage({ type: 'error', text: 'PDF generator not ready. Please wait and try again.' });
      return;
    }

    setGenerating(true);
    setMessage(null);

    try {
      const element = invoiceRef.current;
      const filename = `${invoice.invoice_number}.pdf`;
      
      const opt = {
        margin: 0.3,
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      await window.html2pdf().set(opt).from(element).save();
      
      setMessage({ type: 'success', text: 'PDF downloaded! You can now email it to emfcontractingsc2@gmail.com' });
    } catch (error) {
      console.error('PDF generation error:', error);
      setMessage({ type: 'error', text: 'Failed to generate PDF: ' + error.message });
    } finally {
      setGenerating(false);
    }
  }

  async function sendViaEmail() {
    await downloadPDF();
    
    const businessName = user.profile?.business_name || `${user.first_name} ${user.last_name}`;
    const toEmail = 'emfcontractingsc2@gmail.com';
    const subject = `Subcontractor Invoice ${invoice.invoice_number} - ${businessName} - $${parseFloat(invoice.grand_total || 0).toFixed(2)}`;
    const body = `Hi,\n\nPlease find attached my invoice ${invoice.invoice_number} for the period ${new Date(invoice.period_start).toLocaleDateString()} - ${new Date(invoice.period_end).toLocaleDateString()}.\n\nTotal Due: $${parseFloat(invoice.grand_total || 0).toFixed(2)}\n\nThank you,\n${businessName}`;
    
    const mailtoLink = `mailto:${toEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    setTimeout(() => {
      window.location.href = mailtoLink;
      
      setTimeout(() => {
        const confirmed = confirm('Did you send the email with the PDF attached?\n\nClick OK to mark the invoice as sent.');
        
        if (confirmed) {
          markAsSent();
        }
      }, 2000);
    }, 1000);
  }

  async function markAsSent() {
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
  const customItems = lineItems.filter(i => i.item_type === 'custom');
  const businessName = user.profile?.business_name || `${user.first_name} ${user.last_name}`;

  // Inline styles for PDF compatibility (no oklch colors)
  const styles = {
    page: { minHeight: '100vh', backgroundColor: '#111827', color: 'white' },
    header: { backgroundColor: '#1f2937', borderBottom: '1px solid #374151', padding: '16px' },
    headerInner: { maxWidth: '896px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    backBtn: { padding: '8px 12px', backgroundColor: '#374151', borderRadius: '8px', fontSize: '14px', color: 'white', textDecoration: 'none', border: 'none', cursor: 'pointer' },
    statusBadge: (status) => ({
      fontSize: '12px',
      padding: '4px 8px',
      borderRadius: '9999px',
      backgroundColor: status === 'paid' ? 'rgba(34, 197, 94, 0.2)' : status === 'sent' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(107, 114, 128, 0.2)',
      color: status === 'paid' ? '#4ade80' : status === 'sent' ? '#facc15' : '#9ca3af'
    }),
    blueBtn: { padding: '8px 12px', backgroundColor: '#2563eb', borderRadius: '8px', fontSize: '14px', color: 'white', border: 'none', cursor: 'pointer' },
    redBtn: { padding: '8px 12px', backgroundColor: '#dc2626', borderRadius: '8px', fontSize: '14px', color: 'white', border: 'none', cursor: 'pointer' },
    greenBtn: { padding: '16px', backgroundColor: '#16a34a', borderRadius: '8px', fontWeight: '500', color: 'white', border: 'none', cursor: 'pointer' },
    grayBtn: { padding: '8px 12px', backgroundColor: '#4b5563', borderRadius: '8px', fontSize: '14px', color: 'white', border: 'none', cursor: 'pointer' },
    messageSuccess: { position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)', padding: '12px 24px', borderRadius: '8px', boxShadow: '0 10px 15px rgba(0,0,0,0.1)', zIndex: 50, maxWidth: '400px', textAlign: 'center', backgroundColor: '#16a34a', color: 'white' },
    messageError: { position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)', padding: '12px 24px', borderRadius: '8px', boxShadow: '0 10px 15px rgba(0,0,0,0.1)', zIndex: 50, maxWidth: '400px', textAlign: 'center', backgroundColor: '#dc2626', color: 'white' },
    instructionBox: { backgroundColor: 'rgba(30, 58, 138, 0.3)', border: '1px solid rgba(59, 130, 246, 0.5)', borderRadius: '12px', padding: '16px', marginBottom: '24px' },
  };

  return (
    <div style={styles.page}>
      <Script 
        src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"
        onLoad={() => setHtml2pdfLoaded(true)}
      />

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Link href="/contractor/invoices" style={styles.backBtn}>
              ← Back
            </Link>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>{invoice.invoice_number}</h1>
              <span style={styles.statusBadge(invoice.status)}>
                {invoice.status.toUpperCase()}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={downloadPDF}
              disabled={generating || !html2pdfLoaded}
              style={{ ...styles.blueBtn, opacity: (generating || !html2pdfLoaded) ? 0.5 : 1 }}
            >
              {generating ? '⏳ Generating...' : '📄 Download PDF'}
            </button>
            
            {invoice.status === 'draft' && (
              <>
                <button onClick={deleteInvoice} style={styles.redBtn}>
                  🗑️ Delete
                </button>
                <button
                  onClick={sendViaEmail}
                  disabled={generating || !html2pdfLoaded}
                  style={{ ...styles.greenBtn, opacity: (generating || !html2pdfLoaded) ? 0.5 : 1 }}
                >
                  📧 Download & Email
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Message */}
      {message && (
        <div style={message.type === 'success' ? styles.messageSuccess : styles.messageError}>
          {message.text}
        </div>
      )}

      <div style={{ maxWidth: '896px', margin: '0 auto', padding: '16px' }}>
        
        {/* Instructions for draft invoices */}
        {invoice.status === 'draft' && (
          <div style={styles.instructionBox}>
            <h3 style={{ fontWeight: 'bold', color: '#60a5fa', marginBottom: '8px' }}>📋 How to Send Your Invoice</h3>
            <ol style={{ color: '#d1d5db', fontSize: '14px', margin: 0, paddingLeft: '20px' }}>
              <li>Click <strong>"Download & Email"</strong> button above</li>
              <li>The PDF will download to your device</li>
              <li>Your email app will open with a pre-filled message</li>
              <li><strong>Attach the PDF</strong> to the email and send</li>
              <li>Confirm when done to mark invoice as sent</li>
            </ol>
          </div>
        )}
        
        {/* Invoice Preview - PDF Content with inline styles only */}
        <div 
          ref={invoiceRef} 
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
                  {new Date(invoice.period_start).toLocaleDateString()} - {new Date(invoice.period_end).toLocaleDateString()}
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
                        <td style={{ padding: '8px 0' }}>{item.work_date ? new Date(item.work_date).toLocaleDateString() : '-'}</td>
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
                        <td style={{ padding: '8px 0' }}>{item.work_date ? new Date(item.work_date).toLocaleDateString() : '-'}</td>
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
