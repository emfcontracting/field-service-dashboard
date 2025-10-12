import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const { wo_id } = await request.json();

    console.log('Generating invoice for WO:', wo_id);

    if (!wo_id) {
      return NextResponse.json(
        { success: false, error: 'Work order ID is required' },
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
      console.log('Invoice already exists:', existingInvoice.invoice_id);
      return NextResponse.json(
        { success: false, error: 'Invoice already exists for this work order' },
        { status: 400 }
      );
    }

    // Fetch work order
    const { data: workOrder, error: woError } = await supabase
      .from('work_orders')
      .select('*')
      .eq('wo_id', wo_id)
      .single();

    if (woError || !workOrder) {
      console.error('Work order fetch error:', woError);
      return NextResponse.json(
        { success: false, error: 'Work order not found' },
        { status: 404 }
      );
    }

    console.log('Work order found:', workOrder.wo_number);

    // Verify work order is completed
    if (workOrder.status !== 'completed') {
      return NextResponse.json(
        { success: false, error: 'Work order must be completed before generating invoice' },
        { status: 400 }
      );
    }

    // Fetch lead tech info for rates
    const { data: leadTech } = await supabase
      .from('users')
      .select('first_name, last_name, hourly_rate_regular, hourly_rate_overtime')
      .eq('user_id', workOrder.lead_tech_id)
      .single();

    // Fetch team member assignments
    const { data: assignments } = await supabase
      .from('work_order_assignments')
      .select(`
        *,
        user:users(first_name, last_name, hourly_rate_regular, hourly_rate_overtime)
      `)
      .eq('wo_id', wo_id);

    console.log('Team assignments found:', assignments?.length || 0);

    // Calculate costs and build line items
    let laborCost = 0;
    const lineItems = [];

    // Lead tech labor
    if (leadTech) {
      const regularHours = workOrder.hours_regular || 0;
      const overtimeHours = workOrder.hours_overtime || 0;
      const regularRate = leadTech.hourly_rate_regular || 64;
      const overtimeRate = leadTech.hourly_rate_overtime || 96;

      const regularCost = regularHours * regularRate;
      const overtimeCost = overtimeHours * overtimeRate;
      laborCost += regularCost + overtimeCost;

      if (regularHours > 0) {
        lineItems.push({
          description: `${leadTech.first_name} ${leadTech.last_name} - Regular Hours`,
          quantity: regularHours,
          unit_price: regularRate,
          amount: regularCost,
          category: 'labor'
        });
      }

      if (overtimeHours > 0) {
        lineItems.push({
          description: `${leadTech.first_name} ${leadTech.last_name} - Overtime Hours`,
          quantity: overtimeHours,
          unit_price: overtimeRate,
          amount: overtimeCost,
          category: 'labor'
        });
      }

      console.log('Lead tech labor cost:', regularCost + overtimeCost);
    }

    // Team members labor
    if (assignments && assignments.length > 0) {
      for (const assignment of assignments) {
        if (!assignment.user) continue;

        const regularHours = assignment.hours_regular || 0;
        const overtimeHours = assignment.hours_overtime || 0;
        const regularRate = assignment.user.hourly_rate_regular || 64;
        const overtimeRate = assignment.user.hourly_rate_overtime || 96;

        const regularCost = regularHours * regularRate;
        const overtimeCost = overtimeHours * overtimeRate;
        laborCost += regularCost + overtimeCost;

        if (regularHours > 0) {
          lineItems.push({
            description: `${assignment.user.first_name} ${assignment.user.last_name} - Regular Hours`,
            quantity: regularHours,
            unit_price: regularRate,
            amount: regularCost,
            category: 'labor'
          });
        }

        if (overtimeHours > 0) {
          lineItems.push({
            description: `${assignment.user.first_name} ${assignment.user.last_name} - Overtime Hours`,
            quantity: overtimeHours,
            unit_price: overtimeRate,
            amount: overtimeCost,
            category: 'labor'
          });
        }
      }
    }

    // Materials
    const materialCost = workOrder.material_cost || 0;
    if (materialCost > 0) {
      lineItems.push({
        description: 'Materials',
        quantity: 1,
        unit_price: materialCost,
        amount: materialCost,
        category: 'materials'
      });
    }

    // Equipment
    const equipmentCost = workOrder.emf_equipment_cost || 0;
    if (equipmentCost > 0) {
      lineItems.push({
        description: 'Equipment',
        quantity: 1,
        unit_price: equipmentCost,
        amount: equipmentCost,
        category: 'equipment'
      });
    }

    // Trailer
    const trailerCost = workOrder.trailer_cost || 0;
    if (trailerCost > 0) {
      lineItems.push({
        description: 'Trailer',
        quantity: 1,
        unit_price: trailerCost,
        amount: trailerCost,
        category: 'trailer'
      });
    }

    // Rental
    const rentalCost = workOrder.rental_cost || 0;
    if (rentalCost > 0) {
      lineItems.push({
        description: 'Equipment Rental',
        quantity: 1,
        unit_price: rentalCost,
        amount: rentalCost,
        category: 'rental'
      });
    }

    // Mileage
    let totalMiles = workOrder.miles || 0;
    if (assignments && assignments.length > 0) {
      totalMiles += assignments.reduce((sum, a) => sum + (a.miles || 0), 0);
    }
    const mileageRate = 1.00;
    const mileageCost = totalMiles * mileageRate;

    if (totalMiles > 0) {
      lineItems.push({
        description: `Mileage (${totalMiles} miles)`,
        quantity: totalMiles,
        unit_price: mileageRate,
        amount: mileageCost,
        category: 'mileage'
      });
    }

    // Calculate totals
    const subtotal = laborCost + materialCost + equipmentCost + trailerCost + rentalCost + mileageCost;
    const taxRate = 0.0;
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;

    console.log('Invoice totals:', { subtotal, taxAmount, total });

    // Generate invoice number
    const invoiceNumber = `INV-${workOrder.wo_number}`;

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        wo_id,
        invoice_number: invoiceNumber,
        status: 'draft',
        labor_cost: laborCost,
        material_cost: materialCost,
        equipment_cost: equipmentCost,
        trailer_cost: trailerCost,
        rental_cost: rentalCost,
        mileage_cost: mileageCost,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total
      })
      .select()
      .single();

    if (invoiceError) {
      console.error('Invoice creation error:', invoiceError);
      throw new Error('Failed to create invoice: ' + invoiceError.message);
    }

    console.log('Invoice created:', invoice.invoice_id);

    // Insert line items
    if (lineItems.length > 0) {
      const lineItemsWithInvoiceId = lineItems.map(item => ({
        ...item,
        invoice_id: invoice.invoice_id
      }));

      const { error: lineItemsError } = await supabase
        .from('invoice_line_items')
        .insert(lineItemsWithInvoiceId);

      if (lineItemsError) {
        console.error('Line items error:', lineItemsError);
        throw new Error('Failed to create line items: ' + lineItemsError.message);
      }

      console.log('Line items created:', lineItems.length);
    }

    // Lock the work order
    const { error: lockError } = await supabase
      .from('work_orders')
      .update({
        is_locked: true,
        locked_at: new Date().toISOString(),
        locked_by: null
      })
      .eq('wo_id', wo_id);

    if (lockError) {
      console.error('Lock error:', lockError);
      throw new Error('Failed to lock work order: ' + lockError.message);
    }

    console.log('Work order locked');

    return NextResponse.json({
      success: true,
      invoice,
      lineItems,
      message: 'Invoice generated successfully'
    });

  } catch (error) {
    console.error('Invoice generation error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}