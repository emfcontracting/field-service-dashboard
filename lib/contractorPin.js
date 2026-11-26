// lib/contractorPin.js
// -----------------------------------------------------------------------------
// Subcontractor portal PINs (subcontractor_profiles.pin_hash).
//
// Stored as  scrypt$<salt b64>$<hash b64>  (Node crypto, no dependency).
// Older rows hold btoa(pin) — plain Base64, readable by anyone who can read
// the column. verifyPin still accepts that form and reports needsRehash so the
// login route upgrades it in place on the next successful sign-in.
// Server-side only.
// -----------------------------------------------------------------------------
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';

const PREFIX = 'scrypt$';
const KEYLEN = 32;

export function hashPin(pin) {
  const salt = randomBytes(16);
  const hash = scryptSync(String(pin), salt, KEYLEN);
  return `${PREFIX}${salt.toString('base64')}$${hash.toString('base64')}`;
}

/** → { ok: boolean, needsRehash: boolean } */
export function verifyPin(pin, stored) {
  if (!stored || pin == null) return { ok: false, needsRehash: false };
  const p = String(pin);
  if (stored.startsWith(PREFIX)) {
    const [, saltB64, hashB64] = stored.split('$');
    if (!saltB64 || !hashB64) return { ok: false, needsRehash: false };
    const expected = Buffer.from(hashB64, 'base64');
    const actual = scryptSync(p, Buffer.from(saltB64, 'base64'), expected.length || KEYLEN);
    const ok = expected.length === actual.length && timingSafeEqual(expected, actual);
    return { ok, needsRehash: false };
  }
  // Legacy: btoa(pin)
  const legacy = Buffer.from(p, 'utf8').toString('base64');
  const a = Buffer.from(legacy);
  const b = Buffer.from(String(stored));
  const ok = a.length === b.length && timingSafeEqual(a, b);
  return { ok, needsRehash: ok };
}

export function validPinFormat(pin) {
  return /^\d{4,8}$/.test(String(pin || ''));
}
