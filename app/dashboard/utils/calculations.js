// app/dashboard/utils/calculations.js

export function calculateStats(orders) {
  return {
    total: orders.length,
    pending: orders.filter(wo => wo.status === 'pending').length,
    assigned: orders.filter(wo => wo.status === 'assigned').length,
    in_progress: orders.filter(wo => wo.status === 'in_progress').length,
    completed: orders.filter(wo => wo.status === 'completed').length,
    needs_return: orders.filter(wo => wo.status === 'needs_return').length
  };
}

export function calculateTotalCost(wo) {
  const labor = ((wo.hours_regular || 0) * 64) + ((wo.hours_overtime || 0) * 96);
  const materials = wo.material_cost || 0;
  const equipment = wo.emf_equipment_cost || 0;
  const trailer = wo.trailer_cost || 0;
  const rental = wo.rental_cost || 0;
  const mileage = (wo.miles || 0) * 1.00;
  
  return labor + materials + equipment + trailer + rental + mileage;
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