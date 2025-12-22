// app/api/contractor/approval-analysis/route.js
// Dry run analysis: Cross-reference subcontractor invoices with work order completion status
// Shows what would be approved vs held if we required completed tickets for payment

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const userId = searchParams.get('user_id'); // Optional: filter by specific tech
    
    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];
    
    console.log(`=== Approval Analysis (last ${days} days) ===`);
    console.log('Start date:', startDateStr);
    
    // Get all subcontractor invoice line items with work order links
    let itemsQuery = supabase
      .from('subcontractor_invoice_items')
      .select(`
        *,
        invoice:subcontractor_invoices(
          invoice_id,
          invoice_number,
          user_id,
          period_start,
          period_end,
          status,
          created_at,
          grand_total,
          tech:users(user_id, first_name, last_name)
        ),
        work_order:work_orders(
          wo_id,
          wo_number,
          status,
          building,
          work_order_description,
          photos_received,
          photos_verified_at,
          created_at,
          completed_date
        )
      `)
      .gte('created_at', startDateStr)
      .order('created_at', { ascending: false });
    
    const { data: allItems, error: itemsError } = await itemsQuery;
    
    if (itemsError) {
      console.error('Items query error:', itemsError);
      return Response.json({ success: false, error: itemsError.message }, { status: 500 });
    }
    
    console.log('Total invoice line items found:', allItems?.length || 0);
    
    // Filter by user if specified
    let items = allItems;
    if (userId) {
      items = allItems.filter(item => item.invoice?.user_id === userId);
    }
    
    // Analyze each line item
    const analysis = [];
    const summaryByTech = {};
    
    for (const item of items || []) {
      const invoice = item.invoice;
      const workOrder = item.work_order;
      const techName = invoice?.tech 
        ? `${invoice.tech.first_name} ${invoice.tech.last_name}` 
        : 'Unknown';
      const techId = invoice?.user_id || 'unknown';
      
      // Initialize tech summary if needed
      if (!summaryByTech[techId]) {
        summaryByTech[techId] = {
          tech_name: techName,
          user_id: techId,
          total_items: 0,
          total_amount: 0,
          approved_items: 0,
          approved_amount: 0,
          held_items: 0,
          held_amount: 0,
          hold_reasons: {}
        };
      }
      
      // Skip items without a work order link (custom line items)
      if (!item.wo_id || !workOrder) {
        // Still count the amount, mark as approved (no WO to verify)
        summaryByTech[techId].total_items++;
        summaryByTech[techId].total_amount += parseFloat(item.amount) || 0;
        summaryByTech[techId].approved_items++;
        summaryByTech[techId].approved_amount += parseFloat(item.amount) || 0;
        continue;
      }
      
      // Determine if this would be approved or held
      const issues = [];
      const woNumber = workOrder.wo_number || '';
      const isPM = woNumber.toUpperCase().startsWith('P');
      
      // Check 1: Work order status
      const completedStatuses = ['Completed', 'Invoiced', 'Closed'];
      if (!completedStatuses.includes(workOrder.status)) {
        issues.push(`Status: ${workOrder.status || 'Unknown'}`);
      }
      
      // Check 2: Photos received
      if (!workOrder.photos_received) {
        issues.push('Missing photos');
      }
      
      const wouldBeApproved = issues.length === 0;
      const amount = parseFloat(item.amount) || 0;
      
      // Update tech summary
      summaryByTech[techId].total_items++;
      summaryByTech[techId].total_amount += amount;
      
      if (wouldBeApproved) {
        summaryByTech[techId].approved_items++;
        summaryByTech[techId].approved_amount += amount;
      } else {
        summaryByTech[techId].held_items++;
        summaryByTech[techId].held_amount += amount;
        
        // Track hold reasons
        for (const issue of issues) {
          summaryByTech[techId].hold_reasons[issue] = 
            (summaryByTech[techId].hold_reasons[issue] || 0) + 1;
        }
      }
      
      // Add to detailed analysis
      analysis.push({
        invoice_number: invoice?.invoice_number || 'N/A',
        invoice_date: invoice?.created_at?.split('T')[0] || 'N/A',
        tech_name: techName,
        wo_number: woNumber,
        building: workOrder.building || '',
        description: item.description || '',
        item_type: item.item_type || '',
        work_date: item.work_date || '',
        amount: amount,
        wo_status: workOrder.status || 'Unknown',
        photos_received: workOrder.photos_received || false,
        is_pm: isPM,
        issues: issues,
        would_be_approved: wouldBeApproved
      });
    }
    
    // Calculate overall totals
    const overallTotals = {
      total_items: 0,
      total_amount: 0,
      approved_items: 0,
      approved_amount: 0,
      held_items: 0,
      held_amount: 0
    };
    
    Object.values(summaryByTech).forEach(tech => {
      overallTotals.total_items += tech.total_items;
      overallTotals.total_amount += tech.total_amount;
      overallTotals.approved_items += tech.approved_items;
      overallTotals.approved_amount += tech.approved_amount;
      overallTotals.held_items += tech.held_items;
      overallTotals.held_amount += tech.held_amount;
    });
    
    // Calculate percentages
    overallTotals.approval_rate = overallTotals.total_items > 0 
      ? ((overallTotals.approved_items / overallTotals.total_items) * 100).toFixed(1)
      : 0;
    overallTotals.held_rate = overallTotals.total_items > 0 
      ? ((overallTotals.held_items / overallTotals.total_items) * 100).toFixed(1)
      : 0;
    
    return Response.json({
      success: true,
      analysis_period: {
        days: days,
        start_date: startDateStr,
        end_date: new Date().toISOString().split('T')[0]
      },
      overall_totals: overallTotals,
      by_tech: Object.values(summaryByTech).sort((a, b) => b.held_amount - a.held_amount),
      detailed_items: analysis,
      // Just the held items for easy review
      held_items: analysis.filter(a => !a.would_be_approved)
    });
    
  } catch (error) {
    console.error('Analysis error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
