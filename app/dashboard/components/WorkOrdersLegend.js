// app/dashboard/components/WorkOrdersLegend.js
// ─────────────────────────────────────────────────────────────────────────────
// What every mark in the work orders table means.
//
// A row can carry a dozen marks at once — client, submissions, flags,
// escalation, two CBRE chains, payout, escalation state, three different kinds
// of "new", the NTE flag and the lock. Each has a tooltip, but a tooltip only
// helps someone who already suspects what to hover, and none of it helps a new
// dispatcher at all.
//
// The legend renders the REAL markup, not a description of it: every chip here
// is built from the same config the table uses, so it cannot drift into
// describing something the table stopped doing. Collapsed by default, because
// the people who need it need it twice and then never again.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState } from 'react';
import { CLIENT_STYLES } from '@/lib/clientType';
import { SUBMISSION_META } from '@/lib/submissionStatus';
import { DISPUTE_STATUS } from '@/lib/disputeStatus';
import { CBRE_GRID_STATUS } from '@/lib/cbreGridStatus';
import { CBRE_POSTING_STATUS, CBRE_POSTING_ORDER, CBRE_POSTING_OFF_PATH } from '@/lib/cbrePostingStatus';
import { AGING_LEVELS, AGING_WARN_DAYS, AGING_FLAG_DAYS, AGING_CLOSE_DAYS, AGING_GRACE_DAYS, AGING_DOCUMENTED_DAYS } from '@/lib/agingRisk';
import { PAUSE_REASONS, PAUSE_BADGE } from '@/lib/clockPause';
import { DISPATCH_ORDER, DISPATCH_OFF_PATH } from '@/lib/statusTracks';
import { PRIORITY_CODES } from '@/lib/priorityCodes';
import StatusTrack from './StatusTrack';

const Chip = ({ className = '', style, children }) => (
  <span style={style} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${className}`}>
    {children}
  </span>
);

const Row = ({ mark, children }) => (
  <div className="flex items-start gap-2 py-1">
    <span className="shrink-0 w-[104px] flex items-center gap-1">{mark}</span>
    <span className="text-slate-500 leading-snug">{children}</span>
  </div>
);

const Group = ({ title, children }) => (
  <div className="min-w-[260px] flex-1">
    <div className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold mb-1.5 border-b border-[#1e1e2e] pb-1">
      {title}
    </div>
    {children}
  </div>
);

export default function WorkOrdersLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 border-t border-[#1e1e2e] pt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs text-slate-500 hover:text-slate-300 transition flex items-center gap-1.5"
      >
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
        Legend — what the marks on a row mean
      </button>

      {open && (
        <div className="mt-3 flex flex-wrap gap-x-8 gap-y-5 text-xs">

          <Group title="Who the work is for">
            {Object.entries(CLIENT_STYLES).map(([key, s]) => (
              <Row key={key} mark={<Chip style={{ backgroundColor: s.bgHex, color: s.textHex, borderColor: s.accentHex }}>{s.label}</Chip>}>
                {key === 'CBRE' ? 'Billed through CBRE — CBRE forms and NTE rules apply' : 'UPS work — no CBRE vendor form'}
              </Row>
            ))}
          </Group>

          <Group title="What the crew sent in">
            {Object.entries(SUBMISSION_META).map(([type, meta]) => (
              <Row key={type} mark={
                <span className="flex items-center gap-1.5">
                  <span className="text-[11px] opacity-100">{meta.icon}</span>
                  <span className="text-[11px] opacity-50 grayscale">{meta.icon}</span>
                  <span className="text-[11px] opacity-30 grayscale">{meta.icon}</span>
                </span>
              }>
                {meta.label} — bright: received · faded: missing · faintest: not checked yet.
                Nothing at all means it is not required for this work order.
              </Row>
            ))}
          </Group>

          <Group title="Needs someone">
            <Row mark={<Chip className="bg-red-500/20 text-red-400 border-red-500/40 animate-pulse">🚩</Chip>}>
              Flagged for review. Red is high, orange medium, yellow low; a number means several flags.
            </Row>
            <Row mark={<Chip className="bg-red-500/20 text-red-400 border-red-500/40 animate-pulse">🚨 ESC</Chip>}>
              Escalation — CBRE or UPS has raised this one. Independent of every status.
            </Row>
            <Row mark={<Chip className="bg-orange-500/20 text-orange-400 border-orange-500/30">ACK?</Chip>}>
              CBRE has not been told we accepted the job. Only on CBRE work, and only while it is recent enough to still matter.
            </Row>
            <Row mark={<Chip className="bg-amber-500/30 text-amber-200 border-amber-400/70 animate-pulse">🔔 NEW</Chip>}>
              CBRE changed the status and nobody has looked. <span className="text-slate-400">Click it</span> to acknowledge, or click the work order to open it.
            </Row>
            <Row mark={<Chip className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse">NEW</Chip>}>
              Arrived in the last 24 hours and has no lead tech yet.
            </Row>
            <Row mark={<Chip className="bg-amber-500/20 text-amber-400 border-amber-500/30">💰 NTE</Chip>}>
              An NTE increase was written here but has not been submitted to CBRE.
            </Row>
          </Group>

          <Group title="Clock paused">
            {Object.entries(PAUSE_REASONS).map(([key, cfg]) => (
              <Row key={key} mark={<Chip className={PAUSE_BADGE}>{cfg.emoji} {cfg.short}</Chip>}>
                {cfg.label}
                {cfg.tech
                  ? ' — set by the technician in the field app.'
                  : ' — set here or by the CBRE sync.'}
                {key === 'parts_ordered' && ' The number beside it is how many days it has stood there.'}
              </Row>
            ))}
            <Row mark={<span className="text-slate-500 text-[11px]">what it does</span>}>
              A paused work order&apos;s time does not count against its completion target, and the hold
              reporter sends CBRE a target-date extension so it does not age out while it waits.
              Open the work order to see the technician&apos;s note and to end the pause.
            </Row>
          </Group>

          <Group title="CBRE's open list">
            <Row mark={<StatusTrack track="dispatch" wo={{ cbre_grid_status: 'QUA' }} size="mini" />}>
              How far CBRE's own list of open work orders has this one:
              {' '}{DISPATCH_ORDER.map((c, i) => (
                <span key={c}>{i > 0 && ' → '}<span className="text-slate-300 font-mono">{c}</span> {CBRE_GRID_STATUS[c]?.label.toLowerCase()}</span>
              ))}.
              Filled segments are stages it has passed, hollow ones are still ahead.
            </Row>
            {Object.keys(DISPATCH_OFF_PATH).map((code) => (
              <Row key={code} mark={<Chip className={CBRE_GRID_STATUS[code]?.badge}>{CBRE_GRID_STATUS[code]?.emoji} {code} ⏸</Chip>}>
                {CBRE_GRID_STATUS[code]?.label} — <span className="text-slate-600">not a stage</span>; the job is standing there.
                It only proves the work order got as far as {DISPATCH_OFF_PATH[code]}.
              </Row>
            ))}
          </Group>

          <Group title="CBRE's payment chain">
            <Row mark={<StatusTrack track="posting" wo={{ cbre_posting_status: 'CIR' }} size="mini" />}>
              How far CBRE is through approving and paying:
              {' '}{CBRE_POSTING_ORDER.map((c, i) => (
                <span key={c}>{i > 0 && ' → '}<span className="text-slate-300 font-mono">{c}</span></span>
              ))}.
              Hover a segment for its name. CIR or CMP starts the 75-day payout clock.
            </Row>
            {Object.entries(CBRE_POSTING_OFF_PATH).map(([code, implies]) => (
              <Row key={code} mark={<Chip className={CBRE_POSTING_STATUS[code]?.badge}>{CBRE_POSTING_STATUS[code]?.emoji} {code}</Chip>}>
                {CBRE_POSTING_STATUS[code]?.label} — <span className="text-slate-600">not a stage</span>; the invoice is standing there.
                It only proves the invoice got as far as {implies}. {CBRE_POSTING_STATUS[code]?.action}
              </Row>
            ))}
            <Row mark={<Chip className="bg-emerald-500/10 text-emerald-400/90 border-emerald-500/25">💵 42d</Chip>}>
              Days until the payment is due. Turns red and reads <span className="font-mono">due</span> once the date has passed.
            </Row>
          </Group>

          <Group title="Close-out clock">
            <Row mark={<Chip className={AGING_LEVELS.watch.badge}>{AGING_LEVELS.watch.emoji} 45d</Chip>}>
              Days past the completion target. CBRE&apos;s own countdown has not started yet —
              this is our warning from {AGING_WARN_DAYS} days, while there is still room to move.
            </Row>
            <Row mark={<Chip className={AGING_LEVELS.at_risk.badge}>{AGING_LEVELS.at_risk.emoji} 55d</Chip>}>
              At {AGING_FLAG_DAYS} days past target CBRE flags the work order and e-mails
              &quot;Will Be Closed in {AGING_GRACE_DAYS} Days&quot;. Once that e-mail has been read into
              FSM the badge counts down to CBRE&apos;s own stated date instead of ours.
            </Row>
            <Row mark={<Chip className={AGING_LEVELS.past_due.badge}>{AGING_LEVELS.past_due.emoji} 74d</Chip>}>
              Past {AGING_CLOSE_DAYS} days ({AGING_FLAG_DAYS} + {AGING_GRACE_DAYS}) — closed, and a closed
              work order <span className="text-slate-300">cannot be reopened for billing</span>; only a sub
              work order recovers it. The handbook still says {AGING_DOCUMENTED_DAYS} days; the machine says {AGING_CLOSE_DAYS}.
            </Row>
            <Row mark={<span className="text-slate-500 text-[11px]">no badge</span>}>
              Nothing is shown once the work order is closed here, sits in Escalations, has reached
              CBRE&apos;s posting chain, or has been invoiced — the timer can no longer take it.
              Hover any badge to see which date it counted from: CBRE&apos;s own target, or ours
              estimated from the dispatch date and priority when CBRE never sent one.
            </Row>
          </Group>

          <Group title="Escalations tab">
            {Object.entries(DISPUTE_STATUS).map(([key, cfg]) => (
              <Row key={key} mark={<Chip className={cfg.badge}>{cfg.emoji} {cfg.short}</Chip>}>
                {cfg.label}.
                {key === 'superseded' && ' The chip shows the sub work order number instead — that is where the money is now.'}
                {['open', 'escalated', 'sub_wo_requested', 'superseded'].includes(key) &&
                  ' While it says this, the work order is out of the dashboard, CBRE Data Entry and Invoicing.'}
              </Row>
            ))}
          </Group>

          <Group title="Columns">
            <Row mark={<span className="text-emerald-400">✓</span>}>CBRE column: we told CBRE we accepted the job.</Row>
            <Row mark={<span className="text-orange-400">○</span>}>Not acknowledged to CBRE yet.</Row>
            <Row mark={<span className="text-slate-600">·</span>}>Old enough that it was almost certainly handled by phone or in VAWS — the queue skips it.</Row>
            <Row mark={<span>🔒</span>}>Locked — an invoice has been generated, so the work order is out of the dashboard.</Row>
          </Group>

          <Group title="Priority">
            {Object.entries(PRIORITY_CODES).map(([code, p]) => (
              <Row key={code} mark={<span style={{ color: p.color }} className="font-bold">{p.icon} {code}</span>}>
                {p.description} — respond {p.response}, complete {p.completion}
              </Row>
            ))}
          </Group>

        </div>
      )}
    </div>
  );
}
