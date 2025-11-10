// mobile/utils/calculations.js

export function calculateTotalHours(timeIn, timeOut) {
  if (!timeIn || !timeOut) return { regular: 0, overtime: 0 };
  
  const start = new Date(timeIn);
  const end = new Date(timeOut);
  const totalMinutes = (end - start) / (1000 * 60);
  const totalHours = totalMinutes / 60;
  
  if (totalHours <= 8) {
    return {
      regular: parseFloat(totalHours.toFixed(2)),
      overtime: 0
    };
  } else {
    return {
      regular: 8,
      overtime: parseFloat((totalHours - 8).toFixed(2))
    };
  }
}

export function calculateLaborCost(hoursRegular, hoursOvertime, rate = 64, overtimeRate = 96) {
  const regularCost = (hoursRegular || 0) * rate;
  const overtimeCost = (hoursOvertime || 0) * overtimeRate;
  return regularCost + overtimeCost;
}

export function calculateMileageCost(miles, rate = 1.00) {
  return (miles || 0) * rate;
}

export function calculateMaterialsCost(materials) {
  if (!materials || materials.length === 0) return 0;
  
  return materials.reduce((total, material) => {
    const cost = parseFloat(material.unit_cost || 0);
    const quantity = parseFloat(material.quantity || 0);
    const markup = parseFloat(material.markup_percentage || 25) / 100;
    return total + (cost * quantity * (1 + markup));
  }, 0);
}

export function calculateEquipmentCost(equipment) {
  if (!equipment || equipment.length === 0) return 0;
  
  return equipment.reduce((total, item) => {
    const cost = parseFloat(item.cost || 0);
    const markup = parseFloat(item.markup_percentage || 15) / 100;
    return total + (cost * (1 + markup));
  }, 0);
}

export function calculateTotalCost(workOrder, materials = [], equipment = [], teamMembers = []) {
  // Calculate primary worker costs
  const primaryLabor = calculateLaborCost(
    workOrder.hours_regular,
    workOrder.hours_overtime
  );
  
  const primaryMileage = calculateMileageCost(workOrder.miles);
  
  // Calculate team member costs
  let teamLabor = 0;
  let teamMileage = 0;
  
  if (teamMembers && teamMembers.length > 0) {
    teamMembers.forEach(member => {
      teamLabor += calculateLaborCost(
        member.hours_regular,
        member.hours_overtime
      );
      teamMileage += calculateMileageCost(member.miles);
    });
  }
  
  // Calculate materials and equipment
  const materialsCost = calculateMaterialsCost(materials);
  const equipmentCost = calculateEquipmentCost(equipment);
  
  // Admin hours (5 hours at $64/hr)
  const adminCost = 5 * 64;
  
  return {
    labor: primaryLabor + teamLabor,
    mileage: primaryMileage + teamMileage,
    materials: materialsCost,
    equipment: equipmentCost,
    admin: adminCost,
    total: primaryLabor + teamLabor + primaryMileage + teamMileage + 
           materialsCost + equipmentCost + adminCost
  };
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount || 0);
}