// services/quoteService.js - NTE Increase/Quote Management
// FIXED: Admin fee is only counted once (in current costs), NOT in additional work

// Rate constants
export const RATES = {
  RT_HOURLY: 64,
  OT_HOURLY: 96,
  MILEAGE: 1,
  MARKUP_PERCENT: 0.25
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

  // Labor: (RT hours * techs * $64) + (OT hours * techs * $96)
  // NO admin fee here - admin is already included in current/accrued costs
  const laborTotal = 
    (parseFloat(estimated_rt_hours) * parseInt(estimated_techs) * RATES.RT_HOURLY) +
    (parseFloat(estimated_ot_hours) * parseInt(estimated_techs) * RATES.OT_HOURLY);

  // Materials with 25% markup
  const materialsWithMarkup = parseFloat(material_cost) * (1 + RATES.MARKUP_PERCENT);

  // Equipment with 25% markup
  const equipmentWithMarkup = parseFloat(equipment_cost) * (1 + RATES.MARKUP_PERCENT);
  
  // Rental with 25% markup
  const rentalWithMarkup = parseFloat(rental_cost) * (1 + RATES.MARKUP_PERCENT);
  
  // Trailer with 25% markup
  const trailerWithMarkup = parseFloat(trailer_cost) * (1 + RATES.MARKUP_PERCENT);

  // Mileage @ $1/mile
  const mileageTotal = parseFloat(estimated_miles) * RATES.MILEAGE;

  // Grand total for ADDITIONAL work (no admin fee - it's already in current costs)
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

  return {
    ...quote,
    materials: materials || []
  };
}

// Create a new quote
export async function createQuote(supabase, quoteData, userId) {
  // Calculate totals for the additional costs (no admin fee)
  const totals = calculateQuoteTotals(quoteData);

  const { data, error } = await supabase
    .from('work_order_quotes')
    .insert({
      wo_id: quoteData.wo_id,
      created_by: userId,
      is_verbal_nte: quoteData.is_verbal_nte || false,
      verbal_approved_by: quoteData.verbal_approved_by || null,
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
      // Calculated totals (no admin_fee - it's in current costs)
      labor_total: totals.labor_total,
      materials_with_markup: totals.materials_with_markup,
      equipment_with_markup: totals.equipment_with_markup,
      rental_with_markup: totals.rental_with_markup,
      trailer_with_markup: totals.trailer_with_markup,
      mileage_total: totals.mileage_total,
      grand_total: totals.grand_total
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update an existing quote
export async function updateQuote(supabase, quoteId, quoteData) {
  // Calculate totals for the additional costs (no admin fee)
  const totals = calculateQuoteTotals(quoteData);

  const { data, error } = await supabase
    .from('work_order_quotes')
    .update({
      is_verbal_nte: quoteData.is_verbal_nte || false,
      verbal_approved_by: quoteData.verbal_approved_by || null,
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
      // Calculated totals (no admin_fee - it's in current costs)
      labor_total: totals.labor_total,
      materials_with_markup: totals.materials_with_markup,
      equipment_with_markup: totals.equipment_with_markup,
      rental_with_markup: totals.rental_with_markup,
      trailer_with_markup: totals.trailer_with_markup,
      mileage_total: totals.mileage_total,
      grand_total: totals.grand_total
    })
    .eq('quote_id', quoteId)
    .select()
    .single();

  if (error) throw error;
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

// Update quote material total (recalculate from line items)
export async function recalculateMaterialTotal(supabase, quoteId) {
  // Get all materials for this quote
  const { data: materials, error: fetchError } = await supabase
    .from('quote_materials')
    .select('total_cost')
    .eq('quote_id', quoteId);

  if (fetchError) throw fetchError;

  // Sum up all material costs
  const totalMaterialCost = (materials || []).reduce(
    (sum, mat) => sum + (parseFloat(mat.total_cost) || 0), 
    0
  );

  // Get current quote data
  const { data: quote, error: quoteError } = await supabase
    .from('work_order_quotes')
    .select('*')
    .eq('quote_id', quoteId)
    .single();

  if (quoteError) throw quoteError;

  // Recalculate with new material total
  const updatedQuote = {
    ...quote,
    material_cost: totalMaterialCost
  };

  const totals = calculateQuoteTotals(updatedQuote);

  // Update quote (no admin_fee)
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
