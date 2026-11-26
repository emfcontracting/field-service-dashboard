// lib/contractorDocs.js
// Document types and their reminder rules for the subcontractor portal.
export const DOC_TYPES = [
  { key: 'w9',       label: 'W-9',                         needsExpiry: false, required: true },
  { key: 'coi',      label: 'Insurance certificate (COI)', needsExpiry: true,  required: true },
  { key: 'license',  label: 'License',                     needsExpiry: true,  required: false },
  { key: 'contract', label: 'Contract / agreement',        needsExpiry: false, required: false },
  { key: 'other',    label: 'Other',                       needsExpiry: false, required: false },
];
export const docLabel = (k) => DOC_TYPES.find((t) => t.key === k)?.label || k;

/**
 * Reminders from a sub's documents (today = 'YYYY-MM-DD', Eastern).
 * → [{ key, tone: 'red'|'yellow', text }]
 */
export function docReminders(docs, today, warnDays = 30) {
  const out = [];
  const list = docs || [];
  for (const t of DOC_TYPES.filter((d) => d.required)) {
    const mine = list.filter((d) => d.doc_type === t.key);
    if (!mine.length) { out.push({ key: `missing-${t.key}`, tone: 'yellow', text: `${t.label} missing — upload it under Profile` }); continue; }
    if (!t.needsExpiry) continue;
    const latest = mine.filter((d) => d.expires_on).sort((a, b) => (a.expires_on < b.expires_on ? 1 : -1))[0];
    if (!latest) { out.push({ key: `noexp-${t.key}`, tone: 'yellow', text: `${t.label}: no expiry date entered` }); continue; }
    const days = Math.round((Date.parse(latest.expires_on) - Date.parse(today)) / 86400000);
    if (days < 0) out.push({ key: `exp-${t.key}`, tone: 'red', text: `${t.label} expired on ${latest.expires_on}` });
    else if (days <= warnDays) out.push({ key: `soon-${t.key}`, tone: 'yellow', text: `${t.label} expires in ${days} day${days === 1 ? '' : 's'} (${latest.expires_on})` });
  }
  return out;
}
