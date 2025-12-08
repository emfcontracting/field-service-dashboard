// components/LoginScreen.js - Bilingual Login Screen
'use client';
import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../utils/translations';
import LanguageToggle from './LanguageToggle';

export default function LoginScreen({ onLogin, error, setError }) {
  const { language } = useLanguage();
  const t = (key) => translations[language][key];
  
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    
    if (!email || !pin) {
      setError(t('enterEmailAndPIN'));
      return;
    }
    
    await onLogin(email, pin);
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Language Toggle - Top Right */}
        <div className="flex justify-end mb-4">
          <LanguageToggle />
        </div>

        <div className="text-center mb-8">
          <div className="bg-white w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg p-3">
            <img 
              src="/emf-logo.png" 
              alt="EMF Contracting LLC" 
              className="w-full h-full object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = '<div class="text-2xl font-bold text-gray-800">EMF</div>';
              }}
            />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">EMF Contracting LLC</h1>
          <p className="text-gray-300">{t('fieldServiceMobile')}</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">{t('login')}</h2>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                className="w-full px-4 py-4 text-lg text-gray-900 bg-white border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                autoFocus
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('pin')}</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength="4"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder={t('fourDigitPin')}
                className="w-full px-4 py-4 text-lg text-gray-900 bg-white border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                required
              />
            </div>
            {error && <p className="text-red-500 mb-4">{error}</p>}
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-4 rounded-xl text-lg font-bold hover:bg-blue-700 transition active:scale-95"
            >
              {t('login')}
            </button>
          </form>
          
          {/* Subcontractor Portal Link */}
          <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            <a 
              href="/contractor" 
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              🧱 Subcontractor Portal →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
