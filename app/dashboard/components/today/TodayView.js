// app/dashboard/components/today/TodayView.js
// ─────────────────────────────────────────────────────────────────────────────
// The home screen of the Today theme — design canvas board "D · Today".
//
// Top: the money strip (four numbers) and a one-row pipeline, each stage a
// link into the Pipeline board. Middle: the action list — what has to happen
// today, grouped by who must act (you, CBRE, a technician), sorted by severity
// and size, one button per line, a chevron to see the work orders behind it.
// Right: who is in the field right now, what expires, what got done today.
//
// Nothing here is a view of the data; every line is a thing someone has to do.
// Empty is the goal.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { C, TONE, Panel, Eyebrow, Btn, WoLink, Empty, PriorityTag, todayHeading, timeET, openWorkOrder } from './ui';
import { money, fmtAge, STAGES, siteOf } from './todayModel';
import { extractPriorityCode } from '@/lib/priorityCodes';
import { dateKeyET } from '@/lib/dates';

const GROUPS = {
  you:  { title: 'Your move',            hint: 'nothing here waits on anyone else', color: C.text },
  cbre: { title: "CBRE's move",          hint: 'all you can do is chase — but you can do that', color: C.amber },
  tech: { title: "A technician's move",  hint: 'nothing can be invoiced without this', color: C.red },
};

// Amber button for CBRE's side, blue for what you can finish right now, grey
// for a look-only action and for reminders to the field.
function btnTone(item) {
  if (item.tone === 'amber') return 'amber';
  if (item.action?.kind === 'expand') return 'ghost';
  if (item.tone === 'grey' || item.group === 'tech') return 'ghost';
  return 'primary';
}

function ActionRow({ item, goView, onSelectWorkOrder }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const tone = TONE[item.tone] || TONE.grey;
  const hasList = !!(item.wos && item.wos.length);
  const act = () => {
    const a = item.action || {};
    if (a.kind === 'expand') { setOpen((o) => !o); return; }
    if (a.href) { router.push(a.href); return; }
    if (a.view) goView(a.view, a.params || {});
  };
  return (
    <article className="rounded-xl" style={{ background: C.panel, border: `1px solid ${tone.border}` }}>
      <div className="flex items-center gap-3.5 px-3.5 py-3 flex-wrap">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: tone.dot }} aria-hidden="true" />
        <button type="button" onClick={() => hasList && setOpen((o) => !o)} disabled={!hasList}
          className="flex-1 min-w-[240px] text-left disabled:cursor-default" aria-expanded={hasList ? open : undefined}>
          <div className="font-semibold text-[14px]" style={{ color: C.text }}>{item.title}</div>
          <div className="text-[12px] mt-0.5 truncate" style={{ color: C.muted }}>{item.sub}</div>
        </button>
        <span className="font-bold min-w-[80px] text-right text-[14px]" style={{ color: tone.text }}>{item.value}</span>
        <Btn tone={btnTone(item)} onClick={act}>
          {item.action?.kind === 'expand' ? (open ? 'Hide' : 'Show') : item.action?.label || 'Open'}
        </Btn>
        {hasList && (
          <button type="button" onClick={() => setOpen((o) => !o)} className="text-[12px]" style={{ color: C.muted }} aria-label={open ? 'Hide work orders' : 'Show work orders'}>
            {open ? 'hide' : `${item.wos.length} WO${item.wos.length === 1 ? '' : 's'}`}
          </button>
        )}
      </div>
      {open && hasList && (
        <ul className="px-3.5 pb-3 pt-1 grid gap-1" style={{ borderTop: `1px solid ${C.border}` }}>
          {item.wos.slice(0, 40).map(({ wo, note }, i) => (
            <li key={wo?.wo_id || i} className="flex items-center gap-3 text-[13px] py-1">
              <WoLink wo={wo} onSelect={onSelectWorkOrder} />
              <PriorityTag code={extractPriorityCode(wo?.priority)} />
              <span className="truncate" style={{ color: C.muted }}>{wo?.building ? siteOf(wo) : ''}</span>
              <span className="ml-auto text-right truncate" style={{ color: C.muted }}>{note}</span>
            </li>
          ))}
          {item.wos.length > 40 && <li className="text-[12px]" style={{ color: C.dim }}>and {item.wos.length - 40} more</li>}
        </ul>
      )}
    </article>
  );
}

function MoneyTile({ label, value, sub, tone, onClick }) {
  const border = tone === 'amber' ? C.amberBorder : tone === 'red' ? C.redBorder : C.border;
  const color = tone === 'amber' ? C.amber : tone === 'red' ? C.red : C.text;
  return (
    <button type="button" onClick={onClick} className="text-left rounded-xl px-4 py-3.5 transition hover:brightness-110" style={{ background: C.panel, border: `1px solid ${border}` }}>
      <Eyebrow>{label}</Eyebrow>
      <div className="text-[26px] font-bold mt-1 leading-none" style={{ color }}>{value}</div>
      <div className="text-[12px] mt-1.5" style={{ color: C.muted }}>{sub}</div>
    </button>
  );
}

export default function TodayView({ data, currentUser, loading, supabase, onSelectWorkOrder: onSelectRaw, onNewWorkOrder, goView }) {
  const router = useRouter();
  const onSelectWorkOrder = (wo) => openWorkOrder(supabase, wo, onSelectRaw);
  const { money: m, strip, stuck, groups, itemCount, crew, notClockedIn, expiring, doneToday, error } = data;
  const firstName = currentUser?.first_name || '';

  return (
    <div className="flex flex-col gap-5" style={{ color: C.text }}>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[24px] font-bold m-0">{todayHeading()}</h1>
          <p className="m-0 mt-1 text-[14px]" style={{ color: C.muted }}>
            {loading || data.loading
              ? 'Counting…'
              : itemCount
                ? `${itemCount} thing${itemCount === 1 ? '' : 's'} that should happen today${firstName ? `, ${firstName}` : ''} — sorted by money and age. Empty is the goal.`
                : `Nothing is waiting on anyone${firstName ? `, ${firstName}` : ''}. Empty is the goal — and it is empty.`}
          </p>
        </div>
        <div className="flex gap-2">
          <Btn tone="ghost" onClick={() => data.refresh?.()}>Refresh</Btn>
          <Btn onClick={onNewWorkOrder}>+ Work Order</Btn>
        </div>
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-[13px]" style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, color: C.redText }}>
          Part of this screen could not be loaded ({error}). The numbers below may be incomplete.
        </div>
      )}

      {/* Money strip */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <MoneyTile label="At CBRE, no answer" tone="amber" value={money(m.waitingAtCbre.value)}
          sub={`${m.waitingAtCbre.count} NTE request${m.waitingAtCbre.count === 1 ? '' : 's'} waiting · ${m.waitingAtCbre.old} older than 14 days (${money(m.waitingAtCbre.oldValue)})`}
          onClick={() => goView('ups-escalation')} />
        <MoneyTile label="Done, not invoiced" value={money(m.doneNotInvoiced.value)}
          sub={`${m.doneNotInvoiced.count} draft${m.doneNotInvoiced.count === 1 ? '' : 's'} ready · ${m.doneNotInvoiced.completions} completion form${m.doneNotInvoiced.completions === 1 ? '' : 's'} and ${m.doneNotInvoiced.doneCount} finished job${m.doneNotInvoiced.doneCount === 1 ? '' : 's'} ahead of them`}
          onClick={() => router.push('/invoices')} />
        <MoneyTile label="Invoiced, unpaid" value={money(m.invoicedUnpaid.value)}
          sub={`${m.invoicedUnpaid.count} invoice${m.invoicedUnpaid.count === 1 ? '' : 's'} out · 75-day clock from CIR/CMP`}
          onClick={() => router.push('/invoices')} />
        <MoneyTile label="In the cancellation window" tone={m.closing.count ? 'red' : undefined} value={String(m.closing.count)}
          sub={m.closing.count ? `${m.closing.pastDue} past CBRE's cut-off · ${m.closing.watch} more aging` : `${m.closing.watch} aging, none flagged yet`}
          onClick={() => goView('workorders')} />
      </div>

      {/* One-row pipeline */}
      <Panel className="px-4 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <Eyebrow>Pipeline — where work is piling up</Eyebrow>
          <button type="button" onClick={() => goView('pipeline')} className="text-[12px] hover:underline" style={{ color: '#9ec5ff' }}>Open the board</button>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${STAGES.length}, minmax(0, 1fr))` }}>
          {strip.map((s) => {
            const isStuck = s.id === stuck && s.count > 0;
            return (
              <button key={s.id} type="button" onClick={() => goView('pipeline', { col: s.id })}
                className="rounded-[10px] px-2.5 py-2 text-left transition hover:brightness-110"
                style={{ background: isStuck ? C.amberBorder : '#0f121a', border: `1px solid ${isStuck ? '#5a4512' : C.border}` }}>
                <div className="text-[11px] truncate" style={{ color: C.muted }}>{s.label}</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[20px] font-bold leading-tight" style={{ color: isStuck ? C.amber : C.text }}>{s.count}</span>
                  {s.count > 0 && <span className="text-[11px] truncate" style={{ color: C.muted }}>oldest {fmtAge(s.oldest)}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </Panel>

      <div className="flex gap-6 flex-wrap items-start">
        {/* Action list */}
        <div className="flex-[3_1_560px] min-w-0 flex flex-col gap-5">
          {groups.map((g) => {
            const meta = GROUPS[g.id];
            return (
              <section key={g.id} aria-label={meta.title} className="flex flex-col gap-2">
                <header className="flex items-baseline gap-2.5">
                  <strong className="text-[15px]" style={{ color: meta.color }}>{meta.title}</strong>
                  <span className="text-[12px]" style={{ color: C.muted }}>{g.items.length ? meta.hint : 'nothing waiting'}</span>
                </header>
                {g.items.length
                  ? g.items.map((item) => <ActionRow key={item.id} item={item} goView={goView} onSelectWorkOrder={onSelectWorkOrder} />)
                  : <Empty>Clear.</Empty>}
              </section>
            );
          })}
        </div>

        {/* Right rail */}
        <aside className="flex-[1_1_280px] min-w-[260px] flex flex-col gap-4">
          <Panel className="p-4 flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <Eyebrow>In the field now</Eyebrow>
              <span className="text-[11px]" style={{ color: C.dim }}>{crew.length} clocked in</span>
            </div>
            {crew.length ? crew.map((c) => (
              <div key={c.userId} className="flex flex-col gap-0.5">
                <div className="flex justify-between text-[13px] gap-2"><strong className="truncate">{c.name}</strong><span style={{ color: C.green }}>clocked in {timeET(c.since)}</span></div>
                <div className="text-[12px] truncate" style={{ color: C.muted }}>
                  {c.wo ? <><WoLink wo={c.wo} onSelect={onSelectWorkOrder} className="text-[12px]" /> · {c.site}</> : 'work order not in the open list'}
                </div>
              </div>
            )) : <Empty>Nobody is clocked in.</Empty>}
            {notClockedIn.length > 0 && (
              <div className="text-[12px] pt-2" style={{ color: C.muted, borderTop: `1px solid ${C.border}` }}>
                Not clocked in, with open work: {notClockedIn.slice(0, 5).map((t) => `${t.name.split(' ')[0]} (${t.open})`).join(', ')}{notClockedIn.length > 5 ? ` and ${notClockedIn.length - 5} more` : ''}
              </div>
            )}
            <button type="button" onClick={() => goView('cockpit')} className="text-[12px] text-left hover:underline" style={{ color: '#9ec5ff' }}>Sites &amp; Crew</button>
          </Panel>

          <Panel className="p-4 flex flex-col gap-2">
            <Eyebrow>Expiring</Eyebrow>
            {expiring.length ? expiring.slice(0, 6).map(({ wo, risk, site }) => {
              const hot = risk.level !== 'watch';
              return (
                <div key={wo.wo_id} className="flex items-center justify-between gap-2 text-[13px] rounded-lg px-2.5 py-1.5" style={{ background: hot ? C.redBg : C.panel2 }}>
                  <span className="truncate"><WoLink wo={wo} onSelect={onSelectWorkOrder} className="text-[13px]" /> <span style={{ color: C.muted }}>· {site}</span></span>
                  <span className="whitespace-nowrap font-semibold" style={{ color: hot ? C.redText : C.text }}>
                    {risk.daysToClose <= 0 ? 'past cut-off' : `closes ${dateKeyET(risk.closeDate)?.slice(5)}`}
                  </span>
                </div>
              );
            }) : <Empty>Nothing is close to CBRE's cut-off.</Empty>}
            <button type="button" onClick={() => goView('calendar')} className="text-[12px] text-left hover:underline" style={{ color: '#9ec5ff' }}>Calendar</button>
          </Panel>

          <Panel className="p-4 flex flex-col gap-2">
            <Eyebrow>Done today</Eyebrow>
            {[
              [doneToday.completed, 'work order', 'completed'],
              [doneToday.invoicesCreated, 'invoice', 'created'],
              [doneToday.invoicesPaid, 'invoice', 'paid'],
              [doneToday.confirmed, 'CBRE confirmation', 'matched'],
              [doneToday.checkIns, 'technician', 'clocked in'],
            ].filter(([n]) => n > 0).map(([n, noun, verb]) => (
              <div key={noun + verb} className="flex gap-2.5 items-start text-[13px]">
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" className="flex-shrink-0 mt-0.5"><path d="M5 13l4 4L19 7"/></svg>
                <span>{n} {noun}{n === 1 ? '' : 's'} {verb}</span>
              </div>
            ))}
            {!Object.values(doneToday).some((n) => n > 0) && <Empty>Nothing yet today.</Empty>}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
