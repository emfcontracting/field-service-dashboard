'use client';
// Portal language (en | es). The English text is the key; lib/contractorI18n
// holds the Spanish. Stored in localStorage for this device and in the sub's
// profile (subcontractor_profiles.language) for the Friday e-mail/push.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { translate } from '@/lib/contractorI18n';
import { readContractorSession, saveContractorSession } from '@/lib/contractorSession';
import { contractorApi } from '@/lib/contractorClient';

const KEY = 'contractor_lang';
const Ctx = createContext({ lang: 'en', setLang: () => {}, t: (s, v) => translate('en', s, v) });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState('en');

  useEffect(() => {
    try {
      let l = localStorage.getItem(KEY);
      if (!l) {
        const raw = readContractorSession();
        l = raw ? JSON.parse(raw)?.profile?.language : null;
      }
      if (!l && typeof navigator !== 'undefined' && /^es\b/i.test(navigator.language || '')) l = 'es';
      if (l === 'es' || l === 'en') setLangState(l);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { document.documentElement.lang = lang; } catch { /* ignore */ }
  }, [lang]);

  const setLang = useCallback((l) => {
    if (l !== 'en' && l !== 'es') return;
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
    // Signed in → remember it on the profile (Friday e-mail/push language)
    try {
      const raw = readContractorSession();
      if (raw) {
        const u = JSON.parse(raw);
        saveContractorSession({ ...u, profile: { ...u.profile, language: l } });
        contractorApi.updateProfile({ language: l }).catch(() => {});
      }
    } catch { /* ignore */ }
  }, []);

  const t = useCallback((s, vars) => translate(lang, s, vars), [lang]);
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);

export function LangSwitch({ className = '' }) {
  const { lang, setLang } = useLang();
  return (
    <span className={`inline-flex rounded-lg overflow-hidden border border-gray-600 text-xs ${className}`}>
      {['en', 'es'].map((l) => (
        <button key={l} type="button" onClick={() => setLang(l)}
          className={`px-2 py-1 ${lang === l ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'}`}>
          {l.toUpperCase()}
        </button>
      ))}
    </span>
  );
}
