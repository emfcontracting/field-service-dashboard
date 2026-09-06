// app/api/invoices/qb-pdf/route.js
// GET /api/invoices/qb-pdf?invoice_id=<uuid>   (office/admin session required)
//
// The QuickBooks invoice PDFs live in the PRIVATE storage bucket
// `invoice-pdfs`. This route hands a signed, short-lived download URL to a
// signed-in office user — nothing in that bucket is reachable without login.
import { NextResponse } from 'next/server';
import { requireStaff, serviceClient } from '@/lib/serverAuth';

const PDF_BUCKET = 'invoice-pdfs';
const TTL_SECONDS = 15 * 60;

function storagePathFor(invoice) {
  const url = invoice.qb_pdf_url || '';
  const marker = `/${PDF_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i >= 0) {
    const rest = url.slice(i + marker.length).split('?')[0];
    if (rest && !rest.startsWith('http')) return decodeURIComponent(rest);
  }
  if (url && !url.startsWith('http') && !url.startsWith('/')) return url; // plain storage path
  if (invoice.invoice_number && invoice.qb_invoice_number) {
    return `${invoice.invoice_number}-QB${invoice.qb_invoice_number}.pdf`;
  }
  return null;
}

export async function GET(request) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const invoiceId = new URL(request.url).searchParams.get('invoice_id');
  if (!invoiceId) return NextResponse.json({ error: 'invoice_id required' }, { status: 400 });

  const supabase = serviceClient();
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('invoice_id, invoice_number, qb_invoice_number, qb_pdf_url')
    .eq('invoice_id', invoiceId)
    .maybeSingle();
  if (error || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

  const path = storagePathFor(invoice);
  if (!path) return NextResponse.json({ error: 'No QuickBooks PDF stored for this invoice' }, { status: 404 });

  const { data, error: signErr } = await supabase.storage.from(PDF_BUCKET).createSignedUrl(path, TTL_SECONDS, {
    download: path,
  });
  if (signErr || !data?.signedUrl) {
    return NextResponse.json({ error: signErr?.message || 'Could not sign PDF URL' }, { status: 500 });
  }
  return NextResponse.json({ url: data.signedUrl, path, expiresIn: TTL_SECONDS });
}
