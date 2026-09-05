import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OAuthClient from 'intuit-oauth';

// Lazy initialization to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const realmId = searchParams.get('realmId');
    const state = searchParams.get('state');

    if (!code || !realmId) {
      return NextResponse.redirect(new URL('/settings/quickbooks?qb_error=missing_params', request.url));
    }

    // CSRF protection: state must match the value we set when starting the flow
    const expectedState = request.cookies.get('qb_oauth_state')?.value;
    if (!expectedState || state !== expectedState) {
      return NextResponse.redirect(new URL('/settings/quickbooks?qb_error=state_mismatch', request.url));
    }

    const oauthClient = new OAuthClient({
      clientId: process.env.QUICKBOOKS_CLIENT_ID,
      clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET,
      environment: process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox',
      redirectUri: process.env.QUICKBOOKS_REDIRECT_URI
    });

    // intuit-oauth expects the FULL redirect URL (it parses code/state itself)
    const authResponse = await oauthClient.createToken(request.url);
    const token = authResponse.getJson();

    // Save to database
    const { error } = await getSupabase()
      .from('quickbooks_settings')
      .upsert({
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        realm_id: realmId,
        token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
        connected_at: new Date().toISOString(),
        is_active: true
      });

    if (error) throw error;

    const res = NextResponse.redirect(new URL('/settings/quickbooks?qb_success=true', request.url));
    res.cookies.set('qb_oauth_state', '', { path: '/', maxAge: 0 });
    return res;
  } catch (error) {
    console.error('QuickBooks callback error:', error);
    return NextResponse.redirect(new URL('/settings/quickbooks?qb_error=callback_failed', request.url));
  }
}