import { NextResponse } from 'next/server';
import OAuthClient from 'intuit-oauth';

export async function GET() {
  try {
    const oauthClient = new OAuthClient({
      clientId: process.env.QUICKBOOKS_CLIENT_ID,
      clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET,
      environment: process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox',
      redirectUri: process.env.QUICKBOOKS_REDIRECT_URI
    });

    const authUri = oauthClient.authorizeUri({
      scope: [OAuthClient.scopes.Accounting, OAuthClient.scopes.OpenId],
      state: 'testState'
    });

    return NextResponse.json({ authUri });
  } catch (error) {
    console.error('QuickBooks auth error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}