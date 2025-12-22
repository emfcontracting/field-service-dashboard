// components/EmailPhotosSection.js - Bilingual Email Photos Section with Photo Status
import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../utils/translations';

export default function EmailPhotosSection({ workOrder, currentUser }) {
  const { language } = useLanguage();
  const t = (key) => translations[language][key];
  
  const [photoStatus, setPhotoStatus] = useState(null);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);
  
  const wo = workOrder || {};
  const woNumber = wo.wo_number || t('unknown');
  const building = wo.building || t('unknown');
  const description = wo.work_order_description || t('na');
  const status = wo.status || 'assigned';

  // Check photo status on mount and when workOrder changes
  useEffect(() => {
    if (woNumber && woNumber !== t('unknown') && navigator.onLine) {
      checkPhotoStatus();
    }
  }, [woNumber]);

  async function checkPhotoStatus() {
    if (!woNumber || woNumber === t('unknown')) return;
    
    try {
      setChecking(true);
      const response = await fetch(`/api/verify-photos/${woNumber}`);
      const result = await response.json();
      
      setPhotoStatus(result);
      setLastChecked(new Date());
    } catch (err) {
      console.error('Error checking photo status:', err);
      setPhotoStatus({ error: err.message });
    } finally {
      setChecking(false);
    }
  }

  function handleEmailPhotos() {
    const subject = encodeURIComponent(`${language === 'en' ? 'Photos' : 'Fotos'} - ${woNumber} - ${building}`);
    const body = encodeURIComponent(
      `${language === 'en' ? 'Work Order' : 'Orden de Trabajo'}: ${woNumber}\n` +
      `${t('building')}: ${building}\n` +
      `${t('description')}: ${description}\n` +
      `${language === 'en' ? 'Status' : 'Estado'}: ${status.replace('_', ' ').toUpperCase()}\n` +
      `${language === 'en' ? 'Submitted by' : 'Enviado por'}: ${currentUser.first_name} ${currentUser.last_name}\n` +
      `${language === 'en' ? 'Date' : 'Fecha'}: ${new Date().toLocaleString()}\n\n` +
      `--- ${language === 'en' ? 'Attach photos below' : 'Adjuntar fotos abajo'} ---`
    );
    // CC the OAuth-enabled account so we can verify photos were sent
    const mailtoLink = `mailto:emfcbre@gmail.com?cc=wo.emfcontractingsc@gmail.com&subject=${subject}&body=${body}`;
    window.location.href = mailtoLink;
  }

  // Photo status indicator
  const renderPhotoStatus = () => {
    if (checking) {
      return (
        <div className="flex items-center gap-2 text-yellow-400 text-sm mb-3">
          <span className="animate-pulse">⏳</span>
          <span>{language === 'en' ? 'Checking for photos...' : 'Buscando fotos...'}</span>
        </div>
      );
    }

    if (photoStatus?.photos_received) {
      return (
        <div className="bg-green-900 border border-green-600 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-2 text-green-400 font-semibold">
            <span className="text-xl">✅</span>
            <span>{language === 'en' ? 'Photos Received!' : '¡Fotos Recibidas!'}</span>
          </div>
          {photoStatus.email_count && (
            <p className="text-green-300 text-xs mt-1">
              {language === 'en' 
                ? `${photoStatus.email_count} photo email(s) found` 
                : `${photoStatus.email_count} correo(s) con fotos encontrado(s)`}
            </p>
          )}
          {lastChecked && (
            <p className="text-gray-400 text-xs mt-1">
              {language === 'en' ? 'Verified' : 'Verificado'}: {lastChecked.toLocaleTimeString()}
            </p>
          )}
        </div>
      );
    }

    if (photoStatus && !photoStatus.photos_received && !photoStatus.error) {
      return (
        <div className="bg-yellow-900 border border-yellow-600 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-2 text-yellow-400 font-semibold">
            <span className="text-xl">⚠️</span>
            <span>{language === 'en' ? 'No Photos Found Yet' : 'Aún Sin Fotos'}</span>
          </div>
          <p className="text-yellow-300 text-xs mt-1">
            {language === 'en' 
              ? 'Please send before/after photos to complete this work order.' 
              : 'Por favor envíe fotos antes/después para completar esta orden.'}
          </p>
          {lastChecked && (
            <p className="text-gray-400 text-xs mt-1">
              {language === 'en' ? 'Last checked' : 'Última verificación'}: {lastChecked.toLocaleTimeString()}
            </p>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="font-bold mb-3">📸 {t('sendPhotos')}</h3>
      
      {/* Photo Status Indicator */}
      {renderPhotoStatus()}
      
      <p className="text-sm text-gray-400 mb-3">
        {t('takePhotosEmail')}
      </p>
      
      <div className="space-y-2">
        <button
          onClick={handleEmailPhotos}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 py-4 rounded-lg font-bold text-lg shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
        >
          <span className="text-2xl">📸</span>
          <span>{t('emailPhotosToOffice')}</span>
        </button>
        
        {/* Refresh Status Button */}
        {navigator.onLine && (
          <button
            onClick={checkPhotoStatus}
            disabled={checking}
            className="w-full bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span>{checking ? '⏳' : '🔄'}</span>
            <span>
              {checking 
                ? (language === 'en' ? 'Checking...' : 'Verificando...') 
                : (language === 'en' ? 'Check Photo Status' : 'Verificar Estado de Fotos')}
            </span>
          </button>
        )}
      </div>
      
      {/* Help Text */}
      <div className="mt-3 text-xs text-gray-500">
        <p>
          {language === 'en' 
            ? '💡 Photos must be received before you can complete the work order.' 
            : '💡 Las fotos deben recibirse antes de poder completar la orden de trabajo.'}
        </p>
      </div>
    </div>
  );
}
