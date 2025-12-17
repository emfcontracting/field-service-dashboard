// components/CostSummarySection.js

export default function CostSummarySection({ wo, currentTeamList }) {
  // Calculate team totals for display
  const primaryRT = parseFloat(wo.hours_regular) || 0;
  const primaryOT = parseFloat(wo.hours_overtime) || 0;
  const primaryMiles = parseFloat(wo.miles) || 0;

  let teamRT = 0;
  let teamOT = 0;
  let teamMiles = 0;

  if (currentTeamList && Array.isArray(currentTeamList)) {
    currentTeamList.forEach(member => {
      if (member) {
        teamRT += parseFloat(member.hours_regular) || 0;
        teamOT += parseFloat(member.hours_overtime) || 0;
        teamMiles += parseFloat(member.miles) || 0;
      }
    });
  }

  const totalRT = primaryRT + teamRT;
  const totalOT = primaryOT + teamOT;
  const totalMiles = primaryMiles + teamMiles;
  const adminHours = 2;

  const laborCost = (totalRT * 64) + (totalOT * 96) + (adminHours * 64);
  const materialBase = parseFloat(wo.material_cost) || 0;
  const materialWithMarkup = materialBase * 1.25;
  const equipmentBase = parseFloat(wo.emf_equipment_cost) || 0;
  const equipmentWithMarkup = equipmentBase * 1.25;
  const trailerBase = parseFloat(wo.trailer_cost) || 0;
  const trailerWithMarkup = trailerBase * 1.25;
  const rentalBase = parseFloat(wo.rental_cost) || 0;
  const rentalWithMarkup = rentalBase * 1.25;
  const mileageCost = totalMiles * 1.00;
  const grandTotal = laborCost + materialWithMarkup + equipmentWithMarkup + trailerWithMarkup + rentalWithMarkup + mileageCost;
  const nte = parseFloat(wo.nte) || 0;
  const remaining = nte - grandTotal;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="font-bold mb-3 text-blue-400">💰 Cost Summary</h3>
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">TEAM RT Hours</span>
          <span>{totalRT.toFixed(2)} hrs × $64</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">TEAM OT Hours</span>
          <span>{totalOT.toFixed(2)} hrs × $96</span>
        </div>
        <div className="flex justify-between text-sm text-yellow-400">
          <span>+ Admin Hours</span>
          <span>2 hrs × $64 = $128.00</span>
        </div>
        <div className="flex justify-between font-bold border-t border-gray-700 pt-2">
          <span>Total Labor:</span>
          <span className="text-green-500">${laborCost.toFixed(2)}</span>
        </div>
      </div>

      <div className="border-t border-gray-600 my-4"></div>

      <div className="flex justify-between text-sm mb-2">
        <span className="text-gray-400">Materials:</span>
        <span>${materialBase.toFixed(2)}</span>
      </div>
      <div className="flex justify-between text-sm text-yellow-400 mb-3">
        <span className="ml-4">+ 25% Markup:</span>
        <span>+ ${(materialBase * 0.25).toFixed(2)}</span>
      </div>

      <div className="flex justify-between text-sm mb-2">
        <span className="text-gray-400">Equipment:</span>
        <span>${equipmentBase.toFixed(2)}</span>
      </div>
      <div className="flex justify-between text-sm text-yellow-400 mb-3">
        <span className="ml-4">+ 25% Markup:</span>
        <span>+ ${(equipmentBase * 0.25).toFixed(2)}</span>
      </div>

      <div className="flex justify-between text-sm mb-2">
        <span className="text-gray-400">Trailer:</span>
        <span>${trailerBase.toFixed(2)}</span>
      </div>
      <div className="flex justify-between text-sm text-yellow-400 mb-3">
        <span className="ml-4">+ 25% Markup:</span>
        <span>+ ${(trailerBase * 0.25).toFixed(2)}</span>
      </div>

      <div className="flex justify-between text-sm mb-2">
        <span className="text-gray-400">Rental:</span>
        <span>${rentalBase.toFixed(2)}</span>
      </div>
      <div className="flex justify-between text-sm text-yellow-400 mb-3">
        <span className="ml-4">+ 25% Markup:</span>
        <span>+ ${(rentalBase * 0.25).toFixed(2)}</span>
      </div>

      <div className="flex justify-between text-sm mb-4">
        <span className="text-gray-400">Total Mileage (All Team):</span>
        <span>{totalMiles.toFixed(1)} mi × $1.00 = ${mileageCost.toFixed(2)}</span>
      </div>

      <div className="border-t-2 border-gray-700 pt-3">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-400">NTE Budget:</span>
          <span>${nte.toFixed(2)}</span>
        </div>
        <div className={`flex justify-between font-bold text-lg ${remaining >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          <span>Remaining:</span>
          <span>${remaining.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
