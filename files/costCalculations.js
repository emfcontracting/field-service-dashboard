// costCalculations.js - All cost calculation logic

import { LABOR_RATES, MILEAGE_RATE, MARKUP_RATES } from './constants';

// Labor Cost Calculations
export function calculateLaborCosts(hoursRegular = 0, hoursOvertime = 0) {
  const regularCost = parseFloat(hoursRegular || 0) * LABOR_RATES.REGULAR;
  const overtimeCost = parseFloat(hoursOvertime || 0) * LABOR_RATES.OVERTIME;
  return {
    regular: regularCost,
    overtime: overtimeCost,
    total: regularCost + overtimeCost
  };
}

// Team Member Labor Calculations
export function calculateTeamMemberLabor(teamMembers) {
  if (!teamMembers || teamMembers.length === 0) {
    return {
      regularHours: 0,
      overtimeHours: 0,
      regularCost: 0,
      overtimeCost: 0,
      totalCost: 0
    };
  }

  const totals = teamMembers.reduce((acc, member) => {
    const regular = parseFloat(member.hours_regular || 0);
    const overtime = parseFloat(member.hours_overtime || 0);
    
    return {
      regularHours: acc.regularHours + regular,
      overtimeHours: acc.overtimeHours + overtime,
      regularCost: acc.regularCost + (regular * LABOR_RATES.REGULAR),
      overtimeCost: acc.overtimeCost + (overtime * LABOR_RATES.OVERTIME)
    };
  }, {
    regularHours: 0,
    overtimeHours: 0,
    regularCost: 0,
    overtimeCost: 0
  });

  totals.totalCost = totals.regularCost + totals.overtimeCost;
  return totals;
}

// Materials Cost Calculations
export function calculateMaterialsCosts(materials = 0) {
  const base = parseFloat(materials || 0);
  const markup = base * MARKUP_RATES.MATERIALS;
  return {
    base,
    markup,
    total: base + markup
  };
}

// Equipment Cost Calculations
export function calculateEquipmentCosts(equipmentPurchase = 0, equipmentRental = 0) {
  const purchaseBase = parseFloat(equipmentPurchase || 0);
  const rentalBase = parseFloat(equipmentRental || 0);
  
  const purchaseMarkup = purchaseBase * MARKUP_RATES.EQUIPMENT_PURCHASE;
  const rentalMarkup = rentalBase * MARKUP_RATES.EQUIPMENT_RENTAL;
  
  return {
    purchase: {
      base: purchaseBase,
      markup: purchaseMarkup,
      total: purchaseBase + purchaseMarkup
    },
    rental: {
      base: rentalBase,
      markup: rentalMarkup,
      total: rentalBase + rentalMarkup
    },
    total: purchaseBase + purchaseMarkup + rentalBase + rentalMarkup
  };
}

// Mileage Cost Calculations
export function calculateMileageCost(miles = 0) {
  const mileageValue = parseFloat(miles || 0);
  return mileageValue * MILEAGE_RATE;
}

// Total Cost Calculation
export function calculateTotalCost(workOrder, teamMembers = []) {
  const labor = calculateLaborCosts(workOrder.hours_regular, workOrder.hours_overtime);
  const teamLabor = calculateTeamMemberLabor(teamMembers);
  const materials = calculateMaterialsCosts(workOrder.materials);
  const equipment = calculateEquipmentCosts(
    workOrder.equipment_purchase,
    workOrder.equipment_rental
  );
  const mileage = calculateMileageCost(workOrder.miles);

  const totalLabor = labor.total + teamLabor.totalCost;
  const totalMaterials = materials.total;
  const totalEquipment = equipment.total;
  const totalMileage = mileage;

  const grandTotal = totalLabor + totalMaterials + totalEquipment + totalMileage;

  return {
    labor: {
      primary: labor,
      team: teamLabor,
      total: totalLabor
    },
    materials,
    equipment,
    mileage: {
      miles: parseFloat(workOrder.miles || 0),
      cost: totalMileage
    },
    grandTotal,
    nte: parseFloat(workOrder.nte || 0),
    remaining: parseFloat(workOrder.nte || 0) - grandTotal
  };
}

// Get cost breakdown for display
export function getCostBreakdown(workOrder, teamMembers = []) {
  const costs = calculateTotalCost(workOrder, teamMembers);
  
  return {
    sections: [
      {
        title: 'Labor Costs',
        items: [
          {
            label: 'Primary Tech - Regular',
            hours: parseFloat(workOrder.hours_regular || 0),
            rate: LABOR_RATES.REGULAR,
            amount: costs.labor.primary.regular
          },
          {
            label: 'Primary Tech - Overtime',
            hours: parseFloat(workOrder.hours_overtime || 0),
            rate: LABOR_RATES.OVERTIME,
            amount: costs.labor.primary.overtime
          },
          ...(teamMembers.length > 0 ? [{
            label: 'Team Members',
            detail: `${costs.labor.team.regularHours.toFixed(2)}h RT + ${costs.labor.team.overtimeHours.toFixed(2)}h OT`,
            amount: costs.labor.team.totalCost
          }] : [])
        ],
        total: costs.labor.total
      },
      {
        title: 'Materials',
        items: [
          {
            label: 'Materials Cost',
            amount: costs.materials.base
          },
          {
            label: 'Markup (25%)',
            amount: costs.materials.markup
          }
        ],
        total: costs.materials.total
      },
      {
        title: 'Equipment',
        items: [
          ...(costs.equipment.purchase.base > 0 ? [
            {
              label: 'Equipment Purchase',
              amount: costs.equipment.purchase.base
            },
            {
              label: 'Purchase Markup (25%)',
              amount: costs.equipment.purchase.markup
            }
          ] : []),
          ...(costs.equipment.rental.base > 0 ? [
            {
              label: 'Equipment Rental',
              amount: costs.equipment.rental.base
            },
            {
              label: 'Rental Markup (15%)',
              amount: costs.equipment.rental.markup
            }
          ] : [])
        ],
        total: costs.equipment.total
      },
      {
        title: 'Mileage',
        items: [
          {
            label: `${costs.mileage.miles} miles @ $${MILEAGE_RATE}/mile`,
            amount: costs.mileage.cost
          }
        ],
        total: costs.mileage.cost
      }
    ],
    summary: {
      total: costs.grandTotal,
      nte: costs.nte,
      remaining: costs.remaining,
      percentUsed: costs.nte > 0 ? (costs.grandTotal / costs.nte) * 100 : 0
    }
  };
}
