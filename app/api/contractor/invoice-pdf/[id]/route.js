import { NextResponse } from 'next/server';
import { requireContractorOrStaff, ownsUser, denyNotOwner, serviceClient } from '@/lib/serverAuth';
import { loadSubInvoiceForPdf, buildSubInvoicePdf } from '@/lib/subInvoicePdf';

// Force Node.js runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/contractor/invoice-pdf/[id] → the invoice as PDF (owner or staff).
// The drawing itself lives in lib/subInvoicePdf (shared with the submit mail).
export async function GET(request, { params }) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  try {
    const data = await loadSubInvoiceForPdf(serviceClient(), id);
    if (!data) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    if (!ownsUser(auth, data.invoice.user_id)) return denyNotOwner().response;

    const pdfBytes = await buildSubInvoicePdf(data);
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${data.invoice.invoice_number}.pdf"`,
        'Content-Length': pdfBytes.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json({ error: 'Failed to generate PDF: ' + error.message }, { status: 500 });
  }
}
