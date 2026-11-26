// app/api/contractor/documents/route.js
// -----------------------------------------------------------------------------
// Subcontractor documents in the PRIVATE bucket contractor-docs.
// GET  [?user_id=] → { documents }       (contractor: own; staff: user_id)
// GET  ?doc_id=X   → { url }              signed link, 5 minutes
// POST multipart { file, doc_type, title?, expires_on? } → { document }
// -----------------------------------------------------------------------------
import { NextResponse } from 'next/server';
import { requireContractorOrStaff, serviceClient, ownsUser, denyNotOwner } from '@/lib/serverAuth';
import { targetUserId } from '@/lib/contractorProfile';
import { DOC_TYPES } from '@/lib/contractorDocs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'contractor-docs';
const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const supabase = serviceClient();

  const docId = searchParams.get('doc_id');
  if (docId) {
    const { data: doc } = await supabase.from('contractor_documents').select('user_id, file_path').eq('doc_id', docId).maybeSingle();
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    if (!ownsUser(auth, doc.user_id)) return denyNotOwner().response;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.file_path, 300);
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ url: data.signedUrl });
  }

  const userId = targetUserId(auth, searchParams.get('user_id'));
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 });
  const { data, error } = await supabase.from('contractor_documents')
    .select('doc_id, user_id, doc_type, title, expires_on, uploaded_at').eq('user_id', userId).order('uploaded_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data || [] });
}

export async function POST(request) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const p = auth.principal;
  if (!p.contractor) return NextResponse.json({ error: 'Only subcontractors upload their documents' }, { status: 403 });

  let form;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: 'Invalid upload' }, { status: 400 }); }
  const file = form.get('file');
  const docType = String(form.get('doc_type') || '');
  const expires = String(form.get('expires_on') || '');
  const title = String(form.get('title') || '').trim().slice(0, 200) || null;
  const def = DOC_TYPES.find((t) => t.key === docType);
  if (!def) return NextResponse.json({ error: 'Unknown document type' }, { status: 400 });
  if (expires && !DAY.test(expires)) return NextResponse.json({ error: 'Expiry date must be YYYY-MM-DD' }, { status: 400 });
  if (def.needsExpiry && !expires) return NextResponse.json({ error: `${def.label}: expiry date required` }, { status: 400 });
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'No file' }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: 'PDF or photo (JPG, PNG, WEBP) only' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 4 MB)' }, { status: 413 });

  const supabase = serviceClient();
  const path = `${p.user.user_id}/${docType}-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (upErr) return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });

  const { data, error } = await supabase.from('contractor_documents').insert({
    user_id: p.user.user_id, doc_type: docType, title, file_path: path, expires_on: expires || null,
  }).select('doc_id, user_id, doc_type, title, expires_on, uploaded_at').single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ document: data });
}
