// app/api/contractor/tax-records/[id]/route.js
// ─────────────────────────────────────────────────────────────────────────────
// PATCH  /api/contractor/tax-records/{id}  → update a single record
// DELETE /api/contractor/tax-records/{id}  → delete a single record
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const update = {};
    if (body.entry_date    !== undefined) update.entry_date    = body.entry_date;
    if (body.invoice_ref   !== undefined) update.invoice_ref   = body.invoice_ref || null;
    if (body.category_name !== undefined) update.category_name = body.category_name;
    if (body.amount        !== undefined) update.amount        = parseFloat(body.amount);
    if (body.notes         !== undefined) update.notes         = body.notes || null;
    if (body.receipt_url   !== undefined) update.receipt_url   = body.receipt_url || null;
    if (body.tax_year      !== undefined) update.tax_year      = parseInt(body.tax_year, 10);

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('contractor_tax_records')
      .update(update)
      .eq('record_id', id)
      .select()
      .single();

    if (error) {
      console.error('PATCH tax-records error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ record: data });
  } catch (err) {
    console.error('PATCH tax-records exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    const { error } = await supabase
      .from('contractor_tax_records')
      .delete()
      .eq('record_id', id);

    if (error) {
      console.error('DELETE tax-records error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error('DELETE tax-records exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
