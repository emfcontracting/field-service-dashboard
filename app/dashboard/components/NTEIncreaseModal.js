// app/dashboard/components/NTEIncreaseModal.js
// FIXED: Matches CostSummarySection calculation exactly
// ADDED: Edit mode, Warning banner, Verbal/Written NTE logic, Approve button
// ADDED: Reconciliation Mode (superuser only) - after-the-fact NTE requests
'use client';

import { useState, useEffect } from 'react';

// Rate constants - MUST match CostSummarySection & quoteService
const RATES = {
  RT_RATE: 64,
  OT_RATE: 96,
  MILEAGE_RATE: 1.00,
  MARKUP_PERCENT: 0.25,
  ADMIN_HOURS: 2  // 2 hrs × $64 = $128
};

// Superuser email - matches dashboard/page.js SUPERUSER_EMAIL
const SUPERUSER_EMAIL = 'jones.emfcontracting@gmail.com';

export default function NTEIncreaseModal({ 
  workOrder, 
  currentUser, 
  supabase, 
  onClose, 
  onSave,
  // Edit mode props
  existingQuote = null,  // Pass existing quote for edit mode
  editMode = false
}) {
  // Superuser check - only Daniel sees the reconciliation toggle
  const canUseReconciliationMode = currentUser?.email === SUPERUSER_EMAIL;

  // Request mode: 'estimate' (default, forward-looking) or 'reconciliation' (after-the-fact)
  const [requestMode, setRequestMode] = useState('estimate');

  const [formData, setFormData] = useState({
    is_verbal_nte: false,
    verbal_approved_by: '',
    description: '',
    estimated_techs: 1,
    hours_regular: 0,
    hours_overtime: 0,
    miles: 0,
    materials_base: 0,
    equipment_base: 0,
    rental_base: 0,
    trailer_base: 0,
    notes: ''
  });

  // Reconciliation mode: editable actual final cost breakdown
  // Pre-filled from currentCosts when entering reconciliation mode
  const [reconciliationCosts, setReconciliationCosts] = useState({
    rt_hours: 0,
    ot_hours: 0,
    miles: 0,
    materials_base: 0,  // EMF + Tech combined base
    equipment_base: 0,
    rental_base: 0,
    trailer_base: 0
  });

  const [currentCosts, setCurrentCosts] = useState({
    totalRT: 0, totalOT: 0, totalMiles: 0,
    labor: 0, materials: 0, equipment: 0, rental: 0, trailer: 0,
    mileage: 0, admin: 128, total: 0,
    emfMaterialBase: 0, techMaterialBase: 0
  });

  const [saving, setSaving] = useState(false);
  const [loadingCosts, setLoadingCosts] = useState(true);

  // Load current accrued costs on mount
  useEffect(() => {
    calculateCurrentCosts();
  }, []);

  // Load existing quote data if editing
  useEffect(() => {
    if (existingQuote && editMode) {
      // Restore request mode from existing quote
      if (existingQuote.request_type === 'reconciliation') {
        setRequestMode('reconciliation');
        setReconciliationCosts({
          rt_hours: existingQuote.actual_rt_hours || 0,
          ot_hours: existingQuote.actual_ot_hours || 0,
          miles: existingQuote.actual_miles || 0,
          materials_base: existingQuote.actual_material_cost || 0,
          equipment_base: existingQuote.actual_equipment_cost || 0,
          rental_base: existingQuote.actual_rental_cost || 0,
          trailer_base: existingQuote.actual_trailer_cost || 0
        });
      }

      setFormData({
        is_verbal_nte: existingQuote.is_verbal_nte || false,
        verbal_approved_by: existingQuote.verbal_approved_by || '',
        description: existingQuote.description || '',
        estimated_techs: existingQuote.estimated_techs || 1,
        hours_regular: existingQuote.estimated_rt_hours || 0,
        hours_overtime: existingQuote.estimated_ot_hours || 0,
        miles: existingQuote.estimated_miles || 0,
        materials_base: existingQuote.material_cost || 0,
        equipment_base: existingQuote.equipment_cost || 0,
        rental_base: existingQuote.rental_cost || 0,
        trailer_base: existingQuote.trailer_cost || 0,
        notes: existingQuote.notes || ''
      });
    }
  }, [existingQuote, editMode]);

  // When switching INTO reconciliation mode for the first time (not edit mode),
  // pre-fill from current accrued costs so user has a starting point.
  useEffect(() => {
    if (requestMode === 'reconciliation' && !loadingCosts && !editMode) {
      const totalMaterialBase = (currentCosts.emfMaterialBase || 0) + (currentCosts.techMaterialBase || 0);
      setReconciliationCosts({
        rt_hours: currentCosts.totalRT,
        ot_hours: currentCosts.totalOT,
        miles: currentCosts.totalMiles,
        materials_base: totalMaterialBase,
        equipment_base: parseFloat(workOrder.emf_equipment_cost) || 0,
        rental_base: parseFloat(workOrder.rental_cost) || 0,
        trailer_base: parseFloat(workOrder.trailer_cost) || 0
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestMode, loadingCosts]);

  // ============================================================
  // Calculate current costs - MATCHES CostSummarySection EXACTLY
  // Combines legacy + daily hours, includes tech_material_cost
  // ============================================================
  const calculateCurrentCosts = async () => {
    setLoadingCosts(true);
    try {
      // 1. Legacy totals from work_orders table
      const primaryRT = parseFloat(workOrder.hours_regular) || 0;
      const primaryOT = parseFloat(workOrder.hours_overtime) || 0;
      const primaryMiles = parseFloat(workOrder.miles) || 0;

      // 2. Team member assignments (legacy)
      let teamRT = 0, teamOT = 0, teamMiles = 0;
      const { data: teamMembers } = await supabase
        .from('work_order_assignments')
        .select('hours_regular, hours_overtime, miles')
        .eq('wo_id', workOrder.wo_id);

      if (teamMembers) {
        teamMembers.forEach(tm => {
          teamRT += parseFloat(tm.hours_regular) || 0;
          teamOT += parseFloat(tm.hours_overtime) || 0;
          teamMiles += parseFloat(tm.miles) || 0;
        });
      }

      const legacyTotalRT = primaryRT + teamRT;
      const legacyTotalOT = primaryOT + teamOT;
      const legacyTotalMiles = primaryMiles + teamMiles;

      // 3. Daily hours logs (including tech_material_cost)
      const { data: dailyLogs } = await supabase
        .from('daily_hours_log')
        .select('hours_regular, hours_overtime, miles, tech_material_cost')
        .eq('wo_id', workOrder.wo_id);

      let dailyTotalRT = 0, dailyTotalOT = 0, dailyTotalMiles = 0, dailyTotalTechMaterial = 0;

      if (dailyLogs) {
        dailyLogs.forEach(log => {
          dailyTotalRT += parseFloat(log.hours_regular) || 0;
          dailyTotalOT += parseFloat(log.hours_overtime) || 0;
          dailyTotalMiles += parseFloat(log.miles) || 0;
          dailyTotalTechMaterial += parseFloat(log.tech_material_cost) || 0;
        });
      }

      // COMBINED totals = legacy + daily (NOT either/or!)
      const totalRT = legacyTotalRT + dailyTotalRT;
      const totalOT = legacyTotalOT + dailyTotalOT;
      const totalMiles = legacyTotalMiles + dailyTotalMiles;

      // Labor includes admin hours
      const labor = (totalRT * RATES.RT_RATE) + (totalOT * RATES.OT_RATE) + (RATES.ADMIN_HOURS * RATES.RT_RATE);

      // Materials: EMF + Tech, both with 25% markup
      const emfMaterialBase = parseFloat(workOrder.material_cost) || 0;
      const techMaterialBase = dailyTotalTechMaterial;
      const totalMaterialBase = emfMaterialBase + techMaterialBase;
      const materials = totalMaterialBase * (1 + RATES.MARKUP_PERCENT);

      const equipmentBase = parseFloat(workOrder.emf_equipment_cost) || 0;
      const equipment = equipmentBase * (1 + RATES.MARKUP_PERCENT);

      const rentalBase = parseFloat(workOrder.rental_cost) || 0;
      const rental = rentalBase * (1 + RATES.MARKUP_PERCENT);

      const trailerBase = parseFloat(workOrder.trailer_cost) || 0;
      const trailer = trailerBase * (1 + RATES.MARKUP_PERCENT);

      const mileage = totalMiles * RATES.MILEAGE_RATE;
      const admin = RATES.ADMIN_HOURS * RATES.RT_RATE;
      const total = labor + materials + equipment + rental + trailer + mileage;

      setCurrentCosts({
        totalRT, totalOT, totalMiles,
        labor, materials, equipment, rental, trailer, mileage, admin, total,
        emfMaterialBase, techMaterialBase
      });
    } catch (err) {
      console.error('Error calculating current costs:', err);
    }
    setLoadingCosts(false);
  };

  // Calculate additional work costs (ESTIMATE mode)
  const calcAdditional = () => {
    const techs = parseInt(formData.estimated_techs) || 1;
    const labor = (parseFloat(formData.hours_regular) * techs * RATES.RT_RATE) + 
                  (parseFloat(formData.hours_overtime) * techs * RATES.OT_RATE);
    const materials = parseFloat(formData.materials_base) * (1 + RATES.MARKUP_PERCENT);
    const equipment = parseFloat(formData.equipment_base) * (1 + RATES.MARKUP_PERCENT);
    const rental = parseFloat(formData.rental_base) * (1 + RATES.MARKUP_PERCENT);
    const trailer = parseFloat(formData.trailer_base) * (1 + RATES.MARKUP_PERCENT);
    const mileage = parseFloat(formData.miles) * RATES.MILEAGE_RATE;
    const total = labor + materials + equipment + rental + trailer + mileage;
    return { labor, materials, equipment, rental, trailer, mileage, total };
  };

  // Calculate RECONCILIATION totals (final actual costs, with markup + admin)
  const calcReconciliation = () => {
    const rt = parseFloat(reconciliationCosts.rt_hours) || 0;
    const ot = parseFloat(reconciliationCosts.ot_hours) || 0;
    const labor = (rt * RATES.RT_RATE) + (ot * RATES.OT_RATE) + (RATES.ADMIN_HOURS * RATES.RT_RATE);
    const materials = (parseFloat(reconciliationCosts.materials_base) || 0) * (1 + RATES.MARKUP_PERCENT);
    const equipment = (parseFloat(reconciliationCosts.equipment_base) || 0) * (1 + RATES.MARKUP_PERCENT);
    const rental = (parseFloat(reconciliationCosts.rental_base) || 0) * (1 + RATES.MARKUP_PERCENT);
    const trailer = (parseFloat(reconciliationCosts.trailer_base) || 0) * (1 + RATES.MARKUP_PERCENT);
    const mileage = (parseFloat(reconciliationCosts.miles) || 0) * RATES.MILEAGE_RATE;
    const admin = RATES.ADMIN_HOURS * RATES.RT_RATE;
    const total = labor + materials + equipment + rental + trailer + mileage;
    return { labor, materials, equipment, rental, trailer, mileage, admin, total };
  };

  const additional = calcAdditional();
  const reconciliation = calcReconciliation();
  const originalNTE = parseFloat(workOrder.nte) || 0;

  // Mode-specific values
  const isReconciliation = requestMode === 'reconciliation';
  const projectedTotal = isReconciliation
    ? reconciliation.total
    : currentCosts.total + additional.total;
  const isOverBudget = projectedTotal > originalNTE;
  const overageAmount = Math.max(0, projectedTotal - originalNTE);

  // Auto-fill description with a smart breakdown (reconciliation mode helper)
  const generateReconciliationDescription = () => {
    const overage = projectedTotal - originalNTE;
    const breakdown =
`Work completed. Final actual costs reconciled against original NTE.

Original NTE:        $${originalNTE.toFixed(2)}
Final Actual Total:  $${reconciliation.total.toFixed(2)}
─────────────────────────────────────────
Additional Needed:   $${overage.toFixed(2)}

Final Cost Breakdown:
- Labor (RT ${parseFloat(reconciliationCosts.rt_hours).toFixed(2)} hrs + OT ${parseFloat(reconciliationCosts.ot_hours).toFixed(2)} hrs + 2 admin hrs): $${reconciliation.labor.toFixed(2)}
- Materials (with markup): $${reconciliation.materials.toFixed(2)}
- Equipment (with markup): $${reconciliation.equipment.toFixed(2)}
- Rental (with markup): $${reconciliation.rental.toFixed(2)}
- Trailer (with markup): $${reconciliation.trailer.toFixed(2)}
- Mileage (${parseFloat(reconciliationCosts.miles).toFixed(1)} mi): $${reconciliation.mileage.toFixed(2)}`;
    setFormData({ ...formData, description: breakdown });
  };

  const handleSubmit = async () => {
    if (!formData.description.trim()) {
      alert('Please provide a description of the additional work');
      return;
    }

    // Reconciliation mode: refuse to submit if actual is under or equal to NTE
    if (isReconciliation && overageAmount <= 0) {
      alert('⚠️ Reconciliation Mode: Final actual costs are within original NTE. No NTE increase needed.');
      return;
    }

    try {
      setSaving(true);
      const isVerbal = formData.is_verbal_nte;

      // Build base nteData payload
      const nteData = {
        wo_id: workOrder.wo_id,
        created_by: currentUser.user_id,
        is_verbal_nte: isVerbal,
        verbal_approved_by: isVerbal ? formData.verbal_approved_by : null,
        description: formData.description,
        request_type: requestMode,
        notes: formData.notes,
        original_nte: originalNTE,
        nte_status: isVerbal ? 'verbal_approved' : 'pending',
        approved_at: isVerbal ? new Date().toISOString() : null,
        approved_by: isVerbal ? formData.verbal_approved_by : null,
      };

      if (isReconciliation) {
        // RECONCILIATION MODE: actual final costs, the overage IS the request
        Object.assign(nteData, {
          // Use estimate fields = 0 (or store zero — these are not "future" estimates)
          estimated_techs: 1,
          estimated_rt_hours: 0,
          estimated_ot_hours: 0,
          estimated_miles: 0,
          material_cost: 0,
          equipment_cost: 0,
          rental_cost: 0,
          trailer_cost: 0,
          // Reconciliation-specific actuals
          actual_rt_hours: parseFloat(reconciliationCosts.rt_hours) || 0,
          actual_ot_hours: parseFloat(reconciliationCosts.ot_hours) || 0,
          actual_miles: parseFloat(reconciliationCosts.miles) || 0,
          actual_material_cost: parseFloat(reconciliationCosts.materials_base) || 0,
          actual_equipment_cost: parseFloat(reconciliationCosts.equipment_base) || 0,
          actual_rental_cost: parseFloat(reconciliationCosts.rental_base) || 0,
          actual_trailer_cost: parseFloat(reconciliationCosts.trailer_base) || 0,
          actual_final_total: reconciliation.total,
          // Calculated breakdown of the actual final total
          labor_total: reconciliation.labor,
          materials_with_markup: reconciliation.materials,
          equipment_with_markup: reconciliation.equipment,
          rental_with_markup: reconciliation.rental,
          trailer_with_markup: reconciliation.trailer,
          mileage_total: reconciliation.mileage,
          // grand_total = the OVERAGE (the actual NTE increase being requested)
          grand_total: overageAmount,
          // SNAPSHOT values
          current_costs_snapshot: currentCosts.total,
          new_nte_amount: reconciliation.total,
        });
      } else {
        // ESTIMATE MODE: forward-looking, original behavior
        Object.assign(nteData, {
          estimated_techs: parseInt(formData.estimated_techs) || 1,
          estimated_rt_hours: parseFloat(formData.hours_regular) || 0,
          estimated_ot_hours: parseFloat(formData.hours_overtime) || 0,
          material_cost: parseFloat(formData.materials_base) || 0,
          equipment_cost: parseFloat(formData.equipment_base) || 0,
          rental_cost: parseFloat(formData.rental_base) || 0,
          trailer_cost: parseFloat(formData.trailer_base) || 0,
          estimated_miles: parseFloat(formData.miles) || 0,
          labor_total: additional.labor,
          materials_with_markup: additional.materials,
          equipment_with_markup: additional.equipment,
          rental_with_markup: additional.rental,
          trailer_with_markup: additional.trailer,
          mileage_total: additional.mileage,
          grand_total: additional.total,
          current_costs_snapshot: currentCosts.total,
          new_nte_amount: projectedTotal,
        });
      }

      let result;

      if (editMode && existingQuote) {
        // UPDATE existing quote
        const { data, error } = await supabase
          .from('work_order_quotes')
          .update({
            ...nteData,
            updated_at: new Date().toISOString()
          })
          .eq('quote_id', existingQuote.quote_id)
          .select(`*, creator:users!work_order_quotes_created_by_fkey(first_name, last_name)`)
          .single();

        if (error) throw error;
        result = data;
      } else {
        // INSERT new quote
        const { data, error } = await supabase
          .from('work_order_quotes')
          .insert(nteData)
          .select(`*, creator:users!work_order_quotes_created_by_fkey(first_name, last_name)`)
          .single();

        if (error) throw error;
        result = data;
      }

      // VERBAL → Immediately update work order NTE
      // WRITTEN → Do NOT update NTE - keep old NTE until approved
      if (isVerbal) {
        const newNteValue = isReconciliation ? reconciliation.total : projectedTotal;
        const { error: updateError } = await supabase
          .from('work_orders')
          .update({ nte: newNteValue })
          .eq('wo_id', workOrder.wo_id);

        if (updateError) console.error('Error updating work order NTE (verbal):', updateError);
      }

      alert(editMode ? '✅ NTE Increase updated!' : '✅ NTE Increase request created!');
      onSave(result);
    } catch (err) {
      console.error('Error saving NTE increase:', err);
      alert('❌ Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Approve a written NTE (admin action)
  const handleApproveWrittenNTE = async () => {
    if (!existingQuote) return;
    
    const approverName = prompt('Enter the name of the person who approved this NTE:');
    if (!approverName) return;

    try {
      setSaving(true);
      const newNte = parseFloat(existingQuote.new_nte_amount) || projectedTotal;

      // Update quote status
      const { error: quoteError } = await supabase
        .from('work_order_quotes')
        .update({
          nte_status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: approverName,
          updated_at: new Date().toISOString()
        })
        .eq('quote_id', existingQuote.quote_id);

      if (quoteError) throw quoteError;

      // NOW update the work order NTE
      const { error: woError } = await supabase
        .from('work_orders')
        .update({ nte: newNte })
        .eq('wo_id', workOrder.wo_id);

      if (woError) throw woError;

      alert(`✅ NTE approved! New NTE: $${newNte.toFixed(2)}`);
      onSave({ ...existingQuote, nte_status: 'approved', approved_by: approverName });
    } catch (err) {
      console.error('Error approving NTE:', err);
      alert('❌ Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const isWrittenPending = editMode && existingQuote && 
    !existingQuote.is_verbal_nte && 
    (existingQuote.nte_status === 'pending' || !existingQuote.nte_status);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4 overflow-y-auto">
      <div className="bg-gray-800 rounded-lg max-w-4xl w-full my-8">
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex justify-between items-center z-10 rounded-t-lg">
          <div>
            <h2 className="text-2xl font-bold text-yellow-400">
              💰 {editMode ? 'Edit NTE Increase Request' : 'Create NTE Increase Request'}
            </h2>
            <p className="text-sm text-gray-400 mt-1">Work Order: {workOrder.wo_number}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none">×</button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">

          {/* ⚠️ WARNING BANNER */}
          <div className="bg-amber-900 border-2 border-amber-500 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">⚠️</span>
              <div>
                <h3 className="font-bold text-amber-300 text-sm mb-1">IMPORTANT – Before Creating This Request</h3>
                <p className="text-amber-100 text-sm leading-relaxed">
                  ALL technicians on this ticket must have entered their complete data before this NTE Increase Request is created. 
                  This includes all hours worked, materials, mileage, and return trip home. 
                  Written approvals may take time and verbal approvals may not be granted immediately – all current costs must be fully recorded first.
                </p>
              </div>
            </div>
          </div>

          {/* 🔄 MODE TOGGLE (Superuser only) */}
          {canUseReconciliationMode && !editMode && (
            <div className="bg-gray-700 border-2 border-purple-600 rounded-lg p-4">
              <h3 className="font-bold text-sm text-purple-300 mb-3">⚙️ Request Mode (Superuser)</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRequestMode('estimate')}
                  className={`p-3 rounded-lg font-semibold text-sm transition border-2 ${
                    requestMode === 'estimate'
                      ? 'bg-yellow-700 border-yellow-400 text-white'
                      : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  📊 Estimate Mode
                  <div className="text-xs font-normal mt-1 opacity-90">Forward-looking (default)</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRequestMode('reconciliation')}
                  className={`p-3 rounded-lg font-semibold text-sm transition border-2 ${
                    requestMode === 'reconciliation'
                      ? 'bg-purple-700 border-purple-400 text-white'
                      : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  🔄 Reconciliation Mode
                  <div className="text-xs font-normal mt-1 opacity-90">Work already complete</div>
                </button>
              </div>
              {isReconciliation && (
                <p className="text-xs text-purple-300 mt-3 leading-relaxed">
                  💡 Reconciliation Mode: Enter the FINAL actual costs (pre-filled from logged hours).
                  The amount over the original NTE will automatically be declared as the additional cost requested.
                </p>
              )}
            </div>
          )}

          {/* Edit-mode reconciliation indicator */}
          {editMode && existingQuote?.request_type === 'reconciliation' && (
            <div className="bg-purple-900 border-2 border-purple-500 rounded-lg p-3 text-center">
              <span className="font-bold text-purple-200">🔄 Reconciliation Mode Request</span>
            </div>
          )}

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
                <p className="text-sm text-gray-400">Check if this increase was verbally approved – NTE will be updated immediately</p>
              </div>
            </label>
            {!formData.is_verbal_nte && (
              <p className="text-sm text-blue-400 mt-2 ml-8">
                📄 Written NTE – The current NTE will remain unchanged until this request is formally approved.
              </p>
            )}

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
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm text-gray-400">
                Description of Additional Work <span className="text-red-400">*</span>
              </label>
              {isReconciliation && (
                <button
                  type="button"
                  onClick={generateReconciliationDescription}
                  className="text-xs bg-purple-700 hover:bg-purple-600 text-white px-3 py-1 rounded transition"
                >
                  ✨ Auto-fill from breakdown
                </button>
              )}
            </div>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={
                isReconciliation
                  ? "Describe the work that was completed and why it exceeded the original NTE..."
                  : "Describe the additional work that requires NTE increase..."
              }
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
              rows={isReconciliation ? "6" : "3"}
            />
          </div>

          {/* CURRENT COSTS ACCRUED (Blue Box) - shown in BOTH modes for reference */}
          <div className="bg-blue-900 border-2 border-blue-600 rounded-lg p-4">
            <h3 className="font-bold text-lg text-blue-300 mb-3">
              📊 CURRENT COSTS ACCRUED {isReconciliation && <span className="text-sm font-normal text-blue-400">(reference – from logged data)</span>}
            </h3>
            {loadingCosts ? (
              <div className="text-center py-4 text-gray-400">Calculating costs...</div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>RT Hours ({currentCosts.totalRT.toFixed(2)} hrs × $64)</span>
                  <span className="font-semibold">${(currentCosts.totalRT * RATES.RT_RATE).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>OT Hours ({currentCosts.totalOT.toFixed(2)} hrs × $96)</span>
                  <span className="font-semibold">${(currentCosts.totalOT * RATES.OT_RATE).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-yellow-300">
                  <span>Admin Fee (2 hours × $64)</span>
                  <span className="font-semibold">${currentCosts.admin.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t border-blue-700 pt-1">
                  <span>Total Labor</span>
                  <span>${currentCosts.labor.toFixed(2)}</span>
                </div>

                {/* Materials breakdown */}
                <div className="pt-2">
                  <div className="flex justify-between text-sm">
                    <span>EMF Material (company)</span>
                    <span>${(currentCosts.emfMaterialBase || 0).toFixed(2)}</span>
                  </div>
                  {(currentCosts.techMaterialBase || 0) > 0 && (
                    <div className="flex justify-between text-sm text-orange-400">
                      <span>Tech Material (reimbursable)</span>
                      <span>${currentCosts.techMaterialBase.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold">
                    <span>Materials (with 25% markup)</span>
                    <span>${currentCosts.materials.toFixed(2)}</span>
                  </div>
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
                  <span>Mileage ({currentCosts.totalMiles.toFixed(1)} mi × $1.00)</span>
                  <span className="font-semibold">${currentCosts.mileage.toFixed(2)}</span>
                </div>
                <div className="border-t border-blue-700 pt-2 mt-2 flex justify-between text-lg font-bold text-blue-300">
                  <span>CURRENT TOTAL:</span>
                  <span>${currentCosts.total.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* ====================================================== */}
          {/* ESTIMATE MODE: Additional Work Estimate (Yellow Box)    */}
          {/* ====================================================== */}
          {!isReconciliation && (
            <div className="bg-yellow-900 border-2 border-yellow-600 rounded-lg p-4">
              <h3 className="font-bold text-lg text-yellow-300 mb-3">🔧 ADDITIONAL WORK ESTIMATE</h3>
              
              {/* # Technicians */}
              <div className="mb-3">
                <label className="block text-sm text-gray-300 mb-1"># of Technicians</label>
                <input
                  type="number"
                  min="1"
                  value={formData.estimated_techs}
                  onChange={(e) => setFormData({ ...formData, estimated_techs: e.target.value })}
                  className="w-32 bg-gray-700 text-white px-3 py-2 rounded-lg"
                />
              </div>

              {/* Labor */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Regular Hours (per tech)</label>
                  <input
                    type="number" step="0.5"
                    value={formData.hours_regular}
                    onChange={(e) => setFormData({ ...formData, hours_regular: e.target.value })}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {parseInt(formData.estimated_techs) || 1} tech(s) × {parseFloat(formData.hours_regular) || 0} hrs × $64 = ${((parseInt(formData.estimated_techs) || 1) * (parseFloat(formData.hours_regular) || 0) * 64).toFixed(2)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Overtime Hours (per tech)</label>
                  <input
                    type="number" step="0.5"
                    value={formData.hours_overtime}
                    onChange={(e) => setFormData({ ...formData, hours_overtime: e.target.value })}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {parseInt(formData.estimated_techs) || 1} tech(s) × {parseFloat(formData.hours_overtime) || 0} hrs × $96 = ${((parseInt(formData.estimated_techs) || 1) * (parseFloat(formData.hours_overtime) || 0) * 96).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Materials & Equipment */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Materials Cost</label>
                  <input
                    type="number" step="0.01"
                    value={formData.materials_base}
                    onChange={(e) => setFormData({ ...formData, materials_base: e.target.value })}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                  />
                  <p className="text-xs text-gray-400 mt-1">+ 25% = ${(parseFloat(formData.materials_base) * 1.25).toFixed(2)}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Equipment Cost</label>
                  <input
                    type="number" step="0.01"
                    value={formData.equipment_base}
                    onChange={(e) => setFormData({ ...formData, equipment_base: e.target.value })}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                  />
                  <p className="text-xs text-gray-400 mt-1">+ 25% = ${(parseFloat(formData.equipment_base) * 1.25).toFixed(2)}</p>
                </div>
              </div>

              {/* Rental & Trailer */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Rental Cost</label>
                  <input
                    type="number" step="0.01"
                    value={formData.rental_base}
                    onChange={(e) => setFormData({ ...formData, rental_base: e.target.value })}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                  />
                  <p className="text-xs text-gray-400 mt-1">+ 25% = ${(parseFloat(formData.rental_base) * 1.25).toFixed(2)}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Trailer Cost</label>
                  <input
                    type="number" step="0.01"
                    value={formData.trailer_base}
                    onChange={(e) => setFormData({ ...formData, trailer_base: e.target.value })}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                  />
                  <p className="text-xs text-gray-400 mt-1">+ 25% = ${(parseFloat(formData.trailer_base) * 1.25).toFixed(2)}</p>
                </div>
              </div>

              {/* Mileage */}
              <div className="mb-3">
                <label className="block text-sm text-gray-300 mb-1">Additional Miles</label>
                <input
                  type="number" step="0.1"
                  value={formData.miles}
                  onChange={(e) => setFormData({ ...formData, miles: e.target.value })}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                />
                <p className="text-xs text-gray-400 mt-1">× $1.00/mi = ${(parseFloat(formData.miles) * 1.00).toFixed(2)}</p>
              </div>

              {/* Additional Work Total */}
              <div className="border-t border-yellow-700 pt-3 mt-3">
                <div className="flex justify-between text-lg font-bold text-yellow-300">
                  <span>ADDITIONAL WORK TOTAL:</span>
                  <span>${additional.total.toFixed(2)}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Note: No admin fee for additional work (already in current costs)</p>
              </div>
            </div>
          )}

          {/* ====================================================== */}
          {/* RECONCILIATION MODE: Final Actual Costs (Purple Box)    */}
          {/* ====================================================== */}
          {isReconciliation && (
            <div className="bg-purple-900 border-2 border-purple-600 rounded-lg p-4">
              <h3 className="font-bold text-lg text-purple-300 mb-1">🔄 FINAL ACTUAL COSTS</h3>
              <p className="text-xs text-purple-400 mb-3">Pre-filled from logged data. Adjust if final numbers differ.</p>

              {/* Labor */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Total RT Hours (all techs)</label>
                  <input
                    type="number" step="0.25"
                    value={reconciliationCosts.rt_hours}
                    onChange={(e) => setReconciliationCosts({ ...reconciliationCosts, rt_hours: e.target.value })}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {parseFloat(reconciliationCosts.rt_hours) || 0} hrs × $64 = ${((parseFloat(reconciliationCosts.rt_hours) || 0) * 64).toFixed(2)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Total OT Hours (all techs)</label>
                  <input
                    type="number" step="0.25"
                    value={reconciliationCosts.ot_hours}
                    onChange={(e) => setReconciliationCosts({ ...reconciliationCosts, ot_hours: e.target.value })}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {parseFloat(reconciliationCosts.ot_hours) || 0} hrs × $96 = ${((parseFloat(reconciliationCosts.ot_hours) || 0) * 96).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="text-xs text-yellow-300 mb-3 px-1">
                + Admin Fee (2 hrs × $64) = ${(RATES.ADMIN_HOURS * RATES.RT_RATE).toFixed(2)} automatically included
              </div>

              {/* Materials & Equipment */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Total Materials Cost (base)</label>
                  <input
                    type="number" step="0.01"
                    value={reconciliationCosts.materials_base}
                    onChange={(e) => setReconciliationCosts({ ...reconciliationCosts, materials_base: e.target.value })}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                  />
                  <p className="text-xs text-gray-400 mt-1">+ 25% = ${(parseFloat(reconciliationCosts.materials_base) * 1.25).toFixed(2)}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Total Equipment Cost (base)</label>
                  <input
                    type="number" step="0.01"
                    value={reconciliationCosts.equipment_base}
                    onChange={(e) => setReconciliationCosts({ ...reconciliationCosts, equipment_base: e.target.value })}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                  />
                  <p className="text-xs text-gray-400 mt-1">+ 25% = ${(parseFloat(reconciliationCosts.equipment_base) * 1.25).toFixed(2)}</p>
                </div>
              </div>

              {/* Rental & Trailer */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Total Rental Cost (base)</label>
                  <input
                    type="number" step="0.01"
                    value={reconciliationCosts.rental_base}
                    onChange={(e) => setReconciliationCosts({ ...reconciliationCosts, rental_base: e.target.value })}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                  />
                  <p className="text-xs text-gray-400 mt-1">+ 25% = ${(parseFloat(reconciliationCosts.rental_base) * 1.25).toFixed(2)}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Total Trailer Cost (base)</label>
                  <input
                    type="number" step="0.01"
                    value={reconciliationCosts.trailer_base}
                    onChange={(e) => setReconciliationCosts({ ...reconciliationCosts, trailer_base: e.target.value })}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                  />
                  <p className="text-xs text-gray-400 mt-1">+ 25% = ${(parseFloat(reconciliationCosts.trailer_base) * 1.25).toFixed(2)}</p>
                </div>
              </div>

              {/* Mileage */}
              <div className="mb-3">
                <label className="block text-sm text-gray-300 mb-1">Total Miles (all techs)</label>
                <input
                  type="number" step="0.1"
                  value={reconciliationCosts.miles}
                  onChange={(e) => setReconciliationCosts({ ...reconciliationCosts, miles: e.target.value })}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                />
                <p className="text-xs text-gray-400 mt-1">× $1.00/mi = ${(parseFloat(reconciliationCosts.miles) * 1.00).toFixed(2)}</p>
              </div>

              {/* Final Actual Total */}
              <div className="border-t border-purple-700 pt-3 mt-3">
                <div className="flex justify-between text-lg font-bold text-purple-300">
                  <span>FINAL ACTUAL TOTAL:</span>
                  <span>${reconciliation.total.toFixed(2)}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Includes admin fee + 25% markup on materials/equipment/rental/trailer</p>
              </div>
            </div>
          )}

          {/* ====================================================== */}
          {/* SUMMARY (Green Box) - changes based on mode             */}
          {/* ====================================================== */}
          <div className="bg-green-900 border-2 border-green-600 rounded-lg p-4">
            <h3 className="font-bold text-lg text-green-300 mb-3">
              💰 {isReconciliation ? 'NTE RECONCILIATION SUMMARY' : 'NTE INCREASE SUMMARY'}
            </h3>
            <div className="space-y-2">
              {isReconciliation ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span>Final Actual Total:</span>
                    <span className="font-semibold text-purple-300">${reconciliation.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>− Original NTE Budget:</span>
                    <span className="font-semibold text-gray-300">${originalNTE.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-green-700 pt-2 mt-2 flex justify-between text-lg font-bold">
                    <span className={overageAmount > 0 ? 'text-red-300' : 'text-green-300'}>
                      {overageAmount > 0 ? 'ADDITIONAL COST NEEDED:' : 'WITHIN BUDGET:'}
                    </span>
                    <span className={overageAmount > 0 ? 'text-red-300' : 'text-green-300'}>
                      ${overageAmount > 0 ? overageAmount.toFixed(2) : (originalNTE - reconciliation.total).toFixed(2)}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-sm">
                    <span>Current Costs Accrued:</span>
                    <span className="font-semibold text-blue-300">${currentCosts.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>+ Additional Work Estimate:</span>
                    <span className="font-semibold text-yellow-300">${additional.total.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-green-700 pt-2 mt-2 flex justify-between text-lg font-bold text-green-300">
                    <span>PROJECTED TOTAL COST:</span>
                    <span>${projectedTotal.toFixed(2)}</span>
                  </div>
                </>
              )}

              {/* Budget Comparison */}
              <div className="mt-4 pt-4 border-t border-green-700">
                {!isReconciliation && (
                  <div className="flex justify-between text-sm text-gray-300 mb-2">
                    <span>Original NTE Budget:</span>
                    <span>${originalNTE.toFixed(2)}</span>
                  </div>
                )}
                {isOverBudget ? (
                  <div className="bg-red-900 text-red-200 rounded-lg p-3 text-center">
                    <div className="font-bold text-lg">
                      {isReconciliation ? '⚠️ NTE INCREASE REQUIRED' : '⚠️ NEW NTE NEEDED'}
                    </div>
                    <div className="text-2xl font-bold mt-1">${projectedTotal.toFixed(2)}</div>
                    <p className="text-xs mt-1">Over budget by ${(projectedTotal - originalNTE).toFixed(2)}</p>
                    {formData.is_verbal_nte && (
                      <p className="text-xs mt-1 text-orange-300">📞 Verbal – NTE will be updated immediately upon save</p>
                    )}
                    {!formData.is_verbal_nte && (
                      <p className="text-xs mt-1 text-blue-300">📄 Written – Current NTE stays at ${originalNTE.toFixed(2)} until approved</p>
                    )}
                  </div>
                ) : (
                  <div className="bg-green-800 text-green-200 rounded-lg p-3 text-center">
                    <div className="font-bold">✓ Within Budget</div>
                    {isReconciliation ? (
                      <p className="text-sm mt-1">No NTE increase needed – under budget by ${(originalNTE - projectedTotal).toFixed(2)}</p>
                    ) : (
                      <p className="text-sm mt-1">Remaining: ${(originalNTE - projectedTotal).toFixed(2)}</p>
                    )}
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
              disabled={saving || !formData.description.trim() || (isReconciliation && overageAmount <= 0)}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-bold text-lg transition"
            >
              {saving 
                ? '⏳ Saving...' 
                : editMode 
                  ? '✅ Update NTE Increase' 
                  : isReconciliation
                    ? '✅ Submit Reconciliation Request'
                    : '✅ Create NTE Increase Request'}
            </button>
            
            {/* Approve Button - Only for written pending NTEs in edit mode */}
            {isWrittenPending && (
              <button
                onClick={handleApproveWrittenNTE}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-3 rounded-lg font-bold transition"
              >
                ✅ Approve NTE
              </button>
            )}
            
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
