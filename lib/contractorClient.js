// lib/contractorClient.js
// -----------------------------------------------------------------------------
// Browser helpers for the subcontractor portal (/contractor). Every read and
// write goes through /api/contractor/* with the app token — the portal no
// longer talks to Supabase directly, so the anon key cannot reach these tables.
// Each helper throws Error(message) on a non-2xx answer.
// -----------------------------------------------------------------------------
import { apiFetch } from './apiClient';

async function call(url, init) {
  const res = await apiFetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const contractorApi = {
  me: () => call('/api/contractor/me'),
  hours: (start, end) => call(`/api/contractor/hours?start=${encodeURIComponent(start)}${end ? `&end=${encodeURIComponent(end)}` : ''}`).then((d) => d.hours),
  /** → { hours, already_invoiced } — entries already on another invoice (warning only) */
  hoursChecked: (start, end) => call(`/api/contractor/hours?check=1&start=${encodeURIComponent(start)}${end ? `&end=${encodeURIComponent(end)}` : ''}`),
  invoices: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
    return call(`/api/contractor/invoices${qs ? `?${qs}` : ''}`);
  },
  createInvoice: (body) => call('/api/contractor/invoices', json('POST', body)).then((d) => d.invoice),
  invoice: (id) => call(`/api/contractor/invoices/${id}`),
  editInvoice: (id, body) => call(`/api/contractor/invoices/${id}`, json('PATCH', { action: 'edit', ...body })).then((d) => d.invoice),
  markInvoice: (id, action) => call(`/api/contractor/invoices/${id}`, json('PATCH', { action })).then((d) => d.invoice),
  deleteInvoice: (id) => call(`/api/contractor/invoices/${id}`, { method: 'DELETE' }),
  /** Upload a receipt (private bucket); scan=true also returns Claude's reading. → { path, scan } */
  uploadReceipt: async (file, { scan = false, categories = [] } = {}) => {
    const fd = new FormData();
    fd.append('file', file);
    if (scan) { fd.append('scan', '1'); fd.append('categories', JSON.stringify(categories)); }
    return call('/api/contractor/receipts', { method: 'POST', body: fd });
  },
  /** Short-lived link to view a receipt. Older records may still hold a full URL. */
  receiptLink: async (pathOrUrl) => {
    if (/^https?:/i.test(pathOrUrl || '')) return pathOrUrl;
    const d = await call(`/api/contractor/receipts?path=${encodeURIComponent(pathOrUrl)}`);
    return d.url;
  },
  trips: (year) => call(`/api/contractor/trips?year=${encodeURIComponent(year)}`),
  addTrip: (body) => call('/api/contractor/trips', json('POST', body)).then((d) => d.trip),
  deleteTrip: (id) => call(`/api/contractor/trips/${id}`, { method: 'DELETE' }),
  documents: () => call('/api/contractor/documents').then((d) => d.documents),
  uploadDocument: (file, { doc_type, title, expires_on }) => {
    const fd = new FormData();
    fd.append('file', file); fd.append('doc_type', doc_type);
    if (title) fd.append('title', title);
    if (expires_on) fd.append('expires_on', expires_on);
    return call('/api/contractor/documents', { method: 'POST', body: fd }).then((d) => d.document);
  },
  documentLink: (docId) => call(`/api/contractor/documents?doc_id=${encodeURIComponent(docId)}`).then((d) => d.url),
  deleteDocument: (docId) => call(`/api/contractor/documents/${docId}`, { method: 'DELETE' }),
  updateProfile: (body) => call('/api/contractor/profile', json('PATCH', body)).then((d) => d.profile),
  changePin: (currentPin, newPin) => call('/api/contractor/change-pin', json('POST', { currentPin, newPin })),
};

export default contractorApi;
