'use client';
// First sign-in: three short steps instead of dropping the sub on Settings.
//   1. Set a PIN (required)  2. Business info for the invoice header (optional)
//   3. His own rates (he sets his prices) → dashboard
import { useEffect, useState } from 'react';
import { useLang } from '@/app/contractor/components/LangProvider';
import { useRouter } from 'next/navigation';
import { readContractorSession, saveContractorSession } from '@/lib/contractorSession';
import { contractorApi } from '@/lib/contractorClient';

const input = 'w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3';

export default function ContractorWelcome() {
  const { t } = useLang();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(1);
  const [pin, setPin] = useState({ a: '', b: '' });
  const [biz, setBiz] = useState({ business_name: '', business_address: '', tax_id: '' });
  const [rates, setRates] = useState({ hourly_rate: '', ot_rate: '', mileage_rate: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const raw = readContractorSession();
    if (!raw) { router.replace('/contractor'); return; }
    try {
      const u = JSON.parse(raw);
      setUser(u);
      setStep(u.profile?.has_pin ? 2 : 1);
      setRates({
        hourly_rate: String(u.profile?.hourly_rate ?? ''),
        ot_rate: String(u.profile?.ot_rate ?? ''),
        mileage_rate: String(u.profile?.mileage_rate ?? ''),
      });
      setBiz({
        business_name: u.profile?.business_name || '',
        business_address: u.profile?.business_address || '',
        tax_id: u.profile?.tax_id_masked || '',
      });
    } catch { router.replace('/contractor'); }
  }, [router]);

  function save(next) {
    setUser(next);
    saveContractorSession(next);
  }

  async function submitPin(e) {
    e.preventDefault();
    setError('');
    if (!/^\d{4,6}$/.test(pin.a)) { setError(t('PIN must be 4–6 digits')); return; }
    if (pin.a !== pin.b) { setError(t('PINs do not match')); return; }
    setBusy(true);
    try {
      await contractorApi.changePin('', pin.a);
      const { needsPinSetup, ...rest } = user;
      save({ ...rest, profile: { ...user.profile, has_pin: true } });
      setStep(2);
    } catch (err) {
      setError(err.message || t('Could not set the PIN'));
    } finally {
      setBusy(false);
    }
  }

  async function submitBiz(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const profile = await contractorApi.updateProfile(biz);
      save({ ...user, profile: { ...user.profile, ...profile } });
      setStep(3);
    } catch (err) {
      setError(err.message || t('Could not save'));
    } finally {
      setBusy(false);
    }
  }

  async function submitRates() {
    setError('');
    setBusy(true);
    try {
      const profile = await contractorApi.updateProfile(rates);
      save({ ...user, profile: { ...user.profile, ...profile } });
      router.replace('/contractor/dashboard');
    } catch (err) {
      setError(err.message || t('Could not save rates'));
      setBusy(false);
    }
  }

  if (!user) return null;
  const p = user.profile || {};

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-start justify-center p-4">
      <div className="w-full max-w-md mt-8">
        <h1 className="text-2xl font-bold">{t('Welcome, {name}!', { name: user.first_name })}</h1>
        <p className="text-gray-400 mb-6">{t('Three quick steps and you are set up.')}</p>

        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map(n => (
            <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? 'bg-blue-500' : 'bg-gray-700'}`} />
          ))}
        </div>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        {step === 1 && (
          <form onSubmit={submitPin} className="bg-gray-800 rounded-xl border border-gray-700 p-5 space-y-4">
            <h2 className="font-bold">{t('1 · Choose a PIN')}</h2>
            <p className="text-sm text-gray-400">{t('You sign in with your e-mail and this PIN.')}</p>
            <input type="password" inputMode="numeric" autoFocus placeholder={t('New PIN (4–6 digits)')} className={`${input} text-center tracking-widest`}
              value={pin.a} onChange={e => setPin({ ...pin, a: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
            <input type="password" inputMode="numeric" placeholder={t('Repeat PIN')} className={`${input} text-center tracking-widest`}
              value={pin.b} onChange={e => setPin({ ...pin, b: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
            <button disabled={busy} className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-bold disabled:opacity-50">
              {busy ? t('Saving…') : t('Set PIN')}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={submitBiz} className="bg-gray-800 rounded-xl border border-gray-700 p-5 space-y-4">
            <h2 className="font-bold">{t('2 · Your business')}</h2>
            <p className="text-sm text-gray-400">{t('Shown as “From” on your invoices. You can change it later under Profile.')}</p>
            <input className={input} placeholder={t('Business name (optional)')} value={biz.business_name}
              onChange={e => setBiz({ ...biz, business_name: e.target.value })} />
            <textarea className={`${input} h-20`} placeholder={t('Business address')} value={biz.business_address}
              onChange={e => setBiz({ ...biz, business_address: e.target.value })} />
            <input className={input} placeholder={t('Tax ID / EIN (optional)')} value={biz.tax_id}
              onChange={e => setBiz({ ...biz, tax_id: e.target.value })} />
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(3)} className="flex-1 bg-gray-700 hover:bg-gray-600 py-3 rounded-lg">{t('Skip')}</button>
              <button disabled={busy} className="flex-1 bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-bold disabled:opacity-50">
                {busy ? t('Saving…') : t('Save')}
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 space-y-4">
            <h2 className="font-bold">{t('3 · Your rates')}</h2>
            <p className="text-sm text-gray-400">{t('Your prices for EMF invoices. You can change them any time under Profile.')}</p>
            <div className="grid grid-cols-3 gap-3">
              {[['hourly_rate', t('per hour')], ['ot_rate', t('overtime')], ['mileage_rate', t('per mile')]].map(([k, label]) => (
                <label key={k} className="block">
                  <span className="text-xs text-gray-400">{label} $</span>
                  <input inputMode="decimal" className={input} value={rates[k]}
                    onChange={e => setRates({ ...rates, [k]: e.target.value.replace(/[^\d.]/g, '') })} />
                </label>
              ))}
            </div>
            <p className="text-sm text-gray-400">{t('Every Friday the week before (Fri–Thu) is ready to invoice — you\'ll find it at the top of your Home screen.')}</p>
            <button onClick={submitRates} disabled={busy} className="w-full bg-green-600 hover:bg-green-700 py-3 rounded-lg font-bold disabled:opacity-50">
              {busy ? t('Saving…') : t('Save & go to my portal')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
