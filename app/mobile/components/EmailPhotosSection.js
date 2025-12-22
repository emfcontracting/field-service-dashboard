// components/EmailPhotosSection.js - Bilingual Email Photos Section with Photo Status + PMI Write-ups for PM Work Orders
import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../utils/translations';

export default function EmailPhotosSection({ workOrder, currentUser }) {
  const { language } = useLanguage();
  const t = (key) => translations[language][key];
  
  const [photoStatus, setPhotoStatus] = useState(null);
  const [checkingPhotos, setCheckingPhotos] = useState(false);
  const [lastCheckedPhotos, setLastCheckedPhotos] = useState(null);
  
  // PMI Write-ups state (for PM work orders only)
  const [writeupStatus, setWriteupStatus] = useState(null);
  const [checkingWriteups, setCheckingWriteups] = useState(false);
  const [lastCheckedWriteups, setLastCheckedWriteups] = useState(null);
  
  const wo = workOrder || {};
  const woNumber = wo.wo_number || t('unknown');
  const building = wo.building || t('unknown');
  const description = wo.work_order_description || t('na');
  const status = wo.status || 'assigned';

  // Check if this is a PM work order (starts with P followed by numbers)
  const isPMWorkOrder = woNumber && /^P\d+$/i.test(woNumber);

  // Check photo status on mount and when workOrder changes
  useEffect(() => {
    if (woNumber && woNumber !== t('unknown') && navigator.onLine) {
      checkPhotoStatus();
      if (isPMWorkOrder) {
        checkWriteupStatus();
      }
    }
  }, [woNumber]);

  async function checkPhotoStatus() {
    if (!woNumber || woNumber === t('unknown')) return;
    
    try {
      setCheckingPhotos(true);
      const response = await fetch(`/api/verify-photos/${woNumber}`);
      const result = await response.json();
      
      setPhotoStatus(result);
      setLastCheckedPhotos(new Date());
    } catch (err) {
      console.error('Error checking photo status:', err);
      setPhotoStatus({ error: err.message });
    } finally {
      setCheckingPhotos(false);
    }
  }

  async function checkWriteupStatus() {
    if (!woNumber || woNumber === t('unknown')) return;
    
    try {
      setCheckingWriteups(true);
      const response = await fetch(`/api/verify-writeups/${woNumber}`);
      const result = await response.json();
      
      setWriteupStatus(result);
      setLastCheckedWriteups(new Date());
    } catch (err) {
      console.error('Error checking writeup status:', err);
      setWriteupStatus({ error: err.message });
    } finally {
      setCheckingWriteups(false);
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
    const mailtoLink = `mailto:emfcbre@gmail.com?subject=${subject}&body=${body}`;
    window.location.href = mailtoLink;
  }

  function handleEmailWriteups() {
    const subject = encodeURIComponent(`PMI Write-ups - ${woNumber} - ${building}`);
    const body = encodeURIComponent(
      `${language === 'en' ? 'PM Work Order' : 'Orden de Trabajo PM'}: ${woNumber}\n` +
      `${t('building')}: ${building}\n` +
      `${t('description')}: ${description}\n` +
      `${language === 'en' ? 'Submitted by' : 'Enviado por'}: ${currentUser.first_name} ${currentUser.last_name}\n` +
      `${language === 'en' ? 'Date' : 'Fecha'}: ${new Date().toLocaleString()}\n\n` +
      `--- ${language === 'en' ? 'PMI Write-ups / Findings' : 'Informes PMI / Hallazgos'} ---\n\n` +
      `${language === 'en' ? 'Equipment inspected' : 'Equipo inspeccionado'}:\n\n` +
      `${language === 'en' ? 'Findings/Issues' : 'Hallazgos/Problemas'}:\n\n` +
      `${language === 'en' ? 'Recommendations' : 'Recomendaciones'}:\n\n`
    );
    const mailtoLink = `mailto:emfcbre@gmail.com?subject=${subject}&body=${body}`;
    window.location.href = mailtoLink;
  }

  // Photo status indicator
  const renderPhotoStatus = () => {
    if (checkingPhotos) {
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
          {lastCheckedPhotos && (
            <p className="text-gray-400 text-xs mt-1">
              {language === 'en' ? 'Verified' : 'Verificado'}: {lastCheckedPhotos.toLocaleTimeString()}
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
          {lastCheckedPhotos && (
            <p className="text-gray-400 text-xs mt-1">
              {language === 'en' ? 'Last checked' : 'Última verificación'}: {lastCheckedPhotos.toLocaleTimeString()}
            </p>
          )}
        </div>
      );
    }

    return null;
  };

  // PMI Write-up status indicator (only for PM work orders)
  const renderWriteupStatus = () => {
    if (!isPMWorkOrder) return null;

    if (checkingWriteups) {
      return (
        <div className="flex items-center gap-2 text-yellow-400 text-sm mb-3">
          <span className="animate-pulse">⏳</span>
          <span>{language === 'en' ? 'Checking for write-ups...' : 'Buscando informes...'}</span>
        </div>
      );
    }

    if (writeupStatus?.writeups_received) {
      return (
        <div className="bg-green-900 border border-green-600 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-2 text-green-400 font-semibold">
            <span className="text-xl">✅</span>
            <span>{language === 'en' ? 'PMI Write-ups Received!' : '¡Informes PMI Recibidos!'}</span>
          </div>
          {writeupStatus.email_count && (
            <p className="text-green-300 text-xs mt-1">
              {language === 'en' 
                ? `${writeupStatus.email_count} write-up email(s) found` 
                : `${writeupStatus.email_count} correo(s) con informes encontrado(s)`}
            </p>
          )}
          {lastCheckedWriteups && (
            <p className="text-gray-400 text-xs mt-1">
              {language === 'en' ? 'Verified' : 'Verificado'}: {lastCheckedWriteups.toLocaleTimeString()}
            </p>
          )}
        </div>
      );
    }

    if (writeupStatus && !writeupStatus.writeups_received && !writeupStatus.error) {
      return (
        <div className="bg-orange-900 border border-orange-600 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-2 text-orange-400 font-semibold">
            <span className="text-xl">📋</span>
            <span>{language === 'en' ? 'No PMI Write-ups Found Yet' : 'Aún Sin Informes PMI'}</span>
          </div>
          <p className="text-orange-300 text-xs mt-1">
            {language === 'en' 
              ? 'PM work orders require write-ups before completion.' 
              : 'Las órdenes PM requieren informes antes de completar.'}
          </p>
          {lastCheckedWriteups && (
            <p className="text-gray-400 text-xs mt-1">
              {language === 'en' ? 'Last checked' : 'Última verificación'}: {lastCheckedWriteups.toLocaleTimeString()}
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
        {/* Email Photos Button */}
        <button
          onClick={handleEmailPhotos}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 py-4 rounded-lg font-bold text-lg shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
        >
          <span className="text-2xl">📸</span>
          <span>{t('emailPhotosToOffice')}</span>
        </button>
        
        {/* Refresh Photo Status Button */}
        {navigator.onLine && (
          <button
            onClick={checkPhotoStatus}
            disabled={checkingPhotos}
            className="w-full bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span>{checkingPhotos ? '⏳' : '🔄'}</span>
            <span>
              {checkingPhotos 
                ? (language === 'en' ? 'Checking...' : 'Verificando...') 
                : (language === 'en' ? 'Check Photo Status' : 'Verificar Estado de Fotos')}
            </span>
          </button>
        )}
      </div>
      
      {/* PMI Write-ups Section - Only for PM Work Orders */}
      {isPMWorkOrder && (
        <div className="mt-6 pt-4 border-t border-gray-700">
          <h3 className="font-bold mb-3">📋 {language === 'en' ? 'PMI Write-ups' : 'Informes PMI'}</h3>
          
          {/* Write-up Status Indicator */}
          {renderWriteupStatus()}
          
          <p className="text-sm text-gray-400 mb-3">
            {language === 'en' 
              ? 'PM work orders require inspection write-ups documenting findings and recommendations.'
              : 'Las órdenes PM requieren informes de inspección documentando hallazgos y recomendaciones.'}
          </p>
          
          <div className="space-y-2">
            {/* Email PMI Write-ups Button */}
            <button
              onClick={handleEmailWriteups}
              className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 py-4 rounded-lg font-bold text-lg shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
            >
              <span className="text-2xl">📋</span>
              <span>{language === 'en' ? 'PMI Write-ups to Office' : 'Informes PMI a Oficina'}</span>
            </button>
            
            {/* Refresh Write-up Status Button */}
            {navigator.onLine && (
              <button
                onClick={checkWriteupStatus}
                disabled={checkingWriteups}
                className="w-full bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span>{checkingWriteups ? '⏳' : '🔄'}</span>
                <span>
                  {checkingWriteups 
                    ? (language === 'en' ? 'Checking...' : 'Verificando...') 
                    : (language === 'en' ? 'Check Write-up Status' : 'Verificar Estado de Informes')}
                </span>
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Help Text */}
      <div className="mt-3 text-xs text-gray-500">
        <p>
          {language === 'en' 
            ? '💡 Photos must be received before you can complete the work order.' 
            : '💡 Las fotos deben recibirse antes de poder completar la orden de trabajo.'}
        </p>
        {isPMWorkOrder && (
          <p className="mt-1">
            {language === 'en' 
              ? '📋 PM work orders also require PMI write-ups before completion.' 
              : '📋 Las órdenes PM también requieren informes PMI antes de completar.'}
          </p>
        )}
      </div>
    </div>
  );
}
