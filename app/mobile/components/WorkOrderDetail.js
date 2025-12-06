// Work Order Detail View Component - WITH DAILY HOURS LOG, FIELD DATA, AND NTE INCREASES
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
  onDownloadLogs,
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

  // FIXED: Handle adding comment - passes the newComment value properly
  async function handleAddComment() {
    if (!newComment || !newComment.trim()) {
      return;
    }
    // Pass the comment text to the parent handler
    await onAddComment(newComment.trim());
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
            </div>
          </div>

          {/* Check In/Out */}
          {status !== 'completed' && (
            <>
              <div className="grid grid-cols-2 gap-3">
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
              value={status}
              onChange={(e) => onUpdateField(wo.wo_id, 'status', e.target.value)}
              disabled={saving || status === 'completed'}
              className="w-full px-4 py-3 bg-blue-600 rounded-lg text-white font-semibold text-center"
            >
              <option value="assigned">{t('assigned')}</option>
              <option value="in_progress">{t('inProgress')}</option>
              <option value="pending">{t('pending')}</option>
              <option value="needs_return">{t('needsReturn')}</option>
              <option value="return_trip">{t('returnTrip')}</option>
              <option value="completed">{t('completedStatus')}</option>
            </select>
          </div>

          {/* ADDITIONAL COSTS - Materials, Equipment, Trailer, Rental */}
          <AdditionalCostsSection
            workOrder={wo}
            status={status}
            saving={saving}
            getFieldValue={getFieldValue}
            handleFieldChange={handleFieldChange}
            handleUpdateField={onUpdateField}
          />

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
          <PrimaryTechDailyHours
            workOrder={wo}
            currentUser={currentUser}
            dailyLogs={dailyLogs}
            status={status}
            saving={saving}
            onAddDailyHours={onAddDailyHours}
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
            onDownloadLogs={onDownloadLogs}
          />

          {/* Email Photos Section */}
          <EmailPhotosSection
            workOrder={wo}
            currentUser={currentUser}
          />

          {/* Cost Summary Section - includes legacy + daily hours */}
          <CostSummarySection
            workOrder={wo}
            currentTeamList={currentTeamList}
          />

          {/* Signature Display */}
          <SignatureDisplay workOrder={wo} />

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
                  disabled={saving}
                />
                <button
                  onClick={handleAddComment}
                  disabled={saving || !newComment || !newComment.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-lg text-sm font-semibold disabled:bg-gray-600"
                >
                  {t('addCommentButton')}
                </button>
              </>
            )}
          </div>

          {/* Complete Work Order Button */}
          {wo.time_out && status !== 'completed' && (
            <button
              onClick={onCompleteWorkOrder}
              disabled={saving}
              className="w-full bg-green-600 hover:bg-green-700 py-4 rounded-lg font-bold text-lg transition active:scale-95"
            >
              ✅ {t('completeWorkOrder')}
            </button>
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
    </div>
  );
}
