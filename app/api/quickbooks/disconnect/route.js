import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/serverAuth';

// Lazy initialization to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { error } = await getSupabase()
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
