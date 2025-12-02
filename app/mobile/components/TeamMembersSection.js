// components/TeamMembersSection.js - Bilingual Team Members Section (Simplified - No Hours Input)
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../utils/translations';

export default function TeamMembersSection({
  currentTeamList,
  status,
  saving,
  onLoadTeamMembers,
  onRemoveTeamMember
}) {
  const { language } = useLanguage();
  const t = (key) => translations[language][key] || key;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold">👥 {t('teamMembers')}</h3>
        {status !== 'completed' && (
          <button
            onClick={onLoadTeamMembers}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-3 py-2 rounded-lg text-sm font-semibold transition"
          >
            + {language === 'en' ? 'Add Helper' : 'Agregar Ayudante'}
          </button>
        )}
      </div>
      
      {currentTeamList.length > 0 ? (
        <div className="space-y-2">
          {currentTeamList.map((member) => (
            <div key={member.assignment_id} className="bg-gray-700 rounded-lg p-3 flex justify-between items-center">
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
              {status !== 'completed' && onRemoveTeamMember && (
                <button
                  onClick={() => onRemoveTeamMember(member.assignment_id)}
                  disabled={saving}
                  className="text-red-400 hover:text-red-300 text-sm px-2 py-1 disabled:opacity-50"
                  title={language === 'en' ? 'Remove from team' : 'Eliminar del equipo'}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-400 text-sm text-center py-2">{t('noTeamMembers')}</p>
      )}
      
      {currentTeamList.length > 0 && (
        <p className="text-xs text-gray-500 mt-3 text-center">
          💡 {language === 'en' 
            ? 'Use Daily Hours Log above to track hours for each team member'
            : 'Use el Registro Diario arriba para registrar horas de cada miembro'}
        </p>
      )}
    </div>
  );
}
