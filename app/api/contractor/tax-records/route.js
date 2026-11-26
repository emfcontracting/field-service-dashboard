// app/api/contractor/tax-records/route.js
// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/contractor/tax-records?user_id=X&year=YYYY  → list records for a user/year
// POST /api/contractor/tax-records                       → create one or more records
//
// POST body can be either:
//   { user_id, tax_year, entry_date, invoice_ref?, category_name, amount, notes?, receipt_url? }
//   OR (batch with shared receipt info):
//   { user_id, tax_year, entry_date, invoice_ref?, notes?, receipt_url?,
//     amounts: { 'Material': 50, 'Tools': 30, ... } }
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { requireContractorOrStaff, ownsUser, denyNotOwner, serviceClient } from '@/lib/serverAuth';
import { expenseExtras, resolveWoNumber, withWoNumber } from '@/lib/expenseFields';
import { syncTaxRecords } from '@/lib/taxRecordSync';

// Service role: these tables are RLS-locked (staff_all only); the route
// itself checks who may see which row.
const supabase = serviceClient();

export async function GET(request) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const year   = searchParams.get('year');

    if (!userId || !year) {
      return NextResponse.json({ error: 'user_id and year are required' }, { status: 400 });
    }
    if (!ownsUser(auth, userId)) return denyNotOwner().response;

    // ?sync=1: first fill in what the system knows (material, mileage, hotels)
    let sync = null;
    if (searchParams.get('sync') === '1') {
      try { sync = await syncTaxRecords(supabase, userId, parseInt(year, 10)); }
      catch (e) { console.error('tax record sync failed:', e); sync = { error: e.message }; }
    }

    const { data, error } = await supabase
      .from('contractor_tax_records')
      .select('*, work_order:work_orders(wo_number)')
      .eq('user_id', userId)
      .eq('tax_year', parseInt(year, 10))
      .eq('dismissed', false)
      .order('entry_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('GET tax-records error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ records: withWoNumber(data), sync });
  } catch (err) {
    console.error('GET tax-records exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    const { user_id, tax_year, entry_date } = body;
    if (!ownsUser(auth, user_id)) return denyNotOwner().response;

    if (!user_id || !tax_year || !entry_date) {
      return NextResponse.json(
        { error: 'user_id, tax_year, and entry_date are required' },
        { status: 400 }
      );
    }

    const extras = expenseExtras(body, user_id);
    if (extras.__badReceipt) return NextResponse.json({ error: 'Invalid receipt reference' }, { status: 400 });
    const wo = await resolveWoNumber(supabase, body);
    if (wo.error) return NextResponse.json({ error: wo.error }, { status: 400 });
    Object.assign(extras, wo);

    // Batch insert (multi-category receipt) — payload has `amounts` map
    if (body.amounts && typeof body.amounts === 'object') {
      const rows = Object.entries(body.amounts)
        .filter(([, amt]) => parseFloat(amt) > 0)
        .map(([category_name, amount]) => ({
          user_id,
          tax_year: parseInt(tax_year, 10),
          entry_date,
          invoice_ref: body.invoice_ref || null,
          category_name,
          amount: parseFloat(amount),
          notes: body.notes || null,
          receipt_url: null,
          ...extras,
        }));

      if (rows.length === 0) {
        return NextResponse.json({ error: 'No amounts > 0 provided' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('contractor_tax_records')
        .insert(rows)
        .select();

      if (error) {
        console.error('POST batch tax-records error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ records: data, count: data.length });
    }

    // Single record
    const { category_name, amount } = body;
    if (!category_name || amount == null) {
      return NextResponse.json(
        { error: 'category_name and amount are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('contractor_tax_records')
      .insert({
        user_id,
        tax_year: parseInt(tax_year, 10),
        entry_date,
        invoice_ref: body.invoice_ref || null,
        category_name,
        amount: parseFloat(amount),
        notes: body.notes || null,
        receipt_url: null,
        ...extras,
      })
      .select()
      .single();

    if (error) {
      console.error('POST tax-records error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ record: data });
  } catch (err) {
    console.error('POST tax-records exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
