import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { wo_id, admin_user_id } = await request.json();

    if (!wo_id) {
      return NextResponse.json(
        { success: false, error: 'Work order ID is required' },
        { status: 400 }
      );
    }

    // Check if invoice already exists
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('invoice_id, status')
      .eq('wo_id', wo_id)
      .single();

    if (existingInvoice) {
      return NextResponse.json(
        { success: false, error: 'Invoice already exists for this work order' },
        { status: 400 }
      );
    }

    // 1. Fetch the work order with all details
    const { data: workOrder, error: woError } = await supabase
      .from('work_orders')
      .select(`
        *,
        lead_tech:users!lead_tech_id(first_name, last_name, hourly_rate_regular, hourly_rate_overtime)
      `)
      .eq('wo_id', wo_id)
      .single();

    if (woError) throw woError;
    if (!workOrder) {
      return NextResponse.json(
        { success: false, error: 'Work order not found' },
        { status: 404 }
      );
    }

    // Verify work order is completed
    if (workOrder.status !== 'completed') {
      return NextResponse.json(
        { success: false, error: 'Work order must be completed before generating invoice' },
        { status: 400 }
      );
    }

    // 2. Fetch all team member assignments
    const { data: assignments, error: assignError } = await supabase
      .from('work_order_assignments')
      .select(`
        *,
        user:users(first_name, last_name, hourly_rate_regular, hourly_rate_overtime)
      `)
      .eq('wo_id', wo_id);

    if (assignError) throw assignError;

    // 3. Calculate labor costs and build line items
    let laborCost = 0;
    const lineItems = [];

    // Lead tech labor
    if (workOrder.lead_tech) {
      const regularHours = workOrder.hours_regular || 0;
      const overtimeHours = workOrder.hours_overtime || 0;
      const regularRate = workOrder.lead_tech.hourly_rate_regular || 64.00;
      const overtimeRate = workOrder.lead_tech.hourly_rate_overtime || 96.00;
      
      const regularCost = regularHours * regularRate;
      const overtimeCost = overtimeHours * overtimeRate;
      laborCost += regularCost + overtimeCost;

      if (regularHours > 0) {
        lineItems.push({
          description: `${workOrder.lead_tech.first_name} ${workOrder.lead_tech.last_name} - Regular Hours`,
          quantity: regularHours,
          unit_price: regularRate,
          amount: regularCost,
          category: 'labor'
        });
      }

      if (overtimeHours > 0) {
        lineItems.push({
          description: `${workOrder.lead_tech.first_name} ${workOrder.lead_tech.last_name} - Overtime Hours`,
          quantity: overtimeHours,
          unit_price: overtimeRate,
          amount: overtimeCost,
          category: 'labor'
        });
      }
    }

    // Helper/Co-lead labor
    if (assignments && assignments.length > 0) {
      for (const assignment of assignments) {
        if (!assignment.user) continue;

        const regularHours = assignment.hours_regular || 0;
        const overtimeHours = assignment.hours_overtime || 0;
        const regularRate = assignment.user.hourly_rate_regular || 64.00;
        const overtimeRate = assignment.user.hourly_rate_overtime || 96.00;
        
        const regularCost = regularHours * regularRate;
        const overtimeCost = overtimeHours * overtimeRate;
        laborCost += regularCost + overtimeCost;

        if (regularHours > 0) {
          lineItems.push({
            description: `${assignment.user.first_name} ${assignment.user.last_name} - Regular Hours (${assignment.role})`,
            quantity: regularHours,
            unit_price: regularRate,
            amount: regularCost,
            category: 'labor'
          });
        }

        if (overtimeHours > 0) {
          lineItems.push({
            description: `${assignment.user.first_name} ${assignment.user.last_name} - Overtime Hours (${assignment.role})`,
            quantity: overtimeHours,
            unit_price: overtimeRate,
            amount: overtimeCost,
            category: 'labor'
          });
        }
      }
    }

    // 4. Add materials cost
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

    // 5. Add equipment cost
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

    // 6. Add trailer cost
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

    // 7. Add rental cost
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

    // 8. Calculate mileage (lead tech + helpers)
    let totalMiles = workOrder.miles || 0;
    if (assignments && assignments.length > 0) {
      totalMiles += assignments.reduce((sum, a) => sum + (a.miles || 0), 0);
    }
    const mileageRate = 1.00; // $1.00 per mile
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

    // 9. Calculate totals
    const subtotal = laborCost + materialCost + equipmentCost + trailerCost + rentalCost + mileageCost;
    const taxRate = 0.0; // Set your tax rate here (e.g., 0.07 for 7%)
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;

    // 10. Generate invoice number
    const invoiceNumber = `INV-${workOrder.wo_number}`;

    // 11. Create invoice record
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert([{
        wo_id: wo_id,
        invoice_number: invoiceNumber,
        invoice_date: new Date().toISOString().split('T')[0],
        status: 'draft',
        
        // Amounts using correct column names
        labor_amount: laborCost,
        materials_amount: materialCost,
        equipment_amount: equipmentCost,
        mileage_amount: mileageCost,
        subtotal: subtotal,
        tax_amount: taxAmount,
        total_amount: total
      }])
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    // 12. Insert line items
    if (lineItems.length > 0) {
      const lineItemsWithInvoiceId = lineItems.map(item => ({
        ...item,
        invoice_id: invoice.invoice_id
      }));

      const { error: lineItemsError } = await supabase
        .from('invoice_line_items')
        .insert(lineItemsWithInvoiceId);

      if (lineItemsError) throw lineItemsError;
    }

    // 13. LOCK THE WORK ORDER (prevent lead tech editing)
    const { error: lockError } = await supabase
      .from('work_orders')
      .update({
        is_locked: true,
        locked_at: new Date().toISOString(),
        locked_by: admin_user_id || null
      })
      .eq('wo_id', wo_id);

    if (lockError) throw lockError;

    return NextResponse.json({
      success: true,
      invoice,
      lineItems,
      message: 'Invoice generated successfully and work order locked'
    });

  } catch (error) {
    console.error('Error generating invoice:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}