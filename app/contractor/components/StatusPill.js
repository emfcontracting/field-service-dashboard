'use client';
// One plain-language status for a subcontractor invoice, combining the sub's
// own status with EMF's answer:
//   Draft — not sent · Sent to EMF Nov 20 · Accepted by EMF · Rejected by EMF
//   · Paid Nov 24 (+ "EMF paid" when EMF recorded payment and the sub hasn't)
import { fmtDateShort } from '@/lib/dates';
import { invoiceRecipient } from '@/lib/invoiceRecipient';
import { translate } from '@/lib/contractorI18n';
import { useLang } from './LangProvider';

const TONES = {
  gray:   { bg: 'rgba(107,114,128,0.2)', fg: '#9ca3af' },
  yellow: { bg: 'rgba(234,179,8,0.2)',   fg: '#facc15' },
  blue:   { bg: 'rgba(59,130,246,0.2)',  fg: '#60a5fa' },
  red:    { bg: 'rgba(239,68,68,0.2)',   fg: '#f87171' },
  green:  { bg: 'rgba(34,197,94,0.2)',   fg: '#4ade80' },
};

/** tr = translate function (defaults to English) */
export function invoiceStatusInfo(invoice, tr = (s, v) => translate('en', s, v)) {
  if (!invoice) return { label: '', tone: 'gray', hint: '' };
  const to = invoiceRecipient(invoice);
  const toShort = to.isEmf ? 'EMF' : to.name;
  if (invoice.status === 'paid') {
    return {
      label: invoice.paid_at ? tr('Paid {date}', { date: fmtDateShort(invoice.paid_at, '') }) : tr('Paid'),
      tone: 'green', hint: tr('You marked this invoice as paid.'),
    };
  }
  if (invoice.emf_review_status === 'rejected') {
    return { label: tr('Rejected by EMF'), tone: 'red', hint: invoice.emf_review_note || tr('EMF rejected this invoice — correct and send a new one.') };
  }
  if (invoice.status === 'sent' && invoice.emf_review_status === 'accepted') {
    return { label: tr('Accepted by EMF'), tone: 'blue', hint: tr('EMF approved it — payment is planned.') };
  }
  if (invoice.status === 'sent') {
    return {
      label: invoice.sent_at ? tr('Sent to {to} {date}', { to: toShort, date: fmtDateShort(invoice.sent_at, '') }) : tr('Sent to {to}', { to: toShort }),
      tone: 'yellow', hint: tr('Waiting for payment from {name}.', { name: to.name }),
    };
  }
  return { label: tr('Draft — not sent'), tone: 'gray', hint: tr('Check it and press Send.') };
}

export default function StatusPill({ invoice, withHint = false }) {
  const { t } = useLang();
  const s = invoiceStatusInfo(invoice, t);
  const tone = TONES[s.tone];
  const emfPaidOnly = invoice?.emf_paid_at && invoice?.status !== 'paid';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }} title={s.hint}>
      <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '9999px', backgroundColor: tone.bg, color: tone.fg, fontWeight: 600, whiteSpace: 'nowrap' }}>
        {s.label}
      </span>
      {emfPaidOnly && (
        <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '9999px', backgroundColor: TONES.green.bg, color: TONES.green.fg, fontWeight: 600 }}
          title={t('EMF recorded that it paid this invoice. Mark it paid once the money is in.')}>
          {t('EMF paid')}
        </span>
      )}
      {withHint && <span style={{ fontSize: '12px', color: '#9ca3af' }}>{s.hint}</span>}
    </span>
  );
}
