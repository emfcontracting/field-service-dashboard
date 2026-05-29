// app/api/contractor/tax-categories/[id]/route.js
// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/contractor/tax-categories/{id}  → delete a custom category
// PATCH  /api/contractor/tax-categories/{id}  → rename or recolor
//
// NOTE: Deleting a category does NOT delete the records that used it
// (the records keep the category_name string). That's by design — historical
// data should remain intact even if the category itself is removed.
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
    if (body.category_name !== undefined) update.category_name = String(body.category_name).trim();
    if (body.color_hex     !== undefined) update.color_hex     = body.color_hex;
    if (body.display_order !== undefined) update.display_order = parseInt(body.display_order, 10);

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('contractor_tax_categories')
      .update(update)
      .eq('category_id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Category name already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ category: data });
  } catch (err) {
    console.error('PATCH tax-categories exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    const { error } = await supabase
      .from('contractor_tax_categories')
      .delete()
      .eq('category_id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error('DELETE tax-categories exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
