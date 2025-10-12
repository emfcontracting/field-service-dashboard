import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { wo_id } = await request.json();

    if (!wo_id) {
      return NextResponse.json({ success: false, error: 'Work order ID is required' }, { status: 400 });
    }

    // Fetch work order details
    const { data: workOrder, error: woError } = await supabase
      .from('work_orders')
      .select('*')
      .eq('wo_id', wo_id)
      .single();

    if (woError || !workOrder) {
      return NextResponse.json({ success: false, error: 'Work order not found' }, { status: 404 });
    }

    // Check if already has invoice
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('invoice_id')
      .eq('wo_id', wo_id)
      .single();

    if (existingInvoice) {
      return NextResponse.json({ success: false, error: 'Invoice already exists for this work order' }, { status: 400 });
    }

    // Generate invoice number
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    // Calculate totals
    const laborCost = ((workOrder.hours_regular || 0) * 64) + ((workOrder.hours_overtime || 0) * 96);
    const mileageCost = (workOrder.miles || 0) * 1.00;
    const subtotal = laborCost + 
                     mileageCost + 
                     (workOrder.material_cost || 0) + 
                     (workOrder.emf_equipment_cost || 0) + 
                     (workOrder.trailer_cost || 0) + 
                     (workOrder.rental_cost || 0);

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert([{
        wo_id: wo_id,
        invoice_number: invoiceNumber,
        status: 'draft',
        hours_regular: workOrder.hours_regular || 0,
        hours_overtime: workOrder.hours_overtime || 0,
        miles: workOrder.miles || 0,
        material_cost: workOrder.material_cost || 0,
        emf_equipment_cost: workOrder.emf_equipment_cost || 0,
        trailer_cost: workOrder.trailer_cost || 0,
        rental_cost: workOrder.rental_cost || 0,
        subtotal: subtotal,
        tax_rate: 0,
        tax_amount: 0,
        total: subtotal,
        notes: workOrder.comments || ''
      }])
      .select()
      .single();

    if (invoiceError) {
      console.error('Error creating invoice:', invoiceError);
      return NextResponse.json({ success: false, error: invoiceError.message }, { status: 500 });
    }

    // Lock the work order
    const { error: lockError } = await supabase
      .from('work_orders')
      .update({
        is_locked: true,
        locked_at: new Date().toISOString(),
        locked_by: workOrder.lead_tech_id
      })
      .eq('wo_id', wo_id);

    if (lockError) {
      console.error('Error locking work order:', lockError);
    }

    return NextResponse.json({
      success: true,
      invoice: invoice,
      message: 'Invoice generated successfully'
    });

  } catch (error) {
    console.error('Invoice generation error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}