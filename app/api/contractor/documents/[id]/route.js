// DELETE /api/contractor/documents/[id] → removes the document and its file
import { NextResponse } from 'next/server';
import { requireContractorOrStaff, serviceClient, ownsUser, denyNotOwner } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function DELETE(request, { params }) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const supabase = serviceClient();
  const { data: doc } = await supabase.from('contractor_documents').select('user_id, file_path').eq('doc_id', id).maybeSingle();
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  if (!ownsUser(auth, doc.user_id)) return denyNotOwner().response;
  const { error } = await supabase.from('contractor_documents').delete().eq('doc_id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.storage.from('contractor-docs').remove([doc.file_path]);
  return NextResponse.json({ ok: true });
}
