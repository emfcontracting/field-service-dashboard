// components/LanguageToggle.js - Language Switcher Button
'use client';
import { useLanguage } from '../contexts/LanguageContext';

export default function LanguageToggle() {
  const { language, changeLanguage } = useLanguage();

  return (
    <button
      onClick={() => changeLanguage(language === 'en' ? 'es' : 'en')}
      className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1"
      title={language === 'en' ? 'Switch to Spanish' : 'Cambiar a inglés'}
    >
      <span className="text-lg">🌐</span>
      <span>{language === 'en' ? 'ES' : 'EN'}</span>
    </button>
  );
}
