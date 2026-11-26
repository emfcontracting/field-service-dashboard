// lib/invoiceItemKind.js
// -----------------------------------------------------------------------------
// Overtime vs regular for subcontractor invoice 'hours' lines. Lines are
// written as "Regular Hours - <WO> - <building>" / "OT Hours - <WO> - <building>"
// (app/api/contractor/invoices). The old checks used includes('ot') or
// includes(' ot'): the first matched "Depot", "Scott"…, the second never
// matched "OT Hours" at the start — overtime was miscounted in the reports.
// -----------------------------------------------------------------------------
export function isOvertimeItem(item) {
  const d = String(item?.description || '').trim().toLowerCase();
  return /^ot\b/.test(d) || /\bovertime\b/.test(d);
}
