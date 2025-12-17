// app/dashboard/utils/calculations.js

export function calculateStats(orders) {
  return {
    total: orders.length,
    pending: orders.filter(wo => wo.status === 'pending').length,
    assigned: orders.filter(wo => wo.status === 'assigned').length,
    in_progress: orders.filter(wo => wo.status === 'in_progress').length,
    completed: orders.filter(wo => wo.status === 'completed').length,
    tech_review: orders.filter(wo => wo.status === 'tech_review').length,
    return_trip: orders.filter(wo => wo.status === 'return_trip').length,
    // CBRE status counts (from Gmail labels)
    escalation: orders.filter(wo => wo.cbre_status === 'escalation').length,
    quote_approved: orders.filter(wo => wo.cbre_status === 'quote_approved').length,
    quote_rejected: orders.filter(wo => wo.cbre_status === 'quote_rejected').length,
    quote_submitted: orders.filter(wo => wo.cbre_status === 'quote_submitted').length,
    pending_quote: orders.filter(wo => wo.cbre_status === 'pending_quote').length,
    reassigned: orders.filter(wo => wo.cbre_status === 'reassigned').length
  };
}

export function calculateTotalCost(wo) {
  // Use combined totals if available (from fetchWorkOrders), otherwise fall back to legacy fields
  const hoursRT = wo.total_hours_regular !== undefined ? wo.total_hours_regular : (parseFloat(wo.hours_regular) || 0);
  const hoursOT = wo.total_hours_overtime !== undefined ? wo.total_hours_overtime : (parseFloat(wo.hours_overtime) || 0);
  const miles = wo.total_miles !== undefined ? wo.total_miles : (parseFloat(wo.miles) || 0);
  
  const labor = (hoursRT * 64) + (hoursOT * 96);
  const materials = parseFloat(wo.material_cost) || 0;
  const equipment = parseFloat(wo.emf_equipment_cost) || 0;
  const trailer = parseFloat(wo.trailer_cost) || 0;
  const rental = parseFloat(wo.rental_cost) || 0;
  const mileage = miles * 1.00;
  
  // Add admin hours (2 hrs @ $64) for a more accurate estimate
  const adminHours = 128;
  
  // Apply markups to materials/equipment/trailer/rental (25%)
  const materialsWithMarkup = materials * 1.25;
  const equipmentWithMarkup = equipment * 1.25;
  const trailerWithMarkup = trailer * 1.25;
  const rentalWithMarkup = rental * 1.25;
  
  return labor + adminHours + mileage + materialsWithMarkup + equipmentWithMarkup + trailerWithMarkup + rentalWithMarkup;
}

export function calculateInvoiceTotal(wo, teamMembers = []) {
  // Calculate lead tech labor
  const leadRegular = (wo.hours_regular || 0) * 64;
  const leadOvertime = (wo.hours_overtime || 0) * 96;
  
  // Calculate team labor
  let teamLabor = 0;
  let teamMiles = 0;
  
  if (teamMembers && teamMembers.length > 0) {
    teamMembers.forEach(member => {
      teamLabor += ((member.hours_regular || 0) * 64) + ((member.hours_overtime || 0) * 96);
      teamMiles += (member.miles || 0);
    });
  }
  
  // Admin hours (always 2)
  const adminHours = 2 * 64;
  
  // Total labor
  const totalLabor = leadRegular + leadOvertime + teamLabor + adminHours;
  
  // Calculate materials and equipment with markups
  const materialsWithMarkup = (wo.material_cost || 0) * 1.25;
  const equipmentWithMarkup = (wo.emf_equipment_cost || 0) * 1.25;
  const trailerWithMarkup = (wo.trailer_cost || 0) * 1.25;
  const rentalWithMarkup = (wo.rental_cost || 0) * 1.25;
  
  // Mileage
  const totalMiles = (wo.miles || 0) + teamMiles;
  const mileageCost = totalMiles * 1.00;
  
  // Grand total
  const grandTotal = totalLabor + mileageCost + materialsWithMarkup + 
                     equipmentWithMarkup + trailerWithMarkup + rentalWithMarkup;
  
  return {
    leadRegular,
    leadOvertime,
    teamLabor,
    adminHours,
    totalLabor,
    materialsBase: wo.material_cost || 0,
    materialsWithMarkup,
    equipmentBase: wo.emf_equipment_cost || 0,
    equipmentWithMarkup,
    trailerBase: wo.trailer_cost || 0,
    trailerWithMarkup,
    rentalBase: wo.rental_cost || 0,
    rentalWithMarkup,
    totalMiles,
    mileageCost,
    grandTotal,
    remaining: (wo.nte || 0) - grandTotal,
    isOverBudget: grandTotal > (wo.nte || 0) && (wo.nte || 0) > 0
  };
}

export function calculateAge(dateEntered) {
  if (!dateEntered) return 0;
  const entered = new Date(dateEntered);
  const now = new Date();
  const diffTime = Math.abs(now - entered);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}
