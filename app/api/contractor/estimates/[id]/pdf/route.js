// GET /api/contractor/estimates/[id]/pdf → the estimate as PDF (owner or staff)
import { NextResponse } from 'next/server';
import { requireContractorOrStaff, ownsUser, denyNotOwner, serviceClient } from '@/lib/serverAuth';
import { loadEstimate, buildEstimatePdf } from '@/lib/contractorEstimates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const data = await loadEstimate(serviceClient(), id);
    if (!data) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
    if (!ownsUser(auth, data.estimate.user_id)) return denyNotOwner().response;
    const pdf = await buildEstimatePdf(data);
    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${data.estimate.estimate_number}.pdf"`,
        'Content-Length': pdf.length.toString(),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to generate PDF: ' + e.message }, { status: 500 });
  }
}
