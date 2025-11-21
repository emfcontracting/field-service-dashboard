// hooks/useLanguage.js
// Language management hook for mobile app

import { useState, useEffect, createContext, useContext } from 'react';
import { t } from '../utils/translations';

// Create Language Context
const LanguageContext = createContext();

// Language Provider Component
export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('en');
  
  // Load saved language preference on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem('appLanguage');
    if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'es')) {
      setLanguage(savedLanguage);
    }
  }, []);

  // Save language preference when changed
  const changeLanguage = (newLanguage) => {
    if (newLanguage === 'en' || newLanguage === 'es') {
      setLanguage(newLanguage);
      localStorage.setItem('appLanguage', newLanguage);
    }
  };

  // Toggle between English and Spanish
  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'es' : 'en';
    changeLanguage(newLang);
  };

  // Translation function with current language
  const translate = (key) => {
    return t(key, language);
  };

  const value = {
    language,
    changeLanguage,
    toggleLanguage,
    t: translate,
    isSpanish: language === 'es',
    isEnglish: language === 'en'
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

// Custom hook to use language context
export function useLanguage() {
  const context = useContext(LanguageContext);
  
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  
  return context;
}
