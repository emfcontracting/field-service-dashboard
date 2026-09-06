// lib/quickbooks.js
// -----------------------------------------------------------------------------
// One QuickBooks token helper for every server route (was copied into
// pull-payments and push-invoice). Adds the needs_reconnect state: when Intuit
// rejects the refresh token (expired after ~100 days, revoked, app
// disconnected) the active row is flagged, the failure is written to
// cron_runs, and the dashboard shows a "Reconnect QuickBooks" banner instead
// of a generic 500. A successful OAuth callback clears the flag.
// -----------------------------------------------------------------------------
import OAuthClient from 'intuit-oauth';
import { recordRun } from './cronRun';

export const QB_BASE = () =>
  (process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox') === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';

export class QuickBooksNotConnected extends Error {
  constructor(message = 'QuickBooks not connected', { needsReconnect = false } = {}) {
    super(message);
    this.name = 'QuickBooksNotConnected';
    this.needsReconnect = needsReconnect;
    this.status = 409;
  }
}

/**
 * Returns { accessToken, realmId } for the active connection, refreshing the
 * access token when it is within 5 minutes of expiry. Access tokens last ~1 h;
 * refresh tokens ~100 days and rotate on every refresh.
 * `supabase` must be a service-role client.
 */
export async function getQbAccessToken(supabase) {
  const { data: settings } = await supabase
    .from('quickbooks_settings')
    .select('*')
    .eq('is_active', true)
    .single();
  if (!settings) throw new QuickBooksNotConnected();
  if (settings.needs_reconnect) {
    throw new QuickBooksNotConnected(
      `QuickBooks needs to be reconnected (${settings.last_error || 'refresh token rejected'})`,
      { needsReconnect: true }
    );
  }

  const expiresAt = new Date(settings.token_expires_at || 0);
  if (expiresAt.getTime() - Date.now() > 5 * 60 * 1000) {
    return { accessToken: settings.access_token, realmId: settings.realm_id };
  }

  const oauthClient = new OAuthClient({
    clientId: process.env.QUICKBOOKS_CLIENT_ID,
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET,
    environment: process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox',
    redirectUri: process.env.QUICKBOOKS_REDIRECT_URI,
  });

  const startedAt = new Date();
  let token;
  try {
    const authResponse = await oauthClient.refreshUsingToken(settings.refresh_token);
    token = authResponse.getJson();
  } catch (e) {
    const detail = describeIntuitError(e);
    // invalid_grant = refresh token expired/revoked → only a human can fix it.
    const fatal = /invalid_grant|invalid_client|unauthorized_client/i.test(detail);
    if (fatal) {
      await supabase
        .from('quickbooks_settings')
        .update({ needs_reconnect: true, last_error: detail.slice(0, 500), last_error_at: new Date().toISOString() })
        .eq('is_active', true);
    } else {
      await supabase
        .from('quickbooks_settings')
        .update({ last_error: detail.slice(0, 500), last_error_at: new Date().toISOString() })
        .eq('is_active', true);
    }
    await recordRun({ job: 'quickbooks/token-refresh', trigger: 'auto', status: 'error', started_at: startedAt.toISOString(), duration_ms: Date.now() - startedAt, error: detail });
    throw new QuickBooksNotConnected(`QuickBooks token refresh failed: ${detail}`, { needsReconnect: fatal });
  }

  await supabase
    .from('quickbooks_settings')
    .update({
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      needs_reconnect: false,
      last_error: null,
      last_error_at: null,
    })
    .eq('is_active', true);
  await recordRun({ job: 'quickbooks/token-refresh', trigger: 'auto', status: 'ok', started_at: startedAt.toISOString(), duration_ms: Date.now() - startedAt, summary: { realm_id: settings.realm_id, expires_in: token.expires_in } });
  return { accessToken: token.access_token, realmId: settings.realm_id };
}

function describeIntuitError(e) {
  // intuit-oauth throws Error objects with the raw response on .authResponse / .intuit_tid
  const parts = [e?.message];
  const body = e?.authResponse?.body || e?.authResponse?.json;
  if (body) parts.push(typeof body === 'string' ? body : JSON.stringify(body));
  if (e?.intuit_tid) parts.push(`intuit_tid=${e.intuit_tid}`);
  return parts.filter(Boolean).join(' | ').slice(0, 800);
}

/** Response payload for routes when QuickBooks is not usable. */
export function qbErrorResponse(e) {
  if (e instanceof QuickBooksNotConnected) {
    return { status: 409, body: { error: e.message, code: e.needsReconnect ? 'qb_needs_reconnect' : 'qb_not_connected', needs_reconnect: e.needsReconnect } };
  }
  return null;
}
