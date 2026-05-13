// lib/activityLog.js
// ─────────────────────────────────────────────────────────────────────────────
// Builds a chronological activity log for one (or many) work orders by merging
// timestamps from multiple tables and the embedded check-in/out events that
// live inside `work_orders.comments`. The DB doesn't have a dedicated audit
// table — this file reconstructs the timeline from what each subsystem already
// records (status timestamps, photo verification dates, NTE creation dates,
// flags, daily hours entries, etc).
//
// Event categories (the UI's filter toggles align with these):
//   - lifecycle   : WO created / assigned / completed / acknowledged / locked
//   - checkin     : Tech check-in & check-out (parsed from comments)
//   - hours       : Daily hours logged
//   - status      : CBRE status changes (last value + timestamp)
//   - submission  : Photos / Receipts / PMI write-ups received
//   - nte         : NTE increase requests created / approved
//   - flag        : Review flags raised / resolved
//   - signature   : Customer signature captured
// ─────────────────────────────────────────────────────────────────────────────

export const EVENT_CATEGORIES = [
  { id: 'lifecycle',  label: '📥 Lifecycle (created / assigned / completed)' },
  { id: 'checkin',    label: '✓ Check-Ins & Check-Outs' },
  { id: 'hours',      label: '📅 Hours Logged' },
  { id: 'status',     label: '🏷️ CBRE Status Changes' },
  { id: 'submission', label: '📤 Submissions (photos / receipts / write-ups)' },
  { id: 'nte',        label: '💰 NTE Increase Requests' },
  { id: 'flag',       label: '🚩 Review Flags' },
  { id: 'signature',  label: '✍️ Customer Signature' },
];

// Parse check-in/out events embedded in `work_orders.comments`. Same pattern
// used by CBREDataEntryView — supports EN + ES, multi-event per line.
const CHECKIN_REGEX = /\[([^\]]+)\]\s+([^[\n]+?)\s+-\s+(✓ CHECKED IN|⏸ CHECKED OUT|✓ ENTRADA|⏸ SALIDA)/g;

function parseCheckIns(comments) {
  if (!comments) return [];
  const events = [];
  let m;
  while ((m = CHECKIN_REGEX.exec(comments)) !== null) {
    const [, timestamp, name, label] = m;
    const ts = new Date(timestamp);
    if (isNaN(ts.getTime())) continue;
    const isCheckIn = label.includes('CHECKED IN') || label.includes('ENTRADA');
    events.push({
      ts,
      category: 'checkin',
      event: isCheckIn ? 'Check-In' : 'Check-Out',
      actor: name.trim(),
      detail: '',
    });
  }
  return events;
}

const fmt = (n) => `$${(parseFloat(n) || 0).toFixed(2)}`;
const userName = (u) => u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : '';
const safeDate = (d) => { const x = d ? new Date(d) : null; return (x && !isNaN(x.getTime())) ? x : null; };

// ─────────────────────────────────────────────────────────────────────────────
// Pull all activity data for ONE wo_id from Supabase and return as a sorted
// list of timeline events. Returns oldest first.
// ─────────────────────────────────────────────────────────────────────────────
export async function buildActivityLog(supabase, woId) {
  // Pull the WO (with everything we need), plus the related rows in parallel
  const [woRes, hoursRes, quotesRes, flagsRes] = await Promise.all([
    supabase
      .from('work_orders')
      .select(`
        wo_id, wo_number, building, status,
        date_entered, date_completed, acknowledged, acknowledged_at,
        is_locked, locked_at,
        assigned_to_field, assigned_to_field_at,
        cbre_status, cbre_status_updated_at,
        photos_received, photos_verified_at, photos_email_subject,
        receipts_received, receipts_verified_at, receipts_email_subject,
        writeups_received, writeups_verified_at, writeups_email_subject,
        customer_signature, customer_name, signature_date,
        comments,
        lead_tech:users!lead_tech_id(first_name, last_name),
        locked_by_user:users!locked_by(first_name, last_name)
      `)
      .eq('wo_id', woId)
      .single(),
    supabase
      .from('daily_hours_log')
      .select(`
        log_id, work_date, created_at,
        hours_regular, hours_overtime, miles, tech_material_cost, notes,
        user:users!daily_hours_log_user_id_fkey(first_name, last_name)
      `)
      .eq('wo_id', woId)
      .order('created_at', { ascending: true }),
    supabase
      .from('work_order_quotes')
      .select(`
        quote_id, created_at, approved_at, nte_status, request_type,
        new_nte_amount, original_nte, is_verbal_nte, verbal_approved_by, approved_by,
        creator:users!work_order_quotes_created_by_fkey(first_name, last_name)
      `)
      .eq('wo_id', woId)
      .order('created_at', { ascending: true }),
    supabase
      .from('work_order_flags')
      .select(`
        flag_id, flagged_at, resolved_at, status, priority, comment, resolution_note,
        flagger:users!work_order_flags_flagged_by_fkey(first_name, last_name),
        resolver:users!work_order_flags_resolved_by_fkey(first_name, last_name)
      `)
      .eq('wo_id', woId)
      .order('flagged_at', { ascending: true }),
  ]);

  if (woRes.error) throw woRes.error;
  const wo = woRes.data;
  const dailyHours = hoursRes.data || [];
  const quotes = quotesRes.data || [];
  const flags = flagsRes.data || [];

  const events = [];

  // ── Lifecycle ─────────────────────────────────────────────────────────
  if (safeDate(wo.date_entered)) events.push({
    ts: new Date(wo.date_entered), category: 'lifecycle',
    event: 'WO Created', actor: 'System / CBRE Import',
    detail: `Imported into dashboard${wo.building ? ` — ${wo.building}` : ''}`,
  });

  if (safeDate(wo.assigned_to_field_at)) events.push({
    ts: new Date(wo.assigned_to_field_at), category: 'lifecycle',
    event: 'Assigned to Field', actor: 'Office',
    detail: wo.lead_tech ? `Lead: ${userName(wo.lead_tech)}` : '',
  });

  if (safeDate(wo.date_completed)) events.push({
    ts: new Date(wo.date_completed), category: 'lifecycle',
    event: 'Marked Completed', actor: wo.lead_tech ? userName(wo.lead_tech) : '—',
    detail: '',
  });

  if (safeDate(wo.acknowledged_at)) events.push({
    ts: new Date(wo.acknowledged_at), category: 'lifecycle',
    event: 'Acknowledged', actor: 'Office',
    detail: 'Ready for invoicing',
  });

  if (safeDate(wo.locked_at)) events.push({
    ts: new Date(wo.locked_at), category: 'lifecycle',
    event: 'Locked / Invoice Generated', actor: userName(wo.locked_by_user) || 'Office',
    detail: '',
  });

  // ── Check-Ins / Check-Outs (parsed from comments) ─────────────────────
  events.push(...parseCheckIns(wo.comments));

  // ── Daily Hours Logged ───────────────────────────────────────────────
  dailyHours.forEach(h => {
    const ts = safeDate(h.created_at) || safeDate(h.work_date);
    if (!ts) return;
    const rt = parseFloat(h.hours_regular) || 0;
    const ot = parseFloat(h.hours_overtime) || 0;
    const mi = parseFloat(h.miles) || 0;
    const tm = parseFloat(h.tech_material_cost) || 0;
    const parts = [];
    if (rt) parts.push(`${rt} RT`);
    if (ot) parts.push(`${ot} OT`);
    if (mi) parts.push(`${mi} mi`);
    if (tm) parts.push(`${fmt(tm)} tech material`);
    events.push({
      ts, category: 'hours',
      event: 'Hours Logged',
      actor: userName(h.user) || '—',
      detail: parts.join(' · ') || 'no values',
    });
  });

  // ── CBRE Status (only last value with timestamp is in DB) ─────────────
  if (wo.cbre_status && safeDate(wo.cbre_status_updated_at)) {
    events.push({
      ts: new Date(wo.cbre_status_updated_at), category: 'status',
      event: 'CBRE Status Set',
      actor: 'Email sync / Office',
      detail: wo.cbre_status,
    });
  }

  // ── Submissions ──────────────────────────────────────────────────────
  if (wo.photos_received && safeDate(wo.photos_verified_at)) events.push({
    ts: new Date(wo.photos_verified_at), category: 'submission',
    event: 'Photos Received', actor: 'IMAP sync',
    detail: wo.photos_email_subject ? `"${wo.photos_email_subject}"` : '',
  });
  if (wo.receipts_received && safeDate(wo.receipts_verified_at)) events.push({
    ts: new Date(wo.receipts_verified_at), category: 'submission',
    event: 'Receipts Received', actor: 'IMAP sync',
    detail: wo.receipts_email_subject ? `"${wo.receipts_email_subject}"` : '',
  });
  if (wo.writeups_received && safeDate(wo.writeups_verified_at)) events.push({
    ts: new Date(wo.writeups_verified_at), category: 'submission',
    event: 'PMI Write-up Received', actor: 'IMAP sync',
    detail: wo.writeups_email_subject ? `"${wo.writeups_email_subject}"` : '',
  });

  // ── NTE Increase Requests ────────────────────────────────────────────
  quotes.forEach(q => {
    const createdTs = safeDate(q.created_at);
    if (createdTs) {
      const kind = q.is_verbal_nte ? 'Verbal' : 'Written';
      const mode = q.request_type === 'reconciliation' ? ' (Reconciliation)' : '';
      events.push({
        ts: createdTs, category: 'nte',
        event: `NTE Request Created${mode}`,
        actor: userName(q.creator) || '—',
        detail: `${kind} · Original: ${fmt(q.original_nte)} → New: ${fmt(q.new_nte_amount)}` +
                (q.is_verbal_nte && q.verbal_approved_by ? ` · approved by ${q.verbal_approved_by}` : ''),
      });
    }
    const approvedTs = safeDate(q.approved_at);
    if (approvedTs && (q.nte_status === 'approved' || q.nte_status === 'verbal_approved')) {
      events.push({
        ts: approvedTs, category: 'nte',
        event: 'NTE Request Approved',
        actor: q.approved_by || (q.is_verbal_nte ? (q.verbal_approved_by || 'Verbal') : 'CBRE'),
        detail: `New NTE: ${fmt(q.new_nte_amount)}`,
      });
    }
  });

  // ── Review Flags ─────────────────────────────────────────────────────
  flags.forEach(f => {
    if (safeDate(f.flagged_at)) events.push({
      ts: new Date(f.flagged_at), category: 'flag',
      event: `Flag Raised (${f.priority})`,
      actor: userName(f.flagger) || '—',
      detail: f.comment || '',
    });
    if (safeDate(f.resolved_at) && f.status === 'resolved') events.push({
      ts: new Date(f.resolved_at), category: 'flag',
      event: 'Flag Resolved',
      actor: userName(f.resolver) || '—',
      detail: f.resolution_note || '',
    });
  });

  // ── Customer Signature ───────────────────────────────────────────────
  if (wo.customer_signature && safeDate(wo.signature_date)) events.push({
    ts: new Date(wo.signature_date), category: 'signature',
    event: 'Customer Signed',
    actor: wo.customer_name || 'Customer',
    detail: 'Signature captured on mobile',
  });

  // Sort oldest first
  events.sort((a, b) => a.ts - b.ts);

  return { workOrder: wo, events };
}

// Apply a category filter to an event list. categories: Set<string> or array.
export function filterEvents(events, enabledCategories) {
  const set = enabledCategories instanceof Set ? enabledCategories : new Set(enabledCategories);
  return events.filter(e => set.has(e.category));
}
