// components/modals/ChangePinModal.js - Bilingual Change PIN Modal
'use client';
import { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { translations } from '../../utils/translations';

export default function ChangePinModal({ show, onClose, onChangePin, saving }) {
  const { language } = useLanguage();
  const t = (key) => translations[language][key];
  
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  if (!show) return null;

  async function handleSubmit() {
    if (!newPin || !confirmPin) {
      alert(t('enterEmailAndPIN'));
      return;
    }

    if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      alert(t('pinMustBeFourDigits'));
      return;
    }

    if (newPin !== confirmPin) {
      alert(t('pinsDoNotMatch'));
      return;
    }

    try {
      await onChangePin(newPin);
      alert(t('pinChangedSuccess'));
      setNewPin('');
      setConfirmPin('');
      onClose();
    } catch (err) {
      alert(t('errorChangingPIN') + ' ' + err.message);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">{t('changePIN')}</h3>
          <button
            onClick={() => {
              onClose();
              setNewPin('');
              setConfirmPin('');
            }}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">{t('newPIN')}</label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength="4"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder={t('fourDigitPin')}
              className="w-full px-4 py-3 text-lg text-white bg-gray-700 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">{t('confirmPIN')}</label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength="4"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              placeholder={t('reenterPIN')}
              className="w-full px-4 py-3 text-lg text-white bg-gray-700 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-bold transition active:scale-95 disabled:bg-gray-600"
          >
            {saving ? t('changing') : t('changePINButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
