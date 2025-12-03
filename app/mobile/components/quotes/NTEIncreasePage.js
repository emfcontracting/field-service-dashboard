// components/quotes/NTEIncreasePage.js - Full Page NTE Increase/Quote Form
// NOW INCLUDES EXISTING TICKET COSTS + ADDITIONAL ESTIMATED COSTS
import { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { RATES } from '../../services/quoteService';

export default function NTEIncreasePage({
  workOrder,
  currentUser,
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
  
  // Existing costs from ticket
  const [existingCosts, setExistingCosts] = useState({
    laborRT: 0,
    laborOT: 0,
    laborTotal: 0,
    materialCost: 0,
    materialWithMarkup: 0,
    equipmentCost: 0,
    equipmentWithMarkup: 0,
    trailerCost: 0,
    trailerWithMarkup: 0,
    rentalCost: 0,
    rentalWithMarkup: 0,
    mileage: 0,
    mileageCost: 0,
    adminFee: 128,
    grandTotal: 0
  });
  const [loadingExisting, setLoadingExisting] = useState(true);
  
  // Form state for ADDITIONAL costs
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

  // Material form state
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [materialForm, setMaterialForm] = useState({
    description: '',
    quantity: 1,
    unit_cost: 0
  });

  // Load existing costs from work order
  useEffect(() => {
    if (wo.wo_id) {
      loadExistingCosts();
    }
  }, [wo.wo_id]);

  // Initialize form with existing quote data (for editing)
  useEffect(() => {
    if (selectedQuote) {
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
  }, [selectedQuote]);

  async function loadExistingCosts() {
    try {
      setLoadingExisting(true);
      
      // Get legacy hours from work_orders
      const primaryRT = parseFloat(wo.hours_regular) || 0;
      const primaryOT = parseFloat(wo.hours_overtime) || 0;
      const primaryMiles = parseFloat(wo.miles) || 0;

      // Get team member hours from assignments
      const { data: assignments } = await supabase
        .from('work_order_assignments')
        .select('hours_regular, hours_overtime, miles')
        .eq('wo_id', wo.wo_id);

      let teamRT = 0, teamOT = 0, teamMiles = 0;
      if (assignments) {
        assignments.forEach(a => {
          teamRT += parseFloat(a.hours_regular) || 0;
          teamOT += parseFloat(a.hours_overtime) || 0;
          teamMiles += parseFloat(a.miles) || 0;
        });
      }

      // Get daily hours log totals
      const { data: dailyLogs } = await supabase
        .from('daily_hours_log')
        .select('hours_regular, hours_overtime, miles')
        .eq('wo_id', wo.wo_id);

      let dailyRT = 0, dailyOT = 0, dailyMiles = 0;
      if (dailyLogs) {
        dailyLogs.forEach(log => {
          dailyRT += parseFloat(log.hours_regular) || 0;
          dailyOT += parseFloat(log.hours_overtime) || 0;
          dailyMiles += parseFloat(log.miles) || 0;
        });
      }

      // Combine all hours
      const totalRT = primaryRT + teamRT + dailyRT;
      const totalOT = primaryOT + teamOT + dailyOT;
      const totalMiles = primaryMiles + teamMiles + dailyMiles;

      // Get costs from work order
      const materialBase = parseFloat(wo.material_cost) || 0;
      const equipmentBase = parseFloat(wo.emf_equipment_cost) || 0;
      const trailerBase = parseFloat(wo.trailer_cost) || 0;
      const rentalBase = parseFloat(wo.rental_cost) || 0;

      // Calculate totals
      const laborTotal = (totalRT * RATES.RT_HOURLY) + (totalOT * RATES.OT_HOURLY);
      const materialWithMarkup = materialBase * 1.25;
      const equipmentWithMarkup = equipmentBase * 1.25;
      const trailerWithMarkup = trailerBase * 1.25;
      const rentalWithMarkup = rentalBase * 1.25;
      const mileageCost = totalMiles * RATES.MILEAGE;
      const adminFee = RATES.ADMIN_FEE;
      
      const grandTotal = laborTotal + materialWithMarkup + equipmentWithMarkup + 
                         trailerWithMarkup + rentalWithMarkup + mileageCost + adminFee;

      setExistingCosts({
        laborRT: totalRT,
        laborOT: totalOT,
        laborTotal,
        materialCost: materialBase,
        materialWithMarkup,
        equipmentCost: equipmentBase,
        equipmentWithMarkup,
        trailerCost: trailerBase,
        trailerWithMarkup,
        rentalCost: rentalBase,
        rentalWithMarkup,
        mileage: totalMiles,
        mileageCost,
        adminFee,
        grandTotal
      });

    } catch (err) {
      console.error('Error loading existing costs:', err);
    } finally {
      setLoadingExisting(false);
    }
  }

  // Calculate ADDITIONAL costs from form
  const additionalLaborTotal = 
    (parseFloat(formData.estimated_rt_hours) * parseInt(formData.estimated_techs) * RATES.RT_HOURLY) +
    (parseFloat(formData.estimated_ot_hours) * parseInt(formData.estimated_techs) * RATES.OT_HOURLY);

  // Material from line items or manual entry
  const materialLineItemTotal = materials.reduce(
    (sum, mat) => sum + (parseFloat(mat.total_cost) || 0), 
    0
  );
  const additionalMaterialCost = materials.length > 0 ? materialLineItemTotal : parseFloat(formData.material_cost) || 0;
  const additionalMaterialWithMarkup = additionalMaterialCost * 1.25;

  const additionalEquipmentWithMarkup = (
    (parseFloat(formData.equipment_cost) || 0) + 
    (parseFloat(formData.rental_cost) || 0) + 
    (parseFloat(formData.trailer_cost) || 0)
  ) * 1.25;

  const additionalMileageCost = (parseFloat(formData.estimated_miles) || 0) * RATES.MILEAGE;

  const additionalTotal = additionalLaborTotal + additionalMaterialWithMarkup + 
                          additionalEquipmentWithMarkup + additionalMileageCost;

  // COMBINED totals
  const combinedTotal = existingCosts.grandTotal + additionalTotal;
  const originalNTE = wo.nte || 0;
  const newNTENeeded = combinedTotal;
  const increaseNeeded = newNTENeeded - originalNTE;

  function handleChange(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }));
  }

  function handleAddMaterial() {
    if (!materialForm.description.trim()) {
      alert(language === 'en' ? 'Please enter material description' : 'Por favor ingrese descripción del material');
      return;
    }
    
    onAddMaterial({
      description: materialForm.description,
      quantity: parseFloat(materialForm.quantity) || 1,
      unit_cost: parseFloat(materialForm.unit_cost) || 0
    });
    
    setMaterialForm({ description: '', quantity: 1, unit_cost: 0 });
    setShowMaterialForm(false);
  }

  async function handleSave() {
    if (formData.is_verbal_nte && !formData.verbal_approved_by.trim()) {
      alert(language === 'en' 
        ? 'Please enter who approved the verbal NTE' 
        : 'Por favor ingrese quién aprobó el NTE verbal');
      return;
    }

    try {
      const dataToSave = {
        ...formData,
        material_cost: additionalMaterialCost,
        // Store the calculated totals for reference
        existing_costs_total: existingCosts.grandTotal,
        additional_costs_total: additionalTotal,
        combined_total: combinedTotal,
        original_nte: originalNTE,
        increase_needed: increaseNeeded
      };
      
      await onSave(dataToSave);
      alert(language === 'en' ? '✅ NTE Increase saved!' : '✅ ¡Aumento de NTE guardado!');
      onClose();
    } catch (err) {
      alert((language === 'en' ? 'Error saving: ' : 'Error al guardar: ') + err.message);
    }
  }

  function generatePDF() {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>NTE Increase - ${wo.wo_number}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; background: white; color: #333; font-size: 11px; }
          .header { text-align: center; border-bottom: 2px solid #1e40af; padding-bottom: 12px; margin-bottom: 15px; }
          .header h1 { color: #1e40af; font-size: 18px; margin-bottom: 3px; }
          .header .company { font-size: 12px; color: #666; }
          .badge { display: inline-block; padding: 3px 10px; border-radius: 10px; font-weight: bold; font-size: 10px; margin-top: 8px; }
          .badge-written { background: #3b82f6; color: white; }
          .badge-verbal { background: #f59e0b; color: white; }
          .section { margin-bottom: 12px; }
          .section-title { font-size: 11px; font-weight: bold; color: #1e40af; border-bottom: 1px solid #e5e7eb; padding-bottom: 2px; margin-bottom: 6px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
          .info-item { padding: 4px; background: #f9fafb; border-radius: 3px; }
          .info-label { font-size: 8px; color: #666; text-transform: uppercase; }
          .info-value { font-size: 10px; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin-top: 6px; }
          th, td { padding: 4px 6px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
          th { background: #f3f4f6; font-weight: 600; }
          .text-right { text-align: right; }
          .total-row { font-weight: bold; background: #f0f9ff; }
          .grand-total { font-size: 12px; background: #1e40af; color: white; }
          .increase-box { background: #fef3c7; border: 2px solid #f59e0b; border-radius: 6px; padding: 10px; margin: 12px 0; }
          .new-nte-box { background: #d1fae5; border: 2px solid #10b981; border-radius: 6px; padding: 10px; margin: 12px 0; }
          .notes-box { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 3px; padding: 6px; margin-top: 6px; font-size: 10px; }
          .footer { margin-top: 15px; text-align: center; color: #666; font-size: 9px; border-top: 1px solid #e5e7eb; padding-top: 8px; }
          @media print { body { padding: 10px; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>NTE INCREASE REQUEST</h1>
          <div class="company">EMF Contracting LLC</div>
          <div class="badge ${formData.is_verbal_nte ? 'badge-verbal' : 'badge-written'}">
            ${formData.is_verbal_nte ? '📞 VERBAL NTE' : '📄 WRITTEN NTE'}
          </div>
        </div>

        <div class="section">
          <div class="section-title">Work Order Information</div>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Work Order #</div>
              <div class="info-value">${wo.wo_number || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Building</div>
              <div class="info-value">${wo.building || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Current NTE</div>
              <div class="info-value">$${originalNTE.toFixed(2)}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Date</div>
              <div class="info-value">${new Date().toLocaleDateString()}</div>
            </div>
          </div>
        </div>

        ${formData.is_verbal_nte ? `
        <div class="section">
          <div class="section-title">Verbal Approval</div>
          <div class="info-item">
            <div class="info-label">Approved By</div>
            <div class="info-value">${formData.verbal_approved_by}</div>
          </div>
        </div>
        ` : ''}

        ${formData.description ? `
        <div class="section">
          <div class="section-title">Additional Work Description</div>
          <p style="font-size: 10px;">${formData.description}</p>
        </div>
        ` : ''}

        <!-- EXISTING COSTS -->
        <div class="section">
          <div class="section-title">📋 Current Costs (Already on Ticket)</div>
          <table>
            <tr>
              <td>Labor (${existingCosts.laborRT.toFixed(1)} RT + ${existingCosts.laborOT.toFixed(1)} OT hrs)</td>
              <td class="text-right">$${existingCosts.laborTotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Materials (with 25% markup)</td>
              <td class="text-right">$${existingCosts.materialWithMarkup.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Equipment/Rental/Trailer (with markup)</td>
              <td class="text-right">$${(existingCosts.equipmentWithMarkup + existingCosts.rentalWithMarkup + existingCosts.trailerWithMarkup).toFixed(2)}</td>
            </tr>
            <tr>
              <td>Mileage (${existingCosts.mileage.toFixed(1)} mi)</td>
              <td class="text-right">$${existingCosts.mileageCost.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Admin Fee</td>
              <td class="text-right">$${existingCosts.adminFee.toFixed(2)}</td>
            </tr>
            <tr class="total-row">
              <td><strong>Current Total</strong></td>
              <td class="text-right"><strong>$${existingCosts.grandTotal.toFixed(2)}</strong></td>
            </tr>
          </table>
        </div>

        <!-- ADDITIONAL COSTS -->
        <div class="section">
          <div class="section-title">➕ Additional Estimated Costs</div>
          <table>
            <tr>
              <td>Additional Labor (${formData.estimated_rt_hours} RT + ${formData.estimated_ot_hours} OT × ${formData.estimated_techs} tech${formData.estimated_techs > 1 ? 's' : ''})</td>
              <td class="text-right">$${additionalLaborTotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Additional Materials (with markup)</td>
              <td class="text-right">$${additionalMaterialWithMarkup.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Additional Equipment/Rental/Trailer (with markup)</td>
              <td class="text-right">$${additionalEquipmentWithMarkup.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Additional Mileage (${formData.estimated_miles} mi)</td>
              <td class="text-right">$${additionalMileageCost.toFixed(2)}</td>
            </tr>
            <tr class="total-row">
              <td><strong>Additional Total</strong></td>
              <td class="text-right"><strong>$${additionalTotal.toFixed(2)}</strong></td>
            </tr>
          </table>
        </div>

        <!-- NTE INCREASE SUMMARY -->
        <div class="increase-box">
          <table>
            <tr>
              <td><strong>Current Costs</strong></td>
              <td class="text-right">$${existingCosts.grandTotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td><strong>+ Additional Costs</strong></td>
              <td class="text-right">$${additionalTotal.toFixed(2)}</td>
            </tr>
            <tr style="font-size: 14px; border-top: 2px solid #f59e0b;">
              <td><strong>= TOTAL NEEDED</strong></td>
              <td class="text-right"><strong>$${combinedTotal.toFixed(2)}</strong></td>
            </tr>
          </table>
        </div>

        <div class="new-nte-box">
          <table>
            <tr>
              <td>Original NTE</td>
              <td class="text-right">$${originalNTE.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Total Costs Needed</td>
              <td class="text-right">$${combinedTotal.toFixed(2)}</td>
            </tr>
            <tr style="font-size: 14px; border-top: 2px solid #10b981; color: ${increaseNeeded > 0 ? '#dc2626' : '#10b981'};">
              <td><strong>${increaseNeeded > 0 ? 'NTE INCREASE NEEDED' : 'WITHIN BUDGET'}</strong></td>
              <td class="text-right"><strong>${increaseNeeded > 0 ? '+' : ''}$${increaseNeeded.toFixed(2)}</strong></td>
            </tr>
            ${increaseNeeded > 0 ? `
            <tr style="font-size: 16px; background: #10b981; color: white;">
              <td><strong>NEW NTE REQUESTED</strong></td>
              <td class="text-right"><strong>$${combinedTotal.toFixed(2)}</strong></td>
            </tr>
            ` : ''}
          </table>
        </div>

        ${formData.notes ? `
        <div class="section">
          <div class="section-title">Additional Notes</div>
          <div class="notes-box">${formData.notes}</div>
        </div>
        ` : ''}

        <div class="footer">
          <p><strong>EMF Contracting LLC</strong></p>
          <p>Generated: ${new Date().toLocaleString()} by ${currentUser?.first_name} ${currentUser?.last_name}</p>
        </div>

        <div class="no-print" style="text-align: center; margin-top: 15px;">
          <button onclick="window.print()" style="background: #1e40af; color: white; padding: 10px 25px; border: none; border-radius: 5px; font-size: 12px; cursor: pointer;">
            🖨️ Print
          </button>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex justify-between items-center sticky top-0 z-10">
        <button
          onClick={onClose}
          className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
        >
          ← {language === 'en' ? 'Back' : 'Volver'}
        </button>
        <h1 className="text-lg font-bold">
          {editMode 
            ? (language === 'en' ? 'Edit NTE Increase' : 'Editar Aumento NTE')
            : (language === 'en' ? 'New NTE Increase' : 'Nuevo Aumento NTE')}
        </h1>
        <button
          onClick={generatePDF}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
        >
          🖨️
        </button>
      </div>

      <div className="p-4 space-y-4 pb-32">
        {/* Work Order Info */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="font-bold text-blue-400 mb-2">📋 {wo.wo_number}</h3>
          <p className="text-sm text-gray-400">{wo.building}</p>
          <p className="text-sm text-gray-400">
            {language === 'en' ? 'Current NTE' : 'NTE Actual'}: 
            <span className="text-green-400 font-bold ml-2">${originalNTE.toFixed(2)}</span>
          </p>
        </div>

        {/* EXISTING COSTS SUMMARY */}
        <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-blue-500">
          <h3 className="font-bold mb-3 text-blue-400">
            📋 {language === 'en' ? 'Current Costs (On Ticket)' : 'Costos Actuales (En Ticket)'}
          </h3>
          
          {loadingExisting ? (
            <div className="text-center text-gray-400 py-4">Loading...</div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">
                  {language === 'en' ? 'Labor' : 'Mano de Obra'} 
                  ({existingCosts.laborRT.toFixed(1)} RT + {existingCosts.laborOT.toFixed(1)} OT)
                </span>
                <span>${existingCosts.laborTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{language === 'en' ? 'Materials (w/ markup)' : 'Materiales (c/ margen)'}</span>
                <span>${existingCosts.materialWithMarkup.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{language === 'en' ? 'Equip/Rental/Trailer' : 'Equipo/Alquiler/Trailer'}</span>
                <span>${(existingCosts.equipmentWithMarkup + existingCosts.rentalWithMarkup + existingCosts.trailerWithMarkup).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{language === 'en' ? 'Mileage' : 'Millaje'} ({existingCosts.mileage.toFixed(1)} mi)</span>
                <span>${existingCosts.mileageCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{language === 'en' ? 'Admin Fee' : 'Cargo Admin'}</span>
                <span>${existingCosts.adminFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-gray-600 pt-2 text-blue-400">
                <span>{language === 'en' ? 'CURRENT TOTAL' : 'TOTAL ACTUAL'}</span>
                <span>${existingCosts.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Quote Type Selection */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="font-bold mb-3">{language === 'en' ? 'NTE Type' : 'Tipo de NTE'}</h3>
          
          <button
            onClick={() => handleChange('is_verbal_nte', !formData.is_verbal_nte)}
            className={`w-full p-4 rounded-lg border-2 transition mb-3 ${
              formData.is_verbal_nte
                ? 'bg-yellow-600 border-yellow-400'
                : 'bg-gray-700 border-gray-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                formData.is_verbal_nte ? 'bg-yellow-500 border-yellow-400' : 'border-gray-400'
              }`}>
                {formData.is_verbal_nte && <span className="text-white font-bold">✓</span>}
              </div>
              <div className="text-left">
                <div className="font-bold">📞 {language === 'en' ? 'Verbal NTE Increase' : 'Aumento NTE Verbal'}</div>
                <div className="text-xs opacity-75">
                  {language === 'en' ? 'Approved over the phone' : 'Aprobado por teléfono'}
                </div>
              </div>
            </div>
          </button>

          {formData.is_verbal_nte && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                {language === 'en' ? 'Approved By *' : 'Aprobado Por *'}
              </label>
              <input
                type="text"
                value={formData.verbal_approved_by}
                onChange={(e) => handleChange('verbal_approved_by', e.target.value)}
                placeholder={language === 'en' ? 'Name of person who approved' : 'Nombre de quien aprobó'}
                className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white"
              />
            </div>
          )}
        </div>

        {/* Work Description */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="font-bold mb-3">{language === 'en' ? 'Additional Work Description' : 'Descripción del Trabajo Adicional'}</h3>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder={language === 'en' ? 'Describe the additional work needed...' : 'Describa el trabajo adicional necesario...'}
            className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white"
            rows={3}
          />
        </div>

        {/* ADDITIONAL COSTS HEADER */}
        <div className="bg-yellow-600 rounded-lg p-3 text-center">
          <h3 className="font-bold text-lg">
            ➕ {language === 'en' ? 'ADDITIONAL ESTIMATED COSTS' : 'COSTOS ADICIONALES ESTIMADOS'}
          </h3>
          <p className="text-xs opacity-75">
            {language === 'en' ? 'Enter what you expect to need beyond current costs' : 'Ingrese lo que espera necesitar más allá de los costos actuales'}
          </p>
        </div>

        {/* Additional Labor Estimate */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="font-bold mb-3">👷 {language === 'en' ? 'Additional Labor' : 'Mano de Obra Adicional'}</h3>
          
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1"># Techs</label>
              <input
                type="number"
                min="1"
                value={formData.estimated_techs}
                onChange={(e) => handleChange('estimated_techs', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-center"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">RT {language === 'en' ? 'Hours' : 'Horas'}</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={formData.estimated_rt_hours}
                onChange={(e) => handleChange('estimated_rt_hours', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-center"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">OT {language === 'en' ? 'Hours' : 'Horas'}</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={formData.estimated_ot_hours}
                onChange={(e) => handleChange('estimated_ot_hours', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-center"
              />
            </div>
          </div>
          
          <div className="bg-gray-700 rounded p-2 text-sm">
            <div className="flex justify-between font-bold text-yellow-400">
              <span>{language === 'en' ? 'Additional Labor' : 'Mano de Obra Adicional'}</span>
              <span>${additionalLaborTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Additional Materials */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold">🔧 {language === 'en' ? 'Additional Materials' : 'Materiales Adicionales'}</h3>
            <button
              onClick={() => setShowMaterialForm(true)}
              className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm"
            >
              + {language === 'en' ? 'Add' : 'Agregar'}
            </button>
          </div>

          {materials.length > 0 ? (
            <div className="space-y-2 mb-3">
              {materials.map((mat) => (
                <div key={mat.material_id} className="bg-gray-700 rounded p-3 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-sm">{mat.description}</p>
                    <p className="text-xs text-gray-400">
                      {mat.quantity} × ${parseFloat(mat.unit_cost).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">${parseFloat(mat.total_cost).toFixed(2)}</span>
                    <button
                      onClick={() => onDeleteMaterial(mat.material_id)}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              <div className="bg-gray-700 rounded p-2 text-sm">
                <div className="flex justify-between font-bold text-yellow-400">
                  <span>+ 25% = {language === 'en' ? 'Additional Materials' : 'Materiales Adicionales'}</span>
                  <span>${additionalMaterialWithMarkup.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                {language === 'en' ? 'Estimated Additional Material Cost ($)' : 'Costo Estimado de Materiales Adicionales ($)'}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.material_cost}
                onChange={(e) => handleChange('material_cost', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white"
                placeholder="0.00"
              />
              {formData.material_cost > 0 && (
                <p className="text-xs text-yellow-400 mt-1">
                  + 25% = ${(formData.material_cost * 1.25).toFixed(2)}
                </p>
              )}
            </div>
          )}

          {showMaterialForm && (
            <div className="bg-gray-700 rounded-lg p-3 mt-3 border-2 border-blue-500">
              <h4 className="font-bold text-sm mb-2">{language === 'en' ? 'Add Material' : 'Agregar Material'}</h4>
              <input
                type="text"
                value={materialForm.description}
                onChange={(e) => setMaterialForm({...materialForm, description: e.target.value})}
                placeholder={language === 'en' ? 'Description' : 'Descripción'}
                className="w-full px-3 py-2 bg-gray-600 rounded mb-2 text-white"
              />
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input
                  type="number"
                  min="1"
                  value={materialForm.quantity}
                  onChange={(e) => setMaterialForm({...materialForm, quantity: e.target.value})}
                  placeholder="Qty"
                  className="px-3 py-2 bg-gray-600 rounded text-white"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={materialForm.unit_cost}
                  onChange={(e) => setMaterialForm({...materialForm, unit_cost: e.target.value})}
                  placeholder="Unit $"
                  className="px-3 py-2 bg-gray-600 rounded text-white"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowMaterialForm(false)}
                  className="flex-1 bg-gray-600 py-2 rounded"
                >
                  {language === 'en' ? 'Cancel' : 'Cancelar'}
                </button>
                <button
                  onClick={handleAddMaterial}
                  className="flex-1 bg-green-600 py-2 rounded font-bold"
                >
                  {language === 'en' ? 'Add' : 'Agregar'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Additional Equipment/Rentals */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="font-bold mb-3">🚛 {language === 'en' ? 'Additional Equipment & Rentals' : 'Equipo y Alquileres Adicionales'}</h3>
          
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">{language === 'en' ? 'Equipment' : 'Equipo'}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.equipment_cost}
                onChange={(e) => handleChange('equipment_cost', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-center"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{language === 'en' ? 'Rentals' : 'Alquileres'}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.rental_cost}
                onChange={(e) => handleChange('rental_cost', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-center"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Trailer</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.trailer_cost}
                onChange={(e) => handleChange('trailer_cost', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-center"
                placeholder="0"
              />
            </div>
          </div>
          
          {additionalEquipmentWithMarkup > 0 && (
            <p className="text-xs text-yellow-400 mt-2 text-right">
              + 25% = ${additionalEquipmentWithMarkup.toFixed(2)}
            </p>
          )}
        </div>

        {/* Additional Mileage */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="font-bold mb-3">🚗 {language === 'en' ? 'Additional Mileage' : 'Millaje Adicional'}</h3>
          
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0"
              value={formData.estimated_miles}
              onChange={(e) => handleChange('estimated_miles', parseFloat(e.target.value) || 0)}
              className="flex-1 px-3 py-2 bg-gray-700 rounded-lg text-white text-center"
              placeholder="0"
            />
            <span className="text-gray-400">× $1/mi =</span>
            <span className="font-bold text-yellow-400">${additionalMileageCost.toFixed(2)}</span>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="font-bold mb-3">📝 {language === 'en' ? 'Additional Notes' : 'Notas Adicionales'}</h3>
          <textarea
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder={language === 'en' ? 'Any additional notes...' : 'Notas adicionales...'}
            className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white"
            rows={2}
          />
        </div>

        {/* ADDITIONAL COSTS SUMMARY */}
        <div className="bg-yellow-900 rounded-lg p-4 border-2 border-yellow-500">
          <h3 className="font-bold mb-3 text-yellow-300">
            ➕ {language === 'en' ? 'Additional Costs Summary' : 'Resumen de Costos Adicionales'}
          </h3>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-300">{language === 'en' ? 'Additional Labor' : 'Mano de Obra Adicional'}</span>
              <span>${additionalLaborTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">{language === 'en' ? 'Additional Materials' : 'Materiales Adicionales'}</span>
              <span>${additionalMaterialWithMarkup.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">{language === 'en' ? 'Additional Equip/Rental' : 'Equipo/Alquiler Adicional'}</span>
              <span>${additionalEquipmentWithMarkup.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">{language === 'en' ? 'Additional Mileage' : 'Millaje Adicional'}</span>
              <span>${additionalMileageCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t border-yellow-400 pt-2 mt-2">
              <span>{language === 'en' ? 'ADDITIONAL TOTAL' : 'TOTAL ADICIONAL'}</span>
              <span className="text-yellow-400">${additionalTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* COMBINED TOTAL & NTE INCREASE */}
        <div className="bg-green-900 rounded-lg p-4 border-2 border-green-500">
          <h3 className="font-bold mb-3 text-green-300">
            📊 {language === 'en' ? 'NTE Increase Summary' : 'Resumen de Aumento NTE'}
          </h3>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-300">{language === 'en' ? 'Current Costs (on ticket)' : 'Costos Actuales (en ticket)'}</span>
              <span className="text-blue-400">${existingCosts.grandTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">{language === 'en' ? 'Additional Costs' : 'Costos Adicionales'}</span>
              <span className="text-yellow-400">+ ${additionalTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold border-t border-green-400 pt-2">
              <span>{language === 'en' ? 'TOTAL COSTS NEEDED' : 'COSTOS TOTALES NECESARIOS'}</span>
              <span className="text-white">${combinedTotal.toFixed(2)}</span>
            </div>
            
            <div className="border-t border-green-400 pt-2 mt-2">
              <div className="flex justify-between">
                <span className="text-gray-300">{language === 'en' ? 'Original NTE' : 'NTE Original'}</span>
                <span>${originalNTE.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">{language === 'en' ? 'Total Needed' : 'Total Necesario'}</span>
                <span>${combinedTotal.toFixed(2)}</span>
              </div>
            </div>

            {increaseNeeded > 0 ? (
              <>
                <div className="flex justify-between text-lg font-bold text-red-400 border-t border-green-400 pt-2">
                  <span>{language === 'en' ? 'NTE INCREASE NEEDED' : 'AUMENTO NTE NECESARIO'}</span>
                  <span>+${increaseNeeded.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold bg-green-600 -mx-4 px-4 py-3 mt-2 rounded-b-lg">
                  <span>{language === 'en' ? 'NEW NTE REQUESTED' : 'NUEVO NTE SOLICITADO'}</span>
                  <span>${combinedTotal.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-lg font-bold text-green-400 border-t border-green-400 pt-2">
                <span>✅ {language === 'en' ? 'WITHIN CURRENT NTE' : 'DENTRO DEL NTE ACTUAL'}</span>
                <span>${Math.abs(increaseNeeded).toFixed(2)} {language === 'en' ? 'remaining' : 'restante'}</span>
              </div>
            )}
          </div>
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
