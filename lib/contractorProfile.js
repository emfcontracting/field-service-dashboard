// lib/contractorProfile.js
// -----------------------------------------------------------------------------
// What of a subcontractor_profiles row may reach the browser.
// Never: pin_hash, anything token/secret-like, the full tax_id.
// -----------------------------------------------------------------------------
export function maskTaxId(taxId) {
  const s = String(taxId || '').trim();
  if (!s) return '';
  const digits = s.replace(/\D/g, '');
  const last4 = digits.slice(-4) || s.slice(-4);
  return `***-**-${last4}`;
}

export function isMaskedTaxId(v) {
  return typeof v === 'string' && v.includes('*');
}

export function publicProfile(profile) {
  if (!profile) return null;
  const out = {};
  for (const k of Object.keys(profile)) {
    if (k === 'pin_hash' || k === 'tax_id') continue;
    if (/secret|token|api_key/i.test(k)) continue;
    out[k] = profile[k];
  }
  out.has_pin = !!profile.pin_hash;
  out.tax_id_masked = maskTaxId(profile.tax_id);
  return out;
}

/** Rates the invoice is computed with — always from the stored profile. */
export function profileRates(profile) {
  return {
    hourly: parseFloat(profile?.hourly_rate ?? 35) || 0,
    ot: parseFloat(profile?.ot_rate ?? 52.5) || 0,
    mileage: parseFloat(profile?.mileage_rate ?? 0.67) || 0,
  };
}

/**
 * Whose rows a request acts on. A contractor: always their own user_id,
 * whatever the request says. Staff: the user_id they asked for.
 */
export function targetUserId(auth, requested) {
  const p = auth?.principal;
  if (p?.contractor) return p.user.user_id;
  return requested || null;
}
