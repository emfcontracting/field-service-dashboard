// activeStatuses.js — the ONE list of work-order statuses a technician still
// works on. Used by the live list, the offline cache and the download; keeping
// three hand-written copies in sync is how flagged WOs vanished offline.
export const ACTIVE_STATUSES = [
  'assigned', 'in_progress', 'pending', 'needs_return', 'return_trip',
  'tech_review', 'missing_data', 'update_required',
];
