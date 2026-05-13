// app/api/flags/route.js
// ─────────────────────────────────────────────────────────────────────────────
// POST  /api/flags        → create a flag (admin/office only) + email Daniel
// GET   /api/flags        → list flags, optional ?status=open|resolved&wo_id=…
//
// Per-flag operations (resolve / delete) live in /api/flags/[id]/route.js.
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Where flag notifications go. Hardcoded to Daniel — if he ever wants to
// route notifications elsewhere we can read this from a settings row.
const SUPERADMIN_EMAIL = 'jones.emfcontracting@gmail.com';

const PRIORITY_LABELS = { low: '🟡 LOW', medium: '🟠 MEDIUM', high: '🔴 HIGH' };

// ── Role check ─────────────────────────────────────────────────────────────
async function getActorOrError(userId) {
  if (!userId) return { error: 'Missing user_id', status: 401 };
  const { data: user, error } = await supabase
    .from('users')
    .select('user_id, email, first_name, last_name, role')
    .eq('user_id', userId)
    .single();
  if (error || !user) return { error: 'User not found', status: 401 };
  if (!['admin', 'office_staff'].includes(user.role)) {
    return { error: 'Only admins and office staff can flag work orders', status: 403 };
  }
  return { user };
}

// ── Email Daniel ────────────────────────────────────────────────────────────
// Best-effort; failures are swallowed so the flag still gets created.
async function notifyDaniel({ flag, actor, workOrder }) {
  try {
    const emailPass = process.env.EMAIL_PASS;
    const emailUser = process.env.EMAIL_USER || 'emfcbre@gmail.com';
    if (!emailPass) {
      console.warn('[flags] EMAIL_PASS not set — skipping email');
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: emailUser, pass: emailPass },
    });

    const priorityLabel = PRIORITY_LABELS[flag.priority] || flag.priority;
    const subject = `🚩 [${priorityLabel}] Flag on ${workOrder.wo_number} — ${workOrder.building || ''}`.trim();

    const flagUrl = `https://field-service-dashboard.vercel.app/dashboard?wo=${encodeURIComponent(workOrder.wo_number)}`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <div style="background:#1e293b;color:#fff;padding:20px;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;font-size:18px;">🚩 Work Order Flagged for Review</h2>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 8px 8px;background:#fff;color:#111;">
          <p style="margin:0 0 12px;font-size:14px;color:#374151;">
            <strong>${actor.first_name} ${actor.last_name}</strong>
            (${actor.role.replace('_', ' ')}) flagged a work order for your review.
          </p>

          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
            <tr><td style="padding:6px 0;color:#6b7280;width:120px;">Work Order:</td>
                <td style="padding:6px 0;font-weight:600;">${workOrder.wo_number}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Building:</td>
                <td style="padding:6px 0;">${workOrder.building || '—'}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Priority:</td>
                <td style="padding:6px 0;font-weight:600;">${priorityLabel}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Flagged at:</td>
                <td style="padding:6px 0;">${new Date(flag.flagged_at).toLocaleString('en-US')}</td></tr>
          </table>

          <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:4px;margin:16px 0;">
            <div style="font-size:11px;text-transform:uppercase;color:#92400e;font-weight:600;margin-bottom:4px;">Comment</div>
            <div style="font-size:14px;color:#111;white-space:pre-wrap;">${escapeHtml(flag.comment)}</div>
          </div>

          <div style="text-align:center;margin-top:20px;">
            <a href="${flagUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">
              Open Work Order →
            </a>
          </div>
        </div>
        <div style="text-align:center;color:#9ca3af;font-size:11px;margin-top:12px;">
          PCS FieldService · Flag notifications
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"PCS FieldService" <${emailUser}>`,
      to: SUPERADMIN_EMAIL,
      subject,
      html,
    });
  } catch (e) {
    // Don't let email failure block flag creation
    console.error('[flags] Email notification failed:', e?.message || e);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── POST /api/flags ─────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const body = await request.json();
    const { wo_id, user_id, comment, priority = 'medium' } = body;

    if (!wo_id)               return NextResponse.json({ error: 'wo_id required' },   { status: 400 });
    if (!comment?.trim())     return NextResponse.json({ error: 'comment required' }, { status: 400 });
    if (!['low','medium','high'].includes(priority)) {
      return NextResponse.json({ error: 'invalid priority' }, { status: 400 });
    }

    const actorResult = await getActorOrError(user_id);
    if (actorResult.error) return NextResponse.json({ error: actorResult.error }, { status: actorResult.status });
    const actor = actorResult.user;

    // Fetch WO for email context (and to validate it exists)
    const { data: workOrder, error: woErr } = await supabase
      .from('work_orders')
      .select('wo_id, wo_number, building')
      .eq('wo_id', wo_id)
      .single();
    if (woErr || !workOrder) return NextResponse.json({ error: 'Work order not found' }, { status: 404 });

    // Insert
    const { data: flag, error: insErr } = await supabase
      .from('work_order_flags')
      .insert({
        wo_id,
        flagged_by: actor.user_id,
        comment: comment.trim(),
        priority,
      })
      .select(`
        *,
        flagger:users!work_order_flags_flagged_by_fkey(first_name, last_name, role)
      `)
      .single();

    if (insErr) {
      console.error('[flags] Insert error:', insErr);
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    // Notify Daniel — but don't await blocking; we still want fast response.
    // (Vercel serverless will keep the function alive until this resolves.)
    notifyDaniel({ flag, actor, workOrder });

    return NextResponse.json({ success: true, flag });
  } catch (e) {
    console.error('[flags] POST error:', e);
    return NextResponse.json({ error: e.message || 'unknown' }, { status: 500 });
  }
}

// ── GET /api/flags?status=open&wo_id=… ──────────────────────────────────────
// Used by the Review Queue and the WO detail modal.
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');   // 'open' | 'resolved' | null (=all)
    const woId   = url.searchParams.get('wo_id');

    let query = supabase
      .from('work_order_flags')
      .select(`
        *,
        flagger:users!work_order_flags_flagged_by_fkey(user_id, first_name, last_name, role),
        resolver:users!work_order_flags_resolved_by_fkey(user_id, first_name, last_name),
        work_order:work_orders(wo_id, wo_number, building, status, cbre_status)
      `)
      .order('flagged_at', { ascending: true }); // oldest open flag first; priority sort happens client-side

    if (status) query = query.eq('status', status);
    if (woId)   query = query.eq('wo_id', woId);

    const { data, error } = await query;
    if (error) {
      console.error('[flags] GET error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ flags: data || [] });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
