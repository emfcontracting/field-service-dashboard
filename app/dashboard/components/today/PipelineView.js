// app/dashboard/components/today/PipelineView.js
// ─────────────────────────────────────────────────────────────────────────────
// Design canvas board "A · Pipeline": every work order is a card, every column
// a stage of its life — dispatch to paid. The one line under each card says
// why it is not moving (todayModel.blockerLine / invoiceLine).
//
// The first five columns come from the open list, Invoice and Invoiced from
// the invoices table (an invoiced work order has left the open list). Clicking
// a card opens the same WorkOrderDetailModal the classic table uses — for an
// invoice card whose work order is no longer in the open list the modal gets
// the joined work-order row, which is enough for a look and a comment.
//
// ?col=<stage> (from the Today screen) scrolls that column into view and
// highlights it for a moment.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { C, Panel, Eyebrow, Btn, Empty, PriorityTag, Count, openWorkOrder } from './ui';
import { STAGES, money, fmtAge, techName } from './todayModel';
import { extractPriorityCode } from '@/lib/priorityCodes';

function Card({ card, onSelect }) {
  const wo = card.wo || {};
  const code = extractPriorityCode(wo.priority);
  const old = (card.age || 0) >= 14;
  const openable = !!(wo.wo_id && onSelect);
  return (
    <button type="button" disabled={!openable} onClick={() => openable && onSelect(wo)}
      className="w-full text-left rounded-[10px] px-3 py-2.5 transition hover:brightness-110 disabled:cursor-default"
      style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2">
        <span className="font-semibold text-[13px] truncate">{wo.wo_number || card.inv?.invoice_number || '—'}</span>
        <PriorityTag code={code} />
        <span className="ml-auto text-[11px] whitespace-nowrap" style={{ color: old ? C.amber : C.muted }}>{fmtAge(card.age)}</span>
      </div>
      <div className="text-[12px] truncate mt-0.5" style={{ color: C.muted }}>
        {card.site}{techName(wo) && card.stage !== 'new' ? ` · ${techName(wo).split(' ')[0]}` : ''}{card.value ? ` · ${money(card.value)}` : ''}
      </div>
      <div className="text-[12px] mt-1 truncate" style={{ color: card.stage === 'done' && /ready/.test(card.line) ? C.green : C.text }}>{card.line}</div>
    </button>
  );
}

const PAGE = 25;

export default function PipelineView({ data, loading, supabase, onSelectWorkOrder, initialColumn, goView }) {
  const { columns, strip, stuck, error } = data;
  const open = (wo) => openWorkOrder(supabase, wo, onSelectWorkOrder);
  const [filter, setFilter] = useState('');
  const [shown, setShown] = useState({});
  const colRefs = useRef({});
  const [flash, setFlash] = useState(initialColumn || null);

  useEffect(() => {
    if (!initialColumn || !colRefs.current[initialColumn]) return;
    colRefs.current[initialColumn].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    const t = setTimeout(() => setFlash(null), 2500);
    return () => clearTimeout(t);
  }, [initialColumn, loading]);

  const q = filter.trim().toLowerCase();
  const visible = useMemo(() => {
    const out = {};
    for (const s of STAGES) {
      out[s.id] = q
        ? columns[s.id].filter((c) => [c.wo?.wo_number, c.site, c.line, techName(c.wo), c.inv?.invoice_number].filter(Boolean).join(' ').toLowerCase().includes(q))
        : columns[s.id];
    }
    return out;
  }, [columns, q]);

  const total = STAGES.reduce((s, st) => s + columns[st.id].length, 0);

  return (
    <div className="flex flex-col gap-4" style={{ color: C.text }}>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[24px] font-bold m-0">Pipeline</h1>
          <p className="m-0 mt-1 text-[14px]" style={{ color: C.muted }}>
            {total} work order{total === 1 ? '' : 's'} on the board · the line under each card says why it is not moving
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <label htmlFor="pipeline-filter" className="sr-only">Filter cards</label>
          <input id="pipeline-filter" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter: WO#, site, technician, reason"
            className="rounded-[10px] px-3 min-h-[40px] text-[13px] min-w-[260px]" style={{ background: C.panel, border: `1px solid ${C.border2}`, color: C.text }} />
          <Btn tone="ghost" onClick={() => goView('workorders')}>Classic table</Btn>
          <Btn tone="ghost" onClick={() => data.refresh?.()}>Refresh</Btn>
        </div>
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-[13px]" style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, color: C.redText }}>
          Invoice columns could not be loaded ({error}).
        </div>
      )}

      {/* Where it sticks */}
      <Panel className="px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Eyebrow>Where it sticks</Eyebrow>
          {strip.filter((s) => s.count).sort((a, b) => b.oldest - a.oldest).slice(0, 3).map((s, i) => (
            <span key={s.id} className="text-[13px]" style={{ color: i === 0 ? C.amber : C.muted }}>
              {s.label}: {s.count} card{s.count === 1 ? '' : 's'}, oldest {fmtAge(s.oldest)}{s.value ? ` · ${money(s.value)}` : ''}
            </span>
          ))}
          {!total && !loading && <span className="text-[13px]" style={{ color: C.muted }}>Nothing on the board.</span>}
        </div>
      </Panel>

      {/* Columns */}
      <div className="overflow-x-auto pb-2">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${STAGES.length}, minmax(230px, 1fr))`, minWidth: `${STAGES.length * 242}px` }}>
          {STAGES.map((s) => {
            const cards = visible[s.id];
            const n = shown[s.id] || PAGE;
            const isStuck = s.id === stuck && cards.length > 0;
            const flashing = flash === s.id;
            return (
              <section key={s.id} ref={(el) => { colRefs.current[s.id] = el; }} aria-label={s.label}
                className="rounded-xl flex flex-col gap-2 p-2.5 transition-colors duration-700"
                style={{ background: flashing ? '#1b2232' : C.panel, border: `1px solid ${flashing ? C.accent : isStuck ? '#5a4512' : C.border}`, minHeight: 240 }}>
                <header className="flex items-center justify-between gap-2 px-1">
                  <div>
                    <div className="font-semibold text-[14px]" style={{ color: isStuck ? C.amber : C.text }}>{s.label}</div>
                    <div className="text-[11px] truncate" style={{ color: C.dim }}>{s.hint}</div>
                  </div>
                  <Count n={cards.length} tone={isStuck ? 'amber' : 'grey'} />
                </header>
                {loading && !cards.length ? <Empty>Loading…</Empty> : null}
                {!loading && !cards.length ? <Empty>{q ? 'No match.' : 'Empty.'}</Empty> : null}
                {cards.slice(0, n).map((card) => <Card key={card.key} card={card} onSelect={open} />)}
                {cards.length > n && (
                  <button type="button" onClick={() => setShown((p) => ({ ...p, [s.id]: n + PAGE }))}
                    className="text-[12px] py-1.5 hover:underline" style={{ color: '#9ec5ff' }}>
                    Show {Math.min(PAGE, cards.length - n)} more of {cards.length}
                  </button>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
