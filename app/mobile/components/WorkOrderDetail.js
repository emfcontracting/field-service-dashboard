// Work Order Detail View Component - WITH DAILY HOURS LOG, FIELD DATA, NTE INCREASES & JURASSIC PARK VALIDATION 🦖
import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../utils/translations';
import { formatDate, formatDateTime, calculateAge, getStatusBadge } from '../utils/helpers';
import CostSummarySection from './CostSummarySection';
import EmailPhotosSection from './EmailPhotosSection';
import AdditionalCostsSection from './AdditionalCostsSection';
import PrimaryTechDailyHours from './PrimaryTechDailyHours';
import TeamMembersDailyHours from './TeamMembersDailyHours';
import SignatureDisplay from './SignatureDisplay';
import SignatureModal from './modals/SignatureModal';
import NTEIncreaseList from './quotes/NTEIncreaseList';
import JurassicParkError from './JurassicParkError';

// Map missing_data item -> DOM id of the matching section in this view.
// Used by the clickable badges in the missing-data banner to scroll the tech
// directly to the section they need to fix.
const MISSING_DATA_SECTION_IDS = {
  photos: 'section-photos',
  writeup: 'section-photos',           // PMI write-ups live alongside photos
  daily_hours: 'section-daily-hours',
  material_costs: 'section-material-costs',
  signature: 'section-signature',
  checkin_checkout: 'section-checkin-checkout',
  other: null                          // no specific anchor
};

const MISSING_DATA_LABELS_EN = {
  photos: '📷 Photos',
  writeup: '✍️ Write-up',
  daily_hours: '⏱️ Daily Hours',
  material_costs: '💲 Material costs',
  signature: '✒️ Signature',
  checkin_checkout: '🚪 Check-in/out',
  other: '❓ Other'
};

const MISSING_DATA_LABELS_ES = {
  photos: '📷 Fotos',
  writeup: '✍️ Informe',
  daily_hours: '⏱️ Horas',
  material_costs: '💲 Materiales',
  signature: '✒️ Firma',
  checkin_checkout: '🚪 Entrada/Salida',
  other: '❓ Otro'
};

export default function WorkOrderDetail({
  workOrder,
  currentUser,
  currentTeamList,
  saving,
  newComment,
  setNewComment,
  onBack,
  onCheckIn,
  onCheckOut,
  onCompleteWorkOrder,
  onUpdateField,
  onAddComment,
  onLoadTeamMembers,
  onRemoveTeamMember,
  onShowChangePin,
  onLogout,
  onSaveSignature,
  // FIELD DATA PROPS
  getFieldValue,
  handleFieldChange,
  // TEAM MEMBER FIELD DATA PROPS
  getTeamFieldValue,
  handleTeamFieldChange,
  handleUpdateTeamMemberField,
  // DAILY HOURS PROPS
  dailyLogs = [],
  onAddDailyHours,
  onUpdateDailyHours,
  onDeleteDailyHours,
  onDownloadLogs,
  onMarkMissingDataFixed,
  onMarkUpdateRequiredFollowedUp,
  // NTE INCREASE PROPS
  quotes = [],
  quotesLoading = false,
  onNewQuote,
  onViewQuote,
  onDeleteQuote
}) {
  const { language } = useLanguage();
  const t = (key) => translations[language]?.[key] || key;
  
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureSaving, setSignatureSaving] = useState(false);
  
  // 💬 COMMENT SAVE STATUS: 'idle' | 'saving' | 'success' | 'error'
  const [commentSaveStatus, setCommentSaveStatus] = useState('idle');
  
  // 🦖 JURASSIC PARK ERROR STATE
  const [jurassicError, setJurassicError] = useState(null);

  // ✅ Missing-data "Done" button state
  const [markingFixed, setMarkingFixed] = useState(false);
  const [markedFixedThisSession, setMarkedFixedThisSession] = useState(false);

  // ✅ Update-required "Followed up" button state
  const [markingFollowedUp, setMarkingFollowedUp] = useState(false);
  const [markedFollowedUpThisSession, setMarkedFollowedUpThisSession] = useState(false);

  // 🚩 Missing data: jump to the section the badge points to
  const scrollToSection = (sectionId) => {
    if (!sectionId) return;
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Brief highlight pulse so the tech immediately sees where they landed
      el.classList.add('ring-4', 'ring-red-500', 'ring-opacity-75');
      setTimeout(() => {
        el.classList.remove('ring-4', 'ring-red-500', 'ring-opacity-75');
      }, 2000);
    }
  };

  // ✅ Tech marks missing data as fixed -> notifies office
  const handleMarkFixed = async () => {
    if (!onMarkMissingDataFixed || markingFixed) return;
    const confirmText = language === 'en'
      ? 'Mark missing data as fixed and notify the office?\n\nThe office will review and resolve the flag in the dashboard.'
      : '¿Marcar los datos faltantes como arreglados y notificar a la oficina?\n\nLa oficina revisará y resolverá la marca en el panel.';
    if (!window.confirm(confirmText)) return;

    try {
      setMarkingFixed(true);
      await onMarkMissingDataFixed(wo.wo_id);
      setMarkedFixedThisSession(true);
      alert(language === 'en'
        ? '✅ Office notified. They will resolve the flag once they verify the fix.'
        : '✅ Oficina notificada. Resolverán la marca una vez que verifiquen el arreglo.'
      );
    } catch (err) {
      alert((language === 'en' ? 'Failed to notify office: ' : 'Error al notificar a la oficina: ') + (err.message || 'unknown'));
    } finally {
      setMarkingFixed(false);
    }
  };

  // ✅ Tech marks update-required as followed up -> notifies office
  const handleMarkFollowedUp = async () => {
    if (!onMarkUpdateRequiredFollowedUp || markingFollowedUp) return;
    const confirmText = language === 'en'
      ? 'Mark this as followed up and notify the office?\n\nThe office will review and resolve the flag in the dashboard.'
      : '¿Marcar como seguimiento hecho y notificar a la oficina?\n\nLa oficina revisará y resolverá la marca en el panel.';
    if (!window.confirm(confirmText)) return;

    try {
      setMarkingFollowedUp(true);
      await onMarkUpdateRequiredFollowedUp(wo.wo_id);
      setMarkedFollowedUpThisSession(true);
      alert(language === 'en'
        ? '✅ Office notified. They will resolve the flag once they verify.'
        : '✅ Oficina notificada. Resolverán la marca una vez que verifiquen.'
      );
    } catch (err) {
      alert((language === 'en' ? 'Failed to notify office: ' : 'Error al notificar a la oficina: ') + (err.message || 'unknown'));
    } finally {
      setMarkingFollowedUp(false);
    }
  };
  
  const wo = workOrder || {};
  const woNumber = wo.wo_number || t('unknown');
  const building = wo.building || t('unknown');
  const description = wo.work_order_description || t('na');
  const status = wo.status || 'assigned';
  const nte = wo.nte || 0;
  const dateEntered = wo.date_entered;
  const requestor = wo.requestor || t('na');
  const leadTech = wo.lead_tech || {};

  async function handleSignatureSave(signatureData) {
    setSignatureSaving(true);
    try {
      await onSaveSignature(signatureData);
      setShowSignatureModal(false);
      alert(language === 'en' ? '✅ Signature saved successfully!' : '✅ ¡Firma guardada exitosamente!');
    } catch (err) {
      alert((language === 'en' ? 'Error saving signature: ' : 'Error al guardar firma: ') + err.message);
    } finally {
      setSignatureSaving(false);
    }
  }

  // FIXED: Handle adding comment - with visual feedback for techs
  async function handleAddComment() {
    if (!newComment || !newComment.trim()) {
      return;
    }
    
    setCommentSaveStatus('saving');
    
    try {
      // Pass the comment text to the parent handler
      await onAddComment(newComment.trim());
      
      // Success! Show feedback
      setCommentSaveStatus('success');
      setNewComment(''); // Clear the input
      
      // Reset status after 3 seconds
      setTimeout(() => {
        setCommentSaveStatus('idle');
      }, 3000);
      
    } catch (error) {
      console.error('Error saving comment:', error);
      setCommentSaveStatus('error');
      
      // Reset error status after 5 seconds
      setTimeout(() => {
        setCommentSaveStatus('idle');
      }, 5000);
    }
  }

  // 🦖 JURASSIC PARK VALIDATION - Validates before completing work order
  async function handleCompleteWorkOrder() {
    // Validation 1: Check if Time Entry exists (daily logs)
    const hasTimeEntry = dailyLogs && dailyLogs.length > 0;
    
    if (!hasTimeEntry) {
      const errorMessage = language === 'en' 
        ? '⏰ You must log time entries before completing this work order!'
        : '⏰ ¡Debes registrar las horas antes de completar esta orden de trabajo!';
      setJurassicError(errorMessage);
      return;
    }

    // Validation 2: Check if Photos exist (only when online)
    if (navigator.onLine) {
      try {
        const response = await fetch(`/api/verify-photos/${woNumber}`);
        const result = await response.json();
        
        if (!result.photos_received) {
          const errorMessage = language === 'en'
            ? '📸 You must send before/after photos before completing this work order!'
            : '📸 ¡Debes enviar fotos de antes/después antes de completar esta orden de trabajo!';
          setJurassicError(errorMessage);
          return;
        }
      } catch (err) {
        console.error('Error checking photos:', err);
        // If photo check fails (network error), show warning but allow to proceed
        const continueAnyway = window.confirm(
          language === 'en'
            ? '⚠️ Could not verify photos (network issue).\n\nDo you want to continue completing this work order?\n\nMake sure you have sent before/after photos!'
            : '⚠️ No se pudieron verificar las fotos (problema de red).\n\n¿Deseas continuar completando esta orden de trabajo?\n\n¡Asegúrate de haber enviado fotos de antes/después!'
        );
        if (!continueAnyway) {
          return;
        }
      }
    }

    // ✅ All validations passed - proceed with completion
    onCompleteWorkOrder();
  }

  function downloadCompletionCertificate() {
    const completionDate = wo.date_completed ? formatDateTime(wo.date_completed) : formatDateTime(new Date().toISOString());
    const signatureDateTime = wo.signature_date ? formatDateTime(wo.signature_date) : t('na');
    
    // Parse location if available
    let locationDisplay = '';
    if (wo.signature_location) {
      const [lat, lng] = wo.signature_location.split(',');
      locationDisplay = `${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}`;
    }
    
    // Escape HTML in comments to prevent XSS
    const escapedComments = (wo.comments || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    const escapedDescription = (description || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${language === 'en' ? 'Work Order Completion Certificate' : 'Certificado de Orden de Trabajo Completada'} - ${woNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 40px; background: white; color: #333; }
          .certificate { max-width: 800px; margin: 0 auto; border: 3px solid #1e40af; padding: 40px; background: white; }
          .header { text-align: center; border-bottom: 2px solid #1e40af; padding-bottom: 20px; margin-bottom: 30px; }
          .header h1 { color: #1e40af; font-size: 24px; margin-bottom: 10px; }
          .header .company { font-size: 18px; color: #666; }
          .badge { display: inline-block; background: #22c55e; color: white; padding: 8px 20px; border-radius: 20px; font-weight: bold; margin-top: 15px; }
          .section { margin-bottom: 25px; }
          .section-title { font-size: 14px; color: #1e40af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; font-weight: bold; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
          .info-item { padding: 10px; background: #f9fafb; border-radius: 6px; }
          .info-label { font-size: 11px; color: #666; text-transform: uppercase; margin-bottom: 4px; }
          .info-value { font-size: 14px; font-weight: 600; color: #333; }
          .description-box { background: #f9fafb; border-radius: 8px; padding: 15px; margin-top: 10px; }
          .description-text { font-size: 14px; line-height: 1.6; color: #333; }
          .comments-box { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 15px; margin-top: 10px; max-height: 200px; overflow-y: auto; }
          .comments-text { font-size: 12px; line-height: 1.5; color: #333; white-space: pre-wrap; font-family: inherit; }
          .signature-section { margin-top: 30px; padding-top: 25px; border-top: 2px solid #1e40af; }
          .signature-grid { display: grid; grid-template-columns: auto 1fr; gap: 30px; align-items: start; }
          .signature-image { border: 2px solid #e5e7eb; padding: 10px; background: #f9fafb; border-radius: 8px; }
          .signature-image img { max-width: 250px; height: auto; display: block; }
          .signature-details { }
          .signature-item { margin-bottom: 12px; }
          .signature-label { font-size: 11px; color: #666; text-transform: uppercase; margin-bottom: 2px; }
          .signature-value { font-size: 14px; font-weight: 600; color: #333; }
          .location-link { color: #1e40af; text-decoration: none; }
          .location-link:hover { text-decoration: underline; }
          .verification { background: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 15px; margin-top: 20px; text-align: center; }
          .verification-text { color: #166534; font-weight: bold; font-size: 14px; }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 11px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
          @media print { 
            body { padding: 20px; } 
            .certificate { border: 2px solid #1e40af; } 
            .no-print { display: none; }
            .comments-box { max-height: none; }
          }
        </style>
      </head>
      <body>
        <div class="certificate">
          <div class="header">
            <h1>${language === 'en' ? 'WORK ORDER COMPLETION CERTIFICATE' : 'CERTIFICADO DE ORDEN DE TRABAJO COMPLETADA'}</h1>
            <div class="company">EMF Contracting LLC</div>
            <div class="badge">✓ ${language === 'en' ? 'COMPLETED' : 'COMPLETADO'}</div>
          </div>
          
          <!-- Work Order Info -->
          <div class="section">
            <div class="section-title">${language === 'en' ? 'Work Order Information' : 'Información de la Orden'}</div>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">${language === 'en' ? 'Work Order #' : 'Orden #'}</div>
                <div class="info-value">${woNumber}</div>
              </div>
              <div class="info-item">
                <div class="info-label">${t('building')}</div>
                <div class="info-value">${building}</div>
              </div>
              <div class="info-item">
                <div class="info-label">${t('requestor')}</div>
                <div class="info-value">${requestor}</div>
              </div>
              <div class="info-item">
                <div class="info-label">${language === 'en' ? 'Date Completed' : 'Fecha Completada'}</div>
                <div class="info-value">${completionDate}</div>
              </div>
            </div>
          </div>
          
          <!-- Job Description -->
          <div class="section">
            <div class="section-title">${language === 'en' ? 'Job Description' : 'Descripción del Trabajo'}</div>
            <div class="description-box">
              <p class="description-text">${escapedDescription || (language === 'en' ? 'No description provided' : 'Sin descripción')}</p>
            </div>
          </div>
          
          <!-- Comments/Notes -->
          ${wo.comments ? `
          <div class="section">
            <div class="section-title">${language === 'en' ? 'Work Notes & Comments' : 'Notas y Comentarios del Trabajo'}</div>
            <div class="comments-box">
              <div class="comments-text">${escapedComments}</div>
            </div>
          </div>
          ` : ''}
          
          <!-- Signature Section -->
          ${wo.customer_signature ? `
            <div class="signature-section">
              <div class="section-title">${language === 'en' ? 'Customer Verification & Signature' : 'Verificación y Firma del Cliente'}</div>
              <div class="signature-grid">
                <div class="signature-image">
                  <img src="${wo.customer_signature}" alt="Customer Signature" />
                </div>
                <div class="signature-details">
                  <div class="signature-item">
                    <div class="signature-label">${language === 'en' ? 'Signed By' : 'Firmado Por'}</div>
                    <div class="signature-value">${wo.customer_name || t('na')}</div>
                  </div>
                  <div class="signature-item">
                    <div class="signature-label">${language === 'en' ? 'Date & Time Signed' : 'Fecha y Hora de Firma'}</div>
                    <div class="signature-value">${signatureDateTime}</div>
                  </div>
                  ${locationDisplay ? `
                  <div class="signature-item">
                    <div class="signature-label">${language === 'en' ? 'Location (GPS)' : 'Ubicación (GPS)'}</div>
                    <div class="signature-value">
                      <a href="https://www.google.com/maps?q=${wo.signature_location}" target="_blank" class="location-link">
                        📍 ${locationDisplay}
                      </a>
                    </div>
                  </div>
                  ` : ''}
                </div>
              </div>
              <div class="verification">
                <span class="verification-text">✓ ${language === 'en' ? 'Work completed and verified by customer signature' : 'Trabajo completado y verificado por firma del cliente'}</span>
              </div>
            </div>
          ` : `
            <div class="section">
              <div class="section-title">${language === 'en' ? 'Signature' : 'Firma'}</div>
              <p style="color: #666; font-style: italic;">${language === 'en' ? 'No customer signature on file' : 'Sin firma del cliente en archivo'}</p>
            </div>
          `}
          
          <div class="footer">
            <p><strong>EMF Contracting LLC</strong></p>
            <p>${language === 'en' ? 'Certificate Generated' : 'Certificado Generado'}: ${new Date().toLocaleString()}</p>
          </div>
        </div>
        
        <div class="no-print" style="text-align: center; margin-top: 30px;">
          <button onclick="window.print()" style="background: #1e40af; color: white; padding: 15px 40px; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; margin-right: 10px;">
            🖨️ ${language === 'en' ? 'Print Certificate' : 'Imprimir Certificado'}
          </button>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
  }

  function handlePrintWO() {
    const age = calculateAge(dateEntered);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert(language === 'en' ? 'Unable to open print window.' : 'No se puede abrir la ventana de impresión.');
      return;
    }
    
    const signatureSection = wo.customer_signature ? `
      <div class="section">
        <h2>${language === 'en' ? 'Customer Signature' : 'Firma del Cliente'}</h2>
        <img src="${wo.customer_signature}" alt="Signature" style="max-width: 400px; border: 1px solid #ccc; padding: 10px;">
        <div class="value"><span class="label">${language === 'en' ? 'Signed By' : 'Firmado Por'}:</span> ${wo.customer_name || t('na')}</div>
      </div>
    ` : '';
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${language === 'en' ? 'Work Order' : 'Orden de Trabajo'} ${woNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #1e40af; }
          .header { border-bottom: 2px solid #1e40af; padding-bottom: 10px; margin-bottom: 20px; }
          .section { margin-bottom: 20px; }
          .label { font-weight: bold; color: #4b5563; }
          .value { margin-bottom: 10px; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${language === 'en' ? 'Work Order' : 'Orden de Trabajo'}: ${woNumber}</h1>
        </div>
        <div class="section">
          <div class="value"><span class="label">${t('building')}:</span> ${building}</div>
          <div class="value"><span class="label">${t('description')}:</span> ${description}</div>
          <div class="value"><span class="label">${t('nte')}:</span> $${nte.toFixed(2)}</div>
          <div class="value"><span class="label">${t('age')}:</span> ${age} ${t('days')}</div>
        </div>
        ${signatureSection}
        <button onclick="window.print()" style="margin-top: 20px; padding: 10px 20px; background: #1e40af; color: white; border: none; cursor: pointer; border-radius: 5px;">
          ${language === 'en' ? 'Print' : 'Imprimir'}
        </button>
      </body>
      </html>
    `);
    printWindow.document.close();
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={onBack}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
          >
            ← {t('back')}
          </button>
          <h1 className="text-xl font-bold">{woNumber}</h1>
          <div className="flex gap-2">
            {(currentUser.role === 'admin' || currentUser.role === 'office') && (
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg text-sm"
                title="Dashboard"
              >
                💻
              </button>
            )}
            <button
              onClick={onShowChangePin}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm"
            >
              🔒
            </button>
            <button
              onClick={onLogout}
              className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg text-sm"
            >
              {t('logout')}
            </button>
          </div>
        </div>

        {/* 🚨 TECH REVIEW ALERT - HIGHLY VISIBLE */}
        {status === 'tech_review' && (
          <div className="bg-red-600 border-4 border-red-400 rounded-xl p-4 mb-4 animate-pulse">
            <div className="text-center">
              <div className="text-3xl mb-2">⚠️</div>
              <h2 className="text-xl font-bold text-white mb-2">
                {language === 'en' ? 'RETURNED FROM INVOICE' : 'DEVUELTO DE FACTURA'}
              </h2>
              <p className="text-white text-sm">
                {language === 'en' 
                  ? 'This work order was returned because something is missing or incorrect. Please review and correct the issue.'
                  : 'Esta orden fue devuelta porque falta algo o es incorrecto. Por favor revise y corrija el problema.'}
              </p>
            </div>
          </div>
        )}

        {/* 🚩 MISSING DATA ALERT — in-WO banner with clickable item badges */}
        {status === 'missing_data' && (
          <div
            className="bg-red-700 border-4 border-red-400 rounded-xl p-4 mb-4 shadow-lg"
            style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
          >
            <div className="text-center mb-3">
              <div className="text-3xl mb-1">🚩</div>
              <h2 className="text-lg font-bold text-white">
                {language === 'en' ? 'MISSING DATA — ACTION REQUIRED' : 'DATOS FALTANTES — ACCIÓN REQUERIDA'}
              </h2>
              {wo.missing_data_flagged_at && (
                <p className="text-xs text-red-200 mt-1">
                  {language === 'en' ? 'Flagged ' : 'Marcado '}
                  {new Date(wo.missing_data_flagged_at).toLocaleString()}
                </p>
              )}
            </div>

            {/* Office comment - prominent */}
            {wo.missing_data_comment && (
              <div className="bg-black/40 border border-red-300/40 rounded-lg p-3 mb-3 text-white text-sm whitespace-pre-wrap leading-relaxed">
                {wo.missing_data_comment}
              </div>
            )}

            {/* Clickable item badges — tap to scroll */}
            {Array.isArray(wo.missing_data_items) && wo.missing_data_items.length > 0 && (
              <>
                <div className="text-xs text-red-200 mb-1.5 text-center">
                  {language === 'en' ? 'Tap a badge to jump to the section:' : 'Toca una etiqueta para ir a la sección:'}
                </div>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {wo.missing_data_items.map(item => {
                    const labels = language === 'es' ? MISSING_DATA_LABELS_ES : MISSING_DATA_LABELS_EN;
                    const sectionId = MISSING_DATA_SECTION_IDS[item];
                    const isClickable = !!sectionId;
                    return (
                      <button
                        key={item}
                        onClick={() => scrollToSection(sectionId)}
                        disabled={!isClickable}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition active:scale-95 ${
                          isClickable
                            ? 'bg-white text-red-700 border-red-200 hover:bg-red-100 cursor-pointer shadow-md'
                            : 'bg-red-500/30 text-red-100 border-red-300/30 cursor-default'
                        }`}
                      >
                        {labels[item] || item}
                        {isClickable && <span className="ml-1">↓</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Snooze indicator */}
            {wo.missing_data_snoozed_until && new Date(wo.missing_data_snoozed_until) > new Date() && (
              <div className="mt-3 bg-amber-900/60 border border-amber-400/40 rounded-lg p-2 text-center text-amber-200 text-xs">
                💤 {language === 'en' ? 'Alert snoozed until ' : 'Alerta pospuesta hasta '}
                {new Date(wo.missing_data_snoozed_until).toLocaleTimeString()}
              </div>
            )}

            {/* ✅ "I'm done" button — tech tells office they fixed it.
                ONE-SHOT LOCKOUT: disabled if already marked (from DB or this session). */}
            <div className="mt-3">
              {(() => {
                const alreadyMarked = !!wo.missing_data_tech_marked_fixed_at || markedFixedThisSession;
                return (
                  <>
              <button
                onClick={handleMarkFixed}
                disabled={markingFixed || alreadyMarked}
                className={`w-full py-3 rounded-lg font-bold text-white transition active:scale-95 ${
                  alreadyMarked
                    ? 'bg-emerald-700 cursor-default'
                    : markingFixed
                      ? 'bg-emerald-700 cursor-wait'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-lg'
                }`}
              >
                {markingFixed
                  ? (language === 'en' ? '⏳ Notifying office...' : '⏳ Notificando a la oficina...')
                  : alreadyMarked
                    ? (language === 'en' ? '✓ Office notified — awaiting their review' : '✓ Oficina notificada — esperando revisión')
                    : (language === 'en' ? '✅ I fixed it — notify office' : '✅ Lo arreglé — notificar a la oficina')
                }
              </button>
              {!alreadyMarked && (
                <p className="text-xs text-red-200 text-center mt-1.5 opacity-80">
                  {language === 'en'
                    ? 'You can notify the office once. The banner stays until they resolve it.'
                    : 'Puedes notificar a la oficina una vez. La alerta permanece hasta que la resuelvan.'}
                </p>
              )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* 🔵 UPDATE REQUIRED ALERT — blue in-WO banner. SOFT flag: detected via
            flagged_at, NOT status. Does not block the tech — reminder only. */}
        {wo.update_required_flagged_at && (
          <div
            className="bg-blue-700 border-4 border-blue-400 rounded-xl p-4 mb-4 shadow-lg"
            style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
          >
            <div className="text-center mb-3">
              <div className="text-3xl mb-1">🔵</div>
              <h2 className="text-lg font-bold text-white">
                {language === 'en' ? 'STATUS UPDATE REQUIRED' : 'ACTUALIZACIÓN REQUERIDA'}
              </h2>
              {wo.update_required_flagged_at && (
                <p className="text-xs text-blue-200 mt-1">
                  {language === 'en' ? 'Flagged ' : 'Marcado '}
                  {new Date(wo.update_required_flagged_at).toLocaleString()}
                </p>
              )}
            </div>

            {/* Office comment */}
            {wo.update_required_comment && (
              <div className="bg-black/40 border border-blue-300/40 rounded-lg p-3 mb-3 text-white text-sm whitespace-pre-wrap leading-relaxed">
                {wo.update_required_comment}
              </div>
            )}

            {/* Item badges */}
            {Array.isArray(wo.update_required_items) && wo.update_required_items.length > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-center mb-1">
                {wo.update_required_items.map(item => {
                  const labelsEN = {
                    nte_status: '📞 NTE Status',
                    material_delivery: '📦 Material Delivery',
                    quote_status: '💰 Quote Status',
                    other: '❓ Other'
                  };
                  const labelsES = {
                    nte_status: '📞 Estado NTE',
                    material_delivery: '📦 Entrega Material',
                    quote_status: '💰 Estado Cotización',
                    other: '❓ Otro'
                  };
                  const labels = language === 'es' ? labelsES : labelsEN;
                  return (
                    <span
                      key={item}
                      className="bg-blue-500/30 text-blue-100 border border-blue-300/40 px-3 py-1.5 rounded-full text-xs font-bold"
                    >
                      {labels[item] || item}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Snooze indicator */}
            {wo.update_required_snoozed_until && new Date(wo.update_required_snoozed_until) > new Date() && (
              <div className="mt-3 bg-amber-900/60 border border-amber-400/40 rounded-lg p-2 text-center text-amber-200 text-xs">
                💤 {language === 'en' ? 'Alert snoozed until ' : 'Alerta pospuesta hasta '}
                {new Date(wo.update_required_snoozed_until).toLocaleTimeString()}
              </div>
            )}

            {/* ✅ "I followed up" button — ONE-SHOT LOCKOUT */}
            <div className="mt-3">
              {(() => {
                const alreadyMarked = !!wo.update_required_tech_marked_done_at || markedFollowedUpThisSession;
                return (
                  <>
                    <button
                      onClick={handleMarkFollowedUp}
                      disabled={markingFollowedUp || alreadyMarked}
                      className={`w-full py-3 rounded-lg font-bold text-white transition active:scale-95 ${
                        alreadyMarked
                          ? 'bg-emerald-700 cursor-default'
                          : markingFollowedUp
                            ? 'bg-emerald-700 cursor-wait'
                            : 'bg-emerald-600 hover:bg-emerald-700 shadow-lg'
                      }`}
                    >
                      {markingFollowedUp
                        ? (language === 'en' ? '⏳ Notifying office...' : '⏳ Notificando a la oficina...')
                        : alreadyMarked
                          ? (language === 'en' ? '✓ Office notified — awaiting their review' : '✓ Oficina notificada — esperando revisión')
                          : (language === 'en' ? '✅ I followed up — notify office' : '✅ Hice seguimiento — notificar a la oficina')
                      }
                    </button>
                    {!alreadyMarked && (
                      <p className="text-xs text-blue-200 text-center mt-1.5 opacity-80">
                        {language === 'en'
                          ? 'You can notify the office once. The banner stays until they resolve it.'
                          : 'Puedes notificar a la oficina una vez. La alerta permanece hasta que la resuelvan.'}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Work Order Details */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-3 text-blue-400">{t('workOrderDetails')}</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-400">{t('building')}:</span>
                <p className="font-semibold">{building}</p>
              </div>
              <div>
                <span className="text-gray-400">{t('requestor')}:</span>
                <p className="font-semibold">{requestor}</p>
              </div>
              <div>
                <span className="text-gray-400">{t('description')}:</span>
                <p className="text-gray-300">{description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-700">
                <div>
                  <span className="text-gray-400">{t('dateEntered')}:</span>
                  <p className="font-semibold">{formatDate(dateEntered)}</p>
                </div>
                <div>
                  <span className="text-gray-400">{t('age')}:</span>
                  <p className="font-semibold text-orange-500">{calculateAge(dateEntered)} {t('days')}</p>
                </div>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                <span className="text-gray-400">{t('nte')}:</span>
                <span className="text-green-500 font-bold text-lg">${nte.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-3">{t('quickActions')}</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handlePrintWO}
                className="bg-gray-700 hover:bg-gray-600 py-3 rounded-lg font-semibold"
              >
                🖨️ {t('printWO')}
              </button>
              {status !== 'completed' && !wo.customer_signature && (
                <button
                  onClick={() => setShowSignatureModal(true)}
                  className="bg-purple-600 hover:bg-purple-700 py-3 rounded-lg font-semibold"
                >
                  ✍️ {language === 'en' ? 'Get Signature' : 'Obtener Firma'}
                </button>
              )}
              {wo.customer_signature && (
                <button
                  onClick={downloadCompletionCertificate}
                  className="bg-green-600 hover:bg-green-700 py-3 rounded-lg font-semibold"
                >
                  📄 {language === 'en' ? 'Certificate' : 'Certificado'}
                </button>
              )}
              {/* Download My Hours CSV - only shows if current user has logged hours */}
              {dailyLogs.filter(log => String(log.user_id) === String(currentUser?.user_id)).length > 0 && (
                <button
                  onClick={() => onDownloadLogs(currentUser?.user_id)}
                  className="bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold"
                >
                  📥 {language === 'en' ? 'My Hours CSV' : 'Mis Horas CSV'}
                </button>
              )}
            </div>
          </div>

          {/* Check In/Out */}
          {status !== 'completed' && (
            <>
              <div id="section-checkin-checkout" className="grid grid-cols-2 gap-3 rounded-lg transition">
                <button
                  onClick={() => onCheckIn(wo.wo_id)}
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700 py-4 rounded-lg font-bold text-lg transition active:scale-95 disabled:bg-gray-600"
                >
                  ✓ {t('checkIn')}
                </button>
                <button
                  onClick={() => onCheckOut(wo.wo_id)}
                  disabled={saving}
                  className="bg-orange-600 hover:bg-orange-700 py-4 rounded-lg font-bold text-lg transition active:scale-95 disabled:bg-gray-600"
                >
                  ⏸ {t('checkOut')}
                </button>
              </div>
              {wo.time_in && (
                <div className="bg-gray-800 rounded-lg p-3 text-center text-sm">
                  <p className="text-gray-400">
                    {t('firstCheckIn')}: {formatDate(wo.time_in)}
                    {wo.time_out && (
                      <> • {t('firstCheckOut')}: {formatDate(wo.time_out)}</>
                    )}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Primary Assignment */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-3">{t('primaryAssignment')}</h3>
            <div className="bg-gray-700 rounded-lg p-3">
              <p className="font-semibold">
                {leadTech.first_name || t('unknown')} {leadTech.last_name || ''}
              </p>
            </div>
          </div>

          {/* Update Status */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-3">{t('updateStatus')}</h3>
            <select
              value={status === 'missing_data' ? 'missing_data' : status}
              onChange={(e) => onUpdateField(wo.wo_id, 'status', e.target.value)}
              disabled={saving || status === 'completed' || status === 'missing_data'}
              className={`w-full px-4 py-3 rounded-lg text-white font-semibold text-center ${
                status === 'missing_data'
                  ? 'bg-red-600 cursor-not-allowed opacity-90'
                  : 'bg-blue-600'
              }`}
            >
              <option value="assigned">{t('assigned')}</option>
              <option value="in_progress">{t('inProgress')}</option>
              <option value="pending">{t('pending')}</option>
              <option value="return_trip">{t('returnTrip')}</option>
              <option value="needs_return">{t('returnForReview')}</option>
              {status === 'missing_data' && (
                <option value="missing_data">🚩 Missing Data</option>
              )}
            </select>
            {status === 'missing_data' && (
              <p className="text-xs text-red-400 mt-2 text-center">
                {language === 'en'
                  ? 'Status locked — office must resolve the missing data flag'
                  : 'Estado bloqueado — la oficina debe resolver la marca'}
              </p>
            )}
            {wo.update_required_flagged_at && status !== 'missing_data' && (
              <p className="text-xs text-blue-400 mt-2 text-center">
                {language === 'en'
                  ? '🔵 Status-update reminder active — you can still change status'
                  : '🔵 Recordatorio activo — aún puedes cambiar el estado'}
              </p>
            )}
          </div>

          {/* ADDITIONAL COSTS - Materials, Equipment, Trailer, Rental */}
          <div id="section-material-costs" className="rounded-lg transition">
            <AdditionalCostsSection
              workOrder={wo}
              status={status}
              saving={saving}
              getFieldValue={getFieldValue}
              handleFieldChange={handleFieldChange}
              handleUpdateField={onUpdateField}
            />
          </div>

          {/* NTE INCREASES - Quotes for additional work */}
          <NTEIncreaseList
            quotes={quotes}
            loading={quotesLoading}
            workOrder={wo}
            currentTeamList={currentTeamList}
            onNewQuote={onNewQuote}
            onViewQuote={onViewQuote}
            onDeleteQuote={onDeleteQuote}
          />

          {/* PRIMARY TECH DAILY HOURS SECTION - with CSV download */}
          <div id="section-daily-hours" className="rounded-lg transition">
            <PrimaryTechDailyHours
              workOrder={wo}
              currentUser={currentUser}
              dailyLogs={dailyLogs}
              status={status}
              saving={saving}
              onAddDailyHours={onAddDailyHours}
              onUpdateDailyHours={onUpdateDailyHours}
              onDeleteDailyHours={onDeleteDailyHours}
              onDownloadLogs={onDownloadLogs}
            />

            {/* TEAM MEMBERS DAILY HOURS SECTION - view all, log own only */}
            <TeamMembersDailyHours
              currentTeamList={currentTeamList}
              currentUser={currentUser}
              dailyLogs={dailyLogs}
              status={status}
              saving={saving}
              onLoadTeamMembers={onLoadTeamMembers}
              onAddDailyHours={onAddDailyHours}
              onUpdateDailyHours={onUpdateDailyHours}
              onDeleteDailyHours={onDeleteDailyHours}
              onDownloadLogs={onDownloadLogs}
            />
          </div>

          {/* Email Photos Section */}
          <div id="section-photos" className="rounded-lg transition">
            <EmailPhotosSection
              workOrder={wo}
              currentUser={currentUser}
            />
          </div>

          {/* Cost Summary Section - includes legacy + daily hours */}
          <CostSummarySection
            workOrder={wo}
            currentTeamList={currentTeamList}
          />

          {/* Signature Display */}
          <div id="section-signature" className="rounded-lg transition">
            <SignatureDisplay workOrder={wo} />
          </div>

          {/* Comments */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-3">{t('commentsAndNotes')}</h3>
            <div className="mb-3 max-h-40 overflow-y-auto bg-gray-700 rounded-lg p-3">
              {wo.comments ? (
                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans">
                  {wo.comments}
                </pre>
              ) : (
                <p className="text-gray-500 text-sm">{t('noCommentsYet')}</p>
              )}
            </div>
            {status !== 'completed' && (
              <>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={t('addComment')}
                  className="w-full px-3 py-2 bg-gray-700 rounded-lg mb-2 text-sm text-white"
                  rows="3"
                  disabled={saving || commentSaveStatus === 'saving'}
                />
                
                {/* Save Comment Button with Status Feedback */}
                <button
                  onClick={handleAddComment}
                  disabled={saving || commentSaveStatus === 'saving' || !newComment || !newComment.trim()}
                  className={`w-full py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    commentSaveStatus === 'success'
                      ? 'bg-green-600 hover:bg-green-700'
                      : commentSaveStatus === 'error'
                      ? 'bg-red-600 hover:bg-red-700'
                      : commentSaveStatus === 'saving'
                      ? 'bg-gray-600 cursor-wait'
                      : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600'
                  }`}
                >
                  {commentSaveStatus === 'saving' && (
                    <span>⏳ {language === 'en' ? 'Saving...' : 'Guardando...'}</span>
                  )}
                  {commentSaveStatus === 'success' && (
                    <span>✅ {language === 'en' ? 'Saved!' : '¡Guardado!'}</span>
                  )}
                  {commentSaveStatus === 'error' && (
                    <span>❌ {language === 'en' ? 'Error - Tap to Retry' : 'Error - Toca para Reintentar'}</span>
                  )}
                  {commentSaveStatus === 'idle' && (
                    <span>💾 {language === 'en' ? 'Save Comment' : 'Guardar Comentario'}</span>
                  )}
                </button>
                
                {/* Success Message */}
                {commentSaveStatus === 'success' && (
                  <div className="mt-2 p-2 bg-green-900/50 border border-green-600 rounded-lg text-center">
                    <span className="text-green-400 text-sm">
                      ✅ {language === 'en' ? 'Comment saved successfully!' : '¡Comentario guardado exitosamente!'}
                    </span>
                  </div>
                )}
                
                {/* Error Message */}
                {commentSaveStatus === 'error' && (
                  <div className="mt-2 p-2 bg-red-900/50 border border-red-600 rounded-lg text-center">
                    <span className="text-red-400 text-sm">
                      ❌ {language === 'en' ? 'Failed to save. Please try again.' : 'Error al guardar. Por favor intenta de nuevo.'}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Complete Work Order Button - Always visible at bottom */}
          {status !== 'completed' && (
            <>
              <button
                onClick={handleCompleteWorkOrder}
                disabled={saving || status === 'missing_data'}
                className={`w-full py-4 rounded-lg font-bold text-lg transition active:scale-95 ${
                  status === 'missing_data'
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {status === 'missing_data'
                  ? (language === 'en' ? '🔒 Resolve Missing Data First' : '🔒 Resolver Datos Faltantes Primero')
                  : <>✅ {t('completeWorkOrder')}</>
                }
              </button>
              {status === 'missing_data' && (
                <p className="text-xs text-center text-red-400">
                  {language === 'en'
                    ? 'Office must resolve the missing data flag before this WO can be completed.'
                    : 'La oficina debe resolver la marca de datos faltantes antes de completar.'}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Signature Modal */}
      <SignatureModal
        show={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        onSave={handleSignatureSave}
        saving={signatureSaving}
      />

      {/* 🦖 Jurassic Park Error Overlay */}
      {jurassicError && (
        <JurassicParkError
          message={jurassicError}
          onDismiss={() => setJurassicError(null)}
        />
      )}
    </div>
  );
}
