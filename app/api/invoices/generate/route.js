import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getFixedQuoteForInvoice, buildFixedQuoteLineItems } from '@/app/mobile/services/quoteService';

// Rate constants - MUST match CostSummarySection / Invoicing page logic
const RT_RATE       = 64;
const OT_RATE       = 96;
const MILEAGE_RATE  = 1.00;
const MARKUP        = 1.25;          // 25% markup on materials/equipment/rental/trailer
const ADMIN_HOURS   = 2;             // 2 admin hours @ RT_RATE
const ADMIN_FEE     = ADMIN_HOURS * RT_RATE; // = $128

// Filter check-in/out lines from comments (mirrors /app/invoices/page.js)
function filterWorkComments(comments) {
  if (!comments) return '';
  const lines = comments.split('\n').filter(line => {
    const t = line.trim();
    if (!t) return true;
    if (/- ✓ CHECKED IN$/i.test(t))       return false;
    if (/- ✓ ENTRADA$/i.test(t))           return false;
    if (/- ⏸ CHECKED OUT$/i.test(t))       return false;
    if (/- ⏸ SALIDA$/i.test(t))            return false;
    if (/- ✅ MARKED COMPLETE$/i.test(t))  return false;
    if (/- ✅ MARCADO COMPLETO$/i.test(t)) return false;
    return true;
  });
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export async function POST(request) {
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
    // COMBINED hours calculation: legacy + team assignments + daily_hours_log
    // (matches /app/invoices/page.js generateInvoicePreview EXACTLY)
    // ============================================================
    const primaryRT    = parseFloat(workOrder.hours_regular)  || 0;
    const primaryOT    = parseFloat(workOrder.hours_overtime) || 0;
    const primaryMiles = parseFloat(workOrder.miles)          || 0;

    // Legacy team member assignments
    const { data: teamAssignments } = await supabase
      .from('work_order_assignments')
      .select('hours_regular, hours_overtime, miles')
      .eq('wo_id', wo_id);

    let teamRT = 0, teamOT = 0, teamMiles = 0;
    if (teamAssignments) {
      teamAssignments.forEach(m => {
        teamRT    += parseFloat(m.hours_regular)  || 0;
        teamOT    += parseFloat(m.hours_overtime) || 0;
        teamMiles += parseFloat(m.miles)          || 0;
      });
    }

    // Daily hours logs (this is where MOST hours live now)
    const { data: dailyLogs } = await supabase
      .from('daily_hours_log')
      .select('hours_regular, hours_overtime, miles, tech_material_cost')
      .eq('wo_id', wo_id);

    let dailyRT = 0, dailyOT = 0, dailyMiles = 0, dailyTechMaterial = 0;
    if (dailyLogs) {
      dailyLogs.forEach(l => {
        dailyRT           += parseFloat(l.hours_regular)      || 0;
        dailyOT           += parseFloat(l.hours_overtime)     || 0;
        dailyMiles        += parseFloat(l.miles)              || 0;
        dailyTechMaterial += parseFloat(l.tech_material_cost) || 0;
      });
    }

    // COMBINED totals = primary + team + daily
    const totalRT    = primaryRT    + teamRT    + dailyRT;
    const totalOT    = primaryOT    + teamOT    + dailyOT;
    const totalMiles = primaryMiles + teamMiles + dailyMiles;

    // Material totals (EMF + Tech) with 25% markup
    const emfMaterialBase   = parseFloat(workOrder.material_cost)      || 0;
    const techMaterialBase  = dailyTechMaterial;
    const totalMaterialBase = emfMaterialBase + techMaterialBase;
    const materialsTotal    = totalMaterialBase * MARKUP;

    // Other costs with 25% markup
    const equipmentBase  = parseFloat(workOrder.emf_equipment_cost) || 0;
    const equipmentTotal = equipmentBase * MARKUP;
    const trailerBase    = parseFloat(workOrder.trailer_cost)       || 0;
    const trailerTotal   = trailerBase * MARKUP;
    const rentalBase     = parseFloat(workOrder.rental_cost)        || 0;
    const rentalTotal    = rentalBase * MARKUP;

    // Mileage (no markup)
    const mileageCost = totalMiles * MILEAGE_RATE;

    // Labor totals
    const laborRT       = totalRT * RT_RATE;
    const laborOT       = totalOT * OT_RATE;
    const laborAdmin    = ADMIN_FEE;
    const laborSubtotal = laborRT + laborOT + laborAdmin;

    // ── Billing mode: FIXED quote vs ACTUAL (T&M) ──
    // Fixed  -> line items come straight from the quote and sum to new_nte_amount.
    // Actual -> the computed cost lines above.
    const fixedLineItems = fixedQuote ? buildFixedQuoteLineItems(fixedQuote) : null;

    const actualSubtotal = laborSubtotal + mileageCost
                         + materialsTotal + equipmentTotal + trailerTotal + rentalTotal;
    const subtotal = fixedLineItems
      ? Math.round(fixedLineItems.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0) * 100) / 100
      : actualSubtotal;
    const tax      = 0;
    const total    = subtotal + tax;

    // Work Performed text (mirror invoicing page priority: comments → comments_english → description)
    const workPerformedDescription =
      filterWorkComments(workOrder.comments) ||
      filterWorkComments(workOrder.comments_english) ||
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
    if (totalRT > 0) {
      lineItems.push({
        invoice_id: invoice.invoice_id,
        description: `Labor – Regular Time (${totalRT} hrs @ $${RT_RATE}/hr)`,
        quantity: totalRT,
        unit_price: RT_RATE,
        amount: laborRT,
        line_type: 'labor'
      });
    }

    if (totalOT > 0) {
      lineItems.push({
        invoice_id: invoice.invoice_id,
        description: `Labor – Overtime (${totalOT} hrs @ $${OT_RATE}/hr)`,
        quantity: totalOT,
        unit_price: OT_RATE,
        amount: laborOT,
        line_type: 'labor'
      });
    }

    // Admin hours always included
    lineItems.push({
      invoice_id: invoice.invoice_id,
      description: `Administrative Hours (${ADMIN_HOURS} hrs @ $${RT_RATE}/hr)`,
      quantity: ADMIN_HOURS,
      unit_price: RT_RATE,
      amount: ADMIN_FEE,
      line_type: 'labor'
    });

    if (totalMiles > 0) {
      lineItems.push({
        invoice_id: invoice.invoice_id,
        description: `Mileage (${totalMiles} miles @ $${MILEAGE_RATE.toFixed(2)}/mile)`,
        quantity: totalMiles,
        unit_price: MILEAGE_RATE,
        amount: mileageCost,
        line_type: 'mileage'
      });
    }

    if (materialsTotal > 0) {
      lineItems.push({
        invoice_id: invoice.invoice_id,
        description: 'Materials',
        quantity: 1,
        unit_price: materialsTotal,
        amount: materialsTotal,
        line_type: 'material'
      });
    }

    if (equipmentTotal > 0) {
      lineItems.push({
        invoice_id: invoice.invoice_id,
        description: 'Equipment',
        quantity: 1,
        unit_price: equipmentTotal,
        amount: equipmentTotal,
        line_type: 'equipment'
      });
    }

    if (trailerTotal > 0) {
      lineItems.push({
        invoice_id: invoice.invoice_id,
        description: 'Trailer',
        quantity: 1,
        unit_price: trailerTotal,
        amount: trailerTotal,
        line_type: 'equipment'
      });
    }

    if (rentalTotal > 0) {
      lineItems.push({
        invoice_id: invoice.invoice_id,
        description: 'Rental',
        quantity: 1,
        unit_price: rentalTotal,
        amount: rentalTotal,
        line_type: 'rental'
      });
    }

    } // end actual-cost line items (skipped for fixed-price quotes)

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
