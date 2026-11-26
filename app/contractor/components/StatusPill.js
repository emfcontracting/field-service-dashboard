'use client';
// One plain-language status for a subcontractor invoice, combining the sub's
// own status with EMF's answer:
//   Draft — not sent · Sent to EMF Nov 20 · Accepted by EMF · Rejected by EMF
//   · Paid Nov 24 (+ "EMF paid" when EMF recorded payment and the sub hasn't)
import { fmtDateShort } from '@/lib/dates';
import { invoiceRecipient } from '@/lib/invoiceRecipient';

const TONES = {
  gray:   { bg: 'rgba(107,114,128,0.2)', fg: '#9ca3af' },
  yellow: { bg: 'rgba(234,179,8,0.2)',   fg: '#facc15' },
  blue:   { bg: 'rgba(59,130,246,0.2)',  fg: '#60a5fa' },
  red:    { bg: 'rgba(239,68,68,0.2)',   fg: '#f87171' },
  green:  { bg: 'rgba(34,197,94,0.2)',   fg: '#4ade80' },
};

export function invoiceStatusInfo(invoice) {
  if (!invoice) return { label: '', tone: 'gray', hint: '' };
  const to = invoiceRecipient(invoice);
  const toShort = to.isEmf ? 'EMF' : to.name;
  if (invoice.status === 'paid') {
    return { label: `Paid${invoice.paid_at ? ' ' + fmtDateShort(invoice.paid_at, '') : ''}`, tone: 'green', hint: 'You marked this invoice as paid.' };
  }
  if (invoice.emf_review_status === 'rejected') {
    return { label: 'Rejected by EMF', tone: 'red', hint: invoice.emf_review_note || 'EMF rejected this invoice — correct and send a new one.' };
  }
  if (invoice.status === 'sent' && invoice.emf_review_status === 'accepted') {
    return { label: 'Accepted by EMF', tone: 'blue', hint: 'EMF approved it — payment is planned.' };
  }
  if (invoice.status === 'sent') {
    return { label: `Sent to ${toShort}${invoice.sent_at ? ' ' + fmtDateShort(invoice.sent_at, '') : ''}`, tone: 'yellow', hint: `Waiting for payment from ${to.name}.` };
  }
  return { label: 'Draft — not sent', tone: 'gray', hint: 'Check it and press Send.' };
}

export default function StatusPill({ invoice, withHint = false }) {
  const s = invoiceStatusInfo(invoice);
  const t = TONES[s.tone];
  const emfPaidOnly = invoice?.emf_paid_at && invoice?.status !== 'paid';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }} title={s.hint}>
      <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '9999px', backgroundColor: t.bg, color: t.fg, fontWeight: 600, whiteSpace: 'nowrap' }}>
        {s.label}
      </span>
      {emfPaidOnly && (
        <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '9999px', backgroundColor: TONES.green.bg, color: TONES.green.fg, fontWeight: 600 }}
          title="EMF recorded that it paid this invoice. Mark it paid once the money is in.">
          EMF paid
        </span>
      )}
      {withHint && <span style={{ fontSize: '12px', color: '#9ca3af' }}>{s.hint}</span>}
    </span>
  );
}
