import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OAuthClient from 'intuit-oauth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const realmId = searchParams.get('realmId');

    if (!code || !realmId) {
      return NextResponse.redirect(new URL('/settings?qb_error=missing_params', request.url));
    }

    const oauthClient = new OAuthClient({
      clientId: process.env.QUICKBOOKS_CLIENT_ID,
      clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET,
      environment: process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox',
      redirectUri: process.env.QUICKBOOKS_REDIRECT_URI
    });

    const authResponse = await oauthClient.createToken(code);
    const token = authResponse.getJson();

    // Save to database
    const { error } = await supabase
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

    return NextResponse.redirect(new URL('/settings?qb_success=true', request.url));
  } catch (error) {
    console.error('QuickBooks callback error:', error);
    return NextResponse.redirect(new URL('/settings?qb_error=callback_failed', request.url));
  }
}