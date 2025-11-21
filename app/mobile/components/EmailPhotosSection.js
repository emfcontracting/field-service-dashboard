// components/EmailPhotosSection.js - Bilingual Email Photos Section
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../utils/translations';

export default function EmailPhotosSection({ workOrder, currentUser }) {
  const { language } = useLanguage();
  const t = (key) => translations[language][key];
  
  const wo = workOrder || {};
  const woNumber = wo.wo_number || t('unknown');
  const building = wo.building || t('unknown');
  const description = wo.work_order_description || t('na');
  const status = wo.status || 'assigned';

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

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="font-bold mb-3">📸 {t('sendPhotos')}</h3>
      <p className="text-sm text-gray-400 mb-3">
        {t('takePhotosEmail')}
      </p>
      <button
        onClick={handleEmailPhotos}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 py-4 rounded-lg font-bold text-lg shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
      >
        <span className="text-2xl">📸</span>
        <span>{t('emailPhotosToOffice')}</span>
      </button>
    </div>
  );
}
