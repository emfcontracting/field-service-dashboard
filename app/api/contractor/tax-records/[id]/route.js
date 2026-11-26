// app/api/contractor/tax-records/[id]/route.js
// ─────────────────────────────────────────────────────────────────────────────
// PATCH  /api/contractor/tax-records/{id}  → update a single record
// DELETE /api/contractor/tax-records/{id}  → delete a single record
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { requireContractorOrStaff, ownsUser, denyNotOwner, serviceClient } from '@/lib/serverAuth';
import { expenseExtras, resolveWoNumber } from '@/lib/expenseFields';

// Service role: these tables are RLS-locked (staff_all only); the route
// itself checks who may see which row.
const supabase = serviceClient();

export async function PATCH(request, { params }) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const body = await request.json();
    const { data: existing } = await supabase.from('contractor_tax_records').select('user_id, billed_invoice_id, amount, bill_to_emf, source').eq('record_id', id).maybeSingle();
    if (!existing) return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    if (!ownsUser(auth, existing.user_id)) return denyNotOwner().response;

    const update = {};
    if (body.entry_date    !== undefined) update.entry_date    = body.entry_date;
    if (body.invoice_ref   !== undefined) update.invoice_ref   = body.invoice_ref || null;
    if (body.category_name !== undefined) update.category_name = body.category_name;
    if (body.amount        !== undefined) update.amount        = parseFloat(body.amount);
    if (body.notes         !== undefined) update.notes         = body.notes || null;
    const extras = expenseExtras(body, existing.user_id);
    if (extras.__badReceipt) return NextResponse.json({ error: 'Invalid receipt reference' }, { status: 400 });
    Object.assign(update, extras);
    const wo = await resolveWoNumber(supabase, body);
    if (wo.error) return NextResponse.json({ error: wo.error }, { status: 400 });
    Object.assign(update, wo);
    // Already on an EMF invoice: amount and billing flag are fixed there.
    const amountChanged = update.amount !== undefined && Math.abs(update.amount - parseFloat(existing.amount || 0)) > 0.004;
    const flagChanged = update.bill_to_emf !== undefined && update.bill_to_emf !== !!existing.bill_to_emf;
    if (existing.billed_invoice_id && (amountChanged || flagChanged)) {
      return NextResponse.json({ error: 'This expense is already on an EMF invoice — change it there (or delete that line from the draft first).' }, { status: 409 });
    }
    if (body.tax_year      !== undefined) update.tax_year      = parseInt(body.tax_year, 10);

    // A generated entry (material / mileage / hotel) the sub changes is his
    // from now on: the automatic sync never overwrites it again.
    if (existing.source && existing.source !== 'manual') update.edited = true;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('contractor_tax_records')
      .update(update)
      .eq('record_id', id)
      .select()
      .single();

    if (error) {
      console.error('PATCH tax-records error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ record: data });
  } catch (err) {
    console.error('PATCH tax-records exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const { data: existing } = await supabase.from('contractor_tax_records').select('user_id, source').eq('record_id', id).maybeSingle();
    if (!existing) return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    if (!ownsUser(auth, existing.user_id)) return denyNotOwner().response;

    // Generated entries are only hidden (dismissed) so the sync does not
    // bring them back; manual entries are deleted.
    const { error } = existing.source && existing.source !== 'manual'
      ? await supabase.from('contractor_tax_records').update({ dismissed: true }).eq('record_id', id)
      : await supabase.from('contractor_tax_records').delete().eq('record_id', id);

    if (error) {
      console.error('DELETE tax-records error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error('DELETE tax-records exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
