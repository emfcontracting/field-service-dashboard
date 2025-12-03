// components/quotes/NTEIncreasePage.js - Full Page NTE Increase/Quote Form
import { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
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
  const wo = workOrder || {};
  
  // Form state
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

  // Initialize form with existing quote data
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

  // Calculate live totals
  const totals = calculateTotals(formData);

  // Calculate material total from line items
  const materialLineItemTotal = materials.reduce(
    (sum, mat) => sum + (parseFloat(mat.total_cost) || 0), 
    0
  );

  // Use line items total if we have materials, otherwise use manual entry
  const effectiveMaterialCost = materials.length > 0 ? materialLineItemTotal : parseFloat(formData.material_cost) || 0;
  
  // Recalculate totals with effective material cost
  const effectiveTotals = calculateTotals({
    ...formData,
    material_cost: effectiveMaterialCost
  });

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
    // Validation
    if (formData.is_verbal_nte && !formData.verbal_approved_by.trim()) {
      alert(language === 'en' 
        ? 'Please enter who approved the verbal NTE' 
        : 'Por favor ingrese quién aprobó el NTE verbal');
      return;
    }

    try {
      const dataToSave = {
        ...formData,
        material_cost: effectiveMaterialCost
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
          body { font-family: Arial, sans-serif; padding: 30px; background: white; color: #333; font-size: 12px; }
          .header { text-align: center; border-bottom: 2px solid #1e40af; padding-bottom: 15px; margin-bottom: 20px; }
          .header h1 { color: #1e40af; font-size: 20px; margin-bottom: 5px; }
          .header .company { font-size: 14px; color: #666; }
          .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-weight: bold; font-size: 11px; margin-top: 10px; }
          .badge-written { background: #3b82f6; color: white; }
          .badge-verbal { background: #f59e0b; color: white; }
          .section { margin-bottom: 15px; }
          .section-title { font-size: 12px; font-weight: bold; color: #1e40af; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; margin-bottom: 8px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          .info-item { padding: 6px; background: #f9fafb; border-radius: 4px; }
          .info-label { font-size: 9px; color: #666; text-transform: uppercase; }
          .info-value { font-size: 11px; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
          th { background: #f3f4f6; font-weight: 600; }
          .text-right { text-align: right; }
          .total-row { font-weight: bold; background: #f0f9ff; }
          .grand-total { font-size: 14px; background: #1e40af; color: white; }
          .notes-box { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 4px; padding: 8px; margin-top: 8px; }
          .footer { margin-top: 20px; text-align: center; color: #666; font-size: 10px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
          @media print { body { padding: 15px; } .no-print { display: none; } }
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
              <div class="info-value">$${(wo.nte || 0).toFixed(2)}</div>
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
          <div class="section-title">Work Description</div>
          <p style="font-size: 11px;">${formData.description}</p>
        </div>
        ` : ''}

        <div class="section">
          <div class="section-title">Labor Estimate</div>
          <table>
            <tr>
              <th>Description</th>
              <th class="text-right">Qty</th>
              <th class="text-right">Rate</th>
              <th class="text-right">Total</th>
            </tr>
            <tr>
              <td>Regular Time (${formData.estimated_techs} tech${formData.estimated_techs > 1 ? 's' : ''})</td>
              <td class="text-right">${formData.estimated_rt_hours} hrs</td>
              <td class="text-right">$${RATES.RT_HOURLY}/hr</td>
              <td class="text-right">$${(formData.estimated_rt_hours * formData.estimated_techs * RATES.RT_HOURLY).toFixed(2)}</td>
            </tr>
            <tr>
              <td>Overtime (${formData.estimated_techs} tech${formData.estimated_techs > 1 ? 's' : ''})</td>
              <td class="text-right">${formData.estimated_ot_hours} hrs</td>
              <td class="text-right">$${RATES.OT_HOURLY}/hr</td>
              <td class="text-right">$${(formData.estimated_ot_hours * formData.estimated_techs * RATES.OT_HOURLY).toFixed(2)}</td>
            </tr>
            <tr class="total-row">
              <td colspan="3">Labor Subtotal</td>
              <td class="text-right">$${effectiveTotals.labor_total.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        ${materials.length > 0 ? `
        <div class="section">
          <div class="section-title">Materials (25% markup applied)</div>
          <table>
            <tr>
              <th>Description</th>
              <th class="text-right">Qty</th>
              <th class="text-right">Unit Cost</th>
              <th class="text-right">Total</th>
            </tr>
            ${materials.map(mat => `
              <tr>
                <td>${mat.description}</td>
                <td class="text-right">${mat.quantity}</td>
                <td class="text-right">$${parseFloat(mat.unit_cost).toFixed(2)}</td>
                <td class="text-right">$${parseFloat(mat.total_cost).toFixed(2)}</td>
              </tr>
            `).join('')}
            <tr>
              <td colspan="3">Materials Subtotal</td>
              <td class="text-right">$${materialLineItemTotal.toFixed(2)}</td>
            </tr>
            <tr class="total-row">
              <td colspan="3">Materials with 25% Markup</td>
              <td class="text-right">$${effectiveTotals.materials_with_markup.toFixed(2)}</td>
            </tr>
          </table>
        </div>
        ` : effectiveMaterialCost > 0 ? `
        <div class="section">
          <div class="section-title">Materials (25% markup applied)</div>
          <table>
            <tr>
              <td>Materials Estimate</td>
              <td class="text-right">$${effectiveMaterialCost.toFixed(2)}</td>
            </tr>
            <tr class="total-row">
              <td>Materials with 25% Markup</td>
              <td class="text-right">$${effectiveTotals.materials_with_markup.toFixed(2)}</td>
            </tr>
          </table>
        </div>
        ` : ''}

        <div class="section">
          <div class="section-title">Equipment & Other Costs (25% markup applied)</div>
          <table>
            <tr>
              <th>Description</th>
              <th class="text-right">Cost</th>
              <th class="text-right">With Markup</th>
            </tr>
            <tr>
              <td>Equipment</td>
              <td class="text-right">$${parseFloat(formData.equipment_cost || 0).toFixed(2)}</td>
              <td class="text-right">$${(parseFloat(formData.equipment_cost || 0) * 1.25).toFixed(2)}</td>
            </tr>
            <tr>
              <td>Rentals</td>
              <td class="text-right">$${parseFloat(formData.rental_cost || 0).toFixed(2)}</td>
              <td class="text-right">$${(parseFloat(formData.rental_cost || 0) * 1.25).toFixed(2)}</td>
            </tr>
            <tr>
              <td>Trailer</td>
              <td class="text-right">$${parseFloat(formData.trailer_cost || 0).toFixed(2)}</td>
              <td class="text-right">$${(parseFloat(formData.trailer_cost || 0) * 1.25).toFixed(2)}</td>
            </tr>
            <tr class="total-row">
              <td colspan="2">Equipment/Rentals Subtotal</td>
              <td class="text-right">$${effectiveTotals.equipment_with_markup.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Summary</div>
          <table>
            <tr>
              <td>Labor Total</td>
              <td class="text-right">$${effectiveTotals.labor_total.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Materials (with markup)</td>
              <td class="text-right">$${effectiveTotals.materials_with_markup.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Equipment/Rentals (with markup)</td>
              <td class="text-right">$${effectiveTotals.equipment_with_markup.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Mileage (${formData.estimated_miles} mi @ $${RATES.MILEAGE}/mi)</td>
              <td class="text-right">$${effectiveTotals.mileage_total.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Admin Fee (2 hrs @ $${RATES.RT_HOURLY}/hr)</td>
              <td class="text-right">$${effectiveTotals.admin_fee.toFixed(2)}</td>
            </tr>
            <tr class="grand-total">
              <td><strong>TOTAL NTE INCREASE REQUESTED</strong></td>
              <td class="text-right"><strong>$${effectiveTotals.grand_total.toFixed(2)}</strong></td>
            </tr>
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

        <div class="no-print" style="text-align: center; margin-top: 20px;">
          <button onclick="window.print()" style="background: #1e40af; color: white; padding: 12px 30px; border: none; border-radius: 6px; font-size: 14px; cursor: pointer;">
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
            <span className="text-green-400 font-bold ml-2">${(wo.nte || 0).toFixed(2)}</span>
          </p>
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
          <h3 className="font-bold mb-3">{language === 'en' ? 'Work Description' : 'Descripción del Trabajo'}</h3>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder={language === 'en' ? 'Describe the additional work needed...' : 'Describa el trabajo adicional necesario...'}
            className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white"
            rows={3}
          />
        </div>

        {/* Labor Estimate */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="font-bold mb-3">👷 {language === 'en' ? 'Labor Estimate' : 'Estimación de Mano de Obra'}</h3>
          
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
            <div className="flex justify-between">
              <span className="text-gray-400">RT: {formData.estimated_rt_hours}h × {formData.estimated_techs} × ${RATES.RT_HOURLY}</span>
              <span className="text-green-400">${(formData.estimated_rt_hours * formData.estimated_techs * RATES.RT_HOURLY).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">OT: {formData.estimated_ot_hours}h × {formData.estimated_techs} × ${RATES.OT_HOURLY}</span>
              <span className="text-yellow-400">${(formData.estimated_ot_hours * formData.estimated_techs * RATES.OT_HOURLY).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold border-t border-gray-600 mt-2 pt-2">
              <span>{language === 'en' ? 'Labor Total' : 'Total Mano de Obra'}</span>
              <span>${effectiveTotals.labor_total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Materials */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold">🔧 {language === 'en' ? 'Materials' : 'Materiales'}</h3>
            <button
              onClick={() => setShowMaterialForm(true)}
              className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm"
            >
              + {language === 'en' ? 'Add' : 'Agregar'}
            </button>
          </div>

          {/* Material Line Items */}
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
                <div className="flex justify-between">
                  <span className="text-gray-400">{language === 'en' ? 'Subtotal' : 'Subtotal'}</span>
                  <span>${materialLineItemTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-green-400">
                  <span>+ 25% {language === 'en' ? 'Markup' : 'Margen'}</span>
                  <span>${effectiveTotals.materials_with_markup.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                {language === 'en' ? 'Estimated Material Cost ($)' : 'Costo Estimado de Materiales ($)'}
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
                <p className="text-xs text-green-400 mt-1">
                  + 25% = ${(formData.material_cost * 1.25).toFixed(2)}
                </p>
              )}
            </div>
          )}

          {/* Add Material Form */}
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

        {/* Equipment/Rentals */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="font-bold mb-3">🚛 {language === 'en' ? 'Equipment & Rentals' : 'Equipo y Alquileres'}</h3>
          
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
          
          {effectiveTotals.equipment_with_markup > 0 && (
            <p className="text-xs text-green-400 mt-2 text-right">
              + 25% = ${effectiveTotals.equipment_with_markup.toFixed(2)}
            </p>
          )}
        </div>

        {/* Mileage */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="font-bold mb-3">🚗 {language === 'en' ? 'Mileage' : 'Millaje'}</h3>
          
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0"
              value={formData.estimated_miles}
              onChange={(e) => handleChange('estimated_miles', parseFloat(e.target.value) || 0)}
              className="flex-1 px-3 py-2 bg-gray-700 rounded-lg text-white text-center"
              placeholder="0"
            />
            <span className="text-gray-400">× ${RATES.MILEAGE}/mi =</span>
            <span className="font-bold text-blue-400">${effectiveTotals.mileage_total.toFixed(2)}</span>
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

        {/* Grand Total Summary */}
        <div className="bg-blue-900 rounded-lg p-4 border-2 border-blue-500">
          <h3 className="font-bold mb-3 text-blue-300">💰 {language === 'en' ? 'Total Summary' : 'Resumen Total'}</h3>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-300">{language === 'en' ? 'Labor' : 'Mano de Obra'}</span>
              <span>${effectiveTotals.labor_total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">{language === 'en' ? 'Materials (w/ markup)' : 'Materiales (c/ margen)'}</span>
              <span>${effectiveTotals.materials_with_markup.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">{language === 'en' ? 'Equipment (w/ markup)' : 'Equipo (c/ margen)'}</span>
              <span>${effectiveTotals.equipment_with_markup.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">{language === 'en' ? 'Mileage' : 'Millaje'}</span>
              <span>${effectiveTotals.mileage_total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">{language === 'en' ? 'Admin Fee' : 'Cargo Admin'}</span>
              <span>${effectiveTotals.admin_fee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold border-t border-blue-400 pt-2 mt-2">
              <span>{language === 'en' ? 'TOTAL NTE INCREASE' : 'AUMENTO NTE TOTAL'}</span>
              <span className="text-green-400">${effectiveTotals.grand_total.toFixed(2)}</span>
            </div>
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
