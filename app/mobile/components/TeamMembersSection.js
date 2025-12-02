// components/TeamMembersSection.js - Bilingual Team Members Section (SIMPLIFIED - No Hours)
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../utils/translations';

export default function TeamMembersSection({
  currentTeamList,
  status,
  saving,
  onLoadTeamMembers
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
        <div className="space-y-2">
          {currentTeamList.map((member) => (
            <div key={member.assignment_id} className="bg-gray-700 rounded-lg p-3 flex items-center justify-between">
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
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-400 text-sm text-center py-2">{t('noTeamMembers')}</p>
      )}

      {/* Info note */}
      {currentTeamList && currentTeamList.length > 0 && (
        <p className="text-xs text-gray-500 mt-3 text-center">
          💡 {language === 'en' 
            ? 'Each team member logs their own hours in their app' 
            : 'Cada miembro del equipo registra sus propias horas en su app'}
        </p>
      )}
    </div>
  );
}
