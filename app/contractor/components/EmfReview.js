'use client';
// EMF's side of an invoice, shown to the subcontractor. Separate from the
// sub's own status (draft / sent / paid), which only he sets.
//   emf_review_status: accepted | rejected (+ emf_review_note)
//   emf_paid_at:       EMF recorded its payment
import { useLang } from './LangProvider';

function day(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' });
}

export function emfBadges(invoice, t = (s) => s) {
  const out = [];
  if (invoice?.emf_review_status === 'accepted') out.push({ key: 'acc', text: t('EMF ACCEPTED'), bg: 'rgba(59,130,246,0.2)', fg: '#60a5fa' });
  if (invoice?.emf_review_status === 'rejected') out.push({ key: 'rej', text: t('EMF REJECTED'), bg: 'rgba(239,68,68,0.2)', fg: '#f87171' });
  if (invoice?.emf_paid_at) out.push({ key: 'paid', text: t('EMF PAID'), bg: 'rgba(34,197,94,0.2)', fg: '#4ade80' });
  return out;
}

export function EmfBadges({ invoice }) {
  const { t } = useLang();
  return emfBadges(invoice, t).map((b) => (
    <span key={b.key} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '9999px', backgroundColor: b.bg, color: b.fg, fontWeight: 600, marginLeft: '6px' }}>
      {b.text}
    </span>
  ));
}

export function EmfReviewPanel({ invoice }) {
  const { t } = useLang();
  if (!invoice?.emf_review_status && !invoice?.emf_paid_at) return null;
  const rejected = invoice.emf_review_status === 'rejected';
  return (
    <div className="no-print" style={{
      backgroundColor: rejected ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
      border: `1px solid ${rejected ? 'rgba(239,68,68,0.4)' : 'rgba(59,130,246,0.4)'}`,
      borderRadius: '12px', padding: '16px', marginBottom: '24px',
    }}>
      <h3 style={{ fontWeight: 'bold', color: rejected ? '#f87171' : '#60a5fa', marginBottom: '8px' }}>
        {rejected ? t('❌ EMF rejected this invoice') : invoice.emf_review_status === 'accepted' ? t('✅ EMF accepted this invoice') : '🏢 EMF'}
      </h3>
      {invoice.emf_review_status && (
        <p style={{ color: '#d1d5db', fontSize: '14px', margin: '0 0 6px' }}>
          {day(invoice.emf_reviewed_at)}{invoice.emf_review_note ? ` — ${invoice.emf_review_note}` : ''}
        </p>
      )}
      {invoice.emf_paid_at && (
        <p style={{ color: '#d1d5db', fontSize: '14px', margin: '0 0 6px' }}>{t('EMF recorded payment on {date}.', { date: day(invoice.emf_paid_at) })}</p>
      )}
      {rejected && (
        <p style={{ color: '#d1d5db', fontSize: '14px', margin: 0 }}>
          {t('Delete this invoice and create a corrected one for the same period.')}
        </p>
      )}
    </div>
  );
}
