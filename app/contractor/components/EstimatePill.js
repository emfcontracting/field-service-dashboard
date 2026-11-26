'use client';
import { useLang } from './LangProvider';
import { dateKeyET } from '@/lib/dates';

const TONE = {
  draft: ['rgba(107,114,128,0.2)', '#9ca3af'], sent: ['rgba(234,179,8,0.2)', '#facc15'],
  accepted: ['rgba(59,130,246,0.2)', '#60a5fa'], declined: ['rgba(239,68,68,0.2)', '#f87171'],
  invoiced: ['rgba(34,197,94,0.2)', '#4ade80'], expired: ['rgba(107,114,128,0.2)', '#f87171'],
};
const LABEL = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', declined: 'Declined', invoiced: 'Invoiced', expired: 'Expired' };

export function estimateState(e) {
  if (e.status === 'sent' && e.valid_until && e.valid_until < dateKeyET()) return 'expired';
  return e.status;
}
export function EstimatePill({ estimate }) {
  const { t } = useLang();
  const s = estimateState(estimate);
  const [bg, fg] = TONE[s] || TONE.draft;
  return <span style={{ backgroundColor: bg, color: fg, fontSize: '11px', padding: '3px 8px', borderRadius: '9999px', fontWeight: 600 }}>{t(LABEL[s] || s)}</span>;
}
