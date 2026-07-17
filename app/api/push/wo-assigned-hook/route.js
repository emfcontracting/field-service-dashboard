// POST /api/push/wo-assigned-hook
// Target for a Supabase Database Webhook on the `work_orders` table (INSERT + UPDATE).
// When a work order gets a lead technician (newly assigned or reassigned), this
// sends that tech a native push notification. No dashboard code changes needed.
//
// Supabase payload shape:
//   { type: 'INSERT'|'UPDATE'|'DELETE', table, record, old_record }
//
// Optional security: set NOTIFY_HOOK_SECRET in your env and add a matching
// header "x-hook-secret" in the Supabase webhook config.

import { NextResponse } from 'next/server';
import { notifyTech } from '@/lib/expoPush';

export async function POST(request) {
  try {
    // Optional shared-secret check.
    const secret = process.env.NOTIFY_HOOK_SECRET;
    if (secret && request.headers.get('x-hook-secret') !== secret) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

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
