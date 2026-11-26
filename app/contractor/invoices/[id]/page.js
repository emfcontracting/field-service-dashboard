'use client';

import { useState, useEffect } from 'react';
import { useLang } from '@/app/contractor/components/LangProvider';
import StatusPill from '../../components/StatusPill';
import DraftEditor from '../../components/DraftEditor';
import { readContractorSession, saveContractorSession } from '@/lib/contractorSession';
import { fmtDate, fmtDateTime, parseDate, dateKeyET } from '@/lib/dates';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiClient';
import { contractorApi } from '@/lib/contractorClient';
import { EmfReviewPanel } from '../../components/EmfReview';
import PaymentsPanel from '../../components/PaymentsPanel';
import { invoiceRecipient } from '@/lib/invoiceRecipient';

// Helper function to format date without timezone shift
function formatDateLocal(dateString) {
  if (!dateString) return '-';
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ViewInvoice() {
  const { t } = useLang();
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id;

  const [user, setUser] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    const userData = readContractorSession();
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
      const { invoice: invoiceData, items: itemsData, suggestions: sg } = await contractorApi.invoice(id);
      setInvoice(invoiceData);
      setSuggestions(sg || []);
      setLineItems(itemsData || []);

    } catch (error) {
      console.error('Error loading invoice:', error);
      setMessage({ type: 'error', text: t('Failed to load invoice') });
    } finally {
      setLoading(false);
    }
  }

  // Download PDF directly from server
  async function downloadPDF() {
    setPdfLoading(true);
    setMessage(null);
    
    try {
      const response = await apiFetch(`/api/contractor/invoice-pdf/${invoiceId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoice_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setMessage({ type: 'success', text: t('PDF downloaded!') });
    } catch (error) {
      console.error('PDF download error:', error);
      setMessage({ type: 'error', text: `PDF download failed: ${error.message}. Try the Print option instead.` });
    } finally {
      setPdfLoading(false);
    }
  }

  // Print as PDF fallback
  function printInvoice() {
    window.print();
  }

  // Mails the PDF to the addressee from the server, then sets "sent".
  async function sendInvoice() {
    const to = invoiceRecipient(invoice);
    if (!to.email) { setMessage({ type: 'error', text: t('No recipient e-mail on this invoice') }); return; }
    if (!confirm(t('Send {inv} as PDF to {name} ({email})? You get a copy.', { inv: invoice.invoice_number, name: to.name, email: to.email }))) return;
    setSending(true);
    try {
      const updated = await contractorApi.markInvoice(invoice.invoice_id, 'submit');
      setInvoice(updated);
      setMessage({ type: 'success', text: t('📧 Sent to {email}', { email: to.email }) });
    } catch (error) {
      console.error('Send invoice error:', error);
      setMessage({ type: 'error', text: error.message || t('Failed to send invoice') });
    } finally {
      setSending(false);
    }
  }

  async function markAsSent() {
    if (!confirm(t('Mark as sent without e-mailing it (you sent it to {name} yourself)?', { name: invoiceRecipient(invoice).name }))) {
      return;
    }
    
    try {
      const updated = await contractorApi.markInvoice(invoice.invoice_id, 'sent');
      setInvoice(updated);
      setMessage({ type: 'success', text: t('Invoice marked as sent!') });
    } catch (error) {
      console.error('Error updating invoice status:', error);
      setMessage({ type: 'error', text: t('Failed to update invoice status') });
    }
  }

  async function markAsPaid() {
    if (!confirm(t('Mark this invoice as PAID? This records that you received payment from {name}.', { name: invoiceRecipient(invoice).name }))) {
      return;
    }
    
    try {
      const updated = await contractorApi.markInvoice(invoice.invoice_id, 'paid');
      setInvoice(updated);
      setMessage({ type: 'success', text: t('✅ Invoice marked as PAID!') });
    } catch (error) {
      console.error('Error updating invoice status:', error);
      setMessage({ type: 'error', text: t('Failed to mark invoice as paid') });
    }
  }

  async function undoPaid() {
    if (!confirm(t('Remove the PAID mark from this invoice?'))) return;
    try {
      const updated = await contractorApi.markInvoice(invoice.invoice_id, 'unpaid');
      setInvoice(updated);
      setMessage({ type: 'success', text: t('Paid mark removed') });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || t('Failed to update invoice') });
    }
  }

  async function sendReminder() {
    if (!confirm(t('Send a payment reminder with the invoice to {email}?', { email: invoice.client_email }))) return;
    setSending(true);
    try {
      setInvoice(await contractorApi.remindInvoice(invoice.invoice_id));
      setMessage({ type: 'success', text: t('Reminder sent to {email}', { email: invoice.client_email }) });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally { setSending(false); }
  }

  async function correctInvoice() {
    try {
      const copy = await contractorApi.correctInvoice(invoice.invoice_id);
      router.push(`/contractor/invoices/${copy.invoice_id}`);
    } catch (error) {
      setMessage({ type: 'error', text: error.message || t('Failed to update invoice') });
    }
  }

  async function deleteInvoice() {
    if (!confirm(t('Are you sure you want to delete this invoice? This cannot be undone.'))) {
      return;
    }

    try {
      await contractorApi.deleteInvoice(invoice.invoice_id);

      router.push('/contractor/invoices');
    } catch (error) {
      console.error('Error deleting invoice:', error);
      setMessage({ type: 'error', text: error.message || t('Failed to delete invoice') });
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'white' }}>{t('Loading...')}</div>
      </div>
    );
  }

  if (!user || !invoice) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'white' }}>{t('Invoice not found')}</div>
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
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body { background: white !important; }
          header, .no-print { display: none !important; }
          .print-content { 
            background: white !important; 
            color: black !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* Header */}
      <header className="no-print" style={{ backgroundColor: '#1f2937', borderBottom: '1px solid #374151', padding: '16px' }}>
        <div style={{ maxWidth: '896px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Link href="/contractor/invoices" style={{ padding: '8px 12px', backgroundColor: '#374151', borderRadius: '8px', fontSize: '14px', color: 'white', textDecoration: 'none' }}>
              {t('← Back')}
            </Link>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>{invoice.invoice_number}</h1>
              <StatusPill invoice={invoice} />
              
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {/* Download PDF */}
            <button
              onClick={downloadPDF}
              disabled={pdfLoading}
              style={{ 
                padding: '10px 16px', 
                backgroundColor: pdfLoading ? '#4b5563' : '#2563eb', 
                borderRadius: '8px', 
                fontSize: '14px', 
                fontWeight: 'bold',
                color: 'white', 
                border: 'none', 
                cursor: pdfLoading ? 'wait' : 'pointer',
                opacity: pdfLoading ? 0.7 : 1
              }}
            >
              {pdfLoading ? t('⏳ Generating...') : t('📄 Download PDF')}
            </button>
            
            {/* Print fallback */}
            <button
              onClick={printInvoice}
              style={{ 
                padding: '10px 16px', 
                backgroundColor: '#6b7280', 
                borderRadius: '8px', 
                fontSize: '14px', 
                fontWeight: 'bold',
                color: 'white', 
                border: 'none', 
                cursor: 'pointer'
              }}
            >
              {t('🖨️ Print')}
            </button>
            
            {/* Draft actions */}
            {invoice.status === 'draft' && (
              <>
                <button 
                  onClick={sendInvoice}
                  disabled={sending}
                  style={{ padding: '10px 16px', backgroundColor: sending ? '#4b5563' : '#16a34a', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', color: 'white', border: 'none', cursor: sending ? 'wait' : 'pointer' }}
                >
                  {sending ? t('⏳ Sending...') : (invoiceRecipient(invoice).isEmf ? t('📧 Send to EMF') : t('📧 Send to client'))}
                </button>
                <button 
                  onClick={markAsSent}
                  style={{ padding: '10px 16px', backgroundColor: '#374151', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', color: 'white', border: 'none', cursor: 'pointer' }}
                  title={t('Already sent it yourself')}
                >
                  {t('📤 Mark as Sent')}
                </button>
                <button 
                  onClick={deleteInvoice} 
                  style={{ padding: '10px 16px', backgroundColor: '#dc2626', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', color: 'white', border: 'none', cursor: 'pointer' }}
                >
                  {t('🗑️ Delete')}
                </button>
              </>
            )}

            {/* EMF rejected it: copy as a new draft to correct and send again */}
            {invoice.emf_review_status === 'rejected' && (
              <button
                onClick={correctInvoice}
                style={{ padding: '10px 16px', backgroundColor: '#2563eb', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', color: 'white', border: 'none', cursor: 'pointer' }}
                title={t('Copies this invoice as a new draft — fix it and send it again')}
              >
                {t('✏️ Correct')}
              </button>
            )}

            {/* EMF rejected a sent/paid invoice: the sub may delete and redo it */}
            {invoice.status !== 'draft' && invoice.emf_review_status === 'rejected' && (
              <button
                onClick={deleteInvoice}
                style={{ padding: '10px 16px', backgroundColor: '#dc2626', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', color: 'white', border: 'none', cursor: 'pointer' }}
              >
                {t('🗑️ Delete')}
              </button>
            )}

            {invoice.status === 'sent' && invoice.client_type === 'other' && invoice.client_email && (
              <button
                onClick={sendReminder}
                disabled={sending}
                style={{ padding: '10px 16px', backgroundColor: '#b45309', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', color: 'white', border: 'none', cursor: 'pointer' }}
                title={invoice.last_reminder_at ? t('Last reminder {date} ({n} sent)', { date: new Date(invoice.last_reminder_at).toLocaleDateString('en-US', { timeZone: 'America/New_York' }), n: invoice.reminder_count || 1 }) : ''}
              >
                {t('🔔 Payment reminder')}{invoice.reminder_count ? ` (${invoice.reminder_count})` : ''}
              </button>
            )}

            {/* Sent actions - Add Mark as Paid button */}
            {invoice.status === 'sent' && (
              <button 
                onClick={markAsPaid}
                style={{ 
                  padding: '10px 16px', 
                  backgroundColor: '#059669', 
                  borderRadius: '8px', 
                  fontSize: '14px', 
                  fontWeight: 'bold', 
                  color: 'white', 
                  border: 'none', 
                  cursor: 'pointer',
                  animation: 'pulse 2s infinite'
                }}
              >
                {t('💵 Mark as Paid')}
              </button>
            )}

            {invoice.status === 'paid' && (
              <button
                onClick={undoPaid}
                style={{ padding: '10px 16px', backgroundColor: '#374151', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', color: 'white', border: 'none', cursor: 'pointer' }}
              >
                {t('↩ Undo Paid')}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Message */}
      {message && (
        <div className="no-print" style={{ 
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
        
        <EmfReviewPanel invoice={invoice} />
        <PaymentsPanel invoice={invoice} onChange={setInvoice} />

        {invoice.status === 'draft' && (
          <DraftEditor
            key={invoice.updated_at || invoice.invoice_id}
            invoice={invoice}
            items={lineItems}
            suggestions={suggestions}
            profile={user?.profile}
            onProfileChange={(profile) => {
              const next = { ...user, profile: { ...user.profile, ...profile } };
              setUser(next);
              saveContractorSession(next);
            }}
            onSaved={async () => { await loadInvoice(invoice.invoice_id); setMessage({ type: 'success', text: t('Draft updated') }); }}
          />
        )}

        {/* Instructions for draft invoices */}
        {invoice.status === 'draft' && (
          <div className="no-print" style={{ backgroundColor: 'rgba(30, 58, 138, 0.3)', border: '1px solid rgba(59, 130, 246, 0.5)', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
            <h3 style={{ fontWeight: 'bold', color: '#60a5fa', marginBottom: '8px' }}>{t('📋 How to Send Your Invoice')}</h3>
            <ol style={{ color: '#d1d5db', fontSize: '14px', margin: 0, paddingLeft: '20px' }}>
              <li>{t('Check the invoice below')}</li>
              <li>{t('Click')} <strong>{t('"Send"')}</strong> {t('— the PDF goes to')} <strong>{invoiceRecipient(invoice).email || invoiceRecipient(invoice).name}</strong> {t('and you get a copy')}</li>
              <li>{t('Sent it yourself already? Use')} <strong>{t('"Mark as Sent"')}</strong></li>
            </ol>
          </div>
        )}

        {/* Instructions for sent invoices */}
        {invoice.status === 'sent' && (
          <div className="no-print" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
            <h3 style={{ fontWeight: 'bold', color: '#facc15', marginBottom: '8px' }}>{t('💰 Waiting for Payment')}</h3>
            <p style={{ color: '#d1d5db', fontSize: '14px', margin: 0 }}>
              {t('Once you receive payment from {name}, click', { name: invoiceRecipient(invoice).name })} <strong>{t('"Mark as Paid"')}</strong> {t('to update the status.')}
            </p>
          </div>
        )}

        {/* Paid confirmation */}
        {invoice.status === 'paid' && (
          <div className="no-print" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
            <h3 style={{ fontWeight: 'bold', color: '#4ade80', marginBottom: '8px' }}>{t('✅ Invoice Paid')}</h3>
            <p style={{ color: '#d1d5db', fontSize: '14px', margin: 0 }}>
              {t('This invoice was marked as paid on {date}.', { date: fmtDate(invoice.paid_at, 'N/A') })}
            </p>
          </div>
        )}
        
        {/* Invoice Preview */}
        <div 
          className="print-content"
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
                <p style={{ fontWeight: 'bold', fontSize: '16px', margin: 0 }}>{invoiceRecipient(invoice).name}</p>
                {invoiceRecipient(invoice).lines.map((line, i) => (
                  <p key={i} style={{ color: '#4b5563', fontSize: '13px', margin: '2px 0 0 0' }}>{line}</p>
                ))}
                {invoiceRecipient(invoice).email && (
                  <p style={{ color: '#4b5563', fontSize: '13px', margin: '4px 0 0 0' }}>{invoiceRecipient(invoice).email}</p>
                )}
              </div>
            </div>

            {/* Rates Used (EMF invoices only) */}
            {invoiceRecipient(invoice).isEmf && (
            <div style={{ backgroundColor: '#f3f4f6', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
              <p style={{ fontSize: '13px', color: '#4b5563', margin: 0 }}>
                <strong>Rates:</strong> ${parseFloat(invoice.hourly_rate_used || 0).toFixed(2)}/hr regular | ${parseFloat(invoice.ot_rate_used || 0).toFixed(2)}/hr OT | ${parseFloat(invoice.mileage_rate_used || 0).toFixed(4)}/mile
              </p>
            </div>
            )}

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

            {/* Sent/Paid info */}
            {invoice.sent_at && (
              <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>
                Sent to {invoice.sent_to_email} on {fmtDateTime(invoice.sent_at)}
                {invoice.paid_at && (
                  <span style={{ color: '#059669', fontWeight: 'bold' }}> • Paid on {fmtDateTime(invoice.paid_at)}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
