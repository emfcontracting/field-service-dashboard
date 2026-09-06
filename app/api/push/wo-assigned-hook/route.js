// POST /api/push/wo-assigned-hook
// Target for a Supabase Database Webhook on the `work_orders` table (INSERT + UPDATE).
// When a work order gets a lead technician (newly assigned or reassigned), this
// sends that tech a native push notification. No dashboard code changes needed.
//
// Supabase payload shape:
//   { type: 'INSERT'|'UPDATE'|'DELETE', table, record, old_record }
//
// Security: NOTIFY_HOOK_SECRET must be set in the env and the Supabase webhook
// must send a matching "x-hook-secret" header (required, not optional).

import { NextResponse } from 'next/server';
import { notifyTech } from '@/lib/expoPush';
import { requireHook } from '@/lib/serverAuth';

export async function POST(request) {
  try {
    // Shared-secret check (NOTIFY_HOOK_SECRET must be set and match x-hook-secret).
    const auth = requireHook(request);
    if (!auth.ok) return auth.response;

    const payload = await request.json();
    const { type, record, old_record } = payload || {};
    if (!record) return NextResponse.json({ ok: true, skipped: 'no record' });

    const leadTechId = record.lead_tech_id;
    if (!leadTechId) return NextResponse.json({ ok: true, skipped: 'no lead_tech' });

    // Only notify when the assignment actually changed (new assignment or reassignment).
    const changed = type === 'INSERT' || (old_record && old_record.lead_tech_id !== leadTechId);
    if (!changed) return NextResponse.json({ ok: true, skipped: 'unchanged' });

    const woNumber = record.wo_number || 'Work Order';
    const building = record.building ? ` — ${record.building}` : '';

    const result = await notifyTech(
      leadTechId,
      'New Work Order',
      `${woNumber}${building}`,
      { woId: record.wo_id, woNumber: record.wo_number }
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('wo-assigned-hook error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
