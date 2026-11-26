'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRequireRole, GateScreen } from '@/app/components/useRequireRole';
import { getSupabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/apiClient';

// Shared browser client: it carries the signed-in staff session, which the
// row-level security on subcontractor_* tables requires (is_staff()). A fresh
// anon client here would be refused once those policies are on.
const supabase = getSupabase();

// Helper function to format date without timezone shift
function formatDateLocal(dateString) {
  if (!dateString) return '-';
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SubcontractorInvoiceReview() {
  // This page has no layout of its own, so the gate lives here.
  const { ready, user: signedIn } = useRequireRole(['admin'], { superuserOnly: true });
  const [invoices, setInvoices] = useState([]);
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [emfData, setEmfData] = useState([]);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [overlaps, setOverlaps] = useState([]);
  const [openWOs, setOpenWOs] = useState([]);
  const [rejectNote, setRejectNote] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [actionError, setActionError] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  // Reviewing your own invoice is not a review. The signed-in person's own
  // invoices are out of this list by default; the toggle is there because
  // they still have to be marked sent and paid from somewhere.
  const [myUserIds, setMyUserIds] = useState(new Set());
  const [includeMine, setIncludeMine] = useState(false);

  useEffect(() => {
    if (ready) loadData();
  }, [ready]);

  // Switching your own invoices back off must also close one that is open,
  // otherwise the detail pane keeps showing what the list no longer has.
  useEffect(() => {
    if (!includeMine && selectedInvoice && myUserIds.has(selectedInvoice.user_id)) {
      setSelectedInvoice(null);
      setInvoiceItems([]);
      setEmfData([]);
    }
  }, [includeMine, myUserIds, selectedInvoice]);

  async function loadData() {
    try {
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('subcontractor_invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (invoicesError) throw invoicesError;

      const { data: usersData } = await supabase
        .from('users')
        .select('user_id, first_name, last_name, email, auth_id, same_person_as');

      const usersMap = {};
      (usersData || []).forEach(u => {
        usersMap[u.user_id] = u;
      });

      // Which users rows are "me". The person signing in as ADMIN EMF is the
      // same human as the technician row the SUB-… invoices belong to — two
      // rows, two e-mail addresses, no shared key. users.same_person_as holds
      // that link, and it counts in both directions so it only has to be set
      // on one of the two rows.
      const ids = new Set();
      if (signedIn?.user_id) {
        ids.add(signedIn.user_id);
        if (signedIn.same_person_as) ids.add(signedIn.same_person_as);
        for (const u of usersData || []) {
          if (u.same_person_as === signedIn.user_id) ids.add(u.user_id);
        }
      }
      setMyUserIds(ids);

      setInvoices(invoicesData || []);
      setUsers(usersMap);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function selectInvoice(invoice) {
    setSelectedInvoice(invoice);
    setLoadingComparison(true);
    setInvoiceItems([]);
    setEmfData([]);
    setOverlaps([]);
    setOpenWOs([]);
    setShowReject(false);
    setRejectNote('');
    setActionError('');

    try {
      apiFetch(`/api/admin/subcontractor-invoices/${invoice.invoice_id}`)
        .then(r => r.ok ? r.json() : { overlaps: [] })
        .then(d => setOverlaps(d.overlaps || []))
        .catch(() => setOverlaps([]));

      const { data: itemsData } = await supabase
        .from('subcontractor_invoice_items')
        .select('*')
        .eq('invoice_id', invoice.invoice_id)
        .order('work_date', { ascending: true });

      setInvoiceItems(itemsData || []);

      // Lines on work orders that are not completed yet (warning only).
      const woIds = [...new Set((itemsData || []).filter(i => i.item_type !== 'custom' && i.wo_id).map(i => i.wo_id))];
      if (woIds.length) {
        const { data: wos } = await supabase
          .from('work_orders')
          .select('wo_id, wo_number, status, is_locked')
          .in('wo_id', woIds);
        const open = (wos || []).filter(w => w.status !== 'completed' && !w.is_locked);
        setOpenWOs(open.map(w => ({
          ...w,
          amount: (itemsData || []).filter(i => i.wo_id === w.wo_id).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0),
        })));
      }

      // Get actual EMF data for this user and period (including tech_material_cost)
      const { data: emfHours } = await supabase
        .from('daily_hours_log')
        .select(`
          *,
          work_order:work_orders(wo_number, building, work_order_description)
        `)
        .eq('user_id', invoice.user_id)
        .gte('work_date', invoice.period_start)
        .lte('work_date', invoice.period_end)
        .order('work_date', { ascending: true });

      setEmfData(emfHours || []);
    } catch (error) {
      console.error('Error loading comparison:', error);
    } finally {
      setLoadingComparison(false);
    }
  }

  // EMF's side only (review + EMF payment). The subcontractor's own status
  // (draft / sent / paid) is his and is never changed from here.
  async function emfAction(invoiceId, action, note) {
    setActionError('');
    try {
      const res = await apiFetch(`/api/admin/subcontractor-invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setInvoices(invoices.map(inv => inv.invoice_id === invoiceId ? data.invoice : inv));
      if (selectedInvoice?.invoice_id === invoiceId) setSelectedInvoice(data.invoice);
      setShowReject(false);
      setRejectNote('');
    } catch (error) {
      console.error('EMF action failed:', error);
      setActionError(error.message);
    }
  }

  // Calculate EMF totals including tech material
  const emfTotals = {
    regularHours: emfData.reduce((sum, e) => sum + parseFloat(e.hours_regular || 0), 0),
    otHours: emfData.reduce((sum, e) => sum + parseFloat(e.hours_overtime || 0), 0),
    miles: emfData.reduce((sum, e) => sum + parseFloat(e.miles || 0), 0),
    techMaterial: emfData.reduce((sum, e) => sum + parseFloat(e.tech_material_cost || 0), 0)
  };

  // Calculate invoice totals
  const invoiceTotals = selectedInvoice ? {
    regularHours: parseFloat(selectedInvoice.total_regular_hours || 0),
    otHours: parseFloat(selectedInvoice.total_ot_hours || 0),
    miles: parseFloat(selectedInvoice.total_miles || 0),
    techMaterial: parseFloat(selectedInvoice.total_tech_material || 0)
  } : { regularHours: 0, otHours: 0, miles: 0, techMaterial: 0 };

  // Check for discrepancies
  const discrepancies = {
    regularHours: Math.abs(invoiceTotals.regularHours - emfTotals.regularHours) > 0.1,
    otHours: Math.abs(invoiceTotals.otHours - emfTotals.otHours) > 0.1,
    miles: Math.abs(invoiceTotals.miles - emfTotals.miles) > 0.5,
    techMaterial: Math.abs(invoiceTotals.techMaterial - emfTotals.techMaterial) > 0.01
  };

  const hasDiscrepancy = discrepancies.regularHours || discrepancies.otHours || discrepancies.miles || discrepancies.techMaterial;

  const myInvoiceCount = invoices.filter(inv => myUserIds.has(inv.user_id)).length;

  const filteredInvoices = invoices.filter(inv => {
    // Your own invoices: hidden unless you ask for them.
    if (!includeMine && myUserIds.has(inv.user_id)) return false;
    const user = users[inv.user_id];
    const matchesSearch = searchTerm === '' || 
      inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user?.last_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      filter === 'all' ||
      (filter === 'review' && inv.status !== 'draft' && !inv.emf_review_status) ||
      (filter === 'accepted' && inv.emf_review_status === 'accepted') ||
      (filter === 'rejected' && inv.emf_review_status === 'rejected') ||
      (filter === 'emf_paid' && !!inv.emf_paid_at) ||
      (filter === 'emf_unpaid' && inv.status !== 'draft' && inv.emf_review_status !== 'rejected' && !inv.emf_paid_at);

    return matchesSearch && matchesFilter;
  });

  if (!ready) return <GateScreen />;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <header className="bg-[#0d0d14] border-b border-[#2d2d44] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/settings"
              className="px-4 py-2 bg-[#1e1e2e] hover:bg-[#2d2d44] rounded-lg text-sm"
            >
              ← Back
            </Link>
            <div>
              <h1 className="text-2xl font-bold">🔍 Subcontractor Invoice Review</h1>
              <p className="text-sm text-slate-400">Verify hours, mileage & materials against EMF records</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Invoice List */}
          <div className="lg:col-span-1 space-y-4">
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Search by name or invoice #..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#0d0d14] border border-[#2d2d44] rounded-lg px-4 py-2 text-sm"
              />
              <div className="flex gap-2 flex-wrap">
                {[['all', 'All'], ['review', 'To review'], ['accepted', 'Accepted'], ['rejected', 'Rejected'], ['emf_unpaid', 'EMF unpaid'], ['emf_paid', 'EMF paid']].map(([f, label]) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 rounded-lg text-sm ${
                      filter === f 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-[#0d0d14] text-slate-400 hover:bg-[#1e1e2e]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                {myInvoiceCount > 0 && (
                  <button
                    onClick={() => setIncludeMine(v => !v)}
                    title="Your own invoices are left out of the review — switch them on when you need to mark one sent or paid."
                    className={`px-3 py-1 rounded-lg text-sm ml-auto ${
                      includeMine
                        ? 'bg-amber-600 text-white'
                        : 'bg-[#0d0d14] text-slate-500 hover:bg-[#1e1e2e]'
                    }`}
                  >
                    {includeMine ? `Hide mine (${myInvoiceCount})` : `Show mine (${myInvoiceCount})`}
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
              {filteredInvoices.length === 0 ? (
                <div className="bg-[#0d0d14] rounded-lg p-4 text-center text-slate-500">
                  No invoices found
                </div>
              ) : (
                filteredInvoices.map(invoice => {
                  const user = users[invoice.user_id];
                  return (
                    <button
                      key={invoice.invoice_id}
                      onClick={() => selectInvoice(invoice)}
                      className={`w-full text-left p-4 rounded-lg border transition ${
                        selectedInvoice?.invoice_id === invoice.invoice_id
                          ? 'bg-blue-900/30 border-blue-500'
                          : 'bg-[#0d0d14] border-[#2d2d44] hover:bg-[#1e1e2e]'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold">{invoice.invoice_number}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          invoice.status === 'paid'
                            ? 'bg-green-500/20 text-green-400'
                            : invoice.status === 'sent'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-[#3d3d5e]/20 text-slate-400'
                        }`}>
                          {invoice.status}
                        </span>
                      </div>
                      {(invoice.emf_review_status || invoice.emf_paid_at) && (
                        <div className="flex gap-1 mb-1">
                          {invoice.emf_review_status === 'accepted' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">EMF accepted</span>}
                          {invoice.emf_review_status === 'rejected' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">EMF rejected</span>}
                          {invoice.emf_paid_at && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-300">EMF paid</span>}
                        </div>
                      )}
                      <p className="text-sm text-slate-400">
                        {user ? `${user.first_name} ${user.last_name}` : 'Unknown'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDateLocal(invoice.period_start)} - {formatDateLocal(invoice.period_end)}
                      </p>
                      <p className="text-lg font-bold text-green-400 mt-1">
                        ${parseFloat(invoice.grand_total || 0).toFixed(2)}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Comparison Panel */}
          <div className="lg:col-span-2">
            {!selectedInvoice ? (
              <div className="bg-[#0d0d14] rounded-xl border border-[#2d2d44] p-8 text-center">
                <p className="text-slate-500">Select an invoice to review</p>
              </div>
            ) : loadingComparison ? (
              <div className="bg-[#0d0d14] rounded-xl border border-[#2d2d44] p-8 text-center">
                <p className="text-slate-400">Loading comparison data...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Invoice Header */}
                <div className="bg-[#0d0d14] rounded-xl border border-[#2d2d44] p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-xl font-bold">{selectedInvoice.invoice_number}</h2>
                      <p className="text-slate-400">
                        {users[selectedInvoice.user_id]?.first_name} {users[selectedInvoice.user_id]?.last_name}
                      </p>
                      <p className="text-sm text-slate-500">
                        {formatDateLocal(selectedInvoice.period_start)} - {formatDateLocal(selectedInvoice.period_end)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-xs text-slate-500">
                        Sub&apos;s status: <span className="text-slate-300">{selectedInvoice.status}</span>
                      </span>
                      <div className="flex gap-2 flex-wrap justify-end">
                        {selectedInvoice.emf_review_status !== 'accepted' && (
                          <button
                            onClick={() => emfAction(selectedInvoice.invoice_id, 'accept')}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium"
                          >
                            ✓ Accept
                          </button>
                        )}
                        {selectedInvoice.emf_review_status !== 'rejected' && (
                          <button
                            onClick={() => setShowReject(v => !v)}
                            className="px-3 py-2 bg-red-700 hover:bg-red-800 rounded-lg text-sm font-medium"
                          >
                            ✕ Reject
                          </button>
                        )}
                        {selectedInvoice.emf_review_status && (
                          <button
                            onClick={() => emfAction(selectedInvoice.invoice_id, 'clear')}
                            className="px-3 py-2 bg-[#2d2d44] hover:bg-[#3d3d5e] rounded-lg text-sm"
                            title="Remove the accept/reject"
                          >
                            Undo review
                          </button>
                        )}
                        {selectedInvoice.emf_paid_at ? (
                          <button
                            onClick={() => emfAction(selectedInvoice.invoice_id, 'emf_unpaid')}
                            className="px-3 py-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg text-sm font-medium"
                            title="Click to remove EMF's payment record"
                          >
                            ✓ EMF paid {new Date(selectedInvoice.emf_paid_at).toLocaleDateString('en-US', { timeZone: 'America/New_York' })}
                          </button>
                        ) : (
                          <button
                            onClick={() => emfAction(selectedInvoice.invoice_id, 'emf_paid')}
                            className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium"
                          >
                            💵 Mark EMF Paid
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {selectedInvoice.emf_review_status && (
                    <p className={`mt-3 text-sm ${selectedInvoice.emf_review_status === 'rejected' ? 'text-red-300' : 'text-blue-300'}`}>
                      EMF {selectedInvoice.emf_review_status}
                      {selectedInvoice.emf_reviewed_at ? ` on ${new Date(selectedInvoice.emf_reviewed_at).toLocaleDateString('en-US', { timeZone: 'America/New_York' })}` : ''}
                      {selectedInvoice.emf_review_note ? ` — ${selectedInvoice.emf_review_note}` : ''}
                    </p>
                  )}
                  {showReject && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        placeholder="Reason the subcontractor will see (e.g. 4 h on C3297218 not in EMF records)"
                        className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-lg px-3 py-2 text-sm h-20"
                      />
                      <button
                        onClick={() => emfAction(selectedInvoice.invoice_id, 'reject', rejectNote)}
                        disabled={!rejectNote.trim()}
                        className="px-4 py-2 bg-red-700 hover:bg-red-800 rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        Send rejection
                      </button>
                    </div>
                  )}
                  {actionError && <p className="mt-2 text-sm text-red-400">{actionError}</p>}
                </div>

                {/* Lines on work orders that are not finished */}
                {openWOs.length > 0 && (
                  <div className="bg-orange-900/30 border border-orange-500/50 rounded-xl p-4">
                    <h3 className="font-bold text-orange-400 mb-1">⚠️ Work orders not completed</h3>
                    <p className="text-sm text-orange-200 mb-2">
                      {openWOs.length} work order{openWOs.length === 1 ? '' : 's'} on this invoice {openWOs.length === 1 ? 'is' : 'are'} not completed —
                      ${openWOs.reduce((s, w) => s + w.amount, 0).toFixed(2)} of the invoice. Paperwork may be missing.
                    </p>
                    <ul className="text-xs text-orange-200/80 space-y-0.5">
                      {openWOs.slice(0, 10).map(w => (
                        <li key={w.wo_id}>{w.wo_number} · {w.status || 'unknown'} · ${w.amount.toFixed(2)}</li>
                      ))}
                      {openWOs.length > 10 && <li>… and {openWOs.length - 10} more</li>}
                    </ul>
                  </div>
                )}

                {/* Already on another invoice */}
                {overlaps.length > 0 && (
                  <div className="bg-amber-900/30 border border-amber-500/50 rounded-xl p-4">
                    <h3 className="font-bold text-amber-400 mb-1">⚠️ Entries already on another invoice</h3>
                    <p className="text-sm text-amber-200 mb-2">
                      {new Set(overlaps.map(o => o.wo_id + '|' + o.work_date)).size} entries of this invoice also appear on{' '}
                      {[...new Set(overlaps.map(o => o.invoice_number))].join(', ')}.
                    </p>
                    <ul className="text-xs text-amber-200/80 space-y-0.5">
                      {overlaps.slice(0, 10).map((o, i) => (
                        <li key={i}>{formatDateLocal(o.work_date)} → {o.invoice_number} ({o.status})</li>
                      ))}
                      {overlaps.length > 10 && <li>… and {overlaps.length - 10} more</li>}
                    </ul>
                  </div>
                )}

                {/* Discrepancy Alert */}
                {hasDiscrepancy && (
                  <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-4">
                    <h3 className="font-bold text-red-400 mb-2">⚠️ Discrepancy Detected</h3>
                    <p className="text-sm text-red-300">
                      The invoice totals don't match EMF records. Review the details below.
                    </p>
                  </div>
                )}

                {/* Comparison Summary */}
                <div className="bg-[#0d0d14] rounded-xl border border-[#2d2d44] p-4">
                  <h3 className="font-bold mb-4">📊 Totals Comparison</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-400 border-b border-[#2d2d44]">
                          <th className="text-left py-2">Metric</th>
                          <th className="text-right py-2">Invoice Claims</th>
                          <th className="text-right py-2">EMF Records</th>
                          <th className="text-right py-2">Difference</th>
                          <th className="text-center py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className={discrepancies.regularHours ? 'bg-red-900/20' : ''}>
                          <td className="py-3">Regular Hours</td>
                          <td className="text-right font-mono">{invoiceTotals.regularHours.toFixed(1)}h</td>
                          <td className="text-right font-mono">{emfTotals.regularHours.toFixed(1)}h</td>
                          <td className={`text-right font-mono ${
                            discrepancies.regularHours ? 'text-red-400 font-bold' : 'text-green-400'
                          }`}>
                            {(invoiceTotals.regularHours - emfTotals.regularHours).toFixed(1)}h
                          </td>
                          <td className="text-center">
                            {discrepancies.regularHours ? '❌' : '✅'}
                          </td>
                        </tr>
                        <tr className={discrepancies.otHours ? 'bg-red-900/20' : ''}>
                          <td className="py-3">OT Hours</td>
                          <td className="text-right font-mono">{invoiceTotals.otHours.toFixed(1)}h</td>
                          <td className="text-right font-mono">{emfTotals.otHours.toFixed(1)}h</td>
                          <td className={`text-right font-mono ${
                            discrepancies.otHours ? 'text-red-400 font-bold' : 'text-green-400'
                          }`}>
                            {(invoiceTotals.otHours - emfTotals.otHours).toFixed(1)}h
                          </td>
                          <td className="text-center">
                            {discrepancies.otHours ? '❌' : '✅'}
                          </td>
                        </tr>
                        <tr className={discrepancies.miles ? 'bg-red-900/20' : ''}>
                          <td className="py-3">Mileage</td>
                          <td className="text-right font-mono">{invoiceTotals.miles.toFixed(0)} mi</td>
                          <td className="text-right font-mono">{emfTotals.miles.toFixed(0)} mi</td>
                          <td className={`text-right font-mono ${
                            discrepancies.miles ? 'text-red-400 font-bold' : 'text-green-400'
                          }`}>
                            {(invoiceTotals.miles - emfTotals.miles).toFixed(0)} mi
                          </td>
                          <td className="text-center">
                            {discrepancies.miles ? '❌' : '✅'}
                          </td>
                        </tr>
                        <tr className={discrepancies.techMaterial ? 'bg-red-900/20' : ''}>
                          <td className="py-3 text-orange-400">Tech Material</td>
                          <td className="text-right font-mono">${invoiceTotals.techMaterial.toFixed(2)}</td>
                          <td className="text-right font-mono">${emfTotals.techMaterial.toFixed(2)}</td>
                          <td className={`text-right font-mono ${
                            discrepancies.techMaterial ? 'text-red-400 font-bold' : 'text-green-400'
                          }`}>
                            ${(invoiceTotals.techMaterial - emfTotals.techMaterial).toFixed(2)}
                          </td>
                          <td className="text-center">
                            {discrepancies.techMaterial ? '❌' : '✅'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Side by Side Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Invoice Claims */}
                  <div className="bg-[#0d0d14] rounded-xl border border-[#2d2d44] p-4">
                    <h3 className="font-bold mb-3 text-blue-400">📄 Invoice Claims</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {invoiceItems.filter(i => ['hours', 'mileage', 'material'].includes(i.item_type)).map((item, idx) => (
                        <div key={idx} className={`text-sm p-2 rounded ${item.item_type === 'material' ? 'bg-orange-900/30' : 'bg-[#1e1e2e]/50'}`}>
                          <div className="flex justify-between">
                            <span className="text-slate-400">
                              {item.work_date ? formatDateLocal(item.work_date) : '-'}
                            </span>
                            <span className={`font-mono ${item.item_type === 'material' ? 'text-orange-400' : ''}`}>
                              {item.item_type === 'mileage' 
                                ? `${parseFloat(item.quantity).toFixed(0)} mi`
                                : item.item_type === 'material'
                                  ? `$${parseFloat(item.amount).toFixed(2)}`
                                  : `${parseFloat(item.quantity).toFixed(1)}h`
                              }
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 truncate">{item.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* EMF Records */}
                  <div className="bg-[#0d0d14] rounded-xl border border-[#2d2d44] p-4">
                    <h3 className="font-bold mb-3 text-green-400">📋 EMF Records</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {emfData.map((entry, idx) => (
                        <div key={idx} className="text-sm p-2 bg-[#1e1e2e]/50 rounded">
                          <div className="flex justify-between">
                            <span className="text-slate-400">
                              {formatDateLocal(entry.work_date)}
                            </span>
                            <span className="font-mono">
                              {parseFloat(entry.hours_regular || 0).toFixed(1)}h + {parseFloat(entry.hours_overtime || 0).toFixed(1)}h OT
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-slate-500">
                              {entry.work_order?.wo_number || 'N/A'} - {entry.work_order?.building || ''}
                            </span>
                            <span className="text-xs text-slate-400">
                              {parseFloat(entry.miles || 0).toFixed(0)} mi
                            </span>
                          </div>
                          {parseFloat(entry.tech_material_cost || 0) > 0 && (
                            <div className="text-xs text-orange-400 mt-1">
                              💰 Material: ${parseFloat(entry.tech_material_cost).toFixed(2)}
                            </div>
                          )}
                        </div>
                      ))}
                      {emfData.length === 0 && (
                        <p className="text-slate-500 text-center py-4">No EMF records found for this period</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Invoice Amounts */}
                <div className="bg-[#0d0d14] rounded-xl border border-[#2d2d44] p-4">
                  <h3 className="font-bold mb-3">💰 Invoice Amount</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                    <div>
                      <p className="text-slate-400 text-sm">Labor</p>
                      <p className="text-xl font-bold">${parseFloat(selectedInvoice.total_hours_amount || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Mileage</p>
                      <p className="text-xl font-bold">${parseFloat(selectedInvoice.total_mileage_amount || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-orange-400 text-sm">Material</p>
                      <p className="text-xl font-bold text-orange-400">${parseFloat(selectedInvoice.total_tech_material || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Other</p>
                      <p className="text-xl font-bold">${parseFloat(selectedInvoice.total_line_items_amount || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Total</p>
                      <p className="text-2xl font-bold text-green-400">${parseFloat(selectedInvoice.grand_total || 0).toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-[#2d2d44] text-sm text-slate-500">
                    Rates: ${parseFloat(selectedInvoice.hourly_rate_used || 0).toFixed(2)}/hr | 
                    ${parseFloat(selectedInvoice.ot_rate_used || 0).toFixed(2)}/hr OT | 
                    ${parseFloat(selectedInvoice.mileage_rate_used || 0).toFixed(4)}/mi
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
