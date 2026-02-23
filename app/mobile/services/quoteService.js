// services/quoteService.js - NTE Increase/Quote Management
// FIXED: Verbal NTE = immediate update, Written NTE = pending until approved
// Snapshot principle: saves current costs at time of creation, never recalculates

// Rate constants
export const RATES = {
  RT_HOURLY: 64,
  OT_HOURLY: 96,
  MILEAGE: 1,
  MARKUP_PERCENT: 0.25,
  ADMIN_HOURS: 2  // 2 hours × $64 = $128
};

// Calculate all totals for a quote (ADDITIONAL work only - NO admin fee)
export function calculateQuoteTotals(quoteData) {
  const {
    estimated_techs = 1,
    estimated_rt_hours = 0,
    estimated_ot_hours = 0,
    material_cost = 0,
    equipment_cost = 0,
    rental_cost = 0,
    trailer_cost = 0,
    estimated_miles = 0
  } = quoteData;

  // Labor: (RT hours × techs × $64) + (OT hours × techs × $96)
  // NO admin fee here - admin is already included in current/accrued costs
  const laborTotal = 
    (parseFloat(estimated_rt_hours) * parseInt(estimated_techs) * RATES.RT_HOURLY) +
    (parseFloat(estimated_ot_hours) * parseInt(estimated_techs) * RATES.OT_HOURLY);

  // All cost categories with 25% markup
  const materialsWithMarkup = parseFloat(material_cost) * (1 + RATES.MARKUP_PERCENT);
  const equipmentWithMarkup = parseFloat(equipment_cost) * (1 + RATES.MARKUP_PERCENT);
  const rentalWithMarkup = parseFloat(rental_cost) * (1 + RATES.MARKUP_PERCENT);
  const trailerWithMarkup = parseFloat(trailer_cost) * (1 + RATES.MARKUP_PERCENT);

  // Mileage @ $1/mile
  const mileageTotal = parseFloat(estimated_miles) * RATES.MILEAGE;

  // Grand total for ADDITIONAL work (no admin fee)
  const grandTotal = laborTotal + materialsWithMarkup + equipmentWithMarkup + 
                     rentalWithMarkup + trailerWithMarkup + mileageTotal;

  return {
    labor_total: Math.round(laborTotal * 100) / 100,
    materials_with_markup: Math.round(materialsWithMarkup * 100) / 100,
    equipment_with_markup: Math.round(equipmentWithMarkup * 100) / 100,
    rental_with_markup: Math.round(rentalWithMarkup * 100) / 100,
    trailer_with_markup: Math.round(trailerWithMarkup * 100) / 100,
    mileage_total: Math.round(mileageTotal * 100) / 100,
    grand_total: Math.round(grandTotal * 100) / 100
  };
}

// ============================================================
// Calculate existing/accrued costs - MATCHES CostSummarySection
// This is used as the shared calculation for snapshot creation
// ============================================================
export async function calculateExistingCosts(supabase, workOrder, currentTeamList) {
  const wo = workOrder || {};
  if (!wo.wo_id) return { grandTotal: 0 };

  try {
    // 1. Legacy totals from work_orders + assignments
    const primaryRT = parseFloat(wo.hours_regular) || 0;
    const primaryOT = parseFloat(wo.hours_overtime) || 0;
    const primaryMiles = parseFloat(wo.miles) || 0;

    let teamRT = 0, teamOT = 0, teamMiles = 0;

    if (currentTeamList && Array.isArray(currentTeamList)) {
      currentTeamList.forEach(member => {
        if (member) {
          teamRT += parseFloat(member.hours_regular) || 0;
          teamOT += parseFloat(member.hours_overtime) || 0;
          teamMiles += parseFloat(member.miles) || 0;
        }
      });
    } else {
      const { data: teamMembers } = await supabase
        .from('work_order_assignments')
        .select('hours_regular, hours_overtime, miles')
        .eq('wo_id', wo.wo_id);
      if (teamMembers) {
        teamMembers.forEach(member => {
          teamRT += parseFloat(member.hours_regular) || 0;
          teamOT += parseFloat(member.hours_overtime) || 0;
          teamMiles += parseFloat(member.miles) || 0;
        });
      }
    }

    const legacyTotalRT = primaryRT + teamRT;
    const legacyTotalOT = primaryOT + teamOT;
    const legacyTotalMiles = primaryMiles + teamMiles;

    // 2. Daily hours logs (including tech_material_cost)
    const { data: dailyData, error: dailyError } = await supabase
      .from('daily_hours_log')
      .select('hours_regular, hours_overtime, miles, tech_material_cost')
      .eq('wo_id', wo.wo_id);

    let dailyTotalRT = 0, dailyTotalOT = 0, dailyTotalMiles = 0, dailyTotalTechMaterial = 0;

    if (!dailyError && dailyData) {
      dailyData.forEach(log => {
        dailyTotalRT += parseFloat(log.hours_regular) || 0;
        dailyTotalOT += parseFloat(log.hours_overtime) || 0;
        dailyTotalMiles += parseFloat(log.miles) || 0;
        dailyTotalTechMaterial += parseFloat(log.tech_material_cost) || 0;
      });
    }

    // Combined totals = legacy + daily (same as CostSummarySection)
    const totalRT = legacyTotalRT + dailyTotalRT;
    const totalOT = legacyTotalOT + dailyTotalOT;
    const totalMiles = legacyTotalMiles + dailyTotalMiles;

    // Labor includes admin hours
    const laborCost = (totalRT * RATES.RT_HOURLY) + (totalOT * RATES.OT_HOURLY) + (RATES.ADMIN_HOURS * RATES.RT_HOURLY);

    // Materials: EMF + Tech, both with markup
    const emfMaterialBase = parseFloat(wo.material_cost) || 0;
    const techMaterialBase = dailyTotalTechMaterial;
    const totalMaterialBase = emfMaterialBase + techMaterialBase;
    const materialWithMarkup = totalMaterialBase * (1 + RATES.MARKUP_PERCENT);

    const equipmentBase = parseFloat(wo.emf_equipment_cost) || 0;
    const equipmentWithMarkup = equipmentBase * (1 + RATES.MARKUP_PERCENT);

    const trailerBase = parseFloat(wo.trailer_cost) || 0;
    const trailerWithMarkup = trailerBase * (1 + RATES.MARKUP_PERCENT);

    const rentalBase = parseFloat(wo.rental_cost) || 0;
    const rentalWithMarkup = rentalBase * (1 + RATES.MARKUP_PERCENT);

    const mileageCost = totalMiles * RATES.MILEAGE;

    const grandTotal = laborCost + materialWithMarkup + equipmentWithMarkup + trailerWithMarkup + rentalWithMarkup + mileageCost;

    return {
      totalRT, totalOT, totalMiles,
      laborCost,
      emfMaterialBase, techMaterialBase, totalMaterialBase, materialWithMarkup,
      equipmentBase, equipmentWithMarkup,
      trailerBase, trailerWithMarkup,
      rentalBase, rentalWithMarkup,
      mileageCost,
      grandTotal: Math.round(grandTotal * 100) / 100
    };
  } catch (err) {
    console.error('Error calculating existing costs:', err);
    return { grandTotal: 0 };
  }
}

// Load quotes for a work order
export async function loadQuotes(supabase, woId) {
  const { data, error } = await supabase
    .from('work_order_quotes')
    .select(`
      *,
      creator:users!work_order_quotes_created_by_fkey(first_name, last_name)
    `)
    .eq('wo_id', woId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Load a single quote with materials
export async function loadQuoteWithMaterials(supabase, quoteId) {
  const { data: quote, error: quoteError } = await supabase
    .from('work_order_quotes')
    .select(`
      *,
      creator:users!work_order_quotes_created_by_fkey(first_name, last_name)
    `)
    .eq('quote_id', quoteId)
    .single();

  if (quoteError) throw quoteError;

  const { data: materials, error: materialsError } = await supabase
    .from('quote_materials')
    .select('*')
    .eq('quote_id', quoteId)
    .order('created_at', { ascending: true });

  if (materialsError) throw materialsError;

  return { ...quote, materials: materials || [] };
}

// ============================================================
// CREATE a new NTE Increase Request
// VERBAL → Immediately updates work_orders.nte
// WRITTEN → Keeps old NTE, sets status to 'pending'
// ============================================================
export async function createQuote(supabase, quoteData, userId) {
  const totals = calculateQuoteTotals(quoteData);

  // Get snapshot values from NTEIncreasePage
  const currentCostsSnapshot = Math.round((parseFloat(quoteData.existing_costs_total) || 0) * 100) / 100;
  const newNteAmount = Math.round((parseFloat(quoteData.projected_total) || (currentCostsSnapshot + totals.grand_total)) * 100) / 100;
  const originalNte = parseFloat(quoteData.original_nte) || 0;
  const isVerbal = quoteData.is_verbal_nte || false;

  const { data, error } = await supabase
    .from('work_order_quotes')
    .insert({
      wo_id: quoteData.wo_id,
      created_by: userId,
      is_verbal_nte: isVerbal,
      verbal_approved_by: isVerbal ? (quoteData.verbal_approved_by || null) : null,
      estimated_techs: parseInt(quoteData.estimated_techs) || 1,
      estimated_rt_hours: parseFloat(quoteData.estimated_rt_hours) || 0,
      estimated_ot_hours: parseFloat(quoteData.estimated_ot_hours) || 0,
      material_cost: parseFloat(quoteData.material_cost) || 0,
      equipment_cost: parseFloat(quoteData.equipment_cost) || 0,
      rental_cost: parseFloat(quoteData.rental_cost) || 0,
      trailer_cost: parseFloat(quoteData.trailer_cost) || 0,
      estimated_miles: parseFloat(quoteData.estimated_miles) || 0,
      description: quoteData.description || null,
      notes: quoteData.notes || null,
      // Calculated totals for additional work
      labor_total: totals.labor_total,
      materials_with_markup: totals.materials_with_markup,
      equipment_with_markup: totals.equipment_with_markup,
      rental_with_markup: totals.rental_with_markup,
      trailer_with_markup: totals.trailer_with_markup,
      mileage_total: totals.mileage_total,
      grand_total: totals.grand_total,
      // SNAPSHOT values - frozen at creation time
      current_costs_snapshot: currentCostsSnapshot,
      new_nte_amount: newNteAmount,
      original_nte: originalNte,
      // STATUS: verbal = immediately approved, written = pending
      nte_status: isVerbal ? 'verbal_approved' : 'pending',
      approved_at: isVerbal ? new Date().toISOString() : null,
      approved_by: isVerbal ? (quoteData.verbal_approved_by || null) : null
    })
    .select(`
      *,
      creator:users!work_order_quotes_created_by_fkey(first_name, last_name)
    `)
    .single();

  if (error) throw error;

  // VERBAL → Immediately update work order NTE to new amount
  // WRITTEN → Do NOT update NTE - keep old NTE until approved
  if (isVerbal) {
    const { error: updateError } = await supabase
      .from('work_orders')
      .update({ nte: newNteAmount })
      .eq('wo_id', quoteData.wo_id);

    if (updateError) {
      console.error('Error updating work order NTE (verbal):', updateError);
    }
  }

  return data;
}

// ============================================================
// UPDATE an existing NTE Increase Request
// Recalculates totals, updates snapshot, respects verbal/written rules
// ============================================================
export async function updateQuote(supabase, quoteId, quoteData) {
  const totals = calculateQuoteTotals(quoteData);
  const isVerbal = quoteData.is_verbal_nte || false;

  const currentCostsSnapshot = quoteData.existing_costs_total !== undefined 
    ? Math.round(parseFloat(quoteData.existing_costs_total) * 100) / 100
    : undefined;
  const newNteAmount = quoteData.projected_total !== undefined 
    ? Math.round(parseFloat(quoteData.projected_total) * 100) / 100
    : undefined;

  const updateData = {
    is_verbal_nte: isVerbal,
    verbal_approved_by: isVerbal ? (quoteData.verbal_approved_by || null) : null,
    estimated_techs: parseInt(quoteData.estimated_techs) || 1,
    estimated_rt_hours: parseFloat(quoteData.estimated_rt_hours) || 0,
    estimated_ot_hours: parseFloat(quoteData.estimated_ot_hours) || 0,
    material_cost: parseFloat(quoteData.material_cost) || 0,
    equipment_cost: parseFloat(quoteData.equipment_cost) || 0,
    rental_cost: parseFloat(quoteData.rental_cost) || 0,
    trailer_cost: parseFloat(quoteData.trailer_cost) || 0,
    estimated_miles: parseFloat(quoteData.estimated_miles) || 0,
    description: quoteData.description || null,
    notes: quoteData.notes || null,
    updated_at: new Date().toISOString(),
    // Recalculated totals
    labor_total: totals.labor_total,
    materials_with_markup: totals.materials_with_markup,
    equipment_with_markup: totals.equipment_with_markup,
    rental_with_markup: totals.rental_with_markup,
    trailer_with_markup: totals.trailer_with_markup,
    mileage_total: totals.mileage_total,
    grand_total: totals.grand_total,
    // Update status based on type
    nte_status: isVerbal ? 'verbal_approved' : 'pending',
    approved_at: isVerbal ? new Date().toISOString() : null,
    approved_by: isVerbal ? (quoteData.verbal_approved_by || null) : null
  };

  // Add snapshot values if provided
  if (currentCostsSnapshot !== undefined) {
    updateData.current_costs_snapshot = currentCostsSnapshot;
  }
  if (newNteAmount !== undefined) {
    updateData.new_nte_amount = newNteAmount;
  }
  if (quoteData.original_nte !== undefined) {
    updateData.original_nte = parseFloat(quoteData.original_nte) || 0;
  }

  const { data, error } = await supabase
    .from('work_order_quotes')
    .update(updateData)
    .eq('quote_id', quoteId)
    .select(`
      *,
      creator:users!work_order_quotes_created_by_fkey(first_name, last_name)
    `)
    .single();

  if (error) throw error;

  // VERBAL → Immediately update work order NTE
  // WRITTEN → Do NOT update NTE
  if (isVerbal && newNteAmount !== undefined && quoteData.wo_id) {
    await supabase
      .from('work_orders')
      .update({ nte: newNteAmount })
      .eq('wo_id', quoteData.wo_id);
  }

  return data;
}

// ============================================================
// APPROVE a written NTE Increase (called from dashboard)
// Only NOW does the work order NTE get updated
// ============================================================
export async function approveWrittenNTE(supabase, quoteId, approvedBy) {
  // Get the quote to find the new NTE amount
  const { data: quote, error: fetchError } = await supabase
    .from('work_order_quotes')
    .select('*')
    .eq('quote_id', quoteId)
    .single();

  if (fetchError) throw fetchError;

  // Update quote status to approved
  const { data, error } = await supabase
    .from('work_order_quotes')
    .update({
      nte_status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: approvedBy || 'Admin',
      updated_at: new Date().toISOString()
    })
    .eq('quote_id', quoteId)
    .select()
    .single();

  if (error) throw error;

  // NOW update the work order NTE to the approved amount
  const newNte = parseFloat(quote.new_nte_amount) || 0;
  if (newNte > 0 && quote.wo_id) {
    const { error: updateError } = await supabase
      .from('work_orders')
      .update({ nte: newNte })
      .eq('wo_id', quote.wo_id);

    if (updateError) {
      console.error('Error updating work order NTE after approval:', updateError);
      throw updateError;
    }
  }

  return data;
}

// Delete a quote
export async function deleteQuote(supabase, quoteId) {
  const { error } = await supabase
    .from('work_order_quotes')
    .delete()
    .eq('quote_id', quoteId);

  if (error) throw error;
  return true;
}

// Add material line item
export async function addMaterial(supabase, quoteId, materialData) {
  const totalCost = (parseFloat(materialData.quantity) || 1) * (parseFloat(materialData.unit_cost) || 0);
  
  const { data, error } = await supabase
    .from('quote_materials')
    .insert({
      quote_id: quoteId,
      description: materialData.description,
      quantity: materialData.quantity || 1,
      unit_cost: materialData.unit_cost || 0,
      total_cost: totalCost
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update material line item
export async function updateMaterial(supabase, materialId, materialData) {
  const totalCost = (parseFloat(materialData.quantity) || 1) * (parseFloat(materialData.unit_cost) || 0);
  
  const { data, error } = await supabase
    .from('quote_materials')
    .update({
      description: materialData.description,
      quantity: materialData.quantity || 1,
      unit_cost: materialData.unit_cost || 0,
      total_cost: totalCost
    })
    .eq('material_id', materialId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete material line item
export async function deleteMaterial(supabase, materialId) {
  const { error } = await supabase
    .from('quote_materials')
    .delete()
    .eq('material_id', materialId);

  if (error) throw error;
  return true;
}

// Recalculate material total from line items
export async function recalculateMaterialTotal(supabase, quoteId) {
  const { data: materials, error: fetchError } = await supabase
    .from('quote_materials')
    .select('total_cost')
    .eq('quote_id', quoteId);

  if (fetchError) throw fetchError;

  const totalMaterialCost = (materials || []).reduce(
    (sum, mat) => sum + (parseFloat(mat.total_cost) || 0), 0
  );

  const { data: quote, error: quoteError } = await supabase
    .from('work_order_quotes')
    .select('*')
    .eq('quote_id', quoteId)
    .single();

  if (quoteError) throw quoteError;

  const updatedQuote = { ...quote, material_cost: totalMaterialCost };
  const totals = calculateQuoteTotals(updatedQuote);

  const { error: updateError } = await supabase
    .from('work_order_quotes')
    .update({
      material_cost: totalMaterialCost,
      labor_total: totals.labor_total,
      materials_with_markup: totals.materials_with_markup,
      equipment_with_markup: totals.equipment_with_markup,
      rental_with_markup: totals.rental_with_markup,
      trailer_with_markup: totals.trailer_with_markup,
      mileage_total: totals.mileage_total,
      grand_total: totals.grand_total,
      updated_at: new Date().toISOString()
    })
    .eq('quote_id', quoteId);

  if (updateError) throw updateError;
  return totalMaterialCost;
}
