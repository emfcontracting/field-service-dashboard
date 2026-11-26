// app/api/contractor/receipts/route.js
// -----------------------------------------------------------------------------
// Receipts in the PRIVATE bucket tax-receipts, path <user_id>/<file>.
// POST multipart { file, scan?: '1', categories?: JSON }
//      → { path, scan? }   upload (service role); with scan=1 also the
//                           Claude reading of the receipt (lib/receiptScan)
// GET  ?path=<user_id>/<file> → { url }  signed link, 5 minutes
// A contractor only reaches his own folder; staff any.
// -----------------------------------------------------------------------------
import { NextResponse } from 'next/server';
import { requireContractorOrStaff, serviceClient } from '@/lib/serverAuth';
import { scanReceipt } from '@/lib/receiptScan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BUCKET = 'tax-receipts';
const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf' };

function ownsPath(auth, path) {
  const p = auth.principal;
  if (!p.contractor) return true; // staff
  return typeof path === 'string' && path.startsWith(`${p.user.user_id}/`) && !path.includes('..');
}

export async function GET(request) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const path = new URL(request.url).searchParams.get('path') || '';
  if (!path || /^https?:/i.test(path)) return NextResponse.json({ error: 'path required' }, { status: 400 });
  if (!ownsPath(auth, path)) return NextResponse.json({ error: 'Not your receipt' }, { status: 403 });
  const { data, error } = await serviceClient().storage.from(BUCKET).createSignedUrl(path, 300);
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ url: data.signedUrl });
}

export async function POST(request) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const p = auth.principal;
  if (!p.contractor) return NextResponse.json({ error: 'Only subcontractors upload receipts' }, { status: 403 });

  let form;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: 'Invalid upload' }, { status: 400 }); }
  const file = form.get('file');
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'No file' }, { status: 400 });
  const type = file.type || 'application/octet-stream';
  const ext = TYPES[type];
  if (!ext) return NextResponse.json({ error: 'Only photos (JPG, PNG, WEBP) or PDF' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 4 MB)' }, { status: 413 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const path = `${p.user.user_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await serviceClient().storage.from(BUCKET).upload(path, bytes, { contentType: type, upsert: false });
  if (error) return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 500 });

  let scan = null;
  if (form.get('scan') === '1') {
    let categories = [];
    try { categories = JSON.parse(form.get('categories') || '[]').filter((c) => typeof c === 'string').slice(0, 80); } catch { /* none */ }
    try {
      scan = await scanReceipt({ base64: bytes.toString('base64'), mediaType: type, categories });
    } catch (e) {
      console.error('receipt scan failed:', e?.message);
      scan = { error: 'Could not read the receipt — please fill in the fields.' };
    }
  }
  return NextResponse.json({ path, scan });
}
