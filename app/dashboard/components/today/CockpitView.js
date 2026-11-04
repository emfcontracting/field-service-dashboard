// app/dashboard/components/today/CockpitView.js
// ─────────────────────────────────────────────────────────────────────────────
// Design canvas board "C · Cockpit" — Sites & Crew. The dispatcher's morning
// view: which site has what open, who is where right now, what expires in
// the next days. Money on top as four numbers, then the site matrix (number =
// work orders in that stage, colour = how old the oldest is, red when one of
// them is in CBRE's cancellation window), then the crew and the deadlines.
//
// For decisions in the morning, not for catching up in the evening — that is
// what Today is for.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { C, Panel, Eyebrow, Btn, WoLink, Empty, Count, openWorkOrder, timeET } from './ui';
import { STAGES, money, fmtAge } from './todayModel';
import { dateKeyET } from '@/lib/dates';

const MATRIX_STAGES = STAGES;   // all seven; Invoice/Invoiced come from the invoices table

function cellTone(n, oldest, closing) {
  if (!n) return { bg: '#1b2232', fg: C.dim };
  if (closing) return { bg: C.redBorder, fg: C.redText };
  if (oldest >= 30) return { bg: C.amberBorder, fg: C.amber };
  return { bg: '#1b2232', fg: C.text };
}

export default function CockpitView({ data, users, loading, supabase, onSelectWorkOrder: onSelectRaw, goView }) {
  const router = useRouter();
  const open = (wo) => openWorkOrder(supabase, wo, onSelectRaw);
  const { money: m, sites, crew, notClockedIn, expiring, error, columns } = data;
  const [upsOnly, setUpsOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(() => {
    const r = upsOnly ? sites.filter((s) => /^[A-Z]{5}$/.test(s.site)) : sites;   // UPS site codes: SCSMV, GAWAR …
    return showAll ? r : r.slice(0, 10);
  }, [sites, upsOnly, showAll]);

  const techCount = new Set((users || []).filter((u) => ['lead_tech', 'tech', 'helper'].includes(u.role)).map((u) => u.user_id)).size;

  return (
    <div className="flex flex-col gap-5" style={{ color: C.text }}>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[24px] font-bold m-0">Sites &amp; Crew</h1>
          <p className="m-0 mt-1 text-[14px]" style={{ color: C.muted }}>
            {crew.length} of {techCount} technicians clocked in · {sites.length} site{sites.length === 1 ? '' : 's'} with open work
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn tone={upsOnly ? 'primary' : 'ghost'} onClick={() => setUpsOnly((v) => !v)}>UPS only</Btn>
          <Btn tone="ghost" onClick={() => goView('calendar')}>Calendar</Btn>
          <Btn tone="ghost" onClick={() => data.refresh?.()}>Refresh</Btn>
        </div>
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-[13px]" style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, color: C.redText }}>
          Part of this screen could not be loaded ({error}).
        </div>
      )}

      {/* Money strip */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {[
          { label: 'At CBRE, no answer', value: money(m.waitingAtCbre.value), sub: `${m.waitingAtCbre.old} request${m.waitingAtCbre.old === 1 ? '' : 's'} older than 14 days`, color: C.amber, border: C.amberBorder, go: () => goView('ups-escalation') },
          { label: 'Done, not invoiced', value: money(m.doneNotInvoiced.value), sub: `${m.doneNotInvoiced.count} draft${m.doneNotInvoiced.count === 1 ? '' : 's'}, ${m.doneNotInvoiced.completions} completion${m.doneNotInvoiced.completions === 1 ? '' : 's'} ahead of them`, color: C.text, border: C.border, go: () => router.push('/invoices') },
          { label: 'Invoiced, unpaid', value: money(m.invoicedUnpaid.value), sub: '75-day clock from CIR/CMP', color: C.text, border: C.border, go: () => router.push('/invoices') },
          { label: 'In the cancellation window', value: String(m.closing.count), sub: 'more than 53 days past target at CBRE', color: m.closing.count ? C.red : C.text, border: m.closing.count ? C.redBorder : C.border, go: () => goView('workorders') },
        ].map((t) => (
          <button key={t.label} type="button" onClick={t.go} className="text-left rounded-xl px-4 py-3.5 transition hover:brightness-110" style={{ background: C.panel, border: `1px solid ${t.border}` }}>
            <Eyebrow>{t.label}</Eyebrow>
            <div className="text-[26px] font-bold mt-1 leading-none" style={{ color: t.color }}>{t.value}</div>
            <div className="text-[12px] mt-1.5" style={{ color: C.muted }}>{t.sub}</div>
          </button>
        ))}
      </div>

      <div className="flex gap-5 flex-wrap items-start">
        {/* Site matrix */}
        <Panel className="flex-[3_1_560px] min-w-0 p-4 flex flex-col gap-3" aria-label="Sites">
          <div className="flex justify-between items-baseline flex-wrap gap-2">
            <strong className="text-[15px]">Sites</strong>
            <span className="text-[12px]" style={{ color: C.muted }}>number = work orders · amber = oldest over 30 days · red = one is in the cancellation window</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]" style={{ borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr style={{ color: C.muted }} className="text-[11px] uppercase tracking-[.06em]">
                  <th scope="col" className="text-left px-1.5 py-2" style={{ borderBottom: `1px solid ${C.border}` }}>Site</th>
                  {MATRIX_STAGES.map((s) => (
                    <th key={s.id} scope="col" className="text-center px-1.5 py-2" style={{ borderBottom: `1px solid ${C.border}` }}>{s.label}</th>
                  ))}
                  <th scope="col" className="text-right px-1.5 py-2" style={{ borderBottom: `1px solid ${C.border}` }}>There now</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.site}>
                    <th scope="row" className="text-left px-1.5 py-2 font-semibold" style={{ borderBottom: `1px solid #1c2230` }}>
                      <div>{r.site}{r.name ? <span className="font-normal" style={{ color: C.muted }}> · {r.name}</span> : null}</div>
                      <div className="text-[11px] font-normal" style={{ color: C.dim }}>{r.total} open{r.oldestWo ? ` · oldest ${r.oldestWo} (${fmtAge(r.oldest)})` : ''}</div>
                    </th>
                    {MATRIX_STAGES.map((s) => {
                      const n = r.counts[s.id];
                      const tone = cellTone(n, r.oldest, r.closing && ['new', 'assigned', 'in_field', 'done', 'at_cbre'].includes(s.id) && n);
                      return (
                        <td key={s.id} className="text-center px-1.5 py-1.5" style={{ borderBottom: `1px solid #1c2230` }}>
                          <button type="button" disabled={!n} onClick={() => goView('pipeline', { col: s.id })}
                            className="inline-block min-w-[32px] rounded-lg px-2 py-1 font-semibold disabled:cursor-default transition hover:brightness-125"
                            style={{ background: tone.bg, color: tone.fg }}>{n}</button>
                        </td>
                      );
                    })}
                    <td className="text-right px-1.5 py-1.5" style={{ borderBottom: `1px solid #1c2230`, color: r.techs.length ? '#c7cdd9' : C.dim }}>
                      {r.techs.length ? r.techs.join(', ') : '—'}
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td colSpan={MATRIX_STAGES.length + 2} className="py-3"><Empty>{loading ? 'Loading…' : 'No open work.'}</Empty></td></tr>
                )}
              </tbody>
            </table>
          </div>
          {sites.length > 10 && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="text-[12px] text-left hover:underline" style={{ color: '#9ec5ff' }}>
              {showAll ? 'Show the busiest 10' : `All ${sites.length} sites`}
            </button>
          )}
        </Panel>

        {/* Crew + deadlines */}
        <div className="flex-[2_1_340px] min-w-[300px] flex flex-col gap-5">
          <Panel className="p-4 flex flex-col gap-3" aria-label="In the field now">
            <div className="flex justify-between items-baseline">
              <strong className="text-[15px]">In the field now</strong>
              <span className="text-[12px]" style={{ color: C.muted }}>as of {timeET(new Date().toISOString())}</span>
            </div>
            {crew.length ? crew.map((c) => (
              <div key={c.userId} className="flex flex-col gap-1">
                <div className="flex justify-between text-[13px] gap-2"><strong className="truncate">{c.name}</strong><span style={{ color: C.green }}>clocked in {timeET(c.since)}</span></div>
                <div className="text-[12px] truncate" style={{ color: C.muted }}>
                  {c.wo ? <>{c.site} · <WoLink wo={c.wo} onSelect={open} className="text-[12px]" /> · {c.wo.priority ? String(c.wo.priority).split(' ')[0] : ''}{c.wo.nte ? ` · NTE ${money(c.wo.nte)}` : ''}</> : 'on a work order outside the open list'}
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1b2232' }}>
                  <div className="h-full" style={{ width: `${Math.min(100, Math.round((Date.now() - new Date(c.since).getTime()) / 3600000 / 8 * 100))}%`, background: C.green }} />
                </div>
              </div>
            )) : <Empty>Nobody is clocked in right now.</Empty>}
            {notClockedIn.map((t) => (
              <div key={t.user.user_id} className="flex flex-col gap-1">
                <div className="flex justify-between text-[13px] gap-2"><strong className="truncate">{t.name}</strong><span style={{ color: C.red }}>not clocked in</span></div>
                <div className="text-[12px]" style={{ color: C.muted }}>assigned: {t.open} open work order{t.open === 1 ? '' : 's'}</div>
                <div className="h-1.5 rounded-full" style={{ background: '#1b2232' }} />
              </div>
            ))}
          </Panel>

          <Panel className="p-4 flex flex-col gap-2" aria-label="Expiring">
            <strong className="text-[15px]">Expiring</strong>
            {expiring.length ? expiring.map(({ wo, risk, site }) => {
              const hot = risk.level !== 'watch';
              return (
                <div key={wo.wo_id} className="flex items-center justify-between gap-2 text-[13px] rounded-lg px-2.5 py-2" style={{ background: hot ? C.redBg : C.panel2 }}>
                  <span className="truncate"><WoLink wo={wo} onSelect={open} className="text-[13px]" /> <span style={{ color: C.muted }}>· {site} · {risk.fromCbre ? "CBRE's date" : `${risk.days} d past target`}</span></span>
                  <span className="whitespace-nowrap font-semibold" style={{ color: hot ? C.redText : C.text }}>
                    {risk.daysToClose <= 0 ? `past cut-off ${-risk.daysToClose} d` : `closes ${dateKeyET(risk.closeDate)?.slice(5)}`}
                  </span>
                </div>
              );
            }) : <Empty>Nothing is close to CBRE's cut-off.</Empty>}
            <div className="flex items-center justify-between text-[13px] rounded-lg px-2.5 py-2" style={{ background: C.panel2 }}>
              <span><strong>Finished, not reported</strong> · {columns.done.length} work order{columns.done.length === 1 ? '' : 's'}</span>
              <button type="button" onClick={() => goView('pipeline', { col: 'done' })} className="hover:underline" style={{ color: '#9ec5ff' }}>Pipeline</button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
