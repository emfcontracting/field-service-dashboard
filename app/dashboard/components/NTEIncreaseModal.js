// app/dashboard/components/NTEIncreaseModal.js
'use client';

import { useState, useEffect } from 'react';

export default function NTEIncreaseModal({ workOrder, currentUser, supabase, onClose, onSave }) {
  const [formData, setFormData] = useState({
    is_verbal_nte: false,
    verbal_approved_by: '',
    description: '',
    hours_regular: 0,
    hours_overtime: 0,
    miles: 0,
    materials_base: 0,
    equipment_base: 0,
    rental_base: 0,
    trailer_base: 0,
    notes: ''
  });

  const [currentCosts, setCurrentCosts] = useState({
    labor: 0,
    materials: 0,
    equipment: 0,
    rental: 0,
    trailer: 0,
    mileage: 0,
    admin: 128,
    total: 0
  });

  const [additionalCosts, setAdditionalCosts] = useState({
    labor: 0,
    materials: 0,
    equipment: 0,
    rental: 0,
    trailer: 0,
    mileage: 0,
    total: 0
  });

  const [saving, setSaving] = useState(false);

  // Load current accrued costs on mount
  useEffect(() => {
    calculateCurrentCosts();
  }, []);

  // Recalculate additional costs when form data changes
  useEffect(() => {
    calculateAdditionalCosts();
  }, [formData]);

  const calculateCurrentCosts = async () => {
    try {
      // Get daily hours logs
      const { data: dailyLogs } = await supabase
        .from('daily_hours_log')
        .select('*')
        .eq('wo_id', workOrder.wo_id);

      // Get team member assignments
      const { data: teamMembers } = await supabase
        .from('work_order_assignments')
        .select('*')
        .eq('wo_id', workOrder.wo_id);

      let totalRT = 0;
      let totalOT = 0;
      let totalMileage = 0;

      // Use daily logs if available, otherwise fall back to legacy fields
      if (dailyLogs && dailyLogs.length > 0) {
        dailyLogs.forEach(log => {
          totalRT += parseFloat(log.hours_regular) || 0;
          totalOT += parseFloat(log.hours_overtime) || 0;
          totalMileage += parseFloat(log.miles) || 0;
        });
      } else {
        // Legacy hours from work_orders table
        totalRT = parseFloat(workOrder.hours_regular) || 0;
        totalOT = parseFloat(workOrder.hours_overtime) || 0;
        totalMileage = parseFloat(workOrder.miles) || 0;

        // Add team member hours
        if (teamMembers) {
          teamMembers.forEach(tm => {
            totalRT += parseFloat(tm.hours_regular) || 0;
            totalOT += parseFloat(tm.hours_overtime) || 0;
            totalMileage += parseFloat(tm.miles) || 0;
          });
        }
      }

      const labor = (totalRT * 64) + (totalOT * 96);
      const materials = (parseFloat(workOrder.material_cost) || 0) * 1.25;
      const equipment = (parseFloat(workOrder.emf_equipment_cost) || 0) * 1.25;
      const rental = (parseFloat(workOrder.rental_cost) || 0) * 1.25;
      const trailer = (parseFloat(workOrder.trailer_cost) || 0) * 1.25;
      const mileage = totalMileage * 1.00;
      const admin = 128;

      const total = labor + materials + equipment + rental + trailer + mileage + admin;

      setCurrentCosts({
        labor,
        materials,
        equipment,
        rental,
        trailer,
        mileage,
        admin,
        total
      });
    } catch (err) {
      console.error('Error calculating current costs:', err);
    }
  };

  const calculateAdditionalCosts = () => {
    // Labor calculation (NO admin fee - it's already in current costs)
    const labor = (parseFloat(formData.hours_regular) * 64) + (parseFloat(formData.hours_overtime) * 96);

    // Apply 25% markup to materials, equipment, rental, trailer
    const materials = parseFloat(formData.materials_base) * 1.25;
    const equipment = parseFloat(formData.equipment_base) * 1.25;
    const rental = parseFloat(formData.rental_base) * 1.25;
    const trailer = parseFloat(formData.trailer_base) * 1.25;

    // Mileage at $1.00/mile
    const mileage = parseFloat(formData.miles) * 1.00;

    const total = labor + materials + equipment + rental + trailer + mileage;

    setAdditionalCosts({
      labor,
      materials,
      equipment,
      rental,
      trailer,
      mileage,
      total
    });
  };

  const projectedTotal = currentCosts.total + additionalCosts.total;
  const originalNTE = parseFloat(workOrder.nte) || 0;
  const isOverBudget = projectedTotal > originalNTE;
  const newNTENeeded = projectedTotal;

  const handleSubmit = async () => {
    if (!formData.description.trim()) {
      alert('Please provide a description of the additional work');
      return;
    }

    try {
      setSaving(true);

      const nteData = {
        wo_id: workOrder.wo_id,
        created_by: currentUser.user_id,
        is_verbal_nte: formData.is_verbal_nte,
        verbal_approved_by: formData.is_verbal_nte ? formData.verbal_approved_by : null,
        description: formData.description,
        
        // Additional work estimates
        hours_regular: parseFloat(formData.hours_regular) || 0,
        hours_overtime: parseFloat(formData.hours_overtime) || 0,
        miles: parseFloat(formData.miles) || 0,
        materials_base: parseFloat(formData.materials_base) || 0,
        equipment_base: parseFloat(formData.equipment_base) || 0,
        rental_base: parseFloat(formData.rental_base) || 0,
        trailer_base: parseFloat(formData.trailer_base) || 0,
        
        // Calculated costs (with markup)
        labor_total: additionalCosts.labor,
        materials_with_markup: additionalCosts.materials,
        equipment_with_markup: additionalCosts.equipment,
        rental_with_markup: additionalCosts.rental,
        trailer_with_markup: additionalCosts.trailer,
        mileage_total: additionalCosts.mileage,
        grand_total: additionalCosts.total,
        
        // Snapshot of current costs at time of creation
        current_costs_snapshot: currentCosts.total,
        
        // New NTE amount needed
        new_nte_amount: newNTENeeded,
        
        // Status
        nte_status: formData.is_verbal_nte ? 'verbal_approved' : 'pending',
        
        notes: formData.notes
      };

      const { data, error } = await supabase
        .from('work_order_quotes')
        .insert(nteData)
        .select(`
          *,
          creator:users!work_order_quotes_created_by_fkey(first_name, last_name)
        `)
        .single();

      if (error) throw error;

      alert('✅ NTE increase request created successfully!');
      onSave(data);
    } catch (err) {
      console.error('Error creating NTE increase:', err);
      alert('❌ Error creating NTE increase: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4 overflow-y-auto">
      <div className="bg-gray-800 rounded-lg max-w-4xl w-full my-8">
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex justify-between items-center z-10 rounded-t-lg">
          <div>
            <h2 className="text-2xl font-bold text-yellow-400">💰 Create NTE Increase Request</h2>
            <p className="text-sm text-gray-400 mt-1">Work Order: {workOrder.wo_number}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-3xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          
          {/* NTE Type Selection */}
          <div className="bg-gray-700 rounded-lg p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_verbal_nte}
                onChange={(e) => setFormData({ ...formData, is_verbal_nte: e.target.checked })}
                className="w-5 h-5"
              />
              <div>
                <span className="font-semibold">📞 Verbal NTE Approval</span>
                <p className="text-sm text-gray-400">Check if this increase was verbally approved by CBRE</p>
              </div>
            </label>

            {formData.is_verbal_nte && (
              <div className="mt-3">
                <label className="block text-sm text-gray-400 mb-1">Approved By (Name)</label>
                <input
                  type="text"
                  value={formData.verbal_approved_by}
                  onChange={(e) => setFormData({ ...formData, verbal_approved_by: e.target.value })}
                  placeholder="Enter name of person who approved"
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg"
                />
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Description of Additional Work <span className="text-red-400">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the additional work that requires NTE increase..."
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
              rows="3"
            />
          </div>

          {/* CURRENT COSTS ACCRUED (Blue Box) */}
          <div className="bg-blue-900 border-2 border-blue-600 rounded-lg p-4">
            <h3 className="font-bold text-lg text-blue-300 mb-3">📊 CURRENT COSTS ACCRUED (Work Completed So Far)</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Labor</span>
                <span className="font-semibold">${currentCosts.labor.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Materials (with 25% markup)</span>
                <span className="font-semibold">${currentCosts.materials.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Equipment (with 25% markup)</span>
                <span className="font-semibold">${currentCosts.equipment.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Rental (with 25% markup)</span>
                <span className="font-semibold">${currentCosts.rental.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Trailer (with 25% markup)</span>
                <span className="font-semibold">${currentCosts.trailer.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Mileage</span>
                <span className="font-semibold">${currentCosts.mileage.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-yellow-300">
                <span>Admin Fee (2 hours)</span>
                <span className="font-semibold">${currentCosts.admin.toFixed(2)}</span>
              </div>
              <div className="border-t border-blue-700 pt-2 mt-2 flex justify-between text-lg font-bold text-blue-300">
                <span>CURRENT TOTAL:</span>
                <span>${currentCosts.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* ADDITIONAL WORK ESTIMATE (Yellow Box) */}
          <div className="bg-yellow-900 border-2 border-yellow-600 rounded-lg p-4">
            <h3 className="font-bold text-lg text-yellow-300 mb-3">🔧 ADDITIONAL WORK ESTIMATE</h3>
            
            {/* Labor */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Regular Hours</label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.hours_regular}
                  onChange={(e) => setFormData({ ...formData, hours_regular: e.target.value })}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                  placeholder="0"
                />
                <p className="text-xs text-gray-400 mt-1">× $64/hr = ${(parseFloat(formData.hours_regular) * 64).toFixed(2)}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Overtime Hours</label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.hours_overtime}
                  onChange={(e) => setFormData({ ...formData, hours_overtime: e.target.value })}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                  placeholder="0"
                />
                <p className="text-xs text-gray-400 mt-1">× $96/hr = ${(parseFloat(formData.hours_overtime) * 96).toFixed(2)}</p>
              </div>
            </div>

            {/* Materials & Equipment */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Materials Cost</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.materials_base}
                  onChange={(e) => setFormData({ ...formData, materials_base: e.target.value })}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-400 mt-1">+ 25% = ${(parseFloat(formData.materials_base) * 1.25).toFixed(2)}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Equipment Cost</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.equipment_base}
                  onChange={(e) => setFormData({ ...formData, equipment_base: e.target.value })}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-400 mt-1">+ 25% = ${(parseFloat(formData.equipment_base) * 1.25).toFixed(2)}</p>
              </div>
            </div>

            {/* Rental & Trailer */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Rental Cost</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.rental_base}
                  onChange={(e) => setFormData({ ...formData, rental_base: e.target.value })}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-400 mt-1">+ 25% = ${(parseFloat(formData.rental_base) * 1.25).toFixed(2)}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Trailer Cost</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.trailer_base}
                  onChange={(e) => setFormData({ ...formData, trailer_base: e.target.value })}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-400 mt-1">+ 25% = ${(parseFloat(formData.trailer_base) * 1.25).toFixed(2)}</p>
              </div>
            </div>

            {/* Mileage */}
            <div>
              <label className="block text-sm text-gray-300 mb-1">Additional Miles</label>
              <input
                type="number"
                step="0.1"
                value={formData.miles}
                onChange={(e) => setFormData({ ...formData, miles: e.target.value })}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                placeholder="0"
              />
              <p className="text-xs text-gray-400 mt-1">× $1.00/mi = ${(parseFloat(formData.miles) * 1.00).toFixed(2)}</p>
            </div>

            {/* Additional Work Total */}
            <div className="border-t border-yellow-700 pt-3 mt-3">
              <div className="flex justify-between text-lg font-bold text-yellow-300">
                <span>ADDITIONAL WORK TOTAL:</span>
                <span>${additionalCosts.total.toFixed(2)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Note: No admin fee for additional work (already in current costs)</p>
            </div>
          </div>

          {/* NTE INCREASE SUMMARY (Green Box) */}
          <div className="bg-green-900 border-2 border-green-600 rounded-lg p-4">
            <h3 className="font-bold text-lg text-green-300 mb-3">💰 NTE INCREASE SUMMARY</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Current Costs Accrued:</span>
                <span className="font-semibold">${currentCosts.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>+ Additional Work Estimate:</span>
                <span className="font-semibold">${additionalCosts.total.toFixed(2)}</span>
              </div>
              <div className="border-t border-green-700 pt-2 mt-2 flex justify-between text-lg font-bold text-green-300">
                <span>PROJECTED TOTAL COST:</span>
                <span>${projectedTotal.toFixed(2)}</span>
              </div>

              {/* Budget Comparison */}
              <div className="mt-4 pt-4 border-t border-green-700">
                <div className="flex justify-between text-sm text-gray-300 mb-2">
                  <span>Original NTE Budget:</span>
                  <span>${originalNTE.toFixed(2)}</span>
                </div>
                {isOverBudget && (
                  <div className="bg-red-900 text-red-200 rounded-lg p-3 text-center">
                    <div className="font-bold text-lg">⚠️ NEW NTE NEEDED</div>
                    <div className="text-2xl font-bold mt-1">${newNTENeeded.toFixed(2)}</div>
                    <p className="text-xs mt-1">Over budget by ${(projectedTotal - originalNTE).toFixed(2)}</p>
                  </div>
                )}
                {!isOverBudget && (
                  <div className="bg-green-800 text-green-200 rounded-lg p-3 text-center">
                    <div className="font-bold">✓ Within Budget</div>
                    <p className="text-sm mt-1">Remaining: ${(originalNTE - projectedTotal).toFixed(2)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Additional Notes (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional notes or details..."
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
              rows="2"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              onClick={handleSubmit}
              disabled={saving || !formData.description.trim()}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-bold text-lg transition"
            >
              {saving ? '⏳ Creating...' : '✅ Create NTE Increase Request'}
            </button>
            <button
              onClick={onClose}
              disabled={saving}
              className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-500 px-6 py-3 rounded-lg font-semibold transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
