// lib/costCenter.js
// Cost-center detection from the CBRE work order description prefix.
//
// Dispatch descriptions always start with the numeric cost-center code
// followed by the client token, e.g.:
//   "144017 - UPS - Conveyor/Sorting Equipment - Emergency Breakdown ..."
//   "141303 - CBRE - Electrical - Emergency ..."
//
// The token right after the code tells us who the work is billed for.
// The regex is anchored to the start of the string on purpose: a stray
// "CBRE" later in the free-text description must NOT match.
//
// Used by:
//   - app/dashboard/components/WorkOrdersTable.js  (green row tint)
//   - app/mobile/components/WorkOrdersList.js      (green card tint)
//   - app/mobile/components/CompletedWorkOrders.js (green card tint)
export const isCbreDescription = (description) =>
  /^\s*\d+\s*-\s*CBRE\b/i.test(description || '');
