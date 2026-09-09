// app/dashboard/components/StatusTrack.js
// ─────────────────────────────────────────────────────────────────────────────
// One ordered CBRE chain, drawn so you can see the whole path at a glance:
// stages already passed in colour, the ones still ahead greyed out.
//
// Two sizes, because a work orders row and a detail panel need very different
// things from the same information:
//
//   mini — for table rows. Four to six 5px segments and the current code as
//          text. It has to sit in a line that already carries the client type,
//          submissions, flags, escalation and the NEW bell, so it stays under
//          ~70px and never wraps: the segments are fixed width, not flex.
//   full — for the detail modal and the invoice panel, where there is room to
//          label every stage.
//
// Off-path codes (EBO, OVD) are not steps. They ride beside the track as their
// own chip, because "equipment on back order" is the job standing still, not
// progress, and colouring it as a stage would say the opposite.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { trackSteps, trackTooltip } from '@/lib/statusTracks';

export default function StatusTrack({ track, wo, size = 'mini', className = '' }) {
  const t = trackSteps(track, wo);
  if (!t) return null;

  return size === 'full'
    ? <FullTrack t={t} className={className} />
    : <MiniTrack t={t} tip={trackTooltip(track, wo)} className={className} />;
}

// The segments and the code text take their colour from the stage the work
// order is standing on, so a track reads the same as the badge it replaces.
// The tone is lifted out of that stage's existing badge string rather than
// maintained a second time.
const toneOf = (meta) => {
  const m = /(?:^|\s)(text-[a-z]+-\d{2,3})/.exec(meta?.badge || '');
  return m ? m[1] : 'text-slate-300';
};

// ── Table rows ───────────────────────────────────────────────────────────────
function MiniTrack({ t, tip, className }) {
  const currentMeta = t.offPath ? t.offPathMeta : t.steps.find((s) => s.isCurrent)?.meta;
  return (
    <span
      title={tip}
      className={`inline-flex items-center gap-1 cursor-help align-middle ${toneOf(currentMeta)} ${className}`}
    >
      <span className="inline-flex items-center gap-[2px]">
        {t.steps.map((s) => (
          <span
            key={s.code}
            className={`inline-block w-[5px] h-[10px] rounded-[1px] ${
              s.isCurrent ? 'bg-current opacity-100'
                : s.reached ? 'bg-current opacity-45'
                : 'bg-slate-700 opacity-40'
            }`}
            title={`${s.meta.label} — ${s.reached ? 'reached' : 'not reached'}`}
          />
        ))}
      </span>
      <span className="text-[9px] font-bold font-mono leading-none">
        {t.offPath || t.current}
      </span>
      {currentMeta?.emoji && <span className="text-[9px] leading-none">{currentMeta.emoji}</span>}
      {/* An off-path code sits outside the chain, so it gets a ring to say
          "this is where it is stuck", not "this is how far it got". */}
      {t.offPath && <span className="text-[8px] leading-none opacity-60">⏸</span>}
    </span>
  );
}

// ── Detail panels ────────────────────────────────────────────────────────────
function FullTrack({ t, className }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-1">
        {t.steps.map((s, i) => (
          <div key={s.code} className="flex items-center gap-1 flex-1 last:flex-none">
            <div
              title={s.meta.label}
              className={`flex items-center justify-center rounded-md text-[10px] font-bold font-mono px-1.5 py-1 border transition
                ${s.isCurrent ? (s.meta.badge || 'bg-blue-500/15 text-blue-300 border-blue-500/30')
                  : s.reached ? 'bg-slate-700/40 text-slate-300 border-slate-600/40'
                  : 'bg-[#0a0a0f] text-slate-700 border-[#1e1e2e]'}`}
            >
              {s.code}
            </div>
            {i < t.steps.length - 1 && (
              <div className={`h-px flex-1 ${s.reached && !s.isCurrent ? 'bg-slate-600' : 'bg-[#1e1e2e]'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400">
          {t.offPath ? t.offPathMeta?.label : t.steps.find((s) => s.isCurrent)?.meta.label}
        </span>
        {t.offPath && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${t.offPathMeta?.badge || 'bg-amber-500/15 text-amber-300 border-amber-500/30'}`}>
            {t.offPathMeta?.emoji} {t.offPath} — not a stage, the job is waiting
          </span>
        )}
      </div>
    </div>
  );
}
