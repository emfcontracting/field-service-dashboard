// POST /api/flags/notify-fixed
// Body: { woId, kind: 'missing_data' | 'update_required', actorName }
//
// Fires the office notification when a technician marks a flag as FIXED / done.
// (Snooze does NOT call this — only resolution notifies the office.)
// Uses the existing subscription-based notification system.

import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { sendSubscribedNotification } from '@/lib/notificationRecipients';

export async function POST(request) {
  try {
    const { woId, kind, actorName } = await request.json();
    if (!woId || !kind) {
      return NextResponse.json({ error: 'woId and kind are required' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: wo, error } = await supabase
      .from('work_orders')
      .select('wo_id, wo_number, building, work_order_description, priority, missing_data_items, update_required_items')
      .eq('wo_id', woId)
      .single();
    if (error || !wo) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
    }

    const payload = {
      type: kind === 'missing_data' ? 'missing_data_fixed' : 'update_required_followed_up',
      workOrder: {
        wo_id: wo.wo_id,
        wo_number: wo.wo_number,
        building: wo.building,
        work_order_description: wo.work_order_description,
        priority: wo.priority,
      },
      actorName: actorName || 'Technician',
    };
    if (kind === 'missing_data') payload.missingDataItems = wo.missing_data_items || [];
    else payload.updateRequiredItems = wo.update_required_items || [];

    const result = await sendSubscribedNotification(supabase, payload);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error('notify-fixed error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
