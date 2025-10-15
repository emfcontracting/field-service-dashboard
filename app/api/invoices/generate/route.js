import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

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

    // Get work order details with team assignments and comments
    const { data: workOrder, error: woError } = await supabase
      .from('work_orders')
      .select(`
        *,
        lead_tech:users!lead_tech_id(first_name, last_name, hourly_rate_regular, hourly_rate_overtime)
      `)
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

    // Get team member assignments
    const { data: teamAssignments } = await supabase
      .from('work_order_assignments')
      .select(`
        *,
        user:users(first_name, last_name, hourly_rate_regular, hourly_rate_overtime)
      `)
      .eq('wo_id', wo_id);

    // Get comments to include as work performed
    const { data: comments } = await supabase
      .from('work_order_comments')
      .select(`
        comment,
        comment_type,
        created_at,
        user:users(first_name, last_name)
      `)
      .eq('wo_id', wo_id)
      .eq('comment_type', 'note')
      .order('created_at', { ascending: true });

    // Compile work performed description from comments
    let workPerformedDescription = workOrder.work_order_description;
    
    if (comments && comments.length > 0) {
      workPerformedDescription += '\n\nWork Notes:\n';
      comments.forEach(comment => {
        const timestamp = new Date(comment.created_at).toLocaleString();
        workPerformedDescription += `\n[${timestamp}] ${comment.user?.first_name} ${comment.user?.last_name}:\n${comment.comment}\n`;
      });
    }

    // Calculate lead tech labor
    const leadTechRegular = (workOrder.hours_regular || 0) * (workOrder.lead_tech?.hourly_rate_regular || 64);
    const leadTechOvertime = (workOrder.hours_overtime || 0) * (workOrder.lead_tech?.hourly_rate_overtime || 96);
    
    // Calculate team member labor
    let teamMemberLabor = 0;
    if (teamAssignments && teamAssignments.length > 0) {
      teamMemberLabor = teamAssignments.reduce((sum, member) => {
        const regular = (member.hours_regular || 0) * (member.user?.hourly_rate_regular || 64);
        const overtime = (member.hours_overtime || 0) * (member.user?.hourly_rate_overtime || 96);
        return sum + regular + overtime;
      }, 0);
    }

    // Total labor (NO admin hours added)
const totalLabor = leadTechRegular + leadTechOvertime + teamMemberLabor;

// Calculate mileage
const leadTechMiles = workOrder.miles || 0;
const teamMemberMiles = teamAssignments?.reduce((sum, m) => sum + (m.miles || 0), 0) || 0;
const totalMiles = leadTechMiles + teamMemberMiles;
const mileageCost = totalMiles * 1.00;

// APPLY 25% MARKUPS
const materialCost = workOrder.material_cost || 0;
const materialMarkup = materialCost * 0.25; // 25% markup
const materialTotal = materialCost + materialMarkup;

const equipmentCost = workOrder.emf_equipment_cost || 0;
const equipmentMarkup = equipmentCost * 0.25; // 25% markup
const equipmentTotal = equipmentCost + equipmentMarkup;

const trailerCost = workOrder.trailer_cost || 0;
const trailerMarkup = trailerCost * 0.25; // 25% markup
const trailerTotal = trailerCost + trailerMarkup;

const rentalCost = workOrder.rental_cost || 0;
const rentalMarkup = rentalCost * 0.25; // 25% markup
const rentalTotal = rentalCost + rentalMarkup;

// Calculate totals
const subtotal = totalLabor + mileageCost + materialTotal + equipmentTotal + trailerTotal + rentalTotal;
const tax = 0; // NO TAX
const total = subtotal + tax;

    // Generate invoice number (format: INV-YYYY-XXXXX)
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

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        wo_id: wo_id,
        invoice_date: new Date().toISOString(),
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        subtotal: subtotal,
        tax: tax,
        total: total,
        status: 'draft',
        notes: 'Auto-generated invoice with standard markups applied'
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

    // Create invoice line items
    const lineItems = [];

    // Labor line items
    if (leadTechRegular > 0) {
      lineItems.push({
        invoice_id: invoice.invoice_id,
        description: `Lead Tech Labor - Regular Time (${workOrder.hours_regular} hrs @ $${workOrder.lead_tech?.hourly_rate_regular || 64}/hr)`,
        quantity: workOrder.hours_regular,
        unit_price: workOrder.lead_tech?.hourly_rate_regular || 64,
        amount: leadTechRegular,
        line_type: 'labor'
      });
    }

    if (leadTechOvertime > 0) {
      lineItems.push({
        invoice_id: invoice.invoice_id,
        description: `Lead Tech Labor - Overtime (${workOrder.hours_overtime} hrs @ $${workOrder.lead_tech?.hourly_rate_overtime || 96}/hr)`,
        quantity: workOrder.hours_overtime,
        unit_price: workOrder.lead_tech?.hourly_rate_overtime || 96,
        amount: leadTechOvertime,
        line_type: 'labor'
      });
    }

    // Team member labor (by title, not name)
if (teamAssignments && teamAssignments.length > 0) {
  // Group by role and sum hours
  const laborByRole = {};
  
  teamAssignments.forEach(member => {
    const roleTitle = member.role === 'lead_tech' ? 'Tech' : 
                      member.role === 'tech' ? 'Tech' : 
                      'Helper';
    
    if (!laborByRole[roleTitle]) {
      laborByRole[roleTitle] = {
        regular_hours: 0,
        overtime_hours: 0,
        regular_rate: member.user?.hourly_rate_regular || 64,
        overtime_rate: member.user?.hourly_rate_overtime || 96
      };
    }
    
    laborByRole[roleTitle].regular_hours += member.hours_regular || 0;
    laborByRole[roleTitle].overtime_hours += member.hours_overtime || 0;
  });
  
  // Create line items for each role
  Object.entries(laborByRole).forEach(([role, data]) => {
    if (data.regular_hours > 0) {
      lineItems.push({
        invoice_id: invoice.invoice_id,
        description: `${role} - Regular Time (${data.regular_hours} hrs @ $${data.regular_rate}/hr)`,
        quantity: data.regular_hours,
        unit_price: data.regular_rate,
        amount: data.regular_hours * data.regular_rate,
        line_type: 'labor'
      });
    }
    if (data.overtime_hours > 0) {
      lineItems.push({
        invoice_id: invoice.invoice_id,
        description: `${role} - Overtime (${data.overtime_hours} hrs @ $${data.overtime_rate}/hr)`,
        quantity: data.overtime_hours,
        unit_price: data.overtime_rate,
        amount: data.overtime_hours * data.overtime_rate,
        line_type: 'labor'
      });
    }
  });
}


    // Mileage
    if (totalMiles > 0) {
      lineItems.push({
        invoice_id: invoice.invoice_id,
        description: `Mileage (${totalMiles} miles @ $1.00/mile)`,
        quantity: totalMiles,
        unit_price: 1.00,
        amount: mileageCost,
        line_type: 'mileage'
      });
    }

    // Materials (with 25% markup)
if (materialCost > 0) {
  lineItems.push({
    invoice_id: invoice.invoice_id,
    description: `Materials (Base: $${materialCost.toFixed(2)} + 25% markup)`,
    quantity: 1,
    unit_price: materialTotal,
    amount: materialTotal,
    line_type: 'material'
  });
}

    // Equipment (with 25% markup)
if (equipmentCost > 0) {
  lineItems.push({
    invoice_id: invoice.invoice_id,
    description: `Equipment (Base: $${equipmentCost.toFixed(2)} + 25% markup)`,
    quantity: 1,
    unit_price: equipmentTotal,
    amount: equipmentTotal,
    line_type: 'equipment'
  });
}

    // Trailer (with 25% markup)
if (trailerCost > 0) {
  lineItems.push({
    invoice_id: invoice.invoice_id,
    description: `Trailer (Base: $${trailerCost.toFixed(2)} + 25% markup)`,
    quantity: 1,
    unit_price: trailerTotal,
    amount: trailerTotal,
    line_type: 'equipment'
  });
}

    // Rental (with 25% markup)
if (rentalCost > 0) {
  lineItems.push({
    invoice_id: invoice.invoice_id,
    description: `Rental (Base: $${rentalCost.toFixed(2)} + 25% markup)`,
    quantity: 1,
    unit_price: rentalTotal,
    amount: rentalTotal,
    line_type: 'rental'
  });
}

    // Work Performed Description
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

    // Lock the work order
const { error: lockError } = await supabase
  .from('work_orders')
  .update({
    is_locked: true,
    locked_at: new Date().toISOString(),
    locked_by: null  // <-- FIXED!
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