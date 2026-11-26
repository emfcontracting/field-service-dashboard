// lib/contractorCustomers.js
// The subcontractor's saved customers (other clients than EMF): validation
// shared by the API routes, and the invoice/estimate client fields.
const clip = (v, n) => { const t = String(v ?? '').trim(); return t ? t.slice(0, n) : null; };
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** body → { row } | { error }   (partial: only fields present in body) */
export function cleanCustomer(body, partial = false) {
  const row = {};
  const set = (k, n) => { if (!partial || body[k] !== undefined) row[k] = clip(body[k], n); };
  set('name', 200); set('address', 300); set('city', 100); set('state', 20); set('zip', 20);
  set('email', 200); set('phone', 40); set('notes', 1000);
  if (!partial || body.hourly_rate !== undefined) {
    if (body.hourly_rate === '' || body.hourly_rate == null) row.hourly_rate = null;
    else {
      const r = parseFloat(body.hourly_rate);
      if (!Number.isFinite(r) || r < 0 || r > 1000) return { error: 'Hourly rate must be between 0 and 1000' };
      row.hourly_rate = Math.round(r * 100) / 100;
    }
  }
  if (body.archived !== undefined) row.archived = !!body.archived;
  if ((!partial || body.name !== undefined) && !row.name) return { error: 'Customer name required' };
  if (row.email && !EMAIL_RE.test(row.email)) return { error: 'E-mail looks invalid' };
  return { row };
}

/** A customer row → the client object invoices/estimates take. */
export const customerAsClient = (c) => ({
  name: c.name, address: c.address || '', city: c.city || '', state: c.state || '', zip: c.zip || '', email: c.email || '',
});
