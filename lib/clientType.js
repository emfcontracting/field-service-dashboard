// lib/clientType.js
// ─────────────────────────────────────────────────────────────────────────────
// CBRE vs UPS client-type differentiation (single source of truth).
//
// EMF services two clients through the FSM system:
//   - CBRE  (cost center 144117) — green  #003F2D
//   - UPS   (cost center 144017) — brown  #644117, gold accent #FFB500
//
// client_type lives on work_orders.client_type ('CBRE' | 'UPS' | NULL).
// Imported WOs get it auto-derived from the description prefix
// ("<code> - CBRE - ..." / "<code> - UPS - ..."); manually created WOs
// require an explicit selection. NULL = unknown → NTE creation is blocked
// until an admin sets it.
//
// ADMIN HOURS POLICY (the one calculation difference between the clients):
//   - UPS:  2 admin hours embedded in accrued labor (legacy behavior, unchanged)
//   - CBRE: 0 admin hours by default; admins can toggle them ON per WO
//           via work_orders.include_admin_hours (TRUE = force on, FALSE =
//           force off, NULL = client default).
//   - Unknown client type: keeps legacy behavior (2 hrs) so nothing shifts
//           under existing tickets until they are classified.
// ─────────────────────────────────────────────────────────────────────────────

export const CLIENT_TYPES = ['CBRE', 'UPS'];

// Brand styling for markers, banners and the print/PDF header.
export const CLIENT_STYLES = {
  CBRE: {
    label: 'CBRE',
    bgHex: '#003F2D',      // CBRE green
    textHex: '#FFFFFF',
    accentHex: '#7FBFA8'   // light green for borders/dividers on print
  },
  UPS: {
    label: 'UPS',
    bgHex: '#644117',      // UPS brown
    textHex: '#FFB500',    // UPS gold
    accentHex: '#FFB500'
  }
};

// Derive client type from the CBRE dispatch description prefix.
// Anchored to the start so "CBRE" mentioned later in free text never matches.
export function deriveClientTypeFromDescription(description) {
  const d = description || '';
  if (/^\s*\d+\s*-\s*CBRE\b/i.test(d)) return 'CBRE';
  if (/^\s*\d+\s*-\s*UPS\b/i.test(d)) return 'UPS';
  return null;
}

// Resolve the effective client type for a work order:
// explicit column first, description prefix as fallback for legacy rows.
export function getClientType(workOrder) {
  if (!workOrder) return null;
  if (workOrder.client_type === 'CBRE' || workOrder.client_type === 'UPS') {
    return workOrder.client_type;
  }
  return deriveClientTypeFromDescription(workOrder.work_order_description);
}

// Effective admin hours for a work order (see policy block above).
// `adminHoursConstant` should be RATES.ADMIN_HOURS (2) from quoteService.
export function getEffectiveAdminHours(workOrder, adminHoursConstant = 2) {
  const override = workOrder ? workOrder.include_admin_hours : null;
  if (override === true) return adminHoursConstant;
  if (override === false) return 0;
  const ct = getClientType(workOrder);
  if (ct === 'CBRE') return 0;      // CBRE default: no admin hours
  return adminHoursConstant;        // UPS + unclassified: legacy behavior
}

// Convenience for UI copy ("How will CBRE be billed?" etc.)
export function getClientLabel(workOrder, fallback = 'Client') {
  return getClientType(workOrder) || fallback;
}
