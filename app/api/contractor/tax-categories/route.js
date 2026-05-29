// app/api/contractor/tax-categories/route.js
// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/contractor/tax-categories?user_id=X  → list user's custom categories
// POST /api/contractor/tax-categories            → create a custom category
//   body: { user_id, category_name, color_hex?, display_order? }
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

    if (!userId) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('contractor_tax_categories')
      .select('*')
      .eq('user_id', userId)
      .order('display_order', { ascending: true })
      .order('category_name', { ascending: true });

    if (error) {
      console.error('GET tax-categories error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ categories: data || [] });
  } catch (err) {
    console.error('GET tax-categories exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { user_id, category_name } = body;

    if (!user_id || !category_name) {
      return NextResponse.json(
        { error: 'user_id and category_name are required' },
        { status: 400 }
      );
    }

    const trimmedName = String(category_name).trim();
    if (!trimmedName) {
      return NextResponse.json({ error: 'category_name cannot be empty' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('contractor_tax_categories')
      .insert({
        user_id,
        category_name: trimmedName,
        color_hex: body.color_hex || '#9CA3AF',
        display_order: body.display_order != null ? parseInt(body.display_order, 10) : 999,
      })
      .select()
      .single();

    if (error) {
      // Unique constraint violation (already exists)
      if (error.code === '23505') {
        return NextResponse.json(
          { error: `Category "${trimmedName}" already exists` },
          { status: 409 }
        );
      }
      console.error('POST tax-categories error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ category: data });
  } catch (err) {
    console.error('POST tax-categories exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
