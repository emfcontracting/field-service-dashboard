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
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const year   = searchParams.get('year');

    if (!userId || !year) {
      return NextResponse.json({ error: 'user_id and year are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('contractor_tax_records')
      .select('*')
      .eq('user_id', userId)
      .eq('tax_year', parseInt(year, 10))
      .order('entry_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('GET tax-records error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ records: data || [] });
  } catch (err) {
    console.error('GET tax-records exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { user_id, tax_year, entry_date } = body;

    if (!user_id || !tax_year || !entry_date) {
      return NextResponse.json(
        { error: 'user_id, tax_year, and entry_date are required' },
        { status: 400 }
      );
    }

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
          receipt_url: body.receipt_url || null,
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
        receipt_url: body.receipt_url || null,
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
