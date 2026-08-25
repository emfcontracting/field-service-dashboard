// app/dashboard/components/ApprovalsView.js
// ─────────────────────────────────────────────────────────────────────────────
// APPROVALS — everything waiting on a yes before it leaves the building.
//
// Generic on purpose: it renders whatever is in approval_requests, grouped by
// `kind`. Adding CBRE acknowledgements, NTE submissions or ETA updates needs a
// new producer writing rows — not a new tab and not a change here.
//
// HOW SOMETHING ACTUALLY REACHES CBRE
// -----------------------------------
// Nothing in this app posts to CBRE. Their Vendor App form is protected by an
// invisible reCAPTCHA, which is their way of saying "a person submits this".
// So the last click stays yours — but the typing does not.
//
//   Approve  ->  "Fill in here"  ->  CBRE's form appears below the row with
//                                    the fields already filled in, on their
//                                    domain  ->  you press their Submit
//            ->  "Mark submitted"  ->  the work order leaves the queue
//
// The form is framed rather than linked so this works on a phone, where an
// extension or bookmarklet is not an option. "Open in a tab instead" is there
// for the case where CBRE's page refuses to be framed.
//
// The prefill is a plain query string on the published form URL, which is a
// documented Smartsheet feature. No automation, no token, no impersonation:
// a real browser, a real person, one click instead of six fields typed.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { getSupabase } from '@/lib/supabase';
import { FIELD_LABEL } from '@/lib/cbreVendorForm';

const supabase = getSupabase();

const KIND_META = {
  cbre_acknowledge: { label: 'Acknowledge Work', tone: 'sky',    hint: 'Tells CBRE we have accepted the work order.' },
  cbre_nte:         { label: 'NTE Request',      tone: 'amber',  hint: 'Submits an NTE increase. Carries a dollar amount.' },
  cbre_eta:         { label: 'Arrival Time',     tone: 'violet', hint: 'Updates the next arrival time on the work order.' },
  cbre_comment:     { label: 'Comment',          tone: 'slate',  hint: 'Adds a comment to the work order.' },
  cbre_decline:     { label: 'Decline',        tone: 'rose',    hint: 'Declines the work order to CBRE.' },
  cbre_complete:    { label: 'Complete',       tone: 'emerald', hint: 'Reports completion (start/end times) to CBRE.' },
  cbre_target_date: { label: 'Target Date',    tone: 'cyan',    hint: 'Changes the completion target date.' },
  cbre_tag_equipment:{ label: 'Tag Equipment', tone: 'indigo',  hint: 'Tags an equipment barcode to the work order.' },
  other:            { label: 'Other',            tone: 'slate',  hint: '' },
};

const TONE = {
  sky:    'bg-sky-500/20 text-sky-400 border-sky-500/30',
  amber:  'bg-amber-500/20 text-amber-400 border-amber-500/30',
  violet: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  slate:  'bg-slate-500/20 text-slate-400 border-slate-500/30',
  emerald:'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  rose:   'bg-rose-500/20 text-rose-400 border-rose-500/30',
  cyan:   'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  indigo: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
};

const STATUS_TONE = {
  pending:  'bg-amber-500/20 text-amber-400 border-amber-500/30',
  approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  sent:     'bg-blue-500/20 text-blue-400 border-blue-500/30',
  rejected: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  failed:   'bg-red-500/20 text-red-400 border-red-500/30',
  cancelled:'bg-slate-500/20 text-slate-500 border-slate-500/30',
};

// ── CBRE Vendor App form ─────────────────────────────────────────────────────
const CBRE_FORM_URL = 'https://app.smartsheet.com/b/form/019aa33a6ffd70a7983bbf4af282307a';

// Smartsheet prefills a published form from the query string, keyed by the
// FORM FIELD LABEL — not by the internal field key we store in the payload,
// and not by the sheet's column name either. These are read off the rendered
// form and are case sensitive. If CBRE relabels a field the prefill for that
// one box silently stops working, which is why you see the form before you
// submit it: an empty box is visible, a wrong guess would not be.
//
// We send the internal key as well. Unknown query parameters are ignored, so
// covering both spellings costs nothing and survives one of them being wrong.
const PREFILL_COLUMN = FIELD_LABEL;  // full field map (all Actions) lives in lib/cbreVendorForm.js

// Smartsheet's rules, from their own documentation:
//   - the parameter is the FORM FIELD LABEL, not the sheet column name
//   - labels are CASE SENSITIVE
//   - a space must be %20. URLSearchParams encodes spaces as '+', which
//     Smartsheet does NOT decode back to a space, so we encode by hand.
//   - prefill is ignored on forms that require sign-in (this one does not)
// https://help.smartsheet.com/articles/2478871-url-query-string-form-default-values
function prefillUrl(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const parts = [];
  // A '/' is legal in a query-string key and this form has one in a label
  // ("Comment/Reason/File Description"). encodeURIComponent would turn it into
  // %2F, which we have no reason to believe Smartsheet decodes back. Encode
  // everything else, leave the slash alone.
  const encodeKey = (name) => encodeURIComponent(name).replace(/%2F/g, '/');
  const add = (name, value) =>
    parts.push(`${encodeKey(name)}=${encodeURIComponent(value)}`);

  for (const [key, value] of Object.entries(payload)) {
    // Keys beginning with _ are our own readability mirror, not form fields.
    if (key.startsWith('_')) continue;
    if (value === null || value === undefined || value === '') continue;
    const label = PREFILL_COLUMN[key];
    if (label) add(label, String(value));
    // The internal key too — an unknown parameter is ignored, so if one of the
    // labels above is ever wrong, we have not lost anything by trying both.
    add(key, String(value));
  }
  return parts.length ? `${CBRE_FORM_URL}?${parts.join('&')}` : CBRE_FORM_URL;
}

const money = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n)
    ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null;
};

const ago = (iso) => {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
};

const TABS = [
  { id: 'pending', label: 'Pending' },
  { id: 'ready',   label: 'Ready to send' },
  { id: 'history', label: 'History' },
];

export default function ApprovalsView({ userInfo }) {
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [notice, setNotice]     = useState(null);
  const [tab, setTab]           = useState('pending');
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy]         = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [opened, setOpened]     = useState(() => new Set());
  const [embedded, setEmbedded] = useState(null);   // which row shows the form inline

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('approval_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);
      if (err) throw err;
      setRows(data || []);
    } catch (e) {
      // The table may not exist yet if the migration has not been run.
      setError(
        /approval_requests/i.test(e.message || '')
          ? 'The approval_requests table is missing — run add_approval_requests.sql in Supabase first.'
          : e.message
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const shown = useMemo(() => {
    if (tab === 'pending') return rows.filter((r) => r.status === 'pending');
    if (tab === 'ready')   return rows.filter((r) => r.status === 'approved' && !r.sent_at);
    return rows.filter((r) => r.status !== 'pending' && !(r.status === 'approved' && !r.sent_at));
  }, [rows, tab]);

  const pendingCount = useMemo(() => rows.filter((r) => r.status === 'pending').length, [rows]);
  const readyCount   = useMemo(
    () => rows.filter((r) => r.status === 'approved' && !r.sent_at).length,
    [rows]
  );

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allShownSelected = shown.length > 0 && shown.every((r) => selected.has(r.approval_id));
  const selectable = tab === 'pending' || tab === 'ready';

  async function decide(ids, decision, reason = null) {
    if (!ids.length) return;
    setBusy(true);
    try {
      const patch = {
        status: decision,
        decided_at: new Date().toISOString(),
        decided_by: userInfo?.user_id ?? null,
      };
      if (decision === 'rejected') patch.reject_reason = reason;

      const { error: err } = await supabase
        .from('approval_requests')
        .update(patch)
        .in('approval_id', ids)
        .eq('status', 'pending');       // never re-decide something already decided
      if (err) throw err;

      setSelected(new Set());
      await load();
      if (decision === 'approved') {
        setNotice(
          `${ids.length} approved. They are in "Ready to send" — open each form and press Submit on CBRE's side.`
        );
        setTab('ready');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function rejectSelected() {
    const ids = [...selected];
    if (!ids.length) return;
    const reason = window.prompt(`Reject ${ids.length} request(s). Reason (optional):`, '');
    if (reason === null) return;        // cancelled the prompt
    decide(ids, 'rejected', reason || null);
  }

  // ── Opening the prefilled form ──────────────────────────────────────────────
  // This only opens a tab. It submits nothing. Popup blockers stop a burst of
  // window.open calls, so we open a few at a time and say so rather than
  // silently dropping the rest.
  function openForm(row) {
    const url = prefillUrl(row.payload);
    if (!url) { setError(`No payload on ${row.wo_number || 'this request'} — nothing to prefill.`); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
    setOpened((prev) => new Set(prev).add(row.approval_id));
  }

  function openSelectedForms() {
    const list = shown.filter((r) => selected.has(r.approval_id));
    if (!list.length) return;
    if (list.length > 5) {
      setError('Open at most 5 at a time — your browser will block the rest as popups.');
      return;
    }
    list.forEach(openForm);
    setNotice(
      `${list.length} form${list.length === 1 ? '' : 's'} opened. Press Submit in each tab, then mark them submitted here.`
    );
  }

  // ── Recording that YOU submitted it ─────────────────────────────────────────
  // Marks the request sent and stamps the work order, so the producer stops
  // queueing it tomorrow. It is a record of something you did, not an action.
  async function markSubmitted(ids) {
    if (!ids.length) return;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const affected = rows.filter((r) => ids.includes(r.approval_id));

      const { error: err } = await supabase
        .from('approval_requests')
        .update({ status: 'sent', sent_at: now, send_error: null })
        .in('approval_id', ids)
        .eq('status', 'approved');
      if (err) throw err;

      // Close the loop on the work order itself, per kind.
      const ackWoIds = affected
        .filter((r) => r.kind === 'cbre_acknowledge' && r.wo_id)
        .map((r) => r.wo_id);
      if (ackWoIds.length) {
        const { error: woErr } = await supabase
          .from('work_orders')
          .update({
            cbre_acknowledged_at: now,
            cbre_acknowledged_by: userInfo?.user_id ?? null,
            cbre_acknowledged_via: 'vendor_app_form',
          })
          .in('wo_id', ackWoIds)
          .is('cbre_acknowledged_at', null);   // never overwrite an earlier record
        // A failure here is worth seeing: the request says sent but the work
        // order does not, so it would be queued again tomorrow.
        if (woErr) setError(`Marked sent, but the work order stamp failed: ${woErr.message}`);
      }

      // NTE requests: stamp so the NTE producer stops queueing this WO.
      const nteWoIds = affected.filter((r) => r.kind === 'cbre_nte' && r.wo_id).map((r) => r.wo_id);
      if (nteWoIds.length) {
        const { error: nteErr } = await supabase
          .from('work_orders')
          .update({ cbre_nte_submitted_at: now, cbre_nte_submitted_by: userInfo?.user_id ?? null })
          .in('wo_id', nteWoIds)
          .is('cbre_nte_submitted_at', null);
        if (nteErr) setError(`Marked sent, but the NTE stamp failed: ${nteErr.message}`);
      }

      // Completions: stamp so it is recorded as reported to CBRE.
      const compWoIds = affected.filter((r) => r.kind === 'cbre_complete' && r.wo_id).map((r) => r.wo_id);
      if (compWoIds.length) {
        const { error: compErr } = await supabase
          .from('work_orders')
          .update({ cbre_completion_submitted_at: now, cbre_completion_submitted_by: userInfo?.user_id ?? null })
          .in('wo_id', compWoIds)
          .is('cbre_completion_submitted_at', null);
        if (compErr) setError(`Marked sent, but the completion stamp failed: ${compErr.message}`);
      }

      setSelected(new Set());
      setNotice(`${ids.length} marked as submitted.`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Approvals</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Approve here, then open the prefilled CBRE form and press Submit. This app never submits for you.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {TABS.map((t) => {
            const count = t.id === 'pending' ? pendingCount : t.id === 'ready' ? readyCount : 0;
            return (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setSelected(new Set()); setNotice(null); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                  tab === t.id
                    ? 'bg-slate-700/60 text-slate-100 border-slate-600'
                    : 'bg-transparent text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                {t.label}{count ? ` (${count})` : ''}
              </button>
            );
          })}
          <button
            onClick={load}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-700 text-slate-400 hover:text-slate-200"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm px-4 py-3 flex items-start gap-3">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">×</button>
        </div>
      )}
      {notice && !error && (
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-200 text-sm px-4 py-3 flex items-start gap-3">
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} className="text-sky-400 hover:text-sky-200">×</button>
        </div>
      )}

      {tab === 'ready' && shown.length > 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/30 px-4 py-3 text-sm text-slate-400">
          <span className="text-slate-200 font-medium">These are approved and waiting on you.</span>{' '}
          Open the form — every field is already filled in — press <span className="text-slate-200">Submit</span> on
          CBRE&apos;s page, then mark it submitted here so it stops coming back.
        </div>
      )}

      {selectable && shown.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2">
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={allShownSelected}
              onChange={() =>
                setSelected(allShownSelected ? new Set() : new Set(shown.map((r) => r.approval_id)))
              }
            />
            Select all {shown.length}
          </label>
          <span className="text-slate-500 text-sm">{selected.size} selected</span>
          <div className="flex-1" />

          {tab === 'pending' ? (
            <>
              <button
                disabled={!selected.size || busy}
                onClick={() => decide([...selected], 'approved')}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-emerald-600 text-white disabled:opacity-40"
              >
                Approve selected
              </button>
              <button
                disabled={!selected.size || busy}
                onClick={rejectSelected}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-slate-600 text-slate-300 disabled:opacity-40"
              >
                Reject
              </button>
            </>
          ) : (
            <>
              <button
                disabled={!selected.size || busy}
                onClick={openSelectedForms}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-sky-600 text-white disabled:opacity-40"
              >
                Open {selected.size || ''} form{selected.size === 1 ? '' : 's'}
              </button>
              <button
                disabled={!selected.size || busy}
                onClick={() => markSubmitted([...selected])}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-emerald-600 text-emerald-400 disabled:opacity-40"
              >
                Mark submitted
              </button>
            </>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="rounded-lg border border-slate-700 bg-slate-800/30 px-4 py-10 text-center">
          <p className="text-slate-300 font-medium">
            {tab === 'pending' ? 'Nothing waiting on you'
              : tab === 'ready' ? 'Nothing approved and unsent'
              : 'No history yet'}
          </p>
          <p className="text-slate-500 text-sm mt-1">
            {tab === 'pending'
              ? 'Requests appear here as soon as something needs a decision.'
              : tab === 'ready'
              ? 'Approve something in Pending and it moves here.'
              : 'Submitted and rejected requests will be listed here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((r) => {
            const meta = KIND_META[r.kind] || KIND_META.other;
            const amount = money(r.payload?.amount ?? r.payload?.nte);
            const open = expanded === r.approval_id;
            const readable = r.payload?._readable;
            const wasOpened = opened.has(r.approval_id);
            const isEmbedded = embedded === r.approval_id;
            return (
              <div
                key={r.approval_id}
                className="rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2.5"
              >
                <div className="flex items-start gap-3">
                  {selectable && (
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selected.has(r.approval_id)}
                      onChange={() => toggle(r.approval_id)}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${TONE[meta.tone]}`}>
                        {meta.label}
                      </span>
                      {r.wo_number && (
                        <span className="text-slate-200 font-semibold text-sm">{r.wo_number}</span>
                      )}
                      {amount && (
                        <span className="text-amber-300 font-semibold text-sm tabular-nums">{amount}</span>
                      )}
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_TONE[r.status]}`}>
                        {r.status}
                      </span>
                      {wasOpened && r.status === 'approved' && !r.sent_at && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-sky-500/20 text-sky-400 border-sky-500/30">
                          form opened
                        </span>
                      )}
                      <span className="text-slate-500 text-xs">{ago(r.created_at)} ago</span>
                    </div>
                    <p className="text-slate-300 text-sm mt-1">{r.title}</p>
                    {r.summary && <p className="text-slate-500 text-xs mt-0.5">{r.summary}</p>}
                    {r.send_error && (
                      <p className="text-red-400 text-xs mt-1">Send failed: {r.send_error}</p>
                    )}
                    {r.reject_reason && (
                      <p className="text-slate-500 text-xs mt-1">Rejected: {r.reject_reason}</p>
                    )}

                    <button
                      onClick={() => setExpanded(open ? null : r.approval_id)}
                      className="text-xs text-slate-400 hover:text-slate-200 mt-1.5"
                    >
                      {open ? 'Hide exact values' : 'Show exact values'}
                    </button>
                    {open && (
                      <div className="mt-2 space-y-2">
                        {readable && (
                          <dl className="text-[11px] grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 bg-slate-900/70 border border-slate-700 rounded p-2">
                            {Object.entries(readable).map(([k, v]) => (
                              <div key={k} className="contents">
                                <dt className="text-slate-500">{k}</dt>
                                <dd className="text-slate-200 break-words">{String(v ?? '')}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                        <pre className="text-[11px] leading-relaxed text-slate-300 bg-slate-900/70 border border-slate-700 rounded p-2 overflow-x-auto">
{JSON.stringify(r.payload, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>

                  {tab === 'pending' && (
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        disabled={busy}
                        onClick={() => decide([r.approval_id], 'approved')}
                        className="px-3 py-1 rounded-md text-xs font-semibold bg-emerald-600 text-white disabled:opacity-40"
                      >
                        Approve
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => {
                          const reason = window.prompt('Reason (optional):', '');
                          if (reason === null) return;
                          decide([r.approval_id], 'rejected', reason || null);
                        }}
                        className="px-3 py-1 rounded-md text-xs font-semibold border border-slate-600 text-slate-300 disabled:opacity-40"
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  {tab === 'ready' && (
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        disabled={busy}
                        onClick={() => setEmbedded(isEmbedded ? null : r.approval_id)}
                        className="px-3 py-1 rounded-md text-xs font-semibold bg-sky-600 text-white disabled:opacity-40"
                      >
                        {isEmbedded ? 'Close form' : 'Fill in here'}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => markSubmitted([r.approval_id])}
                        className="px-3 py-1 rounded-md text-xs font-semibold border border-emerald-600 text-emerald-400 disabled:opacity-40"
                      >
                        Mark submitted
                      </button>
                    </div>
                  )}
                </div>

                {/* ── CBRE's form, in place ──────────────────────────────────
                    Works on a phone, which a bookmarklet or browser extension
                    does not. The frame loads CBRE's own page from their own
                    domain, so everything inside it — including the Submit
                    button and whatever bot check runs behind it — is theirs,
                    untouched. We only choose the URL.

                    Consequence worth knowing: because it is their domain, this
                    page cannot read into the frame. We cannot fill a field the
                    URL could not reach, and we cannot tell whether you pressed
                    Submit. Hence the manual "Mark submitted" below rather than
                    a status we pretend to know. */}
                {tab === 'ready' && isEmbedded && (
                  <div className="mt-3 border-t border-slate-700 pt-3">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <p className="text-xs text-slate-400 flex-1 min-w-[220px]">
                        CBRE&apos;s form, prefilled. Check the fields, then press
                        Submit <span className="text-slate-200">inside the frame</span> — that button is theirs.
                      </p>
                      <button
                        onClick={() => openForm(r)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-slate-600 text-slate-400 hover:text-slate-200"
                        title="If the frame stays blank, CBRE's page is refusing to be embedded — this opens it normally."
                      >
                        Open in a tab instead
                      </button>
                    </div>

                    <iframe
                      src={prefillUrl(r.payload) || CBRE_FORM_URL}
                      title={`CBRE Vendor App form — ${r.wo_number || ''}`}
                      className="w-full rounded-lg border border-slate-700 bg-white"
                      style={{ height: 'min(78vh, 900px)' }}
                      loading="lazy"
                    />

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <p className="text-xs text-slate-500 flex-1 min-w-[220px]">
                        Submitted it? Tell us — this page cannot see inside CBRE&apos;s form.
                      </p>
                      <button
                        disabled={busy}
                        onClick={() => { markSubmitted([r.approval_id]); setEmbedded(null); }}
                        className="px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 text-white disabled:opacity-40"
                      >
                        Done — mark submitted
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
