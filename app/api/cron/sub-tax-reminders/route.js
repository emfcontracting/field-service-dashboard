// app/api/cron/sub-tax-reminders/route.js
// -----------------------------------------------------------------------------
// Daily: 7 days before each Form 1040-ES due date, every active subcontractor
// gets a push + e-mail "Q4 estimated tax due Jan 15 — about $X". The amount is
// the same estimate as on the portal's Taxes page (lib/taxYear: paid
// invoices − expenses − standard mileage, SE tax + his own set-aside %),
// divided by four. Planning number, not tax advice. In the sub's language.
// Nothing is sent when the estimate is $0.
//
//   GET ?dry=1               → who would get what, nothing sent
//   GET ?today=YYYY-MM-DD    → treat that date as today (test)
// Vercel cron: daily 14:00 UTC (9:00 / 10:00 Eastern).
// -----------------------------------------------------------------------------
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { requireCronOrAdmin, serviceClient, appBaseUrl } from '@/lib/serverAuth';
import { withCronRun } from '@/lib/cronRun';
import { dateKeyET, fmtDateMed } from '@/lib/dates';
import { dueInstallment } from '@/lib/taxEstimate';
import { yearFigures } from '@/lib/taxYear';
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
  const today = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('today') || '') ? searchParams.get('today') : dateKeyET();
  const inst = dueInstallment(today);
  if (!inst) return NextResponse.json({ today, due: null });

  const supabase = serviceClient();
  const { data: profiles, error } = await supabase.from('subcontractor_profiles').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const active = (profiles || []).filter((p) => p.is_enabled !== false && p.subscription_status !== 'expired');
  const { data: users } = await supabase.from('users').select('user_id, email, first_name, is_active').in('user_id', active.map((p) => p.user_id));
  const userById = Object.fromEntries((users || []).filter((u) => u.is_active !== false).map((u) => [u.user_id, u]));
  const mailer = process.env.EMAIL_USER && process.env.EMAIL_PASS
    ? nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } })
    : null;
  const y = inst.taxYear;
  const sent = [], skipped = [];

  for (const profile of active) {
    const user = userById[profile.user_id];
    if (!user) continue;
    const [inv, rec, trips, logs, pay] = await Promise.all([
      supabase.from('subcontractor_invoices').select('*').eq('user_id', user.user_id),
      supabase.from('contractor_tax_records').select('amount, category_name').eq('user_id', user.user_id).eq('tax_year', y).eq('dismissed', false),
      supabase.from('contractor_trips').select('trip_date, miles').eq('user_id', user.user_id).gte('trip_date', `${y}-01-01`).lte('trip_date', `${y}-12-31`),
      supabase.from('daily_hours_log').select('work_date, miles').eq('user_id', user.user_id).gte('work_date', `${y}-01-01`).lte('work_date', `${y}-12-31`).gt('miles', 0),
      supabase.from('contractor_invoice_payments').select('invoice_id, amount, paid_on').eq('user_id', user.user_id),
    ]);
    if (inv.error) { skipped.push({ user_id: user.user_id, reason: inv.error.message }); continue; }
    const payBy = {};
    for (const p of (pay.error ? [] : pay.data || [])) (payBy[p.invoice_id] ||= []).push(p);
    const invoices = (inv.data || []).map((i) => ({ ...i, payments: payBy[i.invoice_id] || [] }));
    const fig = yearFigures({
      invoices, records: rec.error ? [] : rec.data || [],
      trips: { trips: trips.error ? [] : trips.data || [], emf: logs.error ? [] : logs.data || [] },
      year: y, vehicle: 'standard', setAsidePct: profile.tax_set_aside_pct || 0,
    });
    const amount = Math.round(fig.quarterly);
    if (!(amount > 0)) { skipped.push({ user_id: user.user_id, reason: 'estimate $0' }); continue; }

    const lang = profile.language === 'es' ? 'es' : 'en';
    const tr = (k, v) => translate(lang, k, v);
    const vars = { q: inst.quarter, year: y, date: fmtDateMed(inst.due + 'T12:00:00'), amount: '$' + amount.toLocaleString('en-US'), name: user.first_name || '' };
    const title = tr('Estimated tax due {date}', vars);
    const body = tr('Q{q} {year} (Form 1040-ES): about {amount} by your own estimate. Pay at irs.gov/payments.', vars);
    if (dry) { sent.push({ user_id: user.user_id, amount, dry: true }); continue; }

    let pushed = false, mailed = false;
    try { await notifyTech(user.user_id, title, body, { url: '/contractor/tax-report' }); pushed = true; } catch (e) { console.error('tax push failed:', e.message); }
    if (mailer && user.email) {
      const link = `${appBaseUrl()}/contractor/tax-report`;
      try {
        await mailer.sendMail({
          from: `"EMF Contractor Portal" <${process.env.EMAIL_USER}>`, to: user.email, subject: title,
          html: `<p>${tr('Hi {name},', vars)}</p><p>${body}</p>
<p>${tr('The amount is a planning estimate from your portal figures (self-employment tax plus your own set-aside %), not tax advice. Check it with your tax preparer.')}</p>
<p><a href="${link}">${link}</a></p>`,
        });
        mailed = true;
      } catch (e) { console.error('tax mail failed:', e.message); }
    }
    sent.push({ user_id: user.user_id, amount, pushed, mailed });
  }
  return NextResponse.json({ today, ...inst, dry, sent, skipped });
}

export const GET = (request) => withCronRun('cron/sub-tax-reminders', request, () => run(request));
