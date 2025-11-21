// components/modals/TeamModal.js - Bilingual Team Modal
import { useLanguage } from '../../contexts/LanguageContext';
import { translations } from '../../utils/translations';

export default function TeamModal({ show, onClose, teamMembers, onAddMember, saving }) {
  const { language } = useLanguage();
  const t = (key) => translations[language][key];

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-96 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">{t('addHelper')}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>
        <div className="space-y-2">
          {teamMembers.map(member => (
            <button
              key={member.user_id}
              onClick={() => onAddMember(member.user_id)}
              disabled={saving}
              className="w-full bg-gray-700 hover:bg-gray-600 p-3 rounded-lg text-left transition"
            >
              {member.first_name} {member.last_name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
