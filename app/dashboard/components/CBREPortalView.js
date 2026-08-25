// app/dashboard/components/CBREPortalView.js
// ─────────────────────────────────────────────────────────────────────────────
// CBRE PORTAL — the VAWS portal next to the work orders it is about.
//
// Two halves, and the top one is the point:
//
//   Worklist   your open CBRE work orders, each number one tap from the
//              clipboard. On a phone, typing "C3162346" into a portal search
//              box is most of the work; this removes it.
//   Frame      the portal itself, if it agrees to be framed.
//
// It very likely will NOT agree. A signed-in enterprise portal normally sends
// X-Frame-Options or a frame-ancestors policy to stop being embedded — that is
// standard clickjacking protection, not something aimed at us — and even where
// the frame loads, a cross-site frame no longer gets the session cookie in
// current browsers, so it would show a login screen rather than your work.
//
// Smartsheet's form embeds because a published form is built for embedding.
// This is the opposite kind of page. So the frame here is the upside, not the
// feature: the worklist and "Open portal" carry the tab on their own, and
// nothing pretends the frame worked when it did not.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { getClientType } from '@/lib/clientType';

const PORTAL_URL = 'https://enterprise.serviceinsight.cbre.com/PRD40177VWS';

// How long to wait before saying the frame looks blocked. We cannot READ the
// frame to find out — cross-origin — so this is a hint, not a diagnosis, and it
// is worded that way on screen.
const FRAME_HINT_MS = 6000;

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

const money = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null;
};

const FILTERS = [
  { id: 'all',      label: 'All' },
  { id: 'unack',    label: 'Not acknowledged' },
  { id: 'quoted',   label: 'Quote submitted' },
  { id: 'complete', label: 'Completed' },
];

export default function CBREPortalView({ workOrders = [] }) {
  const [q, setQ]             = useState('');
  const [filter, setFilter]   = useState('all');
  const [copied, setCopied]   = useState(null);
  const [showFrame, setShowFrame] = useState(false);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [frameHint, setFrameHint] = useState(false);
  const hintTimer = useRef(null);

  useEffect(() => () => clearTimeout(hintTimer.current), []);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return workOrders
      .filter((wo) => getClientType(wo) === 'CBRE')
      .filter((wo) => {
        if (filter === 'unack')    return !wo.cbre_acknowledged_at;
        if (filter === 'quoted')   return wo.cbre_status === 'quote_submitted';
        if (filter === 'complete') return wo.status === 'completed';
        return true;
      })
      .filter((wo) => {
        if (!needle) return true;
        return [wo.wo_number, wo.building, wo.description]
          .some((f) => String(f || '').toLowerCase().includes(needle));
      })
      .slice(0, 60);
  }, [workOrders, q, filter]);

  async function copy(text, id) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch {
      // Clipboard is blocked in some contexts. Select it instead of failing mute.
      window.prompt('Copy this:', text);
    }
  }

  function openFrame() {
    setShowFrame(true);
    setFrameLoaded(false);
    setFrameHint(false);
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setFrameHint(true), FRAME_HINT_MS);
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">CBRE Portal</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Your CBRE work orders, one tap from the clipboard — next to the portal you paste them into.
          </p>
        </div>
        <a
          href={PORTAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-sky-600 text-white"
        >
          Open portal ↗
        </a>
      </div>

      {/* ── Worklist ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search WO number, building, description…"
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700 text-sm text-slate-200 placeholder-slate-500"
        />
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              filter === f.id
                ? 'bg-slate-700/60 text-slate-100 border-slate-600'
                : 'bg-transparent text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-slate-500 text-sm px-1">No CBRE work orders match.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((wo) => {
            const nte = money(wo.nte);
            return (
              <div
                key={wo.wo_id}
                className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2"
              >
                <button
                  onClick={() => copy(wo.wo_number, wo.wo_id)}
                  className="font-mono text-sm font-semibold text-slate-100 hover:text-sky-300 shrink-0"
                  title="Tap to copy the work order number"
                >
                  {copied === wo.wo_id ? '✓ copied' : wo.wo_number}
                </button>
                <span className="text-xs text-slate-400 truncate flex-1 min-w-0">
                  {wo.building} · {fmtDate(wo.date_entered)}
                  {nte ? ` · NTE ${nte}` : ''}
                </span>
                {!wo.cbre_acknowledged_at && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-orange-500/20 text-orange-400 border-orange-500/30 shrink-0"
                    title="Not yet acknowledged to CBRE"
                  >
                    ACK?
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── The frame, offered honestly ─────────────────────────────────────── */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-3 space-y-2">
        {!showFrame ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-slate-400 flex-1 min-w-[240px]">
              You can try loading the portal in this page. Signed-in portals usually refuse to be
              embedded, and a frame does not carry your login — so expect this to stay blank and
              use <span className="text-slate-200">Open portal</span> above.
            </p>
            <button
              onClick={openFrame}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-600 text-slate-300 hover:text-slate-100"
            >
              Try it anyway
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-slate-400 flex-1 min-w-[240px]">
                {frameHint && !frameLoaded
                  ? 'Still blank — CBRE is almost certainly refusing to be embedded. Use Open portal above; this is not something the dashboard can change.'
                  : 'Loading CBRE’s portal. If it stays blank, it is refusing the frame.'}
              </p>
              <button
                onClick={() => { setShowFrame(false); clearTimeout(hintTimer.current); }}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-slate-600 text-slate-400 hover:text-slate-200"
              >
                Hide frame
              </button>
            </div>
            <iframe
              src={PORTAL_URL}
              title="CBRE VAWS portal"
              onLoad={() => setFrameLoaded(true)}
              className="w-full rounded-lg border border-slate-700 bg-white"
              style={{ height: 'min(70vh, 820px)' }}
            />
          </>
        )}
      </div>
    </div>
  );
}
