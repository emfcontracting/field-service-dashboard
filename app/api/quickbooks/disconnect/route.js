import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST() {
  try {
    const { error } = await supabase
      .from('quickbooks_settings')
      .update({ is_active: false })
      .eq('is_active', true);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('QuickBooks disconnect error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
