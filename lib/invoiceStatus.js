// lib/invoiceStatus.js
// ─────────────────────────────────────────────────────────────────────────────
// How an invoice status is shown. Lives here rather than inside the Invoicing
// page so the legend can render the same pills without importing the page that
// imports the legend.
//
// 'synced' and 'accepted' are the same thing to the office — CBRE has the
// invoice and it is with accounts payable — so they share a label.
// ─────────────────────────────────────────────────────────────────────────────

export const STATUS_CONFIG = {
  draft:    { label: 'Draft',                      color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  approved: { label: 'Uploaded to CBRE',           color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  accepted: { label: 'Accepted – Submitted to AP', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  synced:   { label: 'Accepted – Submitted to AP', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  paid:     { label: 'Paid',                       color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  rejected: { label: 'Rejected',                   color: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

export const statusConfigFor = (status) =>
  STATUS_CONFIG[status] || { label: String(status || '').toUpperCase(), color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' };
