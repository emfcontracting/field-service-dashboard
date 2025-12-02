// components/TeamMembersSection.js - Bilingual Team Members Section with Field Data
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../utils/translations';

export default function TeamMembersSection({
  currentTeamList,
  status,
  saving,
  onLoadTeamMembers,
  onRemoveTeamMember,
  getTeamFieldValue,
  handleTeamFieldChange,
  handleUpdateTeamMemberField
}) {
  const { language } = useLanguage();
  const t = (key) => translations[language]?.[key] || key;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold">👥 {t('teamMembers')}</h3>
        {status !== 'completed' && (
          <button
            onClick={onLoadTeamMembers}
            className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg text-sm font-semibold"
          >
            + {language === 'en' ? 'Add Helper' : 'Agregar Ayudante'}
          </button>
        )}
      </div>
      
      {currentTeamList && currentTeamList.length > 0 ? (
        <div className="space-y-4">
          {currentTeamList.map((member) => (
            <div key={member.assignment_id} className="bg-gray-700 rounded-lg p-3">
              {/* Team Member Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-sm font-bold">
                    {(member.user?.first_name?.[0] || '?').toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold">
                      {member.user?.first_name || t('unknown')} {member.user?.last_name || ''}
                    </p>
                    <p className="text-xs text-gray-400">
                      {member.role_on_job === 'helper' 
                        ? (language === 'en' ? 'Helper' : 'Ayudante')
                        : (language === 'en' ? 'Tech' : 'Técnico')}
                    </p>
                  </div>
                </div>
                {status !== 'completed' && onRemoveTeamMember && (
                  <button
                    onClick={() => onRemoveTeamMember(member.assignment_id)}
                    className="text-red-400 hover:text-red-300 text-sm px-2 py-1"
                    disabled={saving}
                    title={language === 'en' ? 'Remove' : 'Eliminar'}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Team Member Field Data */}
              {status !== 'completed' && handleUpdateTeamMemberField && (
                <div className="grid grid-cols-3 gap-2">
                  {/* Regular Hours */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      {language === 'en' ? 'RT Hrs' : 'Hrs RT'}
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={getTeamFieldValue ? getTeamFieldValue(member.assignment_id, 'hours_regular') : (member.hours_regular || '')}
                      onChange={(e) => handleTeamFieldChange && handleTeamFieldChange(member.assignment_id, 'hours_regular', e.target.value)}
                      onBlur={(e) => handleUpdateTeamMemberField(member.assignment_id, 'hours_regular', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-2 bg-gray-600 rounded text-white text-sm text-center"
                      disabled={saving}
                      placeholder="0"
                    />
                  </div>
                  {/* Overtime Hours */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      {language === 'en' ? 'OT Hrs' : 'Hrs OT'}
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={getTeamFieldValue ? getTeamFieldValue(member.assignment_id, 'hours_overtime') : (member.hours_overtime || '')}
                      onChange={(e) => handleTeamFieldChange && handleTeamFieldChange(member.assignment_id, 'hours_overtime', e.target.value)}
                      onBlur={(e) => handleUpdateTeamMemberField(member.assignment_id, 'hours_overtime', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-2 bg-gray-600 rounded text-white text-sm text-center"
                      disabled={saving}
                      placeholder="0"
                    />
                  </div>
                  {/* Miles */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      {t('miles')}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={getTeamFieldValue ? getTeamFieldValue(member.assignment_id, 'miles') : (member.miles || '')}
                      onChange={(e) => handleTeamFieldChange && handleTeamFieldChange(member.assignment_id, 'miles', e.target.value)}
                      onBlur={(e) => handleUpdateTeamMemberField(member.assignment_id, 'miles', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-2 bg-gray-600 rounded text-white text-sm text-center"
                      disabled={saving}
                      placeholder="0"
                    />
                  </div>
                </div>
              )}

              {/* Display values for completed work orders */}
              {status === 'completed' && (
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center">
                    <span className="text-gray-400">{language === 'en' ? 'RT' : 'RT'}:</span>
                    <span className="ml-1">{member.hours_regular || 0}h</span>
                  </div>
                  <div className="text-center">
                    <span className="text-gray-400">{language === 'en' ? 'OT' : 'OT'}:</span>
                    <span className="ml-1">{member.hours_overtime || 0}h</span>
                  </div>
                  <div className="text-center">
                    <span className="text-gray-400">{t('miles')}:</span>
                    <span className="ml-1">{member.miles || 0}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-400 text-sm text-center py-2">{t('noTeamMembers')}</p>
      )}

      {/* Info note */}
      {currentTeamList && currentTeamList.length > 0 && status !== 'completed' && (
        <p className="text-xs text-gray-500 mt-3 text-center">
          💡 {language === 'en' 
            ? 'Hours entered here are added to cost summary' 
            : 'Las horas ingresadas aquí se agregan al resumen de costos'}
        </p>
      )}
    </div>
  );
}
