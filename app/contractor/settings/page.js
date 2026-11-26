'use client';

import { useState, useEffect } from 'react';
import { useLang, LangSwitch } from '@/app/contractor/components/LangProvider';
import DocumentsPanel from '../components/DocumentsPanel';
import { readContractorSession, saveContractorSession } from '@/lib/contractorSession';
import { fmtDate } from '@/lib/dates';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { contractorApi } from '@/lib/contractorClient';

export default function ContractorSettings() {
  const { t } = useLang();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const [rates, setRates] = useState({
    hourly_rate: '35.00',
    ot_rate: '52.50',
    mileage_rate: '0.67'
  });

  const [recurring, setRecurring] = useState([]);
  const [businessInfo, setBusinessInfo] = useState({
    business_name: '',
    business_address: '',
    tax_id: ''
  });

  const [pinChange, setPinChange] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  useEffect(() => {
    const userData = readContractorSession();
    if (!userData) {
      router.push('/contractor');
      return;
    }
    
    try {
      const parsed = JSON.parse(userData);
      setUser(parsed);
      
      // Set initial values from profile
      if (parsed.profile) {
        setRates({
          hourly_rate: parseFloat(parsed.profile.hourly_rate || 35).toFixed(2),
          ot_rate: parseFloat(parsed.profile.ot_rate || 52.50).toFixed(2),
          mileage_rate: parseFloat(parsed.profile.mileage_rate || 0.67).toFixed(2)
        });
        setRecurring((parsed.profile.recurring_lines || []).map(l => ({ ...l, quantity: String(l.quantity), rate: String(l.rate) })));
        setBusinessInfo({
          business_name: parsed.profile.business_name || '',
          business_address: parsed.profile.business_address || '',
          tax_id: parsed.profile.tax_id_masked || ''
        });
      }
      
      setLoading(false);
    } catch (e) {
      console.error('Error parsing user data:', e);
      router.push('/contractor');
    }
  }, [router]);

  async function saveRates(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const profile = await contractorApi.updateProfile({
        hourly_rate: rates.hourly_rate, ot_rate: rates.ot_rate, mileage_rate: rates.mileage_rate,
      });
      const next = { ...user, profile: { ...user.profile, ...profile } };
      setUser(next);
      saveContractorSession(next);
      setMessage({ type: 'success', text: t('Rates updated!') });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: error.message || t('Failed to update rates') });
    } finally {
      setSaving(false);
    }
  }

  async function saveRecurring(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const profile = await contractorApi.updateProfile({
        recurring_lines: recurring.map(l => ({ description: l.description, quantity: parseFloat(l.quantity) || 1, rate: parseFloat(l.rate) || 0 })),
      });
      const next = { ...user, profile: { ...user.profile, ...profile } };
      setUser(next);
      saveContractorSession(next);
      setRecurring((profile.recurring_lines || []).map(l => ({ ...l, quantity: String(l.quantity), rate: String(l.rate) })));
      setMessage({ type: 'success', text: t('Weekly line items saved') });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to save' });
    } finally {
      setSaving(false);
    }
  }

  async function saveBusinessInfo(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const updatedProfile = await contractorApi.updateProfile(businessInfo);
      setBusinessInfo({ ...businessInfo, tax_id: updatedProfile.tax_id_masked || '' });
      saveContractorSession(JSON.stringify({
        ...user,
        profile: updatedProfile
      }));

      setMessage({ type: 'success', text: t('Business info updated!') });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Save business info error:', error);
      setMessage({ type: 'error', text: t('Failed to update business info') });
    } finally {
      setSaving(false);
    }
  }

  async function changePin(e) {
    e.preventDefault();
    setMessage(null);

    if (pinChange.new.length < 4) {
      setMessage({ type: 'error', text: t('PIN must be at least 4 digits') });
      return;
    }

    if (pinChange.new !== pinChange.confirm) {
      setMessage({ type: 'error', text: t('PINs do not match') });
      return;
    }

    setSaving(true);

    try {
      // Checked and hashed on the server (current PIN required if one exists).
      await contractorApi.changePin(pinChange.current, pinChange.new);

      // Update session
      const updatedUser = {
        ...user,
        profile: { ...user.profile, has_pin: true },
        needsPinSetup: false
      };
      saveContractorSession(JSON.stringify(updatedUser));
      setUser(updatedUser);

      setPinChange({ current: '', new: '', confirm: '' });
      setMessage({ type: 'success', text: t('PIN updated successfully!') });

      // If this was first-time setup, redirect to dashboard
      if (user.needsPinSetup) {
        setTimeout(() => router.push('/contractor/dashboard'), 1500);
      } else {
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error) {
      console.error('Change PIN error:', error);
      setMessage({ type: 'error', text: error.message || t('Failed to update PIN') });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">{t('Loading...')}</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          {!user.needsPinSetup && (
            <Link
              href="/contractor/dashboard"
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
            >
              {t('← Back')}
            </Link>
          )}
          <div>
            <h1 className="text-xl font-bold">{t('⚙️ Settings')}</h1>
            <p className="text-sm text-gray-400">{user.first_name} {user.last_name}</p>
          </div>
        </div>
      </header>

      {/* Message Toast */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
          message.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {message.text}
        </div>
      )}

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        
        {/* First-time PIN setup notice */}
        {user.needsPinSetup && (
          <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-xl p-4">
            <h2 className="font-bold text-yellow-400 mb-2">{t('⚠️ Setup Required')}</h2>
            <p className="text-gray-300">{t('Please set a PIN to secure your account before continuing.')}</p>
          </div>
        )}

        {/* Language */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">{t('🌐 Language')}</h2>
            <p className="text-sm text-gray-400">{t('Portal, Friday reminder e-mail and push. Your invoices stay in English.')}</p>
          </div>
          <LangSwitch />
        </div>

        {/* PIN Change */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h2 className="font-bold mb-4">🔒 {user.profile?.has_pin ? t('Change PIN') : t('Set PIN')}</h2>
          <form onSubmit={changePin} className="space-y-4">
            {user.profile?.has_pin && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('Current PIN')}</label>
                <input
                  type="password"
                  value={pinChange.current}
                  onChange={(e) => setPinChange({ ...pinChange, current: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-center tracking-widest"
                  placeholder="••••"
                  maxLength={6}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('New PIN')}</label>
                <input
                  type="password"
                  value={pinChange.new}
                  onChange={(e) => setPinChange({ ...pinChange, new: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-center tracking-widest"
                  placeholder="••••"
                  minLength={4}
                  maxLength={6}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('Confirm PIN')}</label>
                <input
                  type="password"
                  value={pinChange.confirm}
                  onChange={(e) => setPinChange({ ...pinChange, confirm: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-center tracking-widest"
                  placeholder="••••"
                  minLength={4}
                  maxLength={6}
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-medium disabled:opacity-50"
            >
              {saving ? t('Saving...') : user.profile?.has_pin ? t('Change PIN') : t('Set PIN')}
            </button>
          </form>
        </div>

        {/* Rates */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h2 className="font-bold mb-4">{t('💰 Your Rates')}</h2>
          <form onSubmit={saveRates} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('Hourly Rate')}</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rates.hourly_rate}
                    onChange={(e) => setRates({ ...rates, hourly_rate: e.target.value })}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-7 pr-4 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('OT Rate')}</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rates.ot_rate}
                    onChange={(e) => setRates({ ...rates, ot_rate: e.target.value })}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-7 pr-4 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('Per Mile')}</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rates.mileage_rate}
                    onChange={(e) => setRates({ ...rates, mileage_rate: e.target.value })}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-7 pr-4 py-2"
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              {t('Used on your EMF invoices from now on. Invoices already created keep the rates they were made with.')}
            </p>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-green-600 hover:bg-green-700 py-2 rounded-lg font-medium disabled:opacity-50"
            >
              {saving ? t('Saving...') : t('Save Rates')}
            </button>
          </form>
        </div>

        {/* Weekly line items */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h2 className="font-bold mb-1">{t('🔁 Weekly Line Items')}</h2>
          <p className="text-sm text-gray-400 mb-4">{t('Added to every new EMF invoice and to the Friday draft (e.g. Admin Hours). You can still change or remove them on each draft.')}</p>
          <form onSubmit={saveRecurring} className="space-y-3">
            {recurring.length === 0 && <p className="text-sm text-gray-500">{t('None yet.')}</p>}
            {recurring.map((l, i) => (
              <div key={i} className="space-y-2 border-b border-gray-700 pb-3">
                <input type="text" value={l.description} placeholder={t('Description (e.g. Admin Hours)')}
                  onChange={(e) => setRecurring(recurring.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2" />
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                  <input inputMode="decimal" value={l.quantity} placeholder={t('Qty')}
                    onChange={(e) => setRecurring(recurring.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))}
                    className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2" />
                  <input inputMode="decimal" value={l.rate} placeholder={t('Rate $')}
                    onChange={(e) => setRecurring(recurring.map((x, j) => j === i ? { ...x, rate: e.target.value } : x))}
                    className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2" />
                  <button type="button" onClick={() => setRecurring(recurring.filter((_, j) => j !== i))}
                    className="px-3 py-2 bg-red-900 hover:bg-red-800 rounded-lg" title={t('Remove')}>✕</button>
                </div>
                <p className="text-xs text-gray-500">= {t('{amount} per invoice', { amount: '$' + ((parseFloat(l.quantity) || 0) * (parseFloat(l.rate) || 0)).toFixed(2) })}</p>
              </div>
            ))}
            <div className="flex gap-2">
              <button type="button" onClick={() => setRecurring([...recurring, { description: '', quantity: '1', rate: '' }])}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">{t('+ Add item')}</button>
              <button type="submit" disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-medium disabled:opacity-50">
                {saving ? t('Saving...') : t('Save Weekly Items')}
              </button>
            </div>
          </form>
        </div>

        <DocumentsPanel />

        {/* Business Info */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h2 className="font-bold mb-4">{t('🏢 Business Information')}</h2>
          <p className="text-sm text-gray-400 mb-4">{t('This info appears on your invoices')}</p>
          <form onSubmit={saveBusinessInfo} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('Business Name (optional)')}</label>
              <input
                type="text"
                value={businessInfo.business_name}
                onChange={(e) => setBusinessInfo({ ...businessInfo, business_name: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                placeholder={t('Your Business LLC')}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('Business Address')}</label>
              <textarea
                value={businessInfo.business_address}
                onChange={(e) => setBusinessInfo({ ...businessInfo, business_address: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 h-20"
                placeholder={t('123 Main St, City, SC 29000')}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('Tax ID (optional, last 4 of SSN or EIN)')}</label>
              <input
                type="text"
                value={businessInfo.tax_id}
                onChange={(e) => setBusinessInfo({ ...businessInfo, tax_id: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                placeholder={t('XX-XXXXXXX or ***-**-1234')}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-medium disabled:opacity-50"
            >
              {saving ? t('Saving...') : t('Save Business Info')}
            </button>
          </form>
        </div>

        {/* Subscription Status */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h2 className="font-bold mb-2">{t('📋 Subscription')}</h2>
          <div className="flex items-center justify-between">
            <div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                user.profile?.subscription_status === 'active'
                  ? 'bg-green-500/20 text-green-400'
                  : user.profile?.subscription_status === 'trial'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-red-500/20 text-red-400'
              }`}>
                {(user.profile?.subscription_status || 'trial').toUpperCase()}
              </span>
            </div>
            {user.profile?.subscription_expires_at && (
              <p className="text-sm text-gray-400">
                Expires: {fmtDate(user.profile.subscription_expires_at)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
