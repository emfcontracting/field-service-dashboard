// app/api/backfill/nte-snapshots/route.js
// Backfill script to populate current_costs_snapshot and new_nte_amount for existing quotes
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Rate constants
const RATES = {
  RT_RATE: 64,
  OT_RATE: 96,
  MILEAGE_RATE: 1.00,
  MARKUP_PERCENT: 0.25,
  ADMIN_HOURS: 2
};

// Calculate current costs for a work order (same logic as mobile app)
async function calculateCurrentCosts(woId, workOrder) {
  try {
    // Get daily hours logs
    const { data: dailyLogs } = await supabase
      .from('daily_hours_log')
      .select('hours_regular, hours_overtime, miles')
      .eq('wo_id', woId);

    // Get team member assignments
    const { data: teamMembers } = await supabase
      .from('work_order_assignments')
      .select('hours_regular, hours_overtime, miles')
      .eq('wo_id', woId);

    let totalRT = 0;
    let totalOT = 0;
    let totalMiles = 0;

    // Use daily logs if available
    if (dailyLogs && dailyLogs.length > 0) {
      dailyLogs.forEach(log => {
        totalRT += parseFloat(log.hours_regular) || 0;
        totalOT += parseFloat(log.hours_overtime) || 0;
        totalMiles += parseFloat(log.miles) || 0;
      });
    } else {
      // Fall back to legacy fields
      totalRT = parseFloat(workOrder.hours_regular) || 0;
      totalOT = parseFloat(workOrder.hours_overtime) || 0;
      totalMiles = parseFloat(workOrder.miles) || 0;

      if (teamMembers) {
        teamMembers.forEach(tm => {
          totalRT += parseFloat(tm.hours_regular) || 0;
          totalOT += parseFloat(tm.hours_overtime) || 0;
          totalMiles += parseFloat(tm.miles) || 0;
        });
      }
    }

    // Calculate costs
    const laborCost = (totalRT * RATES.RT_RATE) + (totalOT * RATES.OT_RATE) + (RATES.ADMIN_HOURS * RATES.RT_RATE);
    const materialWithMarkup = (parseFloat(workOrder.material_cost) || 0) * (1 + RATES.MARKUP_PERCENT);
    const equipmentWithMarkup = (parseFloat(workOrder.emf_equipment_cost) || 0) * (1 + RATES.MARKUP_PERCENT);
    const trailerWithMarkup = (parseFloat(workOrder.trailer_cost) || 0) * (1 + RATES.MARKUP_PERCENT);
    const rentalWithMarkup = (parseFloat(workOrder.rental_cost) || 0) * (1 + RATES.MARKUP_PERCENT);
    const mileageCost = totalMiles * RATES.MILEAGE_RATE;

    const grandTotal = laborCost + materialWithMarkup + equipmentWithMarkup + trailerWithMarkup + rentalWithMarkup + mileageCost;

    return {
      totalRT,
      totalOT,
      totalMiles,
      laborCost,
      materialWithMarkup,
      equipmentWithMarkup,
      trailerWithMarkup,
      rentalWithMarkup,
      mileageCost,
      grandTotal
    };
  } catch (err) {
    console.error('Error calculating costs for WO:', woId, err);
    return null;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dry_run') !== 'false'; // Default to dry run
    const woNumber = searchParams.get('wo'); // Optional: specific WO to backfill

    console.log('=== NTE SNAPSHOT BACKFILL ===');
    console.log('Dry run:', dryRun);
    console.log('Specific WO:', woNumber || 'ALL');

    // Find all quotes that need backfill
    let quotesQuery = supabase
      .from('work_order_quotes')
      .select(`
        quote_id,
        wo_id,
        grand_total,
        labor_total,
        materials_with_markup,
        equipment_with_markup,
        rental_with_markup,
        trailer_with_markup,
        mileage_total,
        current_costs_snapshot,
        new_nte_amount,
        created_at
      `)
      .is('current_costs_snapshot', null);

    const { data: quotes, error: quotesError } = await quotesQuery;

    if (quotesError) {
      throw new Error('Failed to fetch quotes: ' + quotesError.message);
    }

    console.log('Found', quotes?.length || 0, 'quotes needing backfill');

    if (!quotes || quotes.length === 0) {
      return Response.json({
        success: true,
        message: 'No quotes need backfill - all have snapshots already',
        processed: 0
      });
    }

    // Get unique work order IDs
    const woIds = [...new Set(quotes.map(q => q.wo_id))];

    // Fetch all work orders
    const { data: workOrders, error: woError } = await supabase
      .from('work_orders')
      .select('wo_id, wo_number, nte, hours_regular, hours_overtime, miles, material_cost, emf_equipment_cost, trailer_cost, rental_cost')
      .in('wo_id', woIds);

    if (woError) {
      throw new Error('Failed to fetch work orders: ' + woError.message);
    }

    // Create lookup map
    const woMap = {};
    workOrders.forEach(wo => {
      woMap[wo.wo_id] = wo;
    });

    // Process each quote
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const quote of quotes) {
      const workOrder = woMap[quote.wo_id];
      
      if (!workOrder) {
        results.push({
          quote_id: quote.quote_id,
          wo_id: quote.wo_id,
          status: 'error',
          message: 'Work order not found'
        });
        errorCount++;
        continue;
      }

      // Filter by specific WO if provided
      if (woNumber && workOrder.wo_number !== woNumber) {
        continue;
      }

      // Calculate current costs
      const costs = await calculateCurrentCosts(quote.wo_id, workOrder);
      
      if (!costs) {
        results.push({
          quote_id: quote.quote_id,
          wo_number: workOrder.wo_number,
          status: 'error',
          message: 'Failed to calculate costs'
        });
        errorCount++;
        continue;
      }

      // Calculate additional work total from quote
      const additionalTotal = 
        (parseFloat(quote.labor_total) || 0) +
        (parseFloat(quote.materials_with_markup) || 0) +
        (parseFloat(quote.equipment_with_markup) || 0) +
        (parseFloat(quote.rental_with_markup) || 0) +
        (parseFloat(quote.trailer_with_markup) || 0) +
        (parseFloat(quote.mileage_total) || 0);

      // Set snapshot values
      const currentCostsSnapshot = Math.round(costs.grandTotal * 100) / 100;
      const newNteAmount = Math.round((currentCostsSnapshot + additionalTotal) * 100) / 100;

      const result = {
        quote_id: quote.quote_id,
        wo_number: workOrder.wo_number,
        wo_id: quote.wo_id,
        original_nte: workOrder.nte,
        current_costs_snapshot: currentCostsSnapshot,
        additional_total: additionalTotal,
        new_nte_amount: newNteAmount,
        created_at: quote.created_at
      };

      if (dryRun) {
        result.status = 'dry_run';
        result.message = 'Would update quote and work order';
      } else {
        // Actually update the quote
        const { error: updateQuoteError } = await supabase
          .from('work_order_quotes')
          .update({
            current_costs_snapshot: currentCostsSnapshot,
            new_nte_amount: newNteAmount
          })
          .eq('quote_id', quote.quote_id);

        if (updateQuoteError) {
          result.status = 'error';
          result.message = 'Failed to update quote: ' + updateQuoteError.message;
          errorCount++;
        } else {
          // Update work order NTE
          const { error: updateWoError } = await supabase
            .from('work_orders')
            .update({
              nte: newNteAmount
            })
            .eq('wo_id', quote.wo_id);

          if (updateWoError) {
            result.status = 'partial';
            result.message = 'Quote updated but WO NTE failed: ' + updateWoError.message;
          } else {
            result.status = 'success';
            result.message = 'Quote and WO NTE updated';
            successCount++;
          }
        }
      }

      results.push(result);
    }

    return Response.json({
      success: true,
      dry_run: dryRun,
      summary: {
        total_quotes_found: quotes.length,
        processed: results.length,
        success: successCount,
        errors: errorCount
      },
      instructions: dryRun 
        ? 'This was a DRY RUN. To actually update, call with ?dry_run=false'
        : 'Updates complete!',
      results
    });

  } catch (error) {
    console.error('Backfill error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
