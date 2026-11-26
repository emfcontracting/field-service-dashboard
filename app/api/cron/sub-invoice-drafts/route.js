// app/api/cron/sub-invoice-drafts/route.js
// -----------------------------------------------------------------------------
// Fridays: for every active subcontractor, a DRAFT invoice to EMF for the week
// that just closed (Fri–Thu, lib/billingWeek) — with his recurring lines, e.g.
// admin hours — then a push (tech app) and an
// e-mail: "your invoice for … is ready — check it and press Send".
//
// Skipped when the sub has no hours that week, or when any of that week's
// entries is already on one of his invoices (draft, sent or paid — rejected
// ones don't count). Nothing is ever sent to EMF automatically; the sub checks
// the draft and sends it himself.
//
//   GET ?dry=1        → what would be created, nothing written
//   GET ?week=YYYY-MM-DD  → treat that date as "today" (backfill / test)
// Vercel cron: Fridays 13:00 UTC (8:00 / 9:00 Eastern).
// -----------------------------------------------------------------------------
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { requireCronOrAdmin, serviceClient, appBaseUrl } from '@/lib/serverAuth';
import { withCronRun } from '@/lib/cronRun';
import { lastBillingWeek } from '@/lib/billingWeek';
import { dateKeyET, fmtDateShort } from '@/lib/dates';
import { findAlreadyInvoiced } from '@/lib/subInvoiceOverlap';
import { createEmfInvoice } from '@/lib/subInvoiceCreate';
import { notifyTech } from '@/lib/expoPush';
import { translate } from '@/lib/contractorI18n';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function run(request) {
  const auth = await requireCronOrAdmin(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const dry = searchParams.get('dry') === '1';
  const today = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('week') || '') ? searchParams.get('week') : dateKeyET();
  const week = lastBillingWeek(today);
  const supabase = serviceClient();

  const { data: profiles, error: pErr } = await supabase
    .from('subcontractor_profiles')
    .select('*');
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  const active = (profiles || []).filter((p) => p.is_enabled !== false && p.subscription_status !== 'expired');
  if (!active.length) return NextResponse.json({ week, created: [], skipped: [] });

  const { data: users } = await supabase
    .from('users')
    .select('user_id, email, first_name, last_name, is_active')
    .in('user_id', active.map((p) => p.user_id));
  const userById = Object.fromEntries((users || []).filter((u) => u.is_active !== false).map((u) => [u.user_id, u]));

  const created = [];
  const skipped = [];
  const mailer = process.env.EMAIL_USER && process.env.EMAIL_PASS
    ? nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } })
    : null;
  const base = appBaseUrl();

  for (const profile of active) {
    const user = userById[profile.user_id];
    if (!user) { skipped.push({ user_id: profile.user_id, reason: 'inactive user' }); continue; }
    const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();

    const { data: hours, error: hErr } = await supabase
      .from('daily_hours_log')
      .select('wo_id, work_date, hours_regular, hours_overtime, miles, tech_material_cost')
      .eq('user_id', user.user_id)
      .gte('work_date', week.start)
      .lte('work_date', week.end);
    if (hErr) { skipped.push({ name, reason: hErr.message }); continue; }
    const billable = (hours || []).filter((h) =>
      (parseFloat(h.hours_regular) || 0) + (parseFloat(h.hours_overtime) || 0) + (parseFloat(h.miles) || 0) + (parseFloat(h.tech_material_cost) || 0) > 0);
    if (!billable.length) { skipped.push({ name, reason: 'no hours' }); continue; }

    const already = await findAlreadyInvoiced(supabase, user.user_id, billable);
    if (already.length) { skipped.push({ name, reason: `already on ${[...new Set(already.map((a) => a.invoice_number))].join(', ')}` }); continue; }

    if (dry) { created.push({ name, entries: billable.length, dry: true }); continue; }

    const result = await createEmfInvoice(supabase, user, profile, { line_items: [], use_recurring: true }, week.start, week.end);
    if (result.error) { skipped.push({ name, reason: result.error }); continue; }
    const inv = result.invoice;
    const total = (parseFloat(inv.grand_total) || 0).toFixed(2);
    const span = `${fmtDateShort(week.start)}–${fmtDateShort(week.end)}`;
    const link = `${base}/contractor/invoices/${inv.invoice_id}`;
    const lang = profile.language === 'es' ? 'es' : 'en';
    const tr = (k, v) => translate(lang, k, v);
    const vars = { inv: inv.invoice_number, span, total: '$' + total, name: user.first_name || '', link };

    let pushed = false, mailed = false;
    try {
      await notifyTech(user.user_id, tr('Your invoice is ready'), tr('{inv} for {span}: {total}. Check it and press Send.', vars), { url: `/contractor/invoices/${inv.invoice_id}` });
      pushed = true;
    } catch (e) { console.error('draft push failed:', e.message); }
    if (mailer && user.email) {
      try {
        await mailer.sendMail({
          from: `"EMF Contractor Portal" <${process.env.EMAIL_USER}>`,
          to: user.email,
          subject: tr('Your invoice for {span} is ready — {total}', vars),
          html: `<p>${tr('Hi {name},', vars)}</p>
<p>${tr('your invoice <strong>{inv}</strong> for <strong>{span}</strong> is ready as a draft: <strong>{total}</strong>.', vars)}</p>
<p>${tr('Please check it and press <em>Send</em>:', vars)} <a href="${link}">${link}</a></p>
<p>${tr('Nothing has been sent to EMF yet.')}</p>`,
        });
        mailed = true;
      } catch (e) { console.error('draft mail failed:', e.message); }
    }
    created.push({ name, invoice_number: inv.invoice_number, total, pushed, mailed });
  }

  return NextResponse.json({ week, dry, created, skipped });
}

export const GET = (request) => withCronRun('cron/sub-invoice-drafts', request, () => run(request));
