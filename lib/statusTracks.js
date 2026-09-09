// lib/statusTracks.js
// ─────────────────────────────────────────────────────────────────────────────
// A work order walks two ordered chains at CBRE, and until now the UI only ever
// showed the step it happens to be standing on. "DAK" alone does not say
// whether the job was ever acknowledged and quoted; you had to know the order by
// heart to read it.
//
// We do not store the history — only the current code. But both chains ARE
// ordered, so the stages already passed can be derived: a work order sitting at
// QUA must have been dispatched and acknowledged first. That is what these
// tracks render — reached stages in colour, the ones still ahead greyed out.
//
//   dispatch — from the CBRE open-orders grid: D → DAK → DEA → DAR → QUA
//   posting  — after the completion is reported: CPW → CIS → CA1 → CA2 → CIR → CMP
//
// EBO and OVD are deliberately NOT steps. "Equipment on back order" and "vendor
// declined" are not further along than anything, they are the job standing
// still, so they are shown as their own flag beside the track rather than
// pretending to be progress.
//
// Neither are DEA and DAR. Setting an ETA and a tech arriving on site are real
// events, but they are not gates: CBRE can approve a quote on a job nobody has
// driven to yet. Putting them in the chain would mean a work order at QUA lit
// up "tech arrived" — an assertion we have no basis for. Only D → DAK → QUA is
// a genuine sequence, so that is the chain, and everything else says how far it
// implies the job got (`implies`) and nothing more.
// ─────────────────────────────────────────────────────────────────────────────

import { CBRE_POSTING_STATUS, CBRE_POSTING_ORDER } from './cbrePostingStatus';
import { CBRE_GRID_STATUS, gridCode } from './cbreGridStatus';

export const DISPATCH_ORDER = ['D', 'DAK', 'QUA'];

// Off-path codes, and the furthest stage each one proves the work order reached.
// A vendor who declined the job never acknowledged it, so OVD proves only that
// it was dispatched.
export const DISPATCH_OFF_PATH = {
  DEA: 'DAK',
  DAR: 'DAK',
  EBO: 'DAK',
  OVD: 'D',
};

export const TRACKS = {
  dispatch: {
    label: 'CBRE open list',
    order: DISPATCH_ORDER,
    offPath: DISPATCH_OFF_PATH,
    meta: CBRE_GRID_STATUS,
    read: (wo) => gridCode(wo?.cbre_grid_status),
  },
  posting: {
    label: 'CBRE posting',
    order: CBRE_POSTING_ORDER,
    offPath: {},
    meta: CBRE_POSTING_STATUS,
    // cbre_status carries posting codes on some rows too — the posting column
    // wins when both are set.
    read: (wo) => {
      const raw = wo?.cbre_posting_status || wo?.cbre_status || '';
      const code = String(raw).toUpperCase().trim();
      return CBRE_POSTING_ORDER.includes(code) ? code : '';
    },
  },
};

/**
 * What to draw for one track: every stage with whether it has been reached,
 * plus any off-path flag the work order is currently sitting on.
 * Returns null when the work order has never touched this track at all —
 * an empty chain is noise, not information.
 */
export function trackSteps(trackName, wo) {
  const track = TRACKS[trackName];
  if (!track) return null;
  const current = track.read(wo);
  if (!current) return null;

  // An off-path code is not a stage, but it does prove the work order got as
  // far as whatever `implies` says — no further.
  const offPath = current in track.offPath ? current : null;
  const currentIndex = offPath
    ? track.order.indexOf(track.offPath[offPath])
    : track.order.indexOf(current);
  if (currentIndex < 0) return null;

  return {
    label: track.label,
    current,
    offPath,
    offPathMeta: offPath ? track.meta[offPath] : null,
    steps: track.order.map((code, i) => ({
      code,
      meta: track.meta[code] || { label: code, short: code },
      reached: i <= currentIndex,
      isCurrent: !offPath && i === currentIndex,
    })),
  };
}

/** One line for a tooltip: "Dispatched ✓ · Acknowledged ✓ · ETA set — · …" */
export function trackTooltip(trackName, wo) {
  const t = trackSteps(trackName, wo);
  if (!t) return '';
  const chain = t.steps.map((s) => `${s.meta.short || s.code} ${s.reached ? '✓' : '–'}`).join('  ');
  return `${t.label}: ${chain}${t.offPath ? `  ·  currently ${t.offPathMeta?.label || t.offPath} (not a stage)` : ''}`;
}
