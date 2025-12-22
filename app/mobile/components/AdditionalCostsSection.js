// components/AdditionalCostsSection.js - Bilingual Additional Costs (EMF Materials, Equipment, Trailer, Rental)
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../utils/translations';

export default function AdditionalCostsSection({
  workOrder,
  status,
  saving,
  getFieldValue,
  handleFieldChange,
  handleUpdateField
}) {
  const { language } = useLanguage();
  const t = (key) => translations[language]?.[key] || key;
  
  const wo = workOrder || {};

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="font-bold mb-3">💵 {language === 'en' ? 'Additional Costs' : 'Costos Adicionales'}</h3>
      <p className="text-xs text-gray-400 mb-3">
        {language === 'en' 
          ? '25% markup applied automatically' 
          : '25% de margen aplicado automáticamente'}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {/* EMF Material Cost - Company Paid */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            {language === 'en' ? 'EMF Material' : 'Material EMF'}
          </label>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={getFieldValue('material_cost')}
            onChange={(e) => handleFieldChange('material_cost', e.target.value)}
            onBlur={(e) => handleUpdateField(wo.wo_id, 'material_cost', parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
            disabled={saving || status === 'completed'}
            placeholder="$0.00"
          />
          <p className="text-xs text-gray-500 mt-0.5">
            {language === 'en' ? '(Company paid)' : '(Pagado por empresa)'}
          </p>
        </div>
        {/* EMF Equipment */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('emfEquipment')}</label>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={getFieldValue('emf_equipment_cost')}
            onChange={(e) => handleFieldChange('emf_equipment_cost', e.target.value)}
            onBlur={(e) => handleUpdateField(wo.wo_id, 'emf_equipment_cost', parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
            disabled={saving || status === 'completed'}
            placeholder="$0.00"
          />
        </div>
        {/* Trailer Cost */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('trailerCost')}</label>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={getFieldValue('trailer_cost')}
            onChange={(e) => handleFieldChange('trailer_cost', e.target.value)}
            onBlur={(e) => handleUpdateField(wo.wo_id, 'trailer_cost', parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
            disabled={saving || status === 'completed'}
            placeholder="$0.00"
          />
        </div>
        {/* Rental Cost */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('rentalCost')}</label>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={getFieldValue('rental_cost')}
            onChange={(e) => handleFieldChange('rental_cost', e.target.value)}
            onBlur={(e) => handleUpdateField(wo.wo_id, 'rental_cost', parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
            disabled={saving || status === 'completed'}
            placeholder="$0.00"
          />
        </div>
      </div>
      
      {/* Info about Tech Materials */}
      <div className="mt-3 pt-3 border-t border-gray-700">
        <p className="text-xs text-orange-400">
          💡 {language === 'en' 
            ? 'Tech-purchased materials are logged in Daily Hours. They will appear in Cost Summary below.' 
            : 'Los materiales comprados por técnicos se registran en Horas Diarias. Aparecerán en el Resumen de Costos abajo.'}
        </p>
      </div>
    </div>
  );
}
