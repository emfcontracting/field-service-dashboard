'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import AppShell from '@/app/components/AppShell';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  draft:    { label: 'Draft',                      color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  approved: { label: 'Uploaded to CBRE',           color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  accepted: { label: 'Accepted – Submitted to AP', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  synced:   { label: 'Accepted – Submitted to AP', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  paid:     { label: 'Paid',                       color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  rejected: { label: 'Rejected',                   color: 'bg-red-500/15 text-red-400 border-red-500/30' },
};
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { label: status?.toUpperCase(), color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>{cfg.label}</span>;
};

// ── UI primitives ────────────────────────────────────────────────────────────
const Card = ({ children, className = '' }) => (
  <div className={`bg-[#0d0d14] border border-[#1e1e2e] rounded-xl ${className}`}>{children}</div>
);
const CardHeader = ({ children, className = '' }) => (
  <div className={`px-5 py-4 border-b border-[#1e1e2e] ${className}`}>{children}</div>
);
const CardBody = ({ children, className = '' }) => (
  <div className={`px-5 py-4 ${className}`}>{children}</div>
);

const Btn = ({ children, onClick, disabled, variant = 'default', size = 'md', className = '' }) => {
  const variants = {
    default: 'bg-[#1e1e2e] border border-[#2d2d44] text-slate-300 hover:text-slate-100 hover:bg-[#2d2d44]',
    primary: 'bg-blue-600 hover:bg-blue-500 text-white',
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    warning: 'bg-yellow-600 hover:bg-yellow-500 text-white',
    danger:  'bg-red-600 hover:bg-red-500 text-white',
    purple:  'bg-purple-600 hover:bg-purple-500 text-white',
    ghost:   'text-slate-400 hover:text-slate-200 hover:bg-[#1e1e2e]',
  };
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-3 text-base', xl: 'px-6 py-4 text-lg' };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-150
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </button>
  );
};

const ExternalLink = ({ href, children, variant = 'default', size = 'md' }) => {
  const variants = {
    default: 'bg-[#1e1e2e] border border-[#2d2d44] text-slate-300 hover:text-slate-100 hover:bg-[#2d2d44]',
    primary: 'bg-blue-600 hover:bg-blue-500 text-white',
    purple:  'bg-purple-600 hover:bg-purple-500 text-white',
    danger:  'bg-red-600 hover:bg-red-500 text-white',
  };
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-3 text-base' };
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-150
        ${variants[variant]} ${sizes[size]}`}>
      {children}
    </a>
  );
};

// ── Checkbox row ─────────────────────────────────────────────────────────────
const CheckRow = ({ id, checked, onChange, children }) => (
  <label htmlFor={id}
    className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition
      ${checked ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-[#0a0a0f] border-[#2d2d44] hover:border-[#3d3d5e]'}`}>
    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition
      ${checked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
      {checked && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
    </div>
    <input type="checkbox" id={id} checked={checked} onChange={onChange} className="sr-only" />
    <span className={`text-sm font-medium ${checked ? 'text-emerald-300' : 'text-slate-300'}`}>{children}</span>
  </label>
);

// ── Info box ─────────────────────────────────────────────────────────────────
const InfoBox = ({ variant = 'blue', title, children }) => {
  const colors = {
    blue:   'bg-blue-500/10 border-blue-500/20 text-blue-300',
    yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300',
    green:  'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
    red:    'bg-red-500/10 border-red-500/20 text-red-300',
  };
  return (
    <div className={`border rounded-xl p-4 text-sm ${colors[variant]}`}>
      {title && <p className="font-semibold mb-1.5">{title}</p>}
      <div className="opacity-80 leading-relaxed">{children}</div>
    </div>
  );
};

// ── KV pair ──────────────────────────────────────────────────────────────────
const KV = ({ label, value, mono = false }) => (
  <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2.5">
    <p className="text-slate-600 text-[10px] uppercase tracking-wider">{label}</p>
    <p className={`text-slate-200 font-semibold text-sm mt-0.5 ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
  </div>
);

// ── Table ────────────────────────────────────────────────────────────────────
const Table = ({ headers, children, empty }) => (
  children
    ? <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e1e2e]">
              {headers.map(h => (
                <th key={h.label} className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${h.align || 'text-left'}`}>
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    : <div className="px-5 py-12 text-center text-slate-600">{empty}</div>
);

// ════════════════════════════════════════════════════════════════════════════
export default function CBREInvoicingPage() {
  const [workOrders, setWorkOrders]   = useState([]);
  const [invoices, setInvoices]       = useState([]);
  const [selectedWO, setSelectedWO]   = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState('ready');
  const [workflowStep, setWorkflowStep] = useState(1);
  const [nteVerified, setNteVerified]   = useState(false);
  const [photosRetrieved, setPhotosRetrieved] = useState(false);
  const [qbInvoiceCreated, setQbInvoiceCreated] = useState(false);
  const [vwasUploaded, setVwasUploaded] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchCBREWorkOrders(), fetchCBREInvoices()]);
    setLoading(false);
  };

  const fetchCBREWorkOrders = async () => {
    const { data } = await supabase.from('work_orders')
      .select('*, lead_tech:users!lead_tech_id(first_name, last_name, email)')
      .eq('acknowledged', true).eq('is_locked', false)
      .or('client.eq.CBRE,client.eq.UPS,client.is.null')
      .order('acknowledged_at', { ascending: false });
    setWorkOrders(data || []);
  };

  const fetchCBREInvoices = async () => {
    const { data } = await supabase.from('invoices')
      .select('*, work_order:work_orders(wo_number, building, work_order_description, vwas_wo_number, cbre_nte, client, lead_tech:users!lead_tech_id(first_name, last_name))')
      .order('created_at', { ascending: false });
    setInvoices(data || []);
  };

  const startWorkflow = (wo) => {
    setSelectedWO(wo); setSelectedInvoice(null);
    setWorkflowStep(1); setNteVerified(false);
    setPhotosRetrieved(false); setQbInvoiceCreated(false); setVwasUploaded(false);
  };

  const startInvoiceWorkflow = (invoice) => {
    setSelectedInvoice(invoice); setSelectedWO(null);
    if (invoice.vwas_submitted || invoice.cbre_status === 'paid' || invoice.status === 'synced') {
      setWorkflowStep(6); setNteVerified(true); setPhotosRetrieved(true); setQbInvoiceCreated(true); setVwasUploaded(true);
    } else if (invoice.quickbooks_invoice_id) {
      setWorkflowStep(5); setNteVerified(true); setPhotosRetrieved(false); setQbInvoiceCreated(true); setVwasUploaded(false);
    } else if (invoice.status === 'approved') {
      setWorkflowStep(4); setNteVerified(true); setPhotosRetrieved(false); setQbInvoiceCreated(false); setVwasUploaded(false);
    } else {
      setWorkflowStep(3); setNteVerified(true); setPhotosRetrieved(false); setQbInvoiceCreated(false); setVwasUploaded(false);
    }
  };

  const closeWorkflow = () => {
    setSelectedWO(null); setSelectedInvoice(null); setWorkflowStep(1);
    setNteVerified(false); setPhotosRetrieved(false); setQbInvoiceCreated(false); setVwasUploaded(false);
  };

  const updateInvoiceStatus = async (invoiceId, status, cbreStatus = null) => {
    const updates = { status };
    if (cbreStatus) updates.cbre_status = cbreStatus;
    const { error } = await supabase.from('invoices').update(updates).eq('invoice_id', invoiceId);
    if (error) alert('Error: ' + error.message);
    else await fetchData();
  };

  const markVWASSubmitted = async (invoiceId) => {
    const { error } = await supabase.from('invoices').update({
      vwas_submitted: true, vwas_submitted_at: new Date().toISOString(),
      cbre_status: 'submitted_to_vwas', status: 'accepted'
    }).eq('invoice_id', invoiceId);
    if (error) { alert('Error: ' + error.message); return; }
    alert('✅ Invoice marked as submitted to VWAS!');
    setVwasUploaded(true); setWorkflowStep(6); await fetchData();
  };

  // ── Workflow steps tracker ────────────────────────────────────────────────
  const STEPS = [
    { num: 1, title: 'Open RFI Ticket', sub: 'EMF FSM' },
    { num: 2, title: 'Verify NTE',      sub: 'VWAS Check' },
    { num: 3, title: 'Finalize',        sub: 'Generate Invoice' },
    { num: 4, title: 'QuickBooks',      sub: 'Create Invoice' },
    { num: 5, title: 'Upload VWAS',     sub: 'Invoice + Photos' },
    { num: 6, title: 'Complete',        sub: 'Mark Done' },
  ];

  const WorkflowTracker = () => (
    <div className="flex items-start justify-between py-2 px-1">
      {STEPS.map((step, i) => {
        const done    = workflowStep > step.num;
        const current = workflowStep === step.num;
        return (
          <div key={step.num} className="flex items-start flex-1">
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition
                ${done    ? 'bg-emerald-500 text-white'
                : current ? 'bg-blue-600 text-white ring-2 ring-blue-500/40'
                :           'bg-[#1e1e2e] text-slate-600 border border-[#2d2d44]'}`}>
                {done
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  : step.num}
              </div>
              <div className="text-center mt-2 w-16">
                <p className={`text-[11px] font-semibold leading-tight ${current ? 'text-blue-400' : done ? 'text-emerald-400' : 'text-slate-600'}`}>{step.title}</p>
                <p className="text-[10px] text-slate-700 mt-0.5">{step.sub}</p>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-[2px] flex-1 mt-[17px] mx-1 rounded transition ${done ? 'bg-emerald-500/40' : 'bg-[#1e1e2e]'}`} />
            )}
          </div>
        );
      })}
    </div>
  );

  // ── Step content ──────────────────────────────────────────────────────────
  const StepContent = () => {
    const wo       = selectedWO;
    const invoice  = selectedInvoice;
    const woNumber = wo?.wo_number || invoice?.work_order?.wo_number;
    const building = wo?.building  || invoice?.work_order?.building;
    const vwasWO   = wo?.vwas_wo_number || invoice?.work_order?.vwas_wo_number;

    const NavBtns = ({ onBack, onNext, nextLabel, nextDisabled, nextVariant = 'success' }) => (
      <div className="flex gap-3 pt-2">
        {onBack && <Btn onClick={onBack} variant="default" size="lg">← Back</Btn>}
        <Btn onClick={onNext} disabled={nextDisabled} variant={nextVariant} size="lg" className="flex-1">{nextLabel}</Btn>
      </div>
    );

    switch (workflowStep) {
      // ── Step 1 ──
      case 1: return (
        <div className="space-y-4">
          <InfoBox variant="blue" title="Open RFI Ticket in EMF FSM">
            Navigate to the Ready for Invoice page and click "Generate Invoice" for WO #{woNumber}.
          </InfoBox>
          <div className="flex gap-3">
            <ExternalLink href="/invoices" variant="primary" size="lg">📄 Open Invoicing Page</ExternalLink>
          </div>
          <InfoBox variant="blue">
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Go to the Invoicing page</li>
              <li>Find WO #{woNumber} in the "Ready to Invoice" tab</li>
              <li>Click "Generate Invoice"</li>
              <li>Click "Preview &amp; Generate Invoice"</li>
            </ol>
          </InfoBox>
          <NavBtns onNext={() => setWorkflowStep(2)} nextLabel="✅ Done – Continue to Step 2" />
        </div>
      );

      // ── Step 2 ──
      case 2: return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <KV label="EMF WO #" value={woNumber} mono />
            <KV label="VWAS WO #" value={vwasWO} mono />
          </div>
          <div className="flex gap-3">
            <ExternalLink href="https://enterprise.serviceinsight.cbre.com/PRD40177VWS" variant="purple" size="lg">🔗 Open VWAS</ExternalLink>
          </div>
          <InfoBox variant="yellow" title="NTE Check">
            <ul className="list-disc list-inside space-y-1.5 mt-1">
              <li>Confirm invoice total does NOT exceed the NTE</li>
              <li>If it exceeds, request NTE increase before proceeding</li>
              <li>Document scope changes if applicable</li>
            </ul>
          </InfoBox>
          <CheckRow id="nteVerified" checked={nteVerified} onChange={e => setNteVerified(e.target.checked)}>
            I have verified the NTE in VWAS — invoice is compliant
          </CheckRow>
          <NavBtns onBack={() => setWorkflowStep(1)} onNext={() => setWorkflowStep(3)} nextDisabled={!nteVerified} nextLabel="✅ NTE Verified – Continue to Step 3" />
        </div>
      );

      // ── Step 3 ──
      case 3: return (
        <div className="space-y-4">
          <InfoBox variant="blue" title="Finalize invoice in EMF system">
            Review all line items, then click "Finalize &amp; Generate Invoice" on the invoicing page.
          </InfoBox>
          <div className="flex gap-3">
            <ExternalLink href="/invoices" variant="primary" size="lg">📄 Open Invoicing Page</ExternalLink>
          </div>
          <InfoBox variant="blue">
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Review all labor hours, materials, and notes</li>
              <li>Edit line items as needed</li>
              <li>Click "Finalize &amp; Generate Invoice"</li>
              <li>Confirm the invoice is created</li>
            </ol>
          </InfoBox>
          <NavBtns onBack={() => setWorkflowStep(2)} onNext={() => setWorkflowStep(4)} nextLabel="✅ Invoice Generated – Continue to Step 4" />
        </div>
      );

      // ── Step 4 ──
      case 4: return (
        <div className="space-y-4">
          <InfoBox variant="blue" title="Create invoice in QuickBooks">
            Match amounts from the EMF invoice. Export the QB invoice as a PDF.
          </InfoBox>
          <div className="flex gap-3 flex-wrap">
            <ExternalLink href="https://qbo.intuit.com" variant="success" size="lg">💰 Open QuickBooks</ExternalLink>
            {invoice && (
              <Btn onClick={() => window.open(`/invoices/${invoice.invoice_id}/print`, '_blank')} variant="default" size="lg">🖨️ View EMF Invoice</Btn>
            )}
          </div>
          <InfoBox variant="blue">
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Open QuickBooks → Create new invoice</li>
              <li>Include all billable labor, materials, charges</li>
              <li>Match amounts from the EMF invoice</li>
              <li>Save and export as PDF</li>
            </ol>
          </InfoBox>
          <CheckRow id="qbCreated" checked={qbInvoiceCreated} onChange={e => setQbInvoiceCreated(e.target.checked)}>
            I have created the invoice in QuickBooks and saved the PDF
          </CheckRow>
          <NavBtns
            onBack={() => setWorkflowStep(3)}
            onNext={() => { if (invoice) updateInvoiceStatus(invoice.invoice_id, 'approved'); setWorkflowStep(5); }}
            nextDisabled={!qbInvoiceCreated}
            nextLabel="✅ QB Invoice Created – Continue to Step 5" />
        </div>
      );

      // ── Step 5 ──
      case 5: return (
        <div className="space-y-4">
          <InfoBox variant="blue" title="Upload invoice &amp; photos to VWAS">
            Upload the QB invoice PDF and all job photos. Then submit through VWAS to CBRE.
          </InfoBox>
          <div className="flex gap-3 flex-wrap">
            <ExternalLink href="https://enterprise.serviceinsight.cbre.com/PRD40177VWS" variant="purple" size="lg">🔗 Open VWAS</ExternalLink>
            <ExternalLink href={`https://mail.google.com/mail/u/0/#search/in:anywhere+${woNumber}`} variant="danger" size="lg">📧 Gmail (emfcbre@)</ExternalLink>
          </div>
          <InfoBox variant="blue">
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Open VWAS and find the work order</li>
              <li>Attach the QuickBooks invoice PDF</li>
              <li>Open Gmail (emfcbre@gmail.com) and find job photos</li>
              <li>Download photos and upload them to VWAS</li>
              <li>Submit the invoice through VWAS</li>
            </ol>
          </InfoBox>
          <div className="space-y-2.5">
            <CheckRow id="photosRetrieved" checked={photosRetrieved} onChange={e => setPhotosRetrieved(e.target.checked)}>
              I retrieved the job photos from emfcbre@gmail.com
            </CheckRow>
            <CheckRow id="vwasUploaded" checked={vwasUploaded} onChange={e => setVwasUploaded(e.target.checked)}>
              I uploaded the invoice and photos to VWAS
            </CheckRow>
          </div>
          <NavBtns
            onBack={() => setWorkflowStep(4)}
            onNext={() => { invoice ? markVWASSubmitted(invoice.invoice_id) : setWorkflowStep(6); }}
            nextDisabled={!photosRetrieved || !vwasUploaded}
            nextLabel="✅ Uploaded to VWAS – Continue to Step 6" />
        </div>
      );

      // ── Step 6 ──
      case 6: return (
        <div className="space-y-4">
          <InfoBox variant="green" title="🎉 Workflow Complete!">
            The invoice has been submitted to VWAS for CBRE processing.
          </InfoBox>

          <Card>
            <CardBody>
              <p className="text-slate-500 text-xs uppercase tracking-wider mb-3">Status Progression</p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                {['Draft', 'Approved', 'Accepted'].map((s, i) => (
                  <div key={s} className="flex items-center gap-3">
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border
                      ${s === 'Draft' ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                      : s === 'Approved' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'}`}>{s}</span>
                    {i < 2 && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-600"><polyline points="9 18 15 12 9 6"/></svg>}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {invoice && (
            <div className="grid grid-cols-2 gap-3">
              <KV label="Invoice #" value={invoice.invoice_number} mono />
              <KV label="Total" value={`$${invoice.total?.toFixed(2)}`} mono />
              <KV label="Status" value={<StatusBadge status={invoice.status} />} />
              <KV label="VWAS" value={invoice.vwas_submitted ? '✅ Submitted' : '⏳ Pending'} />
            </div>
          )}

          <Btn onClick={closeWorkflow} variant="primary" size="xl" className="w-full">✅ Done – Return to List</Btn>
        </div>
      );

      default: return null;
    }
  };

  // ── Tabs config ──────────────────────────────────────────────────────────
  const inProgress = invoices.filter(i => i.status === 'draft' || i.status === 'approved');
  const rejected   = invoices.filter(i => i.status === 'rejected');
  const submitted  = invoices.filter(i => i.vwas_submitted);

  const TABS = [
    { id: 'ready',     label: 'Ready',        count: workOrders.length },
    { id: 'progress',  label: 'In Progress',  count: inProgress.length },
    { id: 'rejected',  label: 'Rejected',     count: rejected.length },
    { id: 'submitted', label: 'Submitted',    count: submitted.length },
  ];

  // ── Table row ──────────────────────────────────────────────────────────
  const TR = ({ children, onClick, i }) => (
    <tr onClick={onClick}
      className={`border-b border-[#1e1e2e]/60 transition
        ${onClick ? 'cursor-pointer hover:bg-[#1e1e2e]/40' : 'hover:bg-[#1e1e2e]/20'}
        ${i % 2 !== 0 ? 'bg-[#0a0a0f]/30' : ''}`}>
      {children}
    </tr>
  );
  const TD = ({ children, align = 'left', className = '' }) => (
    <td className={`px-4 py-3 text-sm text-${align} ${className}`}>{children}</td>
  );

  if (loading) {
    return (
      <AppShell activeLink="/invoices">
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
            <p className="text-slate-500 text-sm">Loading CBRE workflow…</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activeLink="/invoices">
      <div className="min-h-screen bg-[#0a0a0f] text-slate-200">

        {/* ── Page Header ── */}
        <div className="border-b border-[#1e1e2e] bg-[#0d0d14] px-6 py-5">
          <div className="max-w-7xl mx-auto flex justify-between items-start sm:items-center gap-4 flex-col sm:flex-row">
            <div>
              <div className="flex items-center gap-2.5 mb-0.5">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <p className="text-slate-500 text-xs uppercase tracking-widest font-semibold">CBRE Workflow</p>
              </div>
              <h1 className="text-2xl font-bold text-slate-100">CBRE Invoicing Workflow</h1>
              <p className="text-slate-500 text-sm mt-0.5">Step-by-step VWAS invoice submission</p>
            </div>
            <div className="flex items-center gap-2">
              <Btn onClick={() => window.location.href = '/invoices'} variant="default" size="sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                Standard Invoicing
              </Btn>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">

          {/* ── Active Workflow ── */}
          {(selectedWO || selectedInvoice) ? (
            <Card>
              <CardHeader className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-bold text-slate-100">
                    WO #{selectedWO?.wo_number || selectedInvoice?.work_order?.wo_number}
                  </h2>
                  <p className="text-slate-500 text-sm mt-0.5">
                    {selectedWO?.building || selectedInvoice?.work_order?.building}
                  </p>
                </div>
                <button onClick={closeWorkflow} className="text-slate-500 hover:text-slate-300 text-2xl leading-none transition">×</button>
              </CardHeader>

              <CardBody className="pt-5 pb-2">
                <WorkflowTracker />
              </CardBody>

              <div className="border-t border-[#1e1e2e]" />

              <CardBody className="pt-5">
                <StepContent />
              </CardBody>
            </Card>

          ) : (
            <>
              {/* ── Tabs ── */}
              <div className="flex gap-1 bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-1 w-fit flex-wrap">
                {TABS.map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition
                      ${activeTab === tab.id
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                        : 'text-slate-500 hover:text-slate-300'}`}>
                    {tab.label}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold
                      ${activeTab === tab.id ? 'bg-blue-500/20 text-blue-400' : 'bg-[#1e1e2e] text-slate-500'}`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* ── Ready ── */}
              {activeTab === 'ready' && (
                <Card>
                  <CardHeader><h2 className="text-base font-semibold text-slate-200">Work Orders Ready for CBRE Invoicing</h2></CardHeader>
                  {workOrders.length === 0
                    ? <CardBody><p className="text-center py-8 text-slate-600">No work orders ready.</p></CardBody>
                    : <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[#1e1e2e]">
                              {['WO #', 'Building', 'VWAS WO #', 'Lead Tech', ''].map(h => (
                                <th key={h} className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${h === '' ? 'text-center' : 'text-left'}`}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {workOrders.map((wo, i) => (
                              <TR key={wo.wo_id} i={i}>
                                <TD><span className="font-mono font-semibold text-blue-400">{wo.wo_number}</span></TD>
                                <TD className="text-slate-300">{wo.building}</TD>
                                <TD><span className="font-mono text-slate-400">{wo.vwas_wo_number || '—'}</span></TD>
                                <TD className="text-slate-400">{wo.lead_tech ? `${wo.lead_tech.first_name} ${wo.lead_tech.last_name}` : '—'}</TD>
                                <TD align="center">
                                  <Btn onClick={() => startWorkflow(wo)} variant="success" size="sm">Start Workflow →</Btn>
                                </TD>
                              </TR>
                            ))}
                          </tbody>
                        </table>
                      </div>
                  }
                </Card>
              )}

              {/* ── In Progress ── */}
              {activeTab === 'progress' && (
                <Card>
                  <CardHeader><h2 className="text-base font-semibold text-slate-200">Invoices In Progress</h2></CardHeader>
                  {inProgress.length === 0
                    ? <CardBody><p className="text-center py-8 text-slate-600">No invoices in progress.</p></CardBody>
                    : <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[#1e1e2e]">
                              {['Invoice #', 'WO #', 'Building', 'Total', 'Status', ''].map(h => (
                                <th key={h} className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${h === 'Total' ? 'text-right' : h === '' ? 'text-center' : 'text-left'}`}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {inProgress.map((inv, i) => (
                              <TR key={inv.invoice_id} i={i}>
                                <TD><span className="font-mono font-semibold text-slate-200">{inv.invoice_number}</span></TD>
                                <TD><span className="font-mono text-blue-400 text-xs">{inv.work_order?.wo_number}</span></TD>
                                <TD className="text-slate-400">{inv.work_order?.building}</TD>
                                <TD align="right"><span className="font-mono font-bold text-emerald-400">${inv.total?.toFixed(2)}</span></TD>
                                <TD><StatusBadge status={inv.status} /></TD>
                                <TD align="center">
                                  <Btn onClick={() => startInvoiceWorkflow(inv)} variant="warning" size="sm">Continue →</Btn>
                                </TD>
                              </TR>
                            ))}
                          </tbody>
                        </table>
                      </div>
                  }
                </Card>
              )}

              {/* ── Rejected ── */}
              {activeTab === 'rejected' && (
                <Card>
                  <CardHeader><h2 className="text-base font-semibold text-red-400">Rejected Invoices</h2></CardHeader>
                  {rejected.length === 0
                    ? <CardBody><p className="text-center py-8 text-slate-600">No rejected invoices. 🎉</p></CardBody>
                    : <>
                        <CardBody className="pb-0">
                          <InfoBox variant="red" title="Rejected by CBRE">
                            Click "Return to Draft" to make corrections and resubmit.
                          </InfoBox>
                        </CardBody>
                        <div className="overflow-x-auto mt-4">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-[#1e1e2e]">
                                {['Invoice #', 'WO #', 'Building', 'Total', ''].map(h => (
                                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${h === 'Total' ? 'text-right' : h === '' ? 'text-center' : 'text-left'}`}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rejected.map((inv, i) => (
                                <TR key={inv.invoice_id} i={i}>
                                  <TD><span className="font-mono font-semibold text-slate-200">{inv.invoice_number}</span></TD>
                                  <TD><span className="font-mono text-blue-400 text-xs">{inv.work_order?.wo_number}</span></TD>
                                  <TD className="text-slate-400">{inv.work_order?.building}</TD>
                                  <TD align="right"><span className="font-mono font-bold text-emerald-400">${inv.total?.toFixed(2)}</span></TD>
                                  <TD align="center">
                                    <Btn onClick={() => updateInvoiceStatus(inv.invoice_id, 'draft')} variant="warning" size="sm">↩️ Return to Draft</Btn>
                                  </TD>
                                </TR>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                  }
                </Card>
              )}

              {/* ── Submitted ── */}
              {activeTab === 'submitted' && (
                <Card>
                  <CardHeader><h2 className="text-base font-semibold text-slate-200">Submitted to VWAS</h2></CardHeader>
                  {submitted.length === 0
                    ? <CardBody><p className="text-center py-8 text-slate-600">No invoices submitted to VWAS yet.</p></CardBody>
                    : <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[#1e1e2e]">
                              {['Invoice #', 'WO #', 'Building', 'Total', 'Submitted', 'Status'].map(h => (
                                <th key={h} className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${h === 'Total' ? 'text-right' : 'text-left'}`}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {submitted.map((inv, i) => (
                              <TR key={inv.invoice_id} i={i}>
                                <TD><span className="font-mono font-semibold text-slate-200">{inv.invoice_number}</span></TD>
                                <TD><span className="font-mono text-blue-400 text-xs">{inv.work_order?.wo_number}</span></TD>
                                <TD className="text-slate-400">{inv.work_order?.building}</TD>
                                <TD align="right"><span className="font-mono font-bold text-emerald-400">${inv.total?.toFixed(2)}</span></TD>
                                <TD className="text-slate-500 text-xs">{inv.vwas_submitted_at ? new Date(inv.vwas_submitted_at).toLocaleDateString() : '—'}</TD>
                                <TD><StatusBadge status={inv.status} /></TD>
                              </TR>
                            ))}
                          </tbody>
                        </table>
                      </div>
                  }
                </Card>
              )}

              {/* ── Quick Reference ── */}
              <Card>
                <CardHeader><h3 className="text-sm font-semibold text-slate-300">Quick Reference — CBRE Invoice Process</h3></CardHeader>
                <CardBody>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { label: 'Steps 1–3: EMF FSM', color: 'text-emerald-400', items: ['Open RFI ticket', 'Click "Generate Invoice"', 'Preview & Finalize'] },
                      { label: 'Step 4: QuickBooks',  color: 'text-blue-400',    items: ['Create matching invoice', 'Export as PDF'] },
                      { label: 'Steps 5–6: VWAS',     color: 'text-purple-400',  items: ['Upload QB invoice PDF', 'Get photos from emfcbre@gmail.com', 'Submit to CBRE'] },
                    ].map(col => (
                      <div key={col.label} className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl p-4">
                        <p className={`text-sm font-bold mb-2.5 ${col.color}`}>{col.label}</p>
                        <ul className="space-y-1.5">
                          {col.items.map(item => (
                            <li key={item} className="flex items-center gap-2 text-xs text-slate-400">
                              <span className="w-1 h-1 rounded-full bg-slate-600 flex-shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
