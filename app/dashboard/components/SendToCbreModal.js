// app/dashboard/components/SendToCbreModal.js
// ─────────────────────────────────────────────────────────────────────────────
// "Send to CBRE" — office picks a Vendor App Action for one work order, the
// fields are prefilled from FSM data, and it is queued into approval_requests
// (kind per action). From there it goes through the normal Approvals flow:
// approve → open the prefilled CBRE form → a human presses Submit.
//
// Nothing here contacts CBRE. It only writes a pending queue row.
//
// Actions covered (Acknowledge + NTE have their own automatic producers):
//   Complete · Add Comment · Decline · Change Target Date · Update Arrival Time ·
//   Tag Equipment.
//
// Reminder from the live form (see lib/cbreVendorForm.js): the TIME dropdowns
// and the "Vendor Confirmation" checkbox cannot be prefilled, so for the timed
// actions the person still picks the time(s) on CBRE's form — we write the
// intended time into the comment as a hint.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState, useEffect } from 'react';
import { buildCbrePayload, ACTIONS, to12h } from '@/lib/cbreVendorForm';

// Mirrors the producer defaults (app/api/cbre/*). Override with NEXT_PUBLIC_* if
// the requestor/vendor ever change.
const REQUESTOR_EMAIL =
  process.env.NEXT_PUBLIC_CBRE_REQUESTOR_EMAIL || 'emfcontractingsc@gmail.com';
const VENDOR_NAME =
  process.env.NEXT_PUBLIC_CBRE_VENDOR_NAME || 'EMF Contracting LLC(Gaston)';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safeUuid = (v) => (typeof v === 'string' && UUID_REGEX.test(v) ? v : null);

// The Action options this dialog offers, in order. Acknowledge + NTE excluded
// (they are produced automatically).
const CHOICES = [
  { kind: 'cbre_complete',      label: '✅ Complete Work Order',   desc: 'Report completion (start/end) to CBRE.' },
  { kind: 'cbre_nte',           label: '💵 Submit NTE Request',    desc: 'Request an NTE increase (carries a dollar amount).' },
  { kind: 'cbre_comment',       label: '💬 Add Comment',           desc: 'Add a comment to the work order.' },
  { kind: 'cbre_decline',       label: '🚫 Decline Work Order',    desc: 'Tell CBRE we decline this work order.' },
  { kind: 'cbre_target_date',   label: '🗓️ Change Target Date',    desc: 'Change the completion target date.' },
  { kind: 'cbre_eta',           label: '🕒 Update Arrival Time',   desc: 'Update the next arrival time.' },
  { kind: 'cbre_tag_equipment', label: '🏷️ Tag Equipment',         desc: 'Tag an equipment barcode to the WO.' },
];

// Times exactly as the form offers them: 1:00 … 12:45 in 15-min steps.
const TIMES = [];
for (let h = 1; h <= 12; h++) for (const m of ['00', '15', '30', '45']) TIMES.push(`${h}:${m}`);

const pad = (n) => String(n).padStart(2, '0');

// timestamp → { ymd:'YYYY-MM-DD', time:'9:15', ampm:'AM' } in LOCAL time.
function tsToParts(ts) {
  if (!ts) return { ymd: '', time: '', ampm: 'AM' };
  const dt = new Date(ts);
  if (isNaN(dt.getTime())) return { ymd: '', time: '', ampm: 'AM' };
  const t = to12h(dt) || { time: '', ampm: 'AM' };
  return { ymd: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`, time: t.time, ampm: t.ampm };
}

// picked parts → a LOCAL Date (built from components, so no timezone parse shift).
function partsToDate(ymd, time, ampm) {
  if (!ymd) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return null;
  let hh = 9, mm = 0;
  if (time) { const [h, mn] = time.split(':').map(Number); hh = (h % 12) + (ampm === 'PM' ? 12 : 0); mm = mn || 0; }
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export default function SendToCbreModal({ workOrder, supabase, currentUser, onClose }) {
  const wo = workOrder || {};
  const [kind, setKind] = useState('cbre_complete');
  const [comment, setComment] = useState('');
  const [assetBarcode, setAssetBarcode] = useState(wo.asset_barcode || '');
  const [nteAmount, setNteAmount] = useState(wo.nte != null ? String(wo.nte) : '');

  // one date/time/ampm triple, reused for target & arrival
  const [d1, setD1] = useState({ ymd: '', time: '9:00', ampm: 'AM' });
  // complete: start + end
  const [start, setStart] = useState({ ymd: '', time: '9:00', ampm: 'AM' });
  const [end, setEnd] = useState({ ymd: '', time: '2:00', ampm: 'PM' });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  // Prefill Complete's start/end from the WO's check-in / check-out timestamps.
  useEffect(() => {
    const s = tsToParts(wo.time_in);
    const e = tsToParts(wo.time_out || wo.date_completed);
    if (s.ymd) setStart({ ymd: s.ymd, time: s.time || '9:00', ampm: s.ampm });
    if (e.ymd) setEnd({ ymd: e.ymd, time: e.time || '2:00', ampm: e.ampm });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wo.wo_id]);

  const meta = ACTIONS[kind];

  function buildInput() {
    const base = {
      kind,
      woNumber: wo.wo_number,
      buildingRaw: wo.ups_building_code,
      requestorEmail: REQUESTOR_EMAIL,
      vendor: VENDOR_NAME,
      comment: comment.trim(),
    };
    if (kind === 'cbre_target_date') base.targetAt = partsToDate(d1.ymd, d1.time, d1.ampm);
    if (kind === 'cbre_eta') base.arrivalAt = partsToDate(d1.ymd, d1.time, d1.ampm);
    if (kind === 'cbre_complete') {
      base.startAt = partsToDate(start.ymd, start.time, start.ampm);
      base.endAt = partsToDate(end.ymd, end.time, end.ampm);
    }
    if (kind === 'cbre_tag_equipment') base.assetBarcode = assetBarcode.trim();
    if (kind === 'cbre_nte') base.nteAmount = nteAmount;
    return base;
  }

  // Front-end required-field checks so the person gets a clear message before we
  // even build the payload.
  function localProblems() {
    const p = [];
    if (!wo.wo_number) p.push('This work order has no WO number.');
    if ((kind === 'cbre_comment' || kind === 'cbre_decline') && !comment.trim())
      p.push('A comment / reason is required.');
    if (kind === 'cbre_tag_equipment' && !assetBarcode.trim()) p.push('Asset barcode is required.');
    if (kind === 'cbre_nte' && !(parseFloat(nteAmount) > 0)) p.push('Enter a valid NTE amount.');
    if (kind === 'cbre_target_date' && !d1.ymd) p.push('Pick a target date.');
    if (kind === 'cbre_eta' && !d1.ymd) p.push('Pick an arrival date.');
    if (kind === 'cbre_complete' && (!start.ymd || !end.ymd)) p.push('Both start and end dates are required.');
    return p;
  }

  async function submit() {
    setError(null);
    const lp = localProblems();
    if (lp.length) { setError(lp.join(' ')); return; }

    const built = buildCbrePayload(buildInput());
    if (built.problems.length) { setError(built.problems.join(' ')); return; }

    const label = meta?.label || kind;
    const row = {
      kind,
      wo_id: wo.wo_id,
      wo_number: wo.wo_number,
      title: `${label} · ${wo.wo_number} → CBRE`,
      summary: `${wo.ups_building_code || 'unknown site'}${wo.building ? ' · ' + wo.building : ''}`,
      payload: { ...built.payload, _readable: built.readable },
      status: 'pending',
      created_by: safeUuid(currentUser?.user_id),
    };

    setBusy(true);
    try {
      const { error: err } = await supabase.from('approval_requests').insert(row);
      if (err) {
        if (err.code === '23505')
          setError('There is already a live request of this type for this work order — check the Approvals tab.');
        else setError(err.message);
        return;
      }
      setDone(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const DateTimeRow = ({ v, set, label }) => (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-slate-400">{label}</label>
      <div className="flex gap-2">
        <input
          type="date"
          value={v.ymd}
          onChange={(e) => set({ ...v, ymd: e.target.value })}
          className="flex-1 bg-[#0a0a0f] border border-[#2d2d44] rounded-lg px-2 py-1.5 text-sm text-slate-100"
        />
        <select
          value={v.time}
          onChange={(e) => set({ ...v, time: e.target.value })}
          className="bg-[#0a0a0f] border border-[#2d2d44] rounded-lg px-2 py-1.5 text-sm text-slate-100"
        >
          {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={v.ampm}
          onChange={(e) => set({ ...v, ampm: e.target.value })}
          className="bg-[#0a0a0f] border border-[#2d2d44] rounded-lg px-2 py-1.5 text-sm text-slate-100"
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div
        className="bg-[#1a1a2e] rounded-xl border border-[#2d2d44] w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2d2d44]">
          <h2 className="text-lg font-semibold text-slate-100">📤 Send to CBRE</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-2xl leading-none">×</button>
        </div>

        {done ? (
          <div className="p-6 space-y-4">
            <p className="text-emerald-400 font-semibold">✅ Queued for approval.</p>
            <p className="text-sm text-slate-400">
              Open the <span className="text-slate-200 font-semibold">Approvals</span> tab, approve it, then open
              the prefilled CBRE form and press Submit there.
            </p>
            <button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold">
              Done
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="text-sm text-slate-400">
              {wo.wo_number || '—'} · {wo.ups_building_code || 'no building code'}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-400">Action</label>
              <select
                value={kind}
                onChange={(e) => { setKind(e.target.value); setError(null); }}
                className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-lg px-3 py-2 text-sm text-slate-100"
              >
                {CHOICES.map((c) => <option key={c.kind} value={c.kind}>{c.label}</option>)}
              </select>
              <p className="text-xs text-slate-500">{CHOICES.find((c) => c.kind === kind)?.desc}</p>
            </div>

            {kind === 'cbre_complete' && (
              <>
                <DateTimeRow v={start} set={setStart} label="Completion Start (from check-in)" />
                <DateTimeRow v={end} set={setEnd} label="Completion End (from check-out)" />
                <p className="text-xs text-amber-400/80">
                  On CBRE's form you'll still pick the two times and tick “Vendor Confirmation” — the times are written
                  into the comment for you.
                </p>
              </>
            )}

            {kind === 'cbre_target_date' && <DateTimeRow v={d1} set={setD1} label="New Target Completion" />}
            {kind === 'cbre_eta' && <DateTimeRow v={d1} set={setD1} label="Next Arrival" />}

            {kind === 'cbre_nte' && (
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-400">NTE Request Amount ($)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={nteAmount}
                  onChange={(e) => setNteAmount(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-lg px-3 py-2 text-sm text-slate-100"
                  placeholder="e.g. 1500.00"
                />
              </div>
            )}

            {kind === 'cbre_tag_equipment' && (
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-400">Asset Barcode ID</label>
                <input
                  value={assetBarcode}
                  onChange={(e) => setAssetBarcode(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-lg px-3 py-2 text-sm text-slate-100"
                  placeholder="e.g. 100234567"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-400">
                Comment / Reason {(kind === 'cbre_comment' || kind === 'cbre_decline') && <span className="text-rose-400">*</span>}
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-lg px-3 py-2 text-sm text-slate-100"
                placeholder={kind === 'cbre_decline' ? 'Why is this being declined?' : 'Optional note for CBRE'}
              />
            </div>

            {error && <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-[#2d2d44]">Cancel</button>
              <button
                onClick={submit}
                disabled={busy}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold"
              >
                {busy ? 'Queuing…' : 'Queue for approval'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
