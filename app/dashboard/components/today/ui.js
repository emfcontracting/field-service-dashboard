// app/dashboard/components/today/ui.js
// Small shared pieces of the Today theme — the look of the design canvas
// (ground #0b0d12, panel #141822, border #232a38, amber for CBRE, red for the
// field, green for money that is ours) kept in one place.
'use client';

export const C = {
  ground: '#0b0d12', panel: '#141822', panel2: '#0f121a', border: '#232a38', border2: '#2a3243',
  text: '#e6e8ef', muted: '#9aa3b5', dim: '#6b7385', accent: '#3b82f6',
  amber: '#fbbf24', amberBg: '#f59e0b', amberBorder: '#3a2f12', green: '#34d399', greenBg: '#123524', greenText: '#86efac',
  red: '#f87171', redBorder: '#4a2020', redBg: '#2a1515', redText: '#fca5a5', blue: '#60a5fa', grey: '#9aa3b5',
};

export const TONE = {
  red:   { dot: C.red,   text: C.red,   border: C.redBorder },
  amber: { dot: C.amber, text: C.amber, border: C.amberBorder },
  green: { dot: C.green, text: C.green, border: C.border },
  blue:  { dot: C.blue,  text: C.muted, border: C.border },
  grey:  { dot: C.grey,  text: C.muted, border: C.border },
};

export function Panel({ children, className = '', style = {}, as: Tag = 'section', ...rest }) {
  return (
    <Tag className={`rounded-xl ${className}`} style={{ background: C.panel, border: `1px solid ${C.border}`, ...style }} {...rest}>
      {children}
    </Tag>
  );
}

export function Eyebrow({ children, className = '' }) {
  return <div className={`text-[11px] font-semibold uppercase tracking-[.06em] ${className}`} style={{ color: C.muted }}>{children}</div>;
}

export function Btn({ children, onClick, tone = 'primary', className = '', type = 'button', disabled, title }) {
  const styles = {
    primary: { background: C.accent, color: '#fff', border: '0' },
    amber:   { background: C.amberBg, color: '#111', border: '0' },
    ghost:   { background: C.panel, color: C.text, border: `1px solid ${C.border2}` },
    quiet:   { background: 'transparent', color: C.muted, border: `1px solid ${C.border}` },
  }[tone];
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title}
      className={`rounded-[10px] px-3.5 py-2 text-[13px] font-semibold min-h-[40px] whitespace-nowrap transition disabled:opacity-50 ${className}`}
      style={styles}>
      {children}
    </button>
  );
}

export function Count({ n, tone = 'grey' }) {
  const bg = tone === 'amber' ? C.amberBg : tone === 'red' ? C.red : tone === 'green' ? C.greenBg : '#1b2232';
  const fg = tone === 'amber' || tone === 'red' ? '#111' : tone === 'green' ? C.greenText : C.text;
  return <span className="inline-block min-w-[32px] text-center rounded-lg px-2 py-1 text-[13px] font-semibold" style={{ background: bg, color: fg }}>{n}</span>;
}

// A work order number that opens the detail modal.
export function WoLink({ wo, onSelect, children, className = '' }) {
  const canOpen = !!(wo && wo.wo_id && onSelect);
  return (
    <button type="button" disabled={!canOpen} onClick={() => canOpen && onSelect(wo)}
      className={`font-semibold text-left disabled:cursor-default ${canOpen ? 'hover:underline' : ''} ${className}`}
      style={{ color: C.text }}>
      {children || wo?.wo_number || '—'}
    </button>
  );
}

export function Empty({ children }) {
  return <div className="text-[13px] py-2" style={{ color: C.dim }}>{children}</div>;
}

export function PriorityTag({ code }) {
  if (!code) return null;
  const tone = ['P1', 'P2'].includes(code) ? { bg: C.redBg, fg: C.redText } : code === 'P3' ? { bg: C.amberBorder, fg: C.amber } : { bg: '#1b2232', fg: C.muted };
  return <span className="rounded-md px-1.5 py-[1px] text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{code}</span>;
}

// Open a work order in the detail modal. Rows that came in through a join
// (an invoice's work order, a dispute row) carry only a few columns, so the
// full row is fetched first; rows from the open list are passed straight on.
export async function openWorkOrder(supabase, wo, onSelect) {
  if (!wo || !onSelect) return;
  if (wo.date_entered !== undefined && wo.comments !== undefined) { onSelect(wo); return; }
  if (!supabase || !wo.wo_id) { onSelect(wo); return; }
  try {
    const { data } = await supabase.from('work_orders')
      .select('*, lead_tech:users!lead_tech_id(first_name, last_name, email)')
      .eq('wo_id', wo.wo_id).maybeSingle();
    onSelect(data || wo);
  } catch { onSelect(wo); }
}

export const todayHeading = (d = new Date()) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' }).format(d);

export const timeET = (v) => v
  ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(v))
  : '';
