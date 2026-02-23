// components/quotes/NTEIncreasePage.js - Full Page NTE Increase/Quote Form
// CORRECTED: Current Accrued Costs + Estimated Additional = Projected Total (New NTE Needed)
// Uses same calculation logic as CostSummarySection
import { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { RATES as QUOTE_RATES, calculateExistingCosts as calcExistingCosts } from '../../services/quoteService';

// Rate constants from shared quoteService (single source of truth)
const RATES = {
  RT_RATE: QUOTE_RATES.RT_HOURLY,
  OT_RATE: QUOTE_RATES.OT_HOURLY,
  MILEAGE_RATE: QUOTE_RATES.MILEAGE,
  MARKUP_PERCENT: QUOTE_RATES.MARKUP_PERCENT,
  ADMIN_HOURS: QUOTE_RATES.ADMIN_HOURS
};

export default function NTEIncreasePage({
  workOrder,
  currentUser,
  currentTeamList,  // Need this to match CostSummarySection
  selectedQuote,
  materials,
  saving,
  editMode,
  onSave,
  onClose,
  onAddMaterial,
  onUpdateMaterial,
  onDeleteMaterial,
  calculateTotals
}) {
  const { language } = useLanguage();
  const supabase = createClientComponentClient();
  const wo = workOrder || {};
  
  // Existing costs from ticket (accrued so far) - matching CostSummarySection structure
  const [existingCosts, setExistingCosts] = useState({
    // Hours
    totalRT: 0,
    totalOT: 0,
    totalMiles: 0,
    // Calculated costs
    laborCost: 0,
    materialBase: 0,
    materialWithMarkup: 0,
    equipmentBase: 0,
    equipmentWithMarkup: 0,
    trailerBase: 0,
    trailerWithMarkup: 0,
    rentalBase: 0,
    rentalWithMarkup: 0,
    mileageCost: 0,
    grandTotal: 0
  });
  const [loadingExisting, setLoadingExisting] = useState(true);
  
  // Form state for ADDITIONAL costs (the new work being estimated)
  const [formData, setFormData] = useState({
    is_verbal_nte: false,
    verbal_approved_by: '',
    estimated_techs: 1,
    estimated_rt_hours: 0,
    estimated_ot_hours: 0,
    material_cost: 0,
    equipment_cost: 0,
    rental_cost: 0,
    trailer_cost: 0,
    estimated_miles: 0,
    description: '',
    notes: ''
  });
  
  const [useMaterialLineItems, setUseMaterialLineItems] = useState(false);
  const [materialLineItems, setMaterialLineItems] = useState([]);

  // Load existing costs when component mounts - SAME LOGIC AS CostSummarySection
  useEffect(() => {
    if (wo.wo_id) {
      calculateExistingCosts();
    }
  }, [wo.wo_id, currentTeamList]);
  
  // Calculate existing costs using shared function from quoteService
  const calculateExistingCosts = async () => {
    if (!wo.wo_id) {
      setLoadingExisting(false);
      return;
    }
    
    setLoadingExisting(true);
    try {
      const costs = await calcExistingCosts(supabase, wo, currentTeamList);
      setExistingCosts({
        totalRT: costs.totalRT || 0,
        totalOT: costs.totalOT || 0,
        totalMiles: costs.totalMiles || 0,
        laborCost: costs.laborCost || 0,
        materialBase: costs.totalMaterialBase || 0,
        emfMaterialBase: costs.emfMaterialBase || 0,
        techMaterialBase: costs.techMaterialBase || 0,
        materialWithMarkup: costs.materialWithMarkup || 0,
        equipmentBase: costs.equipmentBase || 0,
        equipmentWithMarkup: costs.equipmentWithMarkup || 0,
        trailerBase: costs.trailerBase || 0,
        trailerWithMarkup: costs.trailerWithMarkup || 0,
        rentalBase: costs.rentalBase || 0,
        rentalWithMarkup: costs.rentalWithMarkup || 0,
        mileageCost: costs.mileageCost || 0,
        grandTotal: costs.grandTotal || 0
      });
    } catch (err) {
      console.error('Error calculating existing costs:', err);
    }
    setLoadingExisting(false);
  };

  // Load existing quote data if editing
  useEffect(() => {
    if (selectedQuote && editMode) {
      setFormData({
        is_verbal_nte: selectedQuote.is_verbal_nte || false,
        verbal_approved_by: selectedQuote.verbal_approved_by || '',
        estimated_techs: selectedQuote.estimated_techs || 1,
        estimated_rt_hours: selectedQuote.estimated_rt_hours || 0,
        estimated_ot_hours: selectedQuote.estimated_ot_hours || 0,
        material_cost: selectedQuote.material_cost || 0,
        equipment_cost: selectedQuote.equipment_cost || 0,
        rental_cost: selectedQuote.rental_cost || 0,
        trailer_cost: selectedQuote.trailer_cost || 0,
        estimated_miles: selectedQuote.estimated_miles || 0,
        description: selectedQuote.description || '',
        notes: selectedQuote.notes || ''
      });
    }
  }, [selectedQuote, editMode]);

  // Calculate ADDITIONAL work costs (the new estimate)
  const calculateAdditionalCosts = () => {
    const techs = parseInt(formData.estimated_techs) || 1;
    const rtHours = parseFloat(formData.estimated_rt_hours) || 0;
    const otHours = parseFloat(formData.estimated_ot_hours) || 0;
    
    // Labor for additional work (no admin fee here - that's already in existing costs)
    const laborTotal = (techs * rtHours * RATES.RT_RATE) + (techs * otHours * RATES.OT_RATE);
    
    // Materials - either from line items or lump sum
    let materialCost = 0;
    if (useMaterialLineItems && materialLineItems.length > 0) {
      materialCost = materialLineItems.reduce((sum, item) => 
        sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_cost) || 0), 0);
    } else {
      materialCost = parseFloat(formData.material_cost) || 0;
    }
    const materialsWithMarkup = materialCost * (1 + RATES.MARKUP_PERCENT);
    
    const equipmentCost = parseFloat(formData.equipment_cost) || 0;
    const equipmentWithMarkup = equipmentCost * (1 + RATES.MARKUP_PERCENT);
    
    const rentalCost = parseFloat(formData.rental_cost) || 0;
    const rentalWithMarkup = rentalCost * (1 + RATES.MARKUP_PERCENT);
    
    const trailerCost = parseFloat(formData.trailer_cost) || 0;
    const trailerWithMarkup = trailerCost * (1 + RATES.MARKUP_PERCENT);
    
    const mileageTotal = (parseFloat(formData.estimated_miles) || 0) * RATES.MILEAGE_RATE;
    
    // Grand total for additional work
    const grandTotal = laborTotal + materialsWithMarkup + equipmentWithMarkup + 
                      rentalWithMarkup + trailerWithMarkup + mileageTotal;
    
    return {
      labor_total: laborTotal,
      material_cost: materialCost,
      materials_with_markup: materialsWithMarkup,
      equipment_cost: equipmentCost,
      equipment_with_markup: equipmentWithMarkup,
      rental_cost: rentalCost,
      rental_with_markup: rentalWithMarkup,
      trailer_cost: trailerCost,
      trailer_with_markup: trailerWithMarkup,
      mileage_total: mileageTotal,
      grand_total: grandTotal
    };
  };

  const additionalCosts = calculateAdditionalCosts();
  
  // Combined totals
  const projectedTotalCost = existingCosts.grandTotal + additionalCosts.grand_total;
  const originalNTE = parseFloat(wo.nte) || 0;
  const remaining = originalNTE - projectedTotalCost;

  const handleSave = async () => {
    const dataToSave = {
      ...formData,
      ...additionalCosts,
      wo_id: wo.wo_id,
      // SNAPSHOT: Store existing costs frozen at this moment
      existing_costs_total: existingCosts.grandTotal,
      projected_total: projectedTotalCost,
      original_nte: originalNTE,
      increase_needed: remaining < 0 ? Math.abs(remaining) : 0
    };
    
    if (useMaterialLineItems) {
      dataToSave.material_line_items = materialLineItems;
    }
    
    onSave(dataToSave);
  };

  const addMaterialLineItem = () => {
    setMaterialLineItems([...materialLineItems, { description: '', quantity: 1, unit_cost: 0 }]);
  };

  const updateMaterialLineItem = (index, field, value) => {
    const updated = [...materialLineItems];
    updated[index][field] = value;
    setMaterialLineItems(updated);
  };

  const removeMaterialLineItem = (index) => {
    setMaterialLineItems(materialLineItems.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-gray-800 p-4 border-b border-gray-700 z-10">
        <div className="flex justify-between items-center">
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            ← {language === 'en' ? 'Back' : 'Volver'}
          </button>
          <h1 className="text-lg font-bold">
            {editMode 
              ? (language === 'en' ? 'Edit NTE Increase' : 'Editar Aumento NTE')
              : (language === 'en' ? 'New NTE Increase' : 'Nuevo Aumento NTE')}
          </h1>
          <div className="w-16"></div>
        </div>
        <div className="text-center text-gray-400 text-sm mt-1">
          WO# {wo.wo_number}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* ===== CRITICAL WARNING BANNER ===== */}
        <div className="bg-amber-800 rounded-lg p-4 border-2 border-amber-400">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">⚠️</span>
            <div>
              <h3 className="font-bold text-amber-300 text-sm mb-2">
                {language === 'en' 
                  ? 'IMPORTANT – Before Creating This Request' 
                  : 'IMPORTANTE – Antes de Crear Esta Solicitud'}
              </h3>
              <p className="text-amber-100 text-sm leading-relaxed">
                {language === 'en'
                  ? 'ALL technicians on this ticket must have entered their complete data before this NTE Increase Request is created. This includes all hours worked, materials, mileage, and return trip home. Written approvals may take time and verbal approvals may not be granted immediately – all current costs must be fully recorded first.'
                  : 'TODOS los técnicos en este ticket deben haber ingresado sus datos completos antes de crear esta Solicitud de Aumento NTE. Esto incluye todas las horas trabajadas, materiales, millaje y el viaje de regreso a casa. Las aprobaciones escritas pueden tomar tiempo y las aprobaciones verbales pueden no otorgarse de inmediato – todos los costos actuales deben estar completamente registrados primero.'}
              </p>
            </div>
          </div>
        </div>

        {/* NTE Type Toggle */}
        <div className="bg-gray-800 rounded-lg p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_verbal_nte}
              onChange={(e) => setFormData({...formData, is_verbal_nte: e.target.checked})}
              className="w-5 h-5 rounded"
            />
            <span className="font-medium">
              {language === 'en' ? 'This is a Verbal NTE Increase' : 'Este es un Aumento NTE Verbal'}
            </span>
          </label>
          
          {formData.is_verbal_nte && (
            <div className="mt-3">
              <label className="block text-sm text-gray-400 mb-1">
                {language === 'en' ? 'Approved By (Name)' : 'Aprobado Por (Nombre)'}
              </label>
              <input
                type="text"
                value={formData.verbal_approved_by}
                onChange={(e) => setFormData({...formData, verbal_approved_by: e.target.value})}
                className="w-full bg-gray-700 rounded p-3 text-white"
                placeholder={language === 'en' ? 'Name of person who approved' : 'Nombre de quien aprobó'}
              />
            </div>
          )}
        </div>

        {/* Description */}
        <div className="bg-gray-800 rounded-lg p-4">
          <label className="block text-sm text-gray-400 mb-1">
            {language === 'en' ? 'Description of Additional Work' : 'Descripción del Trabajo Adicional'}
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            className="w-full bg-gray-700 rounded p-3 text-white min-h-[80px]"
            placeholder={language === 'en' ? 'Describe the additional work needed...' : 'Describa el trabajo adicional necesario...'}
          />
        </div>

        {/* ===== SECTION 1: CURRENT ACCRUED COSTS (matches Cost Summary) ===== */}
        <div className="bg-blue-900 rounded-lg p-4 border-2 border-blue-500">
          <h3 className="font-bold mb-3 text-blue-300">
            📊 {language === 'en' ? 'Current Costs Accrued' : 'Costos Actuales Acumulados'}
          </h3>
          
          {loadingExisting ? (
            <div className="text-center py-4 text-gray-400">Loading...</div>
          ) : (
            <div className="space-y-2 text-sm">
              {/* Labor breakdown */}
              <div className="flex justify-between">
                <span className="text-gray-300">RT Hours ({existingCosts.totalRT.toFixed(2)} hrs × $64)</span>
                <span>${(existingCosts.totalRT * RATES.RT_RATE).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">OT Hours ({existingCosts.totalOT.toFixed(2)} hrs × $96)</span>
                <span>${(existingCosts.totalOT * RATES.OT_RATE).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-yellow-400">
                <span>Admin (2 hrs × $64)</span>
                <span>$128.00</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-blue-600 pt-1">
                <span>{language === 'en' ? 'Total Labor' : 'Total Mano de Obra'}</span>
                <span>${existingCosts.laborCost.toFixed(2)}</span>
              </div>
              
              {/* Materials breakdown: EMF + Tech */}
              <div className="pt-2 space-y-1">
                <div className="text-xs text-gray-400 font-semibold">{language === 'en' ? 'Materials' : 'Materiales'}:</div>
                <div className="flex justify-between text-sm ml-2">
                  <span className="text-gray-300">{language === 'en' ? 'EMF Material (company)' : 'Material EMF (empresa)'}</span>
                  <span>${(existingCosts.emfMaterialBase || 0).toFixed(2)}</span>
                </div>
                {(existingCosts.techMaterialBase || 0) > 0 && (
                  <div className="flex justify-between text-sm ml-2">
                    <span className="text-orange-400">{language === 'en' ? 'Tech Material (reimbursable)' : 'Material Técnico (reembolsable)'}</span>
                    <span className="text-orange-400">${existingCosts.techMaterialBase.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-gray-300">{language === 'en' ? 'Total Materials (+25%)' : 'Total Materiales (+25%)'}</span>
                  <span>${existingCosts.materialWithMarkup.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">{language === 'en' ? 'Equipment' : 'Equipo'} (+25%)</span>
                <span>${existingCosts.equipmentWithMarkup.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">{language === 'en' ? 'Trailer' : 'Trailer'} (+25%)</span>
                <span>${existingCosts.trailerWithMarkup.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">{language === 'en' ? 'Rental' : 'Renta'} (+25%)</span>
                <span>${existingCosts.rentalWithMarkup.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">{language === 'en' ? 'Mileage' : 'Millaje'} ({existingCosts.totalMiles.toFixed(1)} mi)</span>
                <span>${existingCosts.mileageCost.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between text-lg font-bold border-t border-blue-400 pt-2 mt-2">
                <span>{language === 'en' ? 'CURRENT TOTAL' : 'TOTAL ACTUAL'}</span>
                <span className="text-blue-300">${existingCosts.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {/* ===== SECTION 2: ADDITIONAL WORK ESTIMATE ===== */}
        <div className="bg-yellow-900 rounded-lg p-4 border-2 border-yellow-500">
          <h3 className="font-bold mb-3 text-yellow-300">
            🔧 {language === 'en' ? 'Additional Work Estimate' : 'Estimado de Trabajo Adicional'}
          </h3>

          {/* Labor Estimate */}
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">
                {language === 'en' ? '# of Technicians' : '# de Técnicos'}
              </label>
              <input
                type="number"
                min="1"
                value={formData.estimated_techs}
                onChange={(e) => setFormData({...formData, estimated_techs: e.target.value})}
                className="w-full bg-gray-700 rounded p-2 text-white"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  {language === 'en' ? 'RT Hours (per tech)' : 'Horas RT (por técnico)'}
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.estimated_rt_hours}
                  onChange={(e) => setFormData({...formData, estimated_rt_hours: e.target.value})}
                  className="w-full bg-gray-700 rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  {language === 'en' ? 'OT Hours (per tech)' : 'Horas OT (por técnico)'}
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.estimated_ot_hours}
                  onChange={(e) => setFormData({...formData, estimated_ot_hours: e.target.value})}
                  className="w-full bg-gray-700 rounded p-2 text-white"
                />
              </div>
            </div>
            
            <div className="text-right text-sm text-yellow-300">
              {language === 'en' ? 'Labor Total' : 'Total Mano de Obra'}: ${additionalCosts.labor_total.toFixed(2)}
            </div>
          </div>

          {/* Materials */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm text-gray-300">
                {language === 'en' ? 'Materials' : 'Materiales'}
              </label>
              <button
                onClick={() => setUseMaterialLineItems(!useMaterialLineItems)}
                className="text-xs text-yellow-400 underline"
              >
                {useMaterialLineItems 
                  ? (language === 'en' ? 'Use Lump Sum' : 'Usar Suma Global')
                  : (language === 'en' ? 'Use Line Items' : 'Usar Líneas Detalladas')}
              </button>
            </div>
            
            {useMaterialLineItems ? (
              <div className="space-y-2">
                {materialLineItems.map((item, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateMaterialLineItem(index, 'description', e.target.value)}
                      className="flex-1 bg-gray-700 rounded p-2 text-white text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateMaterialLineItem(index, 'quantity', e.target.value)}
                      className="w-16 bg-gray-700 rounded p-2 text-white text-sm"
                    />
                    <input
                      type="number"
                      placeholder="$"
                      value={item.unit_cost}
                      onChange={(e) => updateMaterialLineItem(index, 'unit_cost', e.target.value)}
                      className="w-20 bg-gray-700 rounded p-2 text-white text-sm"
                    />
                    <button
                      onClick={() => removeMaterialLineItem(index)}
                      className="text-red-400 px-2"
                    >×</button>
                  </div>
                ))}
                <button
                  onClick={addMaterialLineItem}
                  className="text-yellow-400 text-sm"
                >+ {language === 'en' ? 'Add Material' : 'Agregar Material'}</button>
              </div>
            ) : (
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.material_cost}
                onChange={(e) => setFormData({...formData, material_cost: e.target.value})}
                className="w-full bg-gray-700 rounded p-2 text-white"
                placeholder="0.00"
              />
            )}
            <div className="text-right text-xs text-gray-400 mt-1">
              +25% markup = ${additionalCosts.materials_with_markup.toFixed(2)}
            </div>
          </div>

          {/* Equipment, Rental, Trailer */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div>
              <label className="block text-xs text-gray-300 mb-1">Equipment</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.equipment_cost}
                onChange={(e) => setFormData({...formData, equipment_cost: e.target.value})}
                className="w-full bg-gray-700 rounded p-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-300 mb-1">Rental</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.rental_cost}
                onChange={(e) => setFormData({...formData, rental_cost: e.target.value})}
                className="w-full bg-gray-700 rounded p-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-300 mb-1">Trailer</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.trailer_cost}
                onChange={(e) => setFormData({...formData, trailer_cost: e.target.value})}
                className="w-full bg-gray-700 rounded p-2 text-white text-sm"
              />
            </div>
          </div>

          {/* Mileage */}
          <div className="mb-4">
            <label className="block text-sm text-gray-300 mb-1">
              {language === 'en' ? 'Estimated Miles' : 'Millas Estimadas'}
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={formData.estimated_miles}
              onChange={(e) => setFormData({...formData, estimated_miles: e.target.value})}
              className="w-full bg-gray-700 rounded p-2 text-white"
            />
            <div className="text-right text-xs text-gray-400 mt-1">
              @ $1.00/mi = ${additionalCosts.mileage_total.toFixed(2)}
            </div>
          </div>

          {/* Additional Work Summary */}
          <div className="border-t border-yellow-600 pt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-300">Labor</span>
              <span>${additionalCosts.labor_total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Materials (+25%)</span>
              <span>${additionalCosts.materials_with_markup.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Equipment (+25%)</span>
              <span>${additionalCosts.equipment_with_markup.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Rental (+25%)</span>
              <span>${additionalCosts.rental_with_markup.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Trailer (+25%)</span>
              <span>${additionalCosts.trailer_with_markup.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Mileage</span>
              <span>${additionalCosts.mileage_total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t border-yellow-400 pt-2 mt-2">
              <span>{language === 'en' ? 'ADDITIONAL WORK TOTAL' : 'TOTAL TRABAJO ADICIONAL'}</span>
              <span className="text-yellow-300">${additionalCosts.grand_total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* ===== SECTION 3: NTE INCREASE SUMMARY ===== */}
        <div className="bg-green-900 rounded-lg p-4 border-2 border-green-500">
          <h3 className="font-bold mb-3 text-green-300">
            💰 {language === 'en' ? 'NTE Increase Summary' : 'Resumen de Aumento NTE'}
          </h3>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-300">{language === 'en' ? 'Current Costs Accrued' : 'Costos Actuales'}</span>
              <span className="text-blue-300">${existingCosts.grandTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">{language === 'en' ? 'Additional Work Estimate' : 'Trabajo Adicional'}</span>
              <span className="text-yellow-300">${additionalCosts.grand_total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t border-green-400 pt-2">
              <span>{language === 'en' ? 'PROJECTED TOTAL COST' : 'COSTO TOTAL PROYECTADO'}</span>
              <span className="text-white">${projectedTotalCost.toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-green-600 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-300">{language === 'en' ? 'Original NTE Budget' : 'Presupuesto NTE Original'}</span>
              <span>${originalNTE.toFixed(2)}</span>
            </div>

            {remaining < 0 ? (
              <div className="flex justify-between text-xl font-bold bg-red-600 -mx-4 px-4 py-3 mt-2 rounded-b-lg">
                <span>{language === 'en' ? 'NEW NTE NEEDED' : 'NUEVO NTE NECESARIO'}</span>
                <span>${projectedTotalCost.toFixed(2)}</span>
              </div>
            ) : (
              <div className="flex justify-between text-lg font-bold text-green-400 border-t border-green-400 pt-2">
                <span>✅ {language === 'en' ? 'WITHIN CURRENT NTE' : 'DENTRO DEL NTE ACTUAL'}</span>
                <span>${remaining.toFixed(2)} {language === 'en' ? 'remaining' : 'restante'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-gray-800 rounded-lg p-4">
          <label className="block text-sm text-gray-400 mb-1">
            {language === 'en' ? 'Additional Notes' : 'Notas Adicionales'}
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({...formData, notes: e.target.value})}
            className="w-full bg-gray-700 rounded p-3 text-white min-h-[60px]"
            placeholder={language === 'en' ? 'Any additional notes...' : 'Notas adicionales...'}
          />
        </div>
      </div>

      {/* Fixed Bottom Save Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 p-4 border-t border-gray-700">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 py-4 rounded-lg font-bold text-lg"
        >
          {saving 
            ? (language === 'en' ? 'Saving...' : 'Guardando...') 
            : (language === 'en' ? '✅ Save NTE Increase' : '✅ Guardar Aumento NTE')}
        </button>
      </div>
    </div>
  );
}
