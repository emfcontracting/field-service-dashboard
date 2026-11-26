'use client';
// Profile: after how many days the dashboard suggests a payment reminder for
// an open invoice to one of your own customers (subcontractor_profiles.reminder_days).
import { useState } from 'react';
import { useLang } from './LangProvider';
import { contractorApi } from '@/lib/contractorClient';
import { readContractorSession, saveContractorSession } from '@/lib/contractorSession';

export default function ReminderDaysCard({ profile }) {
  const { t } = useLang();
  const [days, setDays] = useState(String(profile?.reminder_days || 14));
  const [state, setState] = useState('');
  async function save() {
    const n = parseInt(days, 10);
    if (!(n >= 3 && n <= 90)) { setState(t('Between 3 and 90 days')); return; }
    if (n === (profile?.reminder_days || 14)) return;
    try {
      const p = await contractorApi.updateProfile({ reminder_days: n });
      const raw = readContractorSession();
      if (raw) { const u = JSON.parse(raw); saveContractorSession({ ...u, profile: { ...u.profile, ...p } }); }
      setState(t('Saved'));
    } catch (e) { setState(e.message); }
  }
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
      <h2 className="font-bold">{t('🔔 Payment reminders')}</h2>
      <p className="text-sm text-gray-400 mb-3">{t('For invoices to your own customers: Home suggests a reminder when an invoice is open this many days (counted again after each reminder). You confirm each one.')}</p>
      <div className="flex items-center gap-2">
        <input inputMode="numeric" value={days} onChange={(e) => { setDays(e.target.value.replace(/\D/g, '').slice(0, 2)); setState(''); }} onBlur={save}
          className="w-20 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2" />
        <span className="text-sm text-gray-300">{t('days')}</span>
        {state && <span className="text-sm text-gray-400 ml-2">{state}</span>}
      </div>
    </div>
  );
}
