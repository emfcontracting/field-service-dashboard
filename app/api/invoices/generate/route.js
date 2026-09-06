import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getFixedQuoteForInvoice, buildFixedQuoteLineItems } from '@/app/mobile/services/quoteService';
import { calcBillable, buildActualLineItems, round2 } from '@/lib/billing';
import { billableComments } from '@/lib/commentsSplit';
import { requireStaff } from '@/lib/serverAuth';

// Rates and the cost formula live in lib/billing.js.


export async function POST(request) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;
  const supabase = createRouteHandlerClient({ cookies });
  
  try {
    const { wo_id } = await request.json();

    if (!wo_id) {
      return NextResponse.json(
        { success: false, error: 'Work order ID is required' },
        { status: 400 }
      );
    }

    // Get work order details
    const { data: workOrder, error: woError } = await supabase
      .from('work_orders')
      .select('*')
      .eq('wo_id', wo_id)
      .single();

    if (woError || !workOrder) {
      return NextResponse.json(
        { success: false, error: 'Work order not found' },
        { status: 404 }
      );
    }

    // Check if work order is completed and acknowledged
    if (workOrder.status !== 'completed') {
      return NextResponse.json(
        { success: false, error: 'Work order must be completed before generating invoice' },
        { status: 400 }
      );
    }

    if (!workOrder.acknowledged) {
      return NextResponse.json(
        { success: false, error: 'Work order must be acknowledged before generating invoice' },
        { status: 400 }
      );
    }

    // Check if invoice already exists
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('invoice_id')
      .eq('wo_id', wo_id)
      .single();

    if (existingInvoice) {
      return NextResponse.json(
        { success: false, error: 'Invoice already exists for this work order' },
        { status: 400 }
      );
    }

    // Billing mode: is there a fixed-price quote driving this invoice?
    // (newest non-rejected quote with billing_mode = 'fixed')
    const fixedQuote = await getFixedQuoteForInvoice(supabase, wo_id);

    // ============================================================
    // Cost calculation — lib/billing.js (one formula for preview, generator,
    // table, CBRE data entry and exports). Hours = legacy WO fields + team
    // assignments + daily_hours_log; admin hours per client policy.
    // ============================================================
    const [{ data: teamAssignments }, { data: dailyLogs }] = await Promise.all([
      supabase.from('work_order_assignments').select('hours_regular, hours_overtime, miles').eq('wo_id', wo_id),
      supabase.from('daily_hours_log').select('hours_regular, hours_overtime, miles, tech_material_cost').eq('wo_id', wo_id),
    ]);
    const calc = calcBillable(workOrder, { assignments: teamAssignments || [], dailyLogs: dailyLogs || [] });

    // ── Billing mode: FIXED quote vs ACTUAL (T&M) ──
    // Fixed  -> line items come straight from the quote and sum to new_nte_amount.
    // Actual -> the computed cost lines.
    const fixedLineItems = fixedQuote ? buildFixedQuoteLineItems(fixedQuote) : null;
    const actualLineItems = buildActualLineItems(calc);
    const subtotal = fixedLineItems
      ? round2(fixedLineItems.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0))
      : round2(calc.subtotal);
    const tax      = 0;
    const total    = subtotal + tax;

    // Work Performed text — human-written comments only (tech_comments; older
    // work orders fall back to the human part of the legacy comments log).
    const workPerformedDescription =
      billableComments(workOrder) ||
      workOrder.work_order_description ||
      'Work completed as requested.';

    // ============================================================
    // Invoice numbering
    // ============================================================
    const year = new Date().getFullYear();
    const { data: lastInvoice } = await supabase
      .from('invoices')
      .select('invoice_number')
      .like('invoice_number', `INV-${year}-%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let invoiceNumber;
    if (lastInvoice) {
      const lastNumber = parseInt(lastInvoice.invoice_number.split('-')[2]);
      invoiceNumber = `INV-${year}-${String(lastNumber + 1).padStart(5, '0')}`;
    } else {
      invoiceNumber = `INV-${year}-00001`;
    }

    // ============================================================
    // Create invoice
    // ============================================================
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        wo_id: wo_id,
        invoice_date: new Date().toISOString(),
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        subtotal: subtotal,
        tax: tax,
        total: total,
        status: 'draft',
        notes: 'Auto-generated invoice'
      })
      .select()
      .single();

    if (invoiceError) {
      console.error('Error creating invoice:', invoiceError);
      return NextResponse.json(
        { success: false, error: 'Failed to create invoice: ' + invoiceError.message },
        { status: 500 }
      );
    }

    // ============================================================
    // Build invoice line items (matches /app/invoices/page.js format)
    // ============================================================
    const lineItems = [];

    if (fixedLineItems) {
      // FIXED billing: line items straight from the approved quote
      fixedLineItems.forEach(it => {
        lineItems.push({
          invoice_id: invoice.invoice_id,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          amount: it.amount,
          line_type: it.line_type
        });
      });
    } else {
      // ACTUAL (T&M): the computed cost lines, same wording as the preview.
      actualLineItems.forEach(it => lineItems.push({ invoice_id: invoice.invoice_id, ...it }));
    }

    // Work Performed Description (always last)
    lineItems.push({
      invoice_id: invoice.invoice_id,
      description: workPerformedDescription,
      quantity: 1,
      unit_price: 0,
      amount: 0,
      line_type: 'description'
    });

    // Insert all line items
    const { error: lineItemsError } = await supabase
      .from('invoice_line_items')
      .insert(lineItems);

    if (lineItemsError) {
      console.error('Error creating line items:', lineItemsError);
      // Rollback invoice creation
      await supabase.from('invoices').delete().eq('invoice_id', invoice.invoice_id);
      return NextResponse.json(
        { success: false, error: 'Failed to create invoice line items: ' + lineItemsError.message },
        { status: 500 }
      );
    }

    // ============================================================
    // Lock the work order
    // ============================================================
    const { error: lockError } = await supabase
      .from('work_orders')
      .update({
        is_locked: true,
        locked_at: new Date().toISOString(),
        locked_by: null
      })
      .eq('wo_id', wo_id);

    if (lockError) {
      console.error('Error locking work order:', lockError);
      
      // Rollback the invoice if lock fails
      await supabase.from('invoice_line_items').delete().eq('invoice_id', invoice.invoice_id);
      await supabase.from('invoices').delete().eq('invoice_id', invoice.invoice_id);
      
      return NextResponse.json(
        { success: false, error: 'Failed to lock work order: ' + lockError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      invoice_id: invoice.invoice_id,
      invoice_number: invoiceNumber,
      total: total
    });

  } catch (error) {
    console.error('Invoice generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}
