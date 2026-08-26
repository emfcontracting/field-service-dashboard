// lib/woFieldPermissions.js
// ─────────────────────────────────────────────────────────────────────────────
// WHO MAY EDIT WHICH WORK-ORDER FIELD.
//
//   admin        → every field, always. Also overrides the locked / acknowledged
//                  / missing-data freeze, so a mistake can still be corrected
//                  after a work order has been billed.
//   office_staff → the day-to-day fields only (status, comments, tech, priority,
//                  and the cost figures). The core identity of the work order —
//                  WO number, building, requestor, dispatch date, job description
//                  — is read-only for them, and the usual freeze still applies.
//
// NOTE: this is a UI guardrail, not a security boundary. The dashboard talks to
// Supabase with the anon key, so a determined person could still write directly.
// Enforcing this properly needs RLS policies keyed to the user's role.
// ─────────────────────────────────────────────────────────────────────────────

// Only an admin may change these.
export const ADMIN_ONLY_FIELDS = [
  'comments',                 // the system/activity log — admin may correct it
  'wo_number',
  'building',
  'requestor',
  'date_entered',
  'work_order_description',
];

export function isAdminUser(currentUser) {
  return currentUser?.role === 'admin';
}

// The pre-existing freeze: a locked / acknowledged / missing-data work order is
// not casually edited. Admins are exempt.
export function isFrozen(wo) {
  if (!wo) return false;
  return !!(wo.is_locked || wo.acknowledged || wo.status === 'missing_data');
}

// Can this user edit this field on this work order right now?
export function canEditField(field, currentUser, wo) {
  if (isAdminUser(currentUser)) return true;          // admin overrides everything
  if (ADMIN_ONLY_FIELDS.includes(field)) return false;
  return !isFrozen(wo);
}

// Reason to show when an edit is blocked (tooltip / title attribute).
export function whyBlocked(field, currentUser, wo) {
  if (canEditField(field, currentUser, wo)) return '';
  if (field === 'comments') return 'Admin only — system activity log';
  if (ADMIN_ONLY_FIELDS.includes(field)) return 'Admin only';
  if (wo?.is_locked) return 'Locked — invoiced';
  if (wo?.acknowledged) return 'Acknowledged — locked for invoicing';
  if (wo?.status === 'missing_data') return 'Flagged as missing data';
  return 'Not editable';
}
