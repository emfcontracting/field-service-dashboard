// Cost Calculation Functions

export function calculateTotalCosts(workOrder, currentTeamList = []) {
  const laborCosts = calculateLaborCosts(workOrder, currentTeamList);
  const materialCosts = calculateMaterialCosts(workOrder);
  const equipmentCosts = calculateEquipmentCosts(workOrder);
  const mileageCosts = calculateMileageCosts(workOrder);

  const subtotal = laborCosts.total + materialCosts.total + equipmentCosts.total + mileageCosts;
  
  return {
    labor: laborCosts,
    materials: materialCosts,
    equipment: equipmentCosts,
    mileage: mileageCosts,
    subtotal,
    remaining: (workOrder.nte || 0) - subtotal
  };
}

export function calculateLaborCosts(workOrder, currentTeamList = []) {
  const RT_RATE = 64;
  const OT_RATE = 96;
  
  let totalRT = 0;
  let totalOT = 0;
  let teamBreakdown = [];

  if (currentTeamList && currentTeamList.length > 0) {
    currentTeamList.forEach(member => {
      const rt = parseFloat(member.hours_regular || 0);
      const ot = parseFloat(member.hours_overtime || 0);
      totalRT += rt;
      totalOT += ot;
      
      teamBreakdown.push({
        name: `${member.first_name} ${member.last_name}`,
        rt,
        ot,
        rtCost: rt * RT_RATE,
        otCost: ot * OT_RATE,
        total: (rt * RT_RATE) + (ot * OT_RATE)
      });
    });
  } else {
    totalRT = parseFloat(workOrder.hours_regular || 0);
    totalOT = parseFloat(workOrder.hours_overtime || 0);
  }

  const rtCost = totalRT * RT_RATE;
  const otCost = totalOT * OT_RATE;
  const total = rtCost + otCost;

  return {
    totalRT,
    totalOT,
    rtCost,
    otCost,
    total,
    teamBreakdown
  };
}

export function calculateMaterialCosts(workOrder) {
  const materials = parseFloat(workOrder.cost_material || 0);
  const markup = materials * 0.25;
  const total = materials + markup;

  return {
    base: materials,
    markup,
    total
  };
}

export function calculateEquipmentCosts(workOrder) {
  const equipment = parseFloat(workOrder.cost_equipment || 0);
  const rental = parseFloat(workOrder.cost_rental || 0);
  const base = equipment + rental;
  
  let markupRate = 0.25;
  if (base > 2000) markupRate = 0.15;
  
  const markup = base * markupRate;
  const total = base + markup;

  return {
    equipment,
    rental,
    base,
    markup,
    markupRate,
    total
  };
}

export function calculateMileageCosts(workOrder) {
  const miles = parseFloat(workOrder.miles || 0);
  return miles * 1.0;
}

export function validateHours(rt, ot, laborCosts) {
  const totalHours = rt + ot;
  
  if (totalHours > 24) {
    return {
      valid: false,
      message: 'Total hours cannot exceed 24 hours per day'
    };
  }

  if (rt < 0 || ot < 0) {
    return {
      valid: false,
      message: 'Hours cannot be negative'
    };
  }

  return {
    valid: true,
    message: ''
  };
}
