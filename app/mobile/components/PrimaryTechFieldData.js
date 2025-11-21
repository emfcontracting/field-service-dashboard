// components/PrimaryTechFieldData.js - Bilingual Primary Tech Field Data
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../utils/translations';

export default function PrimaryTechFieldData({
  workOrder,
  status,
  saving,
  getFieldValue,
  handleFieldChange,
  handleUpdateField
}) {
  const { language } = useLanguage();
  const t = (key) => translations[language][key];
  
  const wo = workOrder || {};

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="font-bold mb-3">{t('primaryTechFieldData')}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('regularHours')}</label>
          <input
            type="number"
            step="0.5"
            value={getFieldValue('hours_regular')}
            onChange={(e) => handleFieldChange('hours_regular', e.target.value)}
            onBlur={(e) => handleUpdateField(wo.wo_id, 'hours_regular', parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
            disabled={saving || status === 'completed'}
            placeholder={`0 ${t('hrs')} @ $64/${t('hrs')}`}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('overtimeHours')}</label>
          <input
            type="number"
            step="0.5"
            value={getFieldValue('hours_overtime')}
            onChange={(e) => handleFieldChange('hours_overtime', e.target.value)}
            onBlur={(e) => handleUpdateField(wo.wo_id, 'hours_overtime', parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
            disabled={saving || status === 'completed'}
            placeholder={`0 ${t('hrs')} @ $96/${t('hrs')}`}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('miles')}</label>
          <input
            type="number"
            step="0.1"
            value={getFieldValue('miles')}
            onChange={(e) => handleFieldChange('miles', e.target.value)}
            onBlur={(e) => handleUpdateField(wo.wo_id, 'miles', parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
            disabled={saving || status === 'completed'}
            placeholder="0 mi @ $1/mi"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('materialCost')}</label>
          <input
            type="number"
            step="0.01"
            value={getFieldValue('material_cost')}
            onChange={(e) => handleFieldChange('material_cost', e.target.value)}
            onBlur={(e) => handleUpdateField(wo.wo_id, 'material_cost', parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
            disabled={saving || status === 'completed'}
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('emfEquipment')}</label>
          <input
            type="number"
            step="0.01"
            value={getFieldValue('emf_equipment_cost')}
            onChange={(e) => handleFieldChange('emf_equipment_cost', e.target.value)}
            onBlur={(e) => handleUpdateField(wo.wo_id, 'emf_equipment_cost', parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
            disabled={saving || status === 'completed'}
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('trailerCost')}</label>
          <input
            type="number"
            step="0.01"
            value={getFieldValue('trailer_cost')}
            onChange={(e) => handleFieldChange('trailer_cost', e.target.value)}
            onBlur={(e) => handleUpdateField(wo.wo_id, 'trailer_cost', parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
            disabled={saving || status === 'completed'}
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('rentalCost')}</label>
          <input
            type="number"
            step="0.01"
            value={getFieldValue('rental_cost')}
            onChange={(e) => handleFieldChange('rental_cost', e.target.value)}
            onBlur={(e) => handleUpdateField(wo.wo_id, 'rental_cost', parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
            disabled={saving || status === 'completed'}
            placeholder="0"
          />
        </div>
      </div>
    </div>
  );
}
