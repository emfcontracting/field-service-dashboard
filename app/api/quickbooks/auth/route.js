import { NextResponse } from 'next/server';
import crypto from 'crypto';
import OAuthClient from 'intuit-oauth';

export async function GET() {
  try {
    const oauthClient = new OAuthClient({
      clientId: process.env.QUICKBOOKS_CLIENT_ID,
      clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET,
      environment: process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox',
      redirectUri: process.env.QUICKBOOKS_REDIRECT_URI
    });

    // Random state for CSRF protection — validated in the callback
    const state = crypto.randomBytes(24).toString('hex');

    const authUri = oauthClient.authorizeUri({
      scope: [OAuthClient.scopes.Accounting, OAuthClient.scopes.OpenId],
      state
    });

    const res = NextResponse.json({ authUri });
    res.cookies.set('qb_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 600
    });
    return res;
  } catch (error) {
    console.error('QuickBooks auth error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
