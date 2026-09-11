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
import { buildCbrePayload, ACTIONS, to12h, parseTs, tzParts, tzDate, fmtDate } from '@/lib/cbreVendorForm';
import { billableComments } from '@/lib/commentsSplit';

// Mirrors the producer defaults (app/api/cbre/*). Override with NEXT_PUBLIC_* if
// the requestor/vendor ever change.
const REQUESTOR_EMAIL =
  process.env.NEXT_PUBLIC_CBRE_REQUESTOR_EMAIL || 'emfcontractingsc@gmail.com';
const VENDOR_NAME =
  process.env.NEXT_PUBLIC_CBRE_VENDOR_NAME || 'EMF Contracting LLC(Gaston)';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safeUuid = (v) => (typeof v === 'string' && UUID_REGEX.test(v) ? v : null);

// The Action options this dialog offers, in order.
//
// Acknowledge and NTE also have automatic producers (app/api/cbre/*), and for
// the normal case those are what fire. They are offered here too because the
// automatic run is deliberately narrow — the acknowledgement producer skips
// anything older than fourteen days, and both skip a work order whose building
// code will not resolve — and something has to be able to acknowledge the
// leftovers by hand. A live queue row of the same kind blocks the second one
// (unique index), so a manual request cannot collide with the producer's.
const CHOICES = [
  { kind: 'cbre_acknowledge',   label: '👍 Acknowledge Work',      desc: 'Tell CBRE we accept the work order. Normally automatic — use this for one the producer skipped.' },
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

// DB timestamp → { ymd:'YYYY-MM-DD', time:'9:15', ampm:'AM' } in Eastern time.
// time_in/time_out are naive UTC stamps — parseTs() knows that; plain
// `new Date(ts)` showed them 4–5 h late (see lib/cbreVendorForm.js).
function tsToParts(ts) {
  const dt = parseTs(ts);
  const p = dt ? tzParts(dt) : null;
  if (!p) return { ymd: '', time: '', ampm: 'AM' };
  const t = to12h(dt) || { time: '', ampm: 'AM' };
  return { ymd: `${p.y}-${pad(p.m)}-${pad(p.d)}`, time: t.time, ampm: t.ampm };
}

// picked parts → the instant an Eastern clock shows them (independent of the
// browser's own time zone).
function partsToDate(ymd, time, ampm) {
  if (!ymd) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return null;
  let hh = 9, mm = 0;
  if (time) { const [h, mn] = time.split(':').map(Number); hh = (h % 12) + (ampm === 'PM' ? 12 : 0); mm = mn || 0; }
  return tzDate(y, m, d, hh, mm);
}

// Module-level so its identity is stable across re-renders — a nested
// component would remount on every keystroke and break native date entry
// (you could never type all 4 year digits).
function DateTimeRow({ v, set, label }) {
  return (
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
}

// When a work order carries no check-in / check-out, CBRE still needs a start and
// an end. Default to a standard start with the work order's regular hours, or
// DEFAULT_RT_HOURS if none are logged — so the form is never left empty and the
// window matches what is actually billed.
const DEFAULT_RT_HOURS = 2;
const DEFAULT_START_HOUR = 8;            // 8:00 AM

function defaultWindow(wo) {
  const base = wo?.date_completed || wo?.time_in || wo?.date_entered;
  const p = tzParts(parseTs(base) || new Date());
  const ymd = `${p.y}-${pad(p.m)}-${pad(p.d)}`;

  // Logged regular hours win; otherwise the 2 RT default. Snap to the form's
  // 15-minute grid and keep the window inside one day.
  let hours = parseFloat(wo?.hours_regular);
  if (!Number.isFinite(hours) || hours <= 0) hours = DEFAULT_RT_HOURS;
  hours = Math.min(Math.max(Math.round(hours * 4) / 4, 0.25), 12);

  const startMin = DEFAULT_START_HOUR * 60;
  const endMin = startMin + hours * 60;
  const fmt = (mins) => {
    let h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return { time: `${h}:${pad(m)}`, ampm };
  };
  const s = fmt(startMin);
  const e = fmt(endMin);
  return {
    start: { ymd, time: s.time, ampm: s.ampm },
    end: { ymd, time: e.time, ampm: e.ampm },
    hours,
    fromDefaults: true,
  };
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
  const [usedDefaults, setUsedDefaults] = useState(null);   // {hours} when times were guessed

  // Prefill Complete's start/end from the WO's check-in / check-out timestamps.
  useEffect(() => {
    const s = tsToParts(wo.time_in);
    const e = tsToParts(wo.time_out || wo.date_completed);
    if (s.ymd && e.ymd) {
      // Real check-in / check-out — use them as they are.
      setStart({ ymd: s.ymd, time: s.time || '8:00', ampm: s.ampm });
      setEnd({ ymd: e.ymd, time: e.time || '10:00', ampm: e.ampm });
      setUsedDefaults(null);
    } else {
      // No usable times on the work order — prefill a standard window so CBRE's
      // required Start/End are never blank.
      const d = defaultWindow(wo);
      setStart(s.ymd ? { ymd: s.ymd, time: s.time || d.start.time, ampm: s.ampm } : d.start);
      setEnd(d.end);
      setUsedDefaults({ hours: d.hours });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wo.wo_id]);

  // Acknowledge needs a comment and it lands on CBRE's permanent record, so it
  // is prefilled with the same wording the automatic producer uses — a manual
  // acknowledgement should not read differently from an automatic one. Two
  // versions, because "assigned to technician" would be a false statement on a
  // work order nobody has been given yet. Only fills an empty box; whatever the
  // person has typed wins.
  useEffect(() => {
    if (kind !== 'cbre_acknowledge' || comment.trim()) return;
    const assigned = wo.assigned_to_field_at;
    const day = fmtDate(assigned || wo.date_entered) || 'receipt';
    setComment(assigned
      ? `Work order received and accepted by EMF Contracting LLC. Assigned to technician on ${day}.`
      : `Work order received and accepted by EMF Contracting LLC on ${day}. Technician assignment to follow.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, wo.wo_id]);

  const meta = ACTIONS[kind];

  function buildInput() {
    const base = {
      kind,
      woNumber: wo.wo_number,
      buildingRaw: wo.ups_building_code || wo.building,
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
    // CBRE's form marks Comment/Reason required for all three of these. An
    // earlier version read the form's nested visibility rules and concluded
    // Acknowledge did not need one; that was wrong, and the submissions came
    // back. Trust the rendered form.
    if ((kind === 'cbre_comment' || kind === 'cbre_decline' || kind === 'cbre_acknowledge') && !comment.trim())
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
      summary: `${wo.ups_building_code || wo.building || 'unknown site'}`,
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
            {/* WO context — so the covered work order behind this dialog is not needed */}
            <div className="rounded-lg border border-[#2d2d44] bg-[#0a0a0f] p-3 space-y-1.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-100 font-semibold">{wo.wo_number || '—'}</span>
                <span className="text-slate-400">{wo.ups_building_code || wo.building || 'no building'}</span>
              </div>
              {wo.lead_tech && (
                <div className="text-slate-400"><span className="text-slate-500">Tech:</span> {`${wo.lead_tech.first_name || ''} ${wo.lead_tech.last_name || ''}`.trim() || '—'}</div>
              )}
              {/* Comments, not the job description — what the crew actually
                  reported is what you need when filling CBRE's form. */}
              {(() => {
                const c = billableComments(wo);
                if (!c) return null;
                return (
                  <div>
                    <span className="text-slate-500">Comments:</span>
                    <div className="mt-1 max-h-40 overflow-y-auto rounded border border-[#2d2d44] bg-[#111122] p-2">
                      <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">{c}</pre>
                    </div>
                  </div>
                );
              })()}
              {(wo.time_in || wo.time_out) && (
                <div className="text-slate-400">
                  <span className="text-slate-500">Check-in:</span> {wo.time_in ? parseTs(wo.time_in).toLocaleString('en-US', { timeZone: 'America/New_York' }) : '—'}
                  {'  ·  '}<span className="text-slate-500">out:</span> {wo.time_out ? parseTs(wo.time_out).toLocaleString('en-US', { timeZone: 'America/New_York' }) : '—'}
                </div>
              )}
              {wo.nte != null && wo.nte !== '' && (
                <div className="text-slate-400"><span className="text-slate-500">NTE:</span> ${wo.nte}</div>
              )}
              {Array.isArray(wo.missing_data_items) && wo.missing_data_items.length > 0 && (
                <div className="text-amber-400/90"><span className="text-slate-500">Missing:</span> {wo.missing_data_items.join(', ')}</div>
              )}
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
                {usedDefaults && (
                  <p className="text-xs text-sky-400/90">
                    No check-in/out on this work order — prefilled a standard window of {usedDefaults.hours} RT hour{usedDefaults.hours === 1 ? '' : 's'}. Adjust if needed.
                  </p>
                )}
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
                Comment / Reason {(kind === 'cbre_comment' || kind === 'cbre_decline' || kind === 'cbre_acknowledge') && <span className="text-rose-400">*</span>}
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-lg px-3 py-2 text-sm text-slate-100"
                placeholder={
                  kind === 'cbre_decline' ? 'Why is this being declined?'
                  : kind === 'cbre_acknowledge' ? 'Required by CBRE for this action'
                  : 'Optional note for CBRE'
                }
              />
              {kind === 'cbre_acknowledge' && (
                <p className="text-[11px] text-slate-500">
                  Goes onto CBRE&apos;s permanent record. Prefilled with the same wording the automatic
                  acknowledgement uses — change it if this one needs saying differently.
                </p>
              )}
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
