'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import GlobalWOSearch from '../components/GlobalWOSearch';
import AppShell from '@/components/AppShell';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// ── Status helpers ──────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  draft:    { label: 'Draft',                          color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  approved: { label: 'Uploaded to CBRE',               color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  accepted: { label: 'Accepted – Submitted to AP',     color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  synced:   { label: 'Accepted – Submitted to AP',     color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  paid:     { label: 'Paid',                           color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  rejected: { label: 'Rejected',                       color: 'bg-red-500/15 text-red-400 border-red-500/30' },
};
const statusBadge = (status) => {
  const cfg = STATUS_CONFIG[status] || { label: status?.toUpperCase(), color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>{cfg.label}</span>;
};

// ── Filter check-in/out lines from comments ─────────────────────────────────
const filterWorkComments = (comments) => {
  if (!comments) return '';
  const lines = comments.split('\n').filter(line => {
    const t = line.trim();
    if (!t) return true;
    if (/- ✓ CHECKED IN$/i.test(t))       return false;
    if (/- ✓ ENTRADA$/i.test(t))           return false;
    if (/- ⏸ CHECKED OUT$/i.test(t))       return false;
    if (/- ⏸ SALIDA$/i.test(t))            return false;
    if (/- ✅ MARKED COMPLETE$/i.test(t))  return false;
    if (/- ✅ MARCADO COMPLETO$/i.test(t)) return false;
    return true;
  });
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

// ── Obsidian UI primitives ───────────────────────────────────────────────────
const Card = ({ children, className = '' }) => (
  <div className={`bg-[#0d0d14] border border-[#1e1e2e] rounded-xl ${className}`}>{children}</div>
);
const CardHeader = ({ children, className = '' }) => (
  <div className={`px-6 py-4 border-b border-[#1e1e2e] ${className}`}>{children}</div>
);
const CardBody = ({ children, className = '' }) => (
  <div className={`px-6 py-4 ${className}`}>{children}</div>
);

const Btn = ({ children, onClick, disabled, variant = 'default', size = 'md', className = '' }) => {
  const variants = {
    default:   'bg-[#1e1e2e] border border-[#2d2d44] text-slate-300 hover:text-slate-100 hover:bg-[#2d2d44]',
    primary:   'bg-blue-600 hover:bg-blue-500 text-white',
    success:   'bg-emerald-600 hover:bg-emerald-500 text-white',
    warning:   'bg-yellow-600 hover:bg-yellow-500 text-white',
    danger:    'bg-red-600 hover:bg-red-500 text-white',
    orange:    'bg-orange-600 hover:bg-orange-500 text-white',
    ghost:     'text-slate-400 hover:text-slate-200 hover:bg-[#1e1e2e]',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-3 text-base',
    xl: 'px-6 py-4 text-lg',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-150
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
};

// ── Modal wrapper ────────────────────────────────────────────────────────────
const Modal = ({ children, onClose }) => (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
    <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-2xl max-w-4xl w-full my-8 shadow-2xl">
      {children}
    </div>
  </div>
);
const ModalHeader = ({ title, subtitle, onClose }) => (
  <div className="sticky top-0 bg-[#0d0d14] border-b border-[#1e1e2e] px-6 py-5 flex justify-between items-start rounded-t-2xl z-10">
    <div>
      <h2 className="text-xl font-bold text-slate-100">{title}</h2>
      {subtitle && <p className="text-slate-500 text-sm mt-0.5">{subtitle}</p>}
    </div>
    <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition text-2xl leading-none mt-0.5">×</button>
  </div>
);
const ModalBody = ({ children }) => (
  <div className="p-6 space-y-5 max-h-[calc(100vh-180px)] overflow-y-auto">{children}</div>
);

// ── Input ────────────────────────────────────────────────────────────────────
const Input = ({ className = '', ...props }) => (
  <input
    className={`bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 placeholder-slate-600
      rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/60 transition ${className}`}
    {...props}
  />
);
const Textarea = ({ className = '', ...props }) => (
  <textarea
    className={`bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 placeholder-slate-600
      rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/60 transition resize-none ${className}`}
    {...props}
  />
);

// ── Label / value pair ───────────────────────────────────────────────────────
const Field = ({ label, children }) => (
  <div>
    <span className="text-slate-500 text-xs uppercase tracking-wider">{label}</span>
    <div className="text-slate-200 text-sm mt-0.5 font-medium">{children}</div>
  </div>
);

// ════════════════════════════════════════════════════════════════════════════
export default function InvoicingPage() {
  const [acknowledgedWOs, setAcknowledgedWOs]           = useState([]);
  const [filteredAcknowledgedWOs, setFilteredAcknowledgedWOs] = useState([]);
  const [woTotals, setWoTotals]                         = useState({});
  const [invoices, setInvoices]                         = useState([]);
  const [filteredInvoices, setFilteredInvoices]         = useState([]);
  const [selectedItem, setSelectedItem]                 = useState(null);
  const [lineItems, setLineItems]                       = useState([]);
  const [loading, setLoading]                           = useState(true);
  const [activeTab, setActiveTab]                       = useState('ready');
  const [generatingInvoice, setGeneratingInvoice]       = useState(false);
  const [showInvoicePreview, setShowInvoicePreview]     = useState(false);
  const [previewWO, setPreviewWO]                       = useState(null);
  const [previewLineItems, setPreviewLineItems]         = useState([]);
  const [workPerformedText, setWorkPerformedText]       = useState('');
  const [customLineItem, setCustomLineItem]             = useState({ description: '', quantity: 1, unit_price: 0 });
  const [showGlobalSearch, setShowGlobalSearch]         = useState(false);
  const [readySearchTerm, setReadySearchTerm]           = useState('');
  const [invoiceSearchTerm, setInvoiceSearchTerm]       = useState('');

  // ── Filter effects ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!readySearchTerm.trim()) { setFilteredAcknowledgedWOs(acknowledgedWOs); return; }
    const s = readySearchTerm.toLowerCase();
    setFilteredAcknowledgedWOs(acknowledgedWOs.filter(wo =>
      wo.wo_number?.toLowerCase().includes(s) ||
      wo.building?.toLowerCase().includes(s) ||
      (wo.lead_tech && `${wo.lead_tech.first_name} ${wo.lead_tech.last_name}`.toLowerCase().includes(s))
    ));
  }, [readySearchTerm, acknowledgedWOs]);

  useEffect(() => {
    if (!invoiceSearchTerm.trim()) { setFilteredInvoices(invoices); return; }
    const s = invoiceSearchTerm.toLowerCase();
    setFilteredInvoices(invoices.filter(inv =>
      inv.invoice_number?.toLowerCase().includes(s) ||
      inv.work_order?.wo_number?.toLowerCase().includes(s) ||
      inv.work_order?.building?.toLowerCase().includes(s)
    ));
  }, [invoiceSearchTerm, invoices]);

  useEffect(() => { fetchData(); }, []);

  // ── Data fetching ────────────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchAcknowledgedWorkOrders(), fetchInvoices()]);
    setLoading(false);
  };

  const fetchAcknowledgedWorkOrders = async () => {
    const { data, error } = await supabase.from('work_orders')
      .select('*, lead_tech:users!lead_tech_id(first_name, last_name, email)')
      .eq('acknowledged', true).eq('is_locked', false)
      .order('acknowledged_at', { ascending: false });
    if (!error) {
      setAcknowledgedWOs(data || []);
      if (data?.length) calculateAllTotals(data);
    }
  };

  const calculateAllTotals = async (workOrders) => {
    const totals = {};
    for (const wo of workOrders) {
      try {
        const pRT = parseFloat(wo.hours_regular) || 0;
        const pOT = parseFloat(wo.hours_overtime) || 0;
        const pMi = parseFloat(wo.miles) || 0;

        const { data: teams } = await supabase.from('work_order_assignments')
          .select('hours_regular, hours_overtime, miles').eq('wo_id', wo.wo_id);
        let tRT = 0, tOT = 0, tMi = 0;
        teams?.forEach(m => { tRT += parseFloat(m.hours_regular)||0; tOT += parseFloat(m.hours_overtime)||0; tMi += parseFloat(m.miles)||0; });

        const { data: daily } = await supabase.from('daily_hours_log')
          .select('hours_regular, hours_overtime, miles').eq('wo_id', wo.wo_id);
        let dRT = 0, dOT = 0, dMi = 0;
        daily?.forEach(l => { dRT += parseFloat(l.hours_regular)||0; dOT += parseFloat(l.hours_overtime)||0; dMi += parseFloat(l.miles)||0; });

        const totalRT = pRT+tRT+dRT, totalOT = pOT+tOT+dOT, totalMi = pMi+tMi+dMi;
        totals[wo.wo_id] =
          (totalRT*64) + (totalOT*96) + 128 +
          (totalMi*1) +
          ((parseFloat(wo.material_cost)||0)*1.25) +
          ((parseFloat(wo.emf_equipment_cost)||0)*1.25) +
          ((parseFloat(wo.trailer_cost)||0)*1.25) +
          ((parseFloat(wo.rental_cost)||0)*1.25);
      } catch { totals[wo.wo_id] = 128; }
    }
    setWoTotals(totals);
  };

  const fetchInvoices = async () => {
    const { data } = await supabase.from('invoices')
      .select('*, work_order:work_orders(wo_number, building, work_order_description, comments, lead_tech:users!lead_tech_id(first_name, last_name))')
      .order('created_at', { ascending: false });
    setInvoices(data || []);
  };

  // ── Actions ──────────────────────────────────────────────────────────────
  const selectWorkOrder = (wo) => setSelectedItem({ type: 'work_order', data: wo });

  const selectInvoice = async (invoice) => {
    const { data } = await supabase.from('invoice_line_items')
      .select('*').eq('invoice_id', invoice.invoice_id).order('line_item_id', { ascending: true });
    setLineItems(data || []);
    setSelectedItem({ type: 'invoice', data: invoice });
  };

  const generateInvoicePreview = async (woId) => {
    const wo = acknowledgedWOs.find(w => w.wo_id === woId);
    if (!wo) return;
    setGeneratingInvoice(true);
    try {
      const pRT = parseFloat(wo.hours_regular)||0, pOT = parseFloat(wo.hours_overtime)||0, pMi = parseFloat(wo.miles)||0;
      const { data: teams } = await supabase.from('work_order_assignments')
        .select('*, user:users(first_name, last_name)').eq('wo_id', woId);
      let tRT=0, tOT=0, tMi=0;
      teams?.forEach(m => { tRT+=parseFloat(m.hours_regular)||0; tOT+=parseFloat(m.hours_overtime)||0; tMi+=parseFloat(m.miles)||0; });
      const { data: daily } = await supabase.from('daily_hours_log').select('*').eq('wo_id', woId);
      let dRT=0, dOT=0, dMi=0;
      daily?.forEach(l => { dRT+=parseFloat(l.hours_regular)||0; dOT+=parseFloat(l.hours_overtime)||0; dMi+=parseFloat(l.miles)||0; });
      const totalRT=pRT+tRT+dRT, totalOT=pOT+tOT+dOT, totalMi=pMi+tMi+dMi;

      const items = [];
      if (totalRT>0) items.push({ description:`Labor – Regular Time (${totalRT} hrs @ $64/hr)`, quantity:totalRT, unit_price:64, amount:totalRT*64, line_type:'labor', editable:true });
      if (totalOT>0) items.push({ description:`Labor – Overtime (${totalOT} hrs @ $96/hr)`, quantity:totalOT, unit_price:96, amount:totalOT*96, line_type:'labor', editable:true });
      items.push({ description:'Administrative Hours (2 hrs @ $64/hr)', quantity:2, unit_price:64, amount:128, line_type:'labor', editable:true });
      if (totalMi>0) items.push({ description:`Mileage (${totalMi} miles @ $1.00/mile)`, quantity:totalMi, unit_price:1, amount:totalMi, line_type:'mileage', editable:true });
      const mat = parseFloat(wo.material_cost)||0;       if (mat>0)  items.push({ description:'Materials',  quantity:1, unit_price:mat*1.25,  amount:mat*1.25,  line_type:'material',  editable:true });
      const eqp = parseFloat(wo.emf_equipment_cost)||0;  if (eqp>0)  items.push({ description:'Equipment',  quantity:1, unit_price:eqp*1.25,  amount:eqp*1.25,  line_type:'equipment', editable:true });
      const trl = parseFloat(wo.trailer_cost)||0;        if (trl>0)  items.push({ description:'Trailer',    quantity:1, unit_price:trl*1.25,  amount:trl*1.25,  line_type:'equipment', editable:true });
      const ren = parseFloat(wo.rental_cost)||0;         if (ren>0)  items.push({ description:'Rental',     quantity:1, unit_price:ren*1.25,  amount:ren*1.25,  line_type:'rental',    editable:true });

      let wp = filterWorkComments(wo.comments) || filterWorkComments(wo.comments_english) || wo.work_order_description || 'Work completed as requested.';
      setWorkPerformedText(wp);
      setPreviewWO(wo);
      setPreviewLineItems(items);
      setShowInvoicePreview(true);
      setSelectedItem(null);
    } catch (err) { alert('❌ Failed to generate preview: ' + err.message); }
    finally { setGeneratingInvoice(false); }
  };

  const finalizeInvoice = async () => {
    if (!previewWO || !confirm('Finalize and generate this invoice?\n\nThis will lock the work order.')) return;
    setGeneratingInvoice(true);
    try {
      const subtotal = previewLineItems.reduce((s,i) => s+i.amount, 0);
      const year = new Date().getFullYear();
      const { data: last } = await supabase.from('invoices').select('invoice_number')
        .like('invoice_number', `INV-${year}-%`).order('created_at', { ascending: false }).limit(1).single();
      const num = last ? parseInt(last.invoice_number.split('-')[2])+1 : 1;
      const invoiceNumber = `INV-${year}-${String(num).padStart(5,'0')}`;

      const { data: invoice, error: ie } = await supabase.from('invoices').insert({
        invoice_number: invoiceNumber, wo_id: previewWO.wo_id,
        invoice_date: new Date().toISOString(),
        due_date: new Date(Date.now()+30*24*60*60*1000).toISOString(),
        subtotal, tax:0, total:subtotal, status:'draft', notes:'Invoice generated from preview'
      }).select().single();
      if (ie) throw ie;

      const { error: lie } = await supabase.from('invoice_line_items').insert([
        ...previewLineItems.map(item => ({ invoice_id:invoice.invoice_id, description:item.description, quantity:item.quantity, unit_price:item.unit_price, amount:item.amount, line_type:item.line_type })),
        { invoice_id:invoice.invoice_id, description:workPerformedText, quantity:1, unit_price:0, amount:0, line_type:'description' }
      ]);
      if (lie) throw lie;

      const { error: we } = await supabase.from('work_orders').update({ is_locked:true, locked_at:new Date().toISOString(), locked_by:null }).eq('wo_id', previewWO.wo_id);
      if (we) throw we;

      alert(`✅ Invoice generated!\n\nTotal: $${subtotal.toFixed(2)}`);
      setShowInvoicePreview(false); setPreviewWO(null); setPreviewLineItems([]); setWorkPerformedText('');
      setAcknowledgedWOs(prev => prev.filter(w => w.wo_id !== previewWO.wo_id));
      await fetchData(); setActiveTab('invoiced');
    } catch (err) { alert('❌ ' + err.message); }
    finally { setGeneratingInvoice(false); }
  };

  const returnToTech = async (woId, invoiceId) => {
    const reason = prompt('Enter reason for returning to tech (REQUIRED):');
    if (!reason?.trim()) { alert('❌ A reason is required.'); return; }
    if (!confirm('Return this work order to tech for review?')) return;
    try {
      const { data: woData } = await supabase.from('work_orders').select('comments').eq('wo_id', woId).single();
      await supabase.from('invoice_line_items').delete().eq('invoice_id', invoiceId);
      await supabase.from('invoices').delete().eq('invoice_id', invoiceId);
      const ts = new Date().toLocaleString('en-US', { timeZone:'America/New_York', month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit', hour12:true });
      const note = `[${ts}] 🔄 RETURNED FROM INVOICING FOR TECH REVIEW:\n${reason}`;
      await supabase.from('work_orders').update({
        is_locked:false, locked_at:null, locked_by:null, acknowledged:false, acknowledged_at:null,
        status:'tech_review', comments: woData.comments ? `${woData.comments}\n\n${note}` : note
      }).eq('wo_id', woId);
      alert('✅ Work order returned to tech.'); setSelectedItem(null); await fetchData();
    } catch (err) { alert('❌ ' + err.message); }
  };

  const updateInvoiceStatus = async (invoiceId, newStatus) => {
    const { error } = await supabase.from('invoices').update({ status: newStatus }).eq('invoice_id', invoiceId);
    if (error) { alert('Error: ' + error.message); return; }
    alert(`✅ Invoice marked as ${newStatus}`); await fetchData(); setSelectedItem(null);
  };

  const deleteInvoice = async (invoiceId, woId) => {
    if (prompt('Enter admin password:') !== 'EMF2024!') { alert('❌ Invalid password'); return; }
    if (!confirm('Delete this invoice? This CANNOT be undone.')) return;
    try {
      await supabase.from('invoice_line_items').delete().eq('invoice_id', invoiceId);
      await supabase.from('invoices').delete().eq('invoice_id', invoiceId);
      await supabase.from('work_orders').update({ is_locked:false, locked_at:null, locked_by:null, acknowledged:false, acknowledged_at:null }).eq('wo_id', woId);
      alert('✅ Invoice deleted.'); setSelectedItem(null); await fetchData();
    } catch (err) { alert('❌ ' + err.message); }
  };

  const printInvoice  = (inv) => window.open(`/invoices/${inv.invoice_id}/print`, '_blank');
  const shareInvoice  = async (inv) => {
    const url = `${window.location.origin}/invoices/${inv.invoice_id}/print`;
    if (navigator.share) { try { await navigator.share({ title:`Invoice ${inv.invoice_number}`, url }); } catch {} }
    else { navigator.clipboard.writeText(url); alert('📋 Link copied!'); }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <AppShell activeLink="/invoices">
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
            <p className="text-slate-500 text-sm">Loading invoices…</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const previewTotal = previewLineItems.reduce((s,i) => s+i.amount, 0);

  // ════════════════════════════════════════════════════════════════════════
  return (
    <AppShell activeLink="/invoices">
      <div className="min-h-screen bg-[#0a0a0f] text-slate-200">

        {/* ── Page Header ── */}
        <div className="border-b border-[#1e1e2e] bg-[#0d0d14] px-6 py-5">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">Invoicing</h1>
              <p className="text-slate-500 text-sm mt-0.5">Generate and manage invoices for completed work orders</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Btn onClick={() => setShowGlobalSearch(true)} variant="default" size="sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                Search WOs
              </Btn>
              <Btn onClick={() => window.location.href='/invoices/cbre'} variant="primary" size="sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                CBRE Workflow
              </Btn>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">

          {/* ── Tabs ── */}
          <div className="flex gap-1 bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-1 w-fit">
            {[
              { id:'ready',    label:`Ready to Invoice`, count: acknowledgedWOs.length },
              { id:'invoiced', label:'Invoices',         count: invoices.length },
            ].map(tab => (
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

          {/* ── Ready Tab ── */}
          {activeTab === 'ready' && (
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-200">Acknowledged Work Orders</h2>
                <div className="flex items-center gap-2">
                  <Input value={readySearchTerm} onChange={e => setReadySearchTerm(e.target.value)}
                    placeholder="Search WO#, building, tech…" className="w-56" />
                  {readySearchTerm && (
                    <Btn onClick={() => setReadySearchTerm('')} variant="ghost" size="sm">Clear</Btn>
                  )}
                </div>
              </CardHeader>

              {filteredAcknowledgedWOs.length === 0 ? (
                <CardBody>
                  <div className="text-center py-12 text-slate-600">
                    {readySearchTerm
                      ? <><p>No work orders matching <span className="text-slate-400">"{readySearchTerm}"</span></p><Btn onClick={() => setReadySearchTerm('')} variant="ghost" size="sm" className="mt-3">Clear search</Btn></>
                      : <><p className="text-lg font-medium text-slate-500 mb-1">No work orders ready</p><p className="text-sm">Work orders must be completed and acknowledged first.</p></>
                    }
                  </div>
                </CardBody>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#1e1e2e]">
                        {['WO #', 'Building', 'Lead Tech', 'Acknowledged', 'Est. Total', ''].map(h => (
                          <th key={h} className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${h === 'Est. Total' ? 'text-right' : h === '' ? 'text-center' : 'text-left'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAcknowledgedWOs.map((wo, i) => (
                        <tr key={wo.wo_id}
                          className={`border-b border-[#1e1e2e]/60 hover:bg-[#1e1e2e]/40 transition ${i % 2 === 0 ? '' : 'bg-[#0a0a0f]/30'}`}>
                          <td className="px-4 py-3 font-mono font-semibold text-blue-400">{wo.wo_number}</td>
                          <td className="px-4 py-3 text-slate-300">{wo.building}</td>
                          <td className="px-4 py-3 text-slate-400">{wo.lead_tech ? `${wo.lead_tech.first_name} ${wo.lead_tech.last_name}` : '—'}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{wo.acknowledged_at ? new Date(wo.acknowledged_at).toLocaleString() : '—'}</td>
                          <td className="px-4 py-3 text-right font-bold font-mono text-emerald-400">
                            {woTotals[wo.wo_id] !== undefined
                              ? `$${woTotals[wo.wo_id].toFixed(2)}`
                              : <span className="text-slate-600 text-xs animate-pulse">calculating…</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Btn onClick={() => selectWorkOrder(wo)} variant="success" size="sm">Generate</Btn>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* ── Invoiced Tab ── */}
          {activeTab === 'invoiced' && (
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-200">Generated Invoices</h2>
                <div className="flex items-center gap-2">
                  <Input value={invoiceSearchTerm} onChange={e => setInvoiceSearchTerm(e.target.value)}
                    placeholder="Search Invoice#, WO#, building…" className="w-64" />
                  {invoiceSearchTerm && (
                    <Btn onClick={() => setInvoiceSearchTerm('')} variant="ghost" size="sm">Clear</Btn>
                  )}
                </div>
              </CardHeader>

              {filteredInvoices.length === 0 ? (
                <CardBody>
                  <div className="text-center py-12 text-slate-600">
                    {invoiceSearchTerm
                      ? <><p>No invoices matching <span className="text-slate-400">"{invoiceSearchTerm}"</span></p><Btn onClick={() => setInvoiceSearchTerm('')} variant="ghost" size="sm" className="mt-3">Clear</Btn></>
                      : <p>No invoices generated yet.</p>}
                  </div>
                </CardBody>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#1e1e2e]">
                        {['Invoice #', 'Work Order', 'Building', 'Date', 'Total', 'Status', ''].map(h => (
                          <th key={h} className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${h === 'Total' ? 'text-right' : h === '' ? 'text-center' : 'text-left'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map((inv, i) => (
                        <tr key={inv.invoice_id} onClick={() => selectInvoice(inv)}
                          className={`border-b border-[#1e1e2e]/60 hover:bg-[#1e1e2e]/40 transition cursor-pointer ${i % 2 === 0 ? '' : 'bg-[#0a0a0f]/30'}`}>
                          <td className="px-4 py-3 font-mono font-semibold text-slate-200">{inv.invoice_number}</td>
                          <td className="px-4 py-3 font-mono text-blue-400 text-xs">{inv.work_order?.wo_number}</td>
                          <td className="px-4 py-3 text-slate-400">{inv.work_order?.building}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-right font-bold font-mono text-emerald-400">${inv.total.toFixed(2)}</td>
                          <td className="px-4 py-3">{statusBadge(inv.status)}</td>
                          <td className="px-4 py-3 text-center text-slate-600">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline"><polyline points="9 18 15 12 9 6"/></svg>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            MODAL: Work Order detail
        ══════════════════════════════════════════════════════════════════ */}
        {selectedItem?.type === 'work_order' && (
          <Modal onClose={() => setSelectedItem(null)}>
            <ModalHeader
              title={`WO #${selectedItem.data.wo_number}`}
              subtitle={`${selectedItem.data.building} — Ready for Invoice`}
              onClose={() => setSelectedItem(null)} />
            <ModalBody>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Lead Tech">
                  {selectedItem.data.lead_tech
                    ? `${selectedItem.data.lead_tech.first_name} ${selectedItem.data.lead_tech.last_name}`
                    : '—'}
                </Field>
                <Field label="Acknowledged">{selectedItem.data.acknowledged_at ? new Date(selectedItem.data.acknowledged_at).toLocaleString() : '—'}</Field>
                <Field label="NTE Budget"><span className="text-yellow-400 font-mono">${(selectedItem.data.nte || 0).toFixed(2)}</span></Field>
                <Field label="Est. Invoice Total">
                  <span className="text-emerald-400 font-mono">
                    {woTotals[selectedItem.data.wo_id] !== undefined ? `$${woTotals[selectedItem.data.wo_id].toFixed(2)}` : '…'}
                  </span>
                </Field>
              </div>

              {selectedItem.data.work_order_description && (
                <Field label="Description">{selectedItem.data.work_order_description}</Field>
              )}

              {selectedItem.data.comments && (
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1.5">Tech's Work Notes</p>
                  <div className="bg-[#0a0a0f] border border-[#2d2d44] rounded-lg p-3 text-sm text-slate-300 whitespace-pre-wrap max-h-36 overflow-y-auto font-mono leading-relaxed">
                    {selectedItem.data.comments}
                  </div>
                </div>
              )}

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-300">
                <p className="font-semibold mb-1">Ready to generate invoice</p>
                <p className="text-blue-400/70 text-xs leading-relaxed">Hours from daily_hours_log will be included. Materials, equipment, trailer and rental are marked up 25%. You can edit line items before finalizing.</p>
              </div>

              <Btn onClick={() => generateInvoicePreview(selectedItem.data.wo_id)}
                disabled={generatingInvoice} variant="success" size="xl" className="w-full">
                {generatingInvoice ? 'Loading Preview…' : 'Preview & Generate Invoice'}
              </Btn>
            </ModalBody>
          </Modal>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            MODAL: Invoice Preview
        ══════════════════════════════════════════════════════════════════ */}
        {showInvoicePreview && previewWO && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-2xl max-w-5xl w-full my-8 shadow-2xl">
              <div className="sticky top-0 bg-[#0d0d14] border-b border-[#1e1e2e] px-6 py-5 flex justify-between items-start rounded-t-2xl z-10">
                <div>
                  <h2 className="text-xl font-bold text-slate-100">Invoice Preview</h2>
                  <p className="text-slate-500 text-sm mt-0.5">WO #{previewWO.wo_number} — {previewWO.building}</p>
                </div>
                <button onClick={() => { setShowInvoicePreview(false); setPreviewWO(null); setPreviewLineItems([]); setWorkPerformedText(''); }}
                  className="text-slate-500 hover:text-slate-300 text-2xl leading-none">×</button>
              </div>

              <div className="p-6 space-y-5 max-h-[calc(100vh-180px)] overflow-y-auto">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-300">
                  Review and edit line items below before finalizing. Changes won't be saved until you click Finalize.
                </div>

                {/* Line Items */}
                <Card>
                  <CardHeader>
                    <h3 className="text-sm font-semibold text-slate-300">Line Items</h3>
                    <p className="text-slate-600 text-xs mt-0.5">Edit description, quantity or price inline</p>
                  </CardHeader>
                  <CardBody className="space-y-2">
                    {/* Column headers */}
                    <div className="grid grid-cols-12 gap-2 text-xs text-slate-600 uppercase tracking-wider px-1 pb-1">
                      <div className="col-span-5">Description</div>
                      <div className="col-span-2 text-right">Qty</div>
                      <div className="col-span-2 text-right">Unit $</div>
                      <div className="col-span-2 text-right">Amount</div>
                      <div className="col-span-1" />
                    </div>
                    {previewLineItems.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-[#0a0a0f] border border-[#2d2d44]/60 rounded-lg p-2">
                        <div className="col-span-5">
                          <Input value={item.description}
                            onChange={e => { const u=[...previewLineItems]; u[idx].description=e.target.value; setPreviewLineItems(u); }}
                            className="w-full text-xs" />
                        </div>
                        <div className="col-span-2">
                          <Input type="number" step="0.01" value={item.quantity}
                            onChange={e => { const u=[...previewLineItems]; u[idx].quantity=parseFloat(e.target.value)||0; u[idx].amount=u[idx].quantity*u[idx].unit_price; setPreviewLineItems(u); }}
                            className="w-full text-right text-xs" />
                        </div>
                        <div className="col-span-2">
                          <Input type="number" step="0.01" value={item.unit_price}
                            onChange={e => { const u=[...previewLineItems]; u[idx].unit_price=parseFloat(e.target.value)||0; u[idx].amount=u[idx].quantity*u[idx].unit_price; setPreviewLineItems(u); }}
                            className="w-full text-right text-xs" />
                        </div>
                        <div className="col-span-2 text-right font-mono font-bold text-emerald-400 text-sm">${item.amount.toFixed(2)}</div>
                        <div className="col-span-1 text-center">
                          <button onClick={() => setPreviewLineItems(previewLineItems.filter((_,i)=>i!==idx))}
                            className="text-red-500/50 hover:text-red-400 transition text-lg leading-none">×</button>
                        </div>
                      </div>
                    ))}
                  </CardBody>
                </Card>

                {/* Add custom line item */}
                <Card>
                  <CardHeader><h3 className="text-sm font-semibold text-slate-300">Add Custom Line Item</h3></CardHeader>
                  <CardBody>
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-6">
                        <label className="block text-xs text-slate-500 mb-1">Description</label>
                        <Input value={customLineItem.description} onChange={e => setCustomLineItem({...customLineItem, description:e.target.value})}
                          placeholder="e.g., Additional Service" className="w-full" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-slate-500 mb-1">Qty</label>
                        <Input type="number" step="0.01" value={customLineItem.quantity}
                          onChange={e => setCustomLineItem({...customLineItem, quantity:parseFloat(e.target.value)||0})}
                          className="w-full text-right" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-slate-500 mb-1">Unit $</label>
                        <Input type="number" step="0.01" value={customLineItem.unit_price}
                          onChange={e => setCustomLineItem({...customLineItem, unit_price:parseFloat(e.target.value)||0})}
                          className="w-full text-right" />
                      </div>
                      <div className="col-span-2">
                        <Btn onClick={() => {
                          if (!customLineItem.description.trim()) { alert('Description required'); return; }
                          setPreviewLineItems([...previewLineItems, { description:customLineItem.description, quantity:customLineItem.quantity, unit_price:customLineItem.unit_price, amount:customLineItem.quantity*customLineItem.unit_price, line_type:'custom', editable:true }]);
                          setCustomLineItem({ description:'', quantity:1, unit_price:0 });
                        }} variant="success" size="sm" className="w-full">Add</Btn>
                      </div>
                    </div>
                  </CardBody>
                </Card>

                {/* Work Performed */}
                <Card>
                  <CardHeader>
                    <h3 className="text-sm font-semibold text-slate-300">Work Performed</h3>
                    <p className="text-slate-600 text-xs mt-0.5">This text appears on the invoice. Edit as needed.</p>
                  </CardHeader>
                  <CardBody>
                    <Textarea value={workPerformedText} onChange={e => setWorkPerformedText(e.target.value)}
                      rows={7} placeholder="Describe work performed…" className="w-full" />
                  </CardBody>
                </Card>

                {/* Totals */}
                <Card>
                  <CardBody>
                    <div className="flex justify-end">
                      <div className="w-72 space-y-2">
                        <div className="flex justify-between text-sm text-slate-400">
                          <span>Subtotal</span><span className="font-mono">${previewTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-slate-600">
                          <span>Tax</span><span className="font-mono">$0.00</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-[#2d2d44] text-xl font-bold">
                          <span className="text-slate-200">Total</span>
                          <span className="text-emerald-400 font-mono">${previewTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>

                {/* Actions */}
                <div className="flex gap-3 pt-2 border-t border-[#1e1e2e]">
                  <Btn onClick={finalizeInvoice} disabled={generatingInvoice} variant="success" size="xl" className="flex-1">
                    {generatingInvoice ? 'Generating…' : '✅ Finalize & Generate Invoice'}
                  </Btn>
                  <Btn onClick={() => { setShowInvoicePreview(false); setPreviewWO(null); setPreviewLineItems([]); setWorkPerformedText(''); }}
                    variant="default" size="xl">Cancel</Btn>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            MODAL: Invoice detail
        ══════════════════════════════════════════════════════════════════ */}
        {selectedItem?.type === 'invoice' && (
          <Modal onClose={() => setSelectedItem(null)}>
            <ModalHeader
              title={`Invoice #${selectedItem.data.invoice_number}`}
              subtitle={`WO #${selectedItem.data.work_order?.wo_number} — ${selectedItem.data.work_order?.building}`}
              onClose={() => setSelectedItem(null)} />
            <ModalBody>
              {/* Meta */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Status">{statusBadge(selectedItem.data.status)}</Field>
                <Field label="Lead Tech">
                  {selectedItem.data.work_order?.lead_tech
                    ? `${selectedItem.data.work_order.lead_tech.first_name} ${selectedItem.data.work_order.lead_tech.last_name}` : '—'}
                </Field>
                <Field label="Invoice Date">{new Date(selectedItem.data.invoice_date).toLocaleDateString()}</Field>
                <Field label="Due Date">{new Date(selectedItem.data.due_date).toLocaleDateString()}</Field>
              </div>

              {/* Line Items */}
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Line Items</p>
                <div className="space-y-1.5">
                  {lineItems.map(item => (
                    <div key={item.line_item_id}
                      className={`rounded-lg p-3 ${item.line_type === 'description' ? 'bg-[#0a0a0f] border border-[#1e1e2e]' : 'bg-[#1e1e2e]/50'}`}>
                      {item.line_type === 'description' ? (
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Work Performed</p>
                          <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{item.description}</p>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm text-slate-200 font-medium">{item.description}</p>
                            <p className="text-xs text-slate-600 mt-0.5">{item.line_type?.toUpperCase()}</p>
                          </div>
                          <div className="text-right ml-4 flex-shrink-0">
                            <p className="font-mono font-bold text-emerald-400">${item.amount.toFixed(2)}</p>
                            {item.quantity>0 && item.unit_price>0 && (
                              <p className="text-xs text-slate-600">{item.quantity} × ${item.unit_price.toFixed(2)}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl p-4">
                <div className="flex justify-end">
                  <div className="w-64 space-y-1.5 text-sm">
                    <div className="flex justify-between text-slate-400">
                      <span>Subtotal</span><span className="font-mono">${selectedItem.data.subtotal.toFixed(2)}</span>
                    </div>
                    {selectedItem.data.tax>0 && (
                      <div className="flex justify-between text-slate-400">
                        <span>Tax</span><span className="font-mono">${selectedItem.data.tax.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-1.5 border-t border-[#2d2d44] text-lg font-bold">
                      <span className="text-slate-200">Total</span>
                      <span className="text-emerald-400 font-mono">${selectedItem.data.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2">
                <Btn onClick={() => printInvoice(selectedItem.data)} variant="default">🖨️ Print</Btn>
                <Btn onClick={() => shareInvoice(selectedItem.data)} variant="default">📤 Share</Btn>
              </div>

              <div className="space-y-2">
                {selectedItem.data.status === 'draft' && (<>
                  <Btn onClick={() => returnToTech(selectedItem.data.wo_id, selectedItem.data.invoice_id)} variant="orange" size="lg" className="w-full">🔄 Return to Tech for Review</Btn>
                  <Btn onClick={() => updateInvoiceStatus(selectedItem.data.invoice_id, 'approved')} variant="primary" size="lg" className="w-full">📤 Uploaded to CBRE</Btn>
                </>)}
                {selectedItem.data.status === 'approved' && (<>
                  <Btn onClick={() => updateInvoiceStatus(selectedItem.data.invoice_id, 'draft')} variant="warning" size="lg" className="w-full">↩️ Return to Draft</Btn>
                  <Btn onClick={() => updateInvoiceStatus(selectedItem.data.invoice_id, 'accepted')} variant="success" size="lg" className="w-full">✅ Accepted – Submitted to AP</Btn>
                </>)}
                {(selectedItem.data.status==='accepted'||selectedItem.data.status==='synced') && (<>
                  <Btn onClick={() => updateInvoiceStatus(selectedItem.data.invoice_id, 'draft')} variant="warning" size="lg" className="w-full">↩️ Return to Draft</Btn>
                  <Btn onClick={() => updateInvoiceStatus(selectedItem.data.invoice_id, 'paid')} variant="success" size="lg" className="w-full">💰 Mark as Paid</Btn>
                </>)}
                {selectedItem.data.status==='paid' && (
                  <Btn onClick={() => updateInvoiceStatus(selectedItem.data.invoice_id, 'draft')} variant="warning" size="lg" className="w-full">↩️ Return to Draft</Btn>
                )}
                {selectedItem.data.status==='rejected' && (<>
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                    <p className="text-red-400 font-semibold text-sm">❌ Invoice Rejected by CBRE</p>
                    <p className="text-red-400/60 text-xs mt-0.5">Return to draft to make changes and resubmit.</p>
                  </div>
                  <Btn onClick={() => updateInvoiceStatus(selectedItem.data.invoice_id, 'draft')} variant="warning" size="lg" className="w-full">↩️ Return to Draft</Btn>
                </>)}

                <div className="pt-2 border-t border-[#1e1e2e] space-y-1.5">
                  <Btn onClick={() => deleteInvoice(selectedItem.data.invoice_id, selectedItem.data.wo_id)} variant="danger" size="lg" className="w-full">🗑️ Delete Invoice (Admin)</Btn>
                  <p className="text-xs text-slate-600 text-center">⚠️ Requires admin password. Cannot be undone.</p>
                </div>

                <Btn onClick={() => setSelectedItem(null)} variant="default" size="lg" className="w-full">Close</Btn>
              </div>
            </ModalBody>
          </Modal>
        )}

        {/* Global Search */}
        {showGlobalSearch && <GlobalWOSearch onClose={() => setShowGlobalSearch(false)} />}
      </div>
    </AppShell>
  );
}
