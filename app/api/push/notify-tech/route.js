// POST /api/push/notify-tech
// Body: { userId, title, body?, data? }
// Sends a native push notification to all of a technician's registered devices.
//
// Call this from wherever a work order gets assigned to a tech (e.g. when
// lead_tech_id is set or a work_order_assignments row is inserted), for example:
//
//   await fetch(`${BASE}/api/push/notify-tech`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({
//       userId: leadTechId,
//       title: 'New Work Order',
//       body: `${wo.wo_number} — ${wo.building}`,
//       data: { woId: wo.wo_id },
//     }),
//   });

import { NextResponse } from 'next/server';
import { notifyTech } from '@/lib/expoPush';

export async function POST(request) {
  try {
    const { userId, title, body, data } = await request.json();
    if (!userId || !title) {
      return NextResponse.json({ error: 'userId and title are required' }, { status: 400 });
    }
    const result = await notifyTech(userId, title, body || '', data || {});
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('notify-tech error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
