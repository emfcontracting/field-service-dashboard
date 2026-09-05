// app/api/quickbooks/pull-payments/route.js
// ─────────────────────────────────────────────────────────────────────────────
// Pull payment truth FROM QuickBooks (stage 2 of payment tracking).
//
// QB is bank-connected, so an invoice with Balance = 0 there means the money
// actually arrived — stronger than CBRE's "marked as Paid" mail. This route:
//   1. loads the OAuth tokens from quickbooks_settings (refreshing if needed),
//   2. pages through QB Invoices (Id, DocNumber, Balance, TotalAmt) and
//      Payments (TxnDate + linked invoice ids),
//   3. matches FSM invoices via qb_invoice_number == DocNumber, and
//   4. marks fully-paid ones paid with the REAL payment date.
//
// This is also the historical migration Daniel wanted: one full run marks
// every old invoice QB knows as paid. Params: ?days=3650 (QB query window by
// txn date), ?dryRun=true, ?manual=true (same CRON_SECRET guard as elsewhere).
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';
import OAuthClient from 'intuit-oauth';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

const QB_BASE = () =>
  (process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox') === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';

async function getAccessToken(supabase) {
  const { data: settings } = await supabase
    .from('quickbooks_settings')
    .select('*')
    .eq('is_active', true)
    .single();
  if (!settings) throw new Error('QuickBooks not connected');

  const expiresAt = new Date(settings.token_expires_at || 0);
  if (expiresAt.getTime() - Date.now() > 5 * 60 * 1000) {
    return { accessToken: settings.access_token, realmId: settings.realm_id };
  }

  // Refresh (access tokens last ~1h; refresh tokens ~100 days and rotate).
  const oauthClient = new OAuthClient({
    clientId: process.env.QUICKBOOKS_CLIENT_ID,
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET,
    environment: process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox',
    redirectUri: process.env.QUICKBOOKS_REDIRECT_URI,
  });
  const authResponse = await oauthClient.refreshUsingToken(settings.refresh_token);
  const token = authResponse.getJson();
  await supabase
    .from('quickbooks_settings')
    .update({
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    })
    .eq('is_active', true);
  return { accessToken: token.access_token, realmId: settings.realm_id };
}

async function qbQuery(accessToken, realmId, query) {
  const url = `${QB_BASE()}/v3/company/${realmId}/query?minorversion=73&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    // intuit_tid identifies the request for Intuit support when troubleshooting
    const tid = res.headers.get('intuit_tid');
    throw new Error(`QB query failed (${res.status}, intuit_tid=${tid}): ${(await res.text()).substring(0, 300)}`);
  }
  return res.json();
}

// Page through a QB entity query (QB caps at 1000 rows per page).
async function qbQueryAll(accessToken, realmId, entity, where) {
  const rows = [];
  let start = 1;
  while (true) {
    const q = `SELECT * FROM ${entity}${where ? ` WHERE ${where}` : ''} STARTPOSITION ${start} MAXRESULTS 1000`;
    const data = await qbQuery(accessToken, realmId, q);
    const batch = data?.QueryResponse?.[entity] || [];
    rows.push(...batch);
    if (batch.length < 1000) break;
    start += 1000;
  }
  return rows;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      if (searchParams.get('manual') !== 'true') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    const days = parseInt(searchParams.get('days')) || 60;
    const dryRun = searchParams.get('dryRun') === 'true';

    const supabase = getSupabase();
    const { accessToken, realmId } = await getAccessToken(supabase);

    const sinceDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

    // 1) QB invoices in window (TxnDate) — id → { docNumber, balance, total }
    const qbInvoices = await qbQueryAll(accessToken, realmId, 'Invoice', `TxnDate >= '${sinceDate}'`);
    const byId = new Map();
    const byDoc = new Map();
    for (const inv of qbInvoices) {
      const rec = {
        id: inv.Id,
        doc: `${inv.DocNumber || ''}`.trim(),
        balance: parseFloat(inv.Balance ?? 0),
        total: parseFloat(inv.TotalAmt ?? 0),
        txnDate: inv.TxnDate,
        lastUpdated: inv.MetaData?.LastUpdatedTime,
        paymentDates: [],
      };
      byId.set(inv.Id, rec);
      if (rec.doc) byDoc.set(rec.doc, rec);
    }

    // 2) Payments in window → attach real payment dates to their invoices
    const qbPayments = await qbQueryAll(accessToken, realmId, 'Payment', `TxnDate >= '${sinceDate}'`);
    for (const pay of qbPayments) {
      for (const line of pay.Line || []) {
        for (const lt of line.LinkedTxn || []) {
          if (lt.TxnType === 'Invoice' && byId.has(lt.TxnId)) {
            byId.get(lt.TxnId).paymentDates.push(pay.TxnDate);
          }
        }
      }
    }

    // 3) FSM invoices with a QB number that aren't marked paid yet
    const { data: fsmInvoices } = await supabase
      .from('invoices')
      .select('invoice_id, qb_invoice_number, status, paid_at, total')
      .not('qb_invoice_number', 'is', null);

    const results = {
      qbInvoices: qbInvoices.length,
      qbPayments: qbPayments.length,
      fsmLinked: (fsmInvoices || []).length,
      markedPaid: 0,
      alreadyPaid: 0,
      stillOpenInQb: 0,
      notInQbWindow: 0,
      partiallyPaid: [],
      errors: [],
      dryRun, days,
    };

    for (const inv of fsmInvoices || []) {
      const qb = byDoc.get(`${inv.qb_invoice_number}`.trim());
      if (!qb) { results.notInQbWindow++; continue; }
      if (inv.status === 'paid' && inv.paid_at) { results.alreadyPaid++; continue; }

      if (qb.balance === 0 && qb.total > 0) {
        // Fully paid in QB — use the latest real payment date.
        const paidAt = qb.paymentDates.sort().pop() || qb.lastUpdated || new Date().toISOString();
        const paidIso = new Date(paidAt).toISOString();
        if (!dryRun) {
          const { error } = await supabase
            .from('invoices')
            .update({ status: 'paid', paid_at: paidIso })
            .eq('invoice_id', inv.invoice_id);
          if (error) { results.errors.push(`${inv.qb_invoice_number}: ${error.message}`); continue; }
        }
        results.markedPaid++;
      } else if (qb.balance > 0 && qb.balance < qb.total) {
        results.partiallyPaid.push({ qb: inv.qb_invoice_number, balance: qb.balance, total: qb.total });
        results.stillOpenInQb++;
      } else {
        results.stillOpenInQb++;
      }
    }

    return Response.json({
      success: true,
      message: `QB: ${results.qbInvoices} invoices / ${results.qbPayments} payments read. Marked paid: ${results.markedPaid}, already paid: ${results.alreadyPaid}, still open in QB: ${results.stillOpenInQb}.`,
      ...results,
    });
  } catch (error) {
    console.error('QB pull-payments error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
