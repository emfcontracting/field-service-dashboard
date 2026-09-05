// POST /api/quickbooks/push-invoice  { invoice_id, dryRun? }
//
// Pushes a finalized FSM invoice to QuickBooks Online:
//   1. creates the Invoice in QB (customer CBRE-UPS, items mapped by line_type),
//   2. stores the QB DocNumber as qb_invoice_number on invoice + work order,
//   3. downloads the official QB invoice PDF and stores it in Supabase storage
//      (bucket "invoice-pdfs") so the office can upload it to CBRE/Coupa.
//
// dryRun:true builds and returns the QB payload without creating anything.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OAuthClient from 'intuit-oauth';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const QB_CUSTOMER_NAME = 'CBRE-UPS';
// Invoice emails go to our own inbox: that is how the office receives the QB
// invoice mail (also feeds the invoice-sent email parser) for the CBRE upload.
const QB_BILL_EMAIL = 'emfcontractingsc@gmail.com';
const ITEM_BY_LINE_TYPE = {
  labor:     'Labor',
  mileage:   'Mileage',
  material:  'Material',
  equipment: 'Equipment Rental',
  rental:    'Equipment Rental',
};
const PDF_BUCKET = 'invoice-pdfs';

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

async function qbFetch(accessToken, realmId, path, options = {}) {
  const res = await fetch(`${QB_BASE()}/v3/company/${realmId}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: options.accept || 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const tid = res.headers.get('intuit_tid');
    throw new Error(`QB ${path} failed (${res.status}, intuit_tid=${tid}): ${(await res.text()).substring(0, 400)}`);
  }
  return res;
}

async function qbQuery(accessToken, realmId, query) {
  const res = await qbFetch(accessToken, realmId, `/query?query=${encodeURIComponent(query)}&minorversion=73`);
  return res.json();
}

export async function POST(request) {
  const supabase = getSupabase();
  try {
    const body = await request.json().catch(() => ({}));
    const invoiceId = body.invoice_id;
    const dryRun = body.dryRun === true;
    if (!invoiceId) {
      return NextResponse.json({ success: false, error: 'invoice_id is required' }, { status: 400 });
    }

    // ── Load FSM invoice + line items + work order ──────────────────────────
    const { data: invoice, error: invErr } = await supabase
      .from('invoices').select('*').eq('invoice_id', invoiceId).single();
    if (invErr || !invoice) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    }
    if (invoice.qb_invoice_number) {
      return NextResponse.json(
        { success: false, error: `Already in QuickBooks as #${invoice.qb_invoice_number}` },
        { status: 409 }
      );
    }

    const { data: lineItems } = await supabase
      .from('invoice_line_items').select('*')
      .eq('invoice_id', invoiceId).order('line_item_id', { ascending: true });
    if (!lineItems?.length) {
      return NextResponse.json({ success: false, error: 'Invoice has no line items' }, { status: 400 });
    }

    const { data: wo } = await supabase
      .from('work_orders').select('wo_id, wo_number, building')
      .eq('wo_id', invoice.wo_id).single();

    // ── Resolve QB customer + items by name (robust against id changes) ─────
    const { accessToken, realmId } = await getAccessToken(supabase);

    const custRes = await qbQuery(accessToken, realmId,
      `select Id, DisplayName from Customer where DisplayName = '${QB_CUSTOMER_NAME}'`);
    const customer = custRes.QueryResponse?.Customer?.[0];
    if (!customer) throw new Error(`QB customer "${QB_CUSTOMER_NAME}" not found`);

    const itemNames = [...new Set(Object.values(ITEM_BY_LINE_TYPE))];
    const itemRes = await qbQuery(accessToken, realmId,
      `select Id, Name from Item where Name in (${itemNames.map((n) => `'${n}'`).join(',')})`);
    const itemIdByName = {};
    (itemRes.QueryResponse?.Item || []).forEach((it) => { itemIdByName[it.Name] = it.Id; });
    for (const n of itemNames) {
      if (!itemIdByName[n]) throw new Error(`QB item "${n}" not found`);
    }

    // ── Build QB lines ──────────────────────────────────────────────────────
    const descriptionItems = lineItems.filter((li) => li.line_type === 'description');
    const billableItems    = lineItems.filter((li) => li.line_type !== 'description');

    const qbLines = [];

    // Header text (WO + work performed) as a description-only line, like the
    // office's existing QB invoices.
    const headerParts = [];
    if (wo?.wo_number) headerParts.push(`${wo.wo_number}${wo.building ? ' ' + String(wo.building).split(' - ')[0].trim() : ''}:`);
    descriptionItems.forEach((li) => { if (li.description?.trim()) headerParts.push(li.description.trim()); });
    if (headerParts.length) {
      qbLines.push({
        DetailType: 'DescriptionOnly',
        Description: headerParts.join('\n').substring(0, 4000),
        DescriptionLineDetail: {},
      });
    }

    for (const li of billableItems) {
      const itemName = ITEM_BY_LINE_TYPE[li.line_type] || 'Labor';
      const qty = parseFloat(li.quantity) || 1;
      const amount = Math.round((parseFloat(li.amount) || 0) * 100) / 100;
      const unitPrice = qty !== 0 ? Math.round((amount / qty) * 10000) / 10000 : amount;
      qbLines.push({
        DetailType: 'SalesItemLineDetail',
        Amount: amount,
        Description: (li.description || '').substring(0, 4000),
        SalesItemLineDetail: {
          ItemRef: { value: itemIdByName[itemName], name: itemName },
          Qty: qty,
          UnitPrice: unitPrice,
        },
      });
    }

    // QB has custom transaction numbers enabled, so the API must assign the
    // next sequential DocNumber itself (otherwise the invoice stays unnumbered).
    const recent = await qbQuery(accessToken, realmId,
      'select DocNumber from Invoice orderby MetaData.CreateTime desc maxresults 30');
    let maxDoc = 0;
    (recent.QueryResponse?.Invoice || []).forEach((iv) => {
      const n = parseInt(iv.DocNumber, 10);
      if (Number.isFinite(n) && n > maxDoc) maxDoc = n;
    });
    if (!maxDoc) throw new Error('Could not determine next QB invoice number');
    const nextDocNumber = String(maxDoc + 1);

    const toDateOnly = (d) => (d ? new Date(d).toISOString().slice(0, 10) : undefined);
    const qbInvoice = {
      DocNumber: nextDocNumber,
      CustomerRef: { value: customer.Id, name: customer.DisplayName },
      TxnDate: toDateOnly(invoice.invoice_date),
      DueDate: toDateOnly(invoice.due_date),
      Line: qbLines,
      PrivateNote: `FSM ${invoice.invoice_number}${wo?.wo_number ? ' — WO ' + wo.wo_number : ''}`,
      BillEmail: { Address: QB_BILL_EMAIL },
      EmailStatus: 'NeedToSend',
    };

    if (dryRun) {
      return NextResponse.json({ success: true, dryRun: true, payload: qbInvoice });
    }

    // ── Create in QB ────────────────────────────────────────────────────────
    const createRes = await qbFetch(accessToken, realmId, `/invoice?minorversion=73`, {
      method: 'POST',
      body: JSON.stringify(qbInvoice),
    });
    const created = (await createRes.json()).Invoice;
    const qbId = created.Id;
    const docNumber = created.DocNumber;

    // Send the invoice email from QB (to our own inbox)
    let emailSent = false;
    try {
      await qbFetch(accessToken, realmId, `/invoice/${qbId}/send?minorversion=73`, { method: 'POST' });
      emailSent = true;
    } catch (sendErr) {
      console.error('QB invoice send error:', sendErr);
    }

    // ── Download the official QB PDF and store it ───────────────────────────
    let pdfUrl = null;
    try {
      const pdfRes = await qbFetch(accessToken, realmId, `/invoice/${qbId}/pdf?minorversion=73`, {
        accept: 'application/pdf',
      });
      const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
      const path = `${invoice.invoice_number}-QB${docNumber}.pdf`;

      let up = await supabase.storage.from(PDF_BUCKET).upload(path, pdfBuf, {
        contentType: 'application/pdf', upsert: true,
      });
      if (up.error && /bucket/i.test(up.error.message || '')) {
        await supabase.storage.createBucket(PDF_BUCKET, { public: true });
        up = await supabase.storage.from(PDF_BUCKET).upload(path, pdfBuf, {
          contentType: 'application/pdf', upsert: true,
        });
      }
      if (!up.error) {
        pdfUrl = supabase.storage.from(PDF_BUCKET).getPublicUrl(path).data.publicUrl;
      } else {
        console.error('QB PDF storage error:', up.error);
      }
    } catch (pdfErr) {
      console.error('QB PDF download error:', pdfErr);
    }

    // ── Persist QB linkage on invoice + work order ──────────────────────────
    // Critical linkage first (existing columns), extras separately so a
    // missing column can never cost us the QB number.
    const { error: linkErr } = await supabase.from('invoices').update({
      qb_invoice_number: docNumber,
      qb_invoice_id: qbId,
      synced_to_qb_at: new Date().toISOString(),
    }).eq('invoice_id', invoiceId);
    if (linkErr) console.error('QB linkage update error:', linkErr);

    if (pdfUrl) {
      const { error: pdfColErr } = await supabase.from('invoices')
        .update({ qb_pdf_url: pdfUrl }).eq('invoice_id', invoiceId);
      if (pdfColErr) console.error('qb_pdf_url update error (run migration?):', pdfColErr);
    }

    if (invoice.wo_id) {
      await supabase.from('work_orders').update({ qb_invoice_number: docNumber }).eq('wo_id', invoice.wo_id);
    }

    return NextResponse.json({
      success: true,
      qbInvoiceNumber: docNumber,
      qbInvoiceId: qbId,
      total: created.TotalAmt,
      pdfUrl,
      emailSent,
    });
  } catch (error) {
    console.error('QB push-invoice error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
