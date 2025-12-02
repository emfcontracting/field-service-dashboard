// Work Order Detail View Component - Updated with Daily Hours Integration
import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../utils/translations';
import { formatDate, formatDateTime, calculateAge, getStatusBadge } from '../utils/helpers';
import CostSummarySection from './CostSummarySection';
import EmailPhotosSection from './EmailPhotosSection';
import DailyHoursSection from './DailyHoursSection';
import TeamMembersSection from './TeamMembersSection';
import SignatureDisplay from './SignatureDisplay';
import SignatureModal from './modals/SignatureModal';

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
  getFieldValue,
  handleFieldChange
}) {
  const { language } = useLanguage();
  const t = (key) => translations[language][key] || key;
  
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

  function handlePrintWO() {
    const age = calculateAge(dateEntered);
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert(language === 'en' ? 'Unable to open print window.' : 'No se puede abrir ventana de impresión.');
      return;
    }
    
    const signatureSection = wo.customer_signature ? `
      <div class="section">
        <h2>Customer Signature</h2>
        <img src="${wo.customer_signature}" alt="Customer Signature" style="max-width: 400px; border: 1px solid #ccc; padding: 10px;">
        <div class="value"><span class="label">Signed By:</span> ${wo.customer_name || 'N/A'}</div>
        <div class="value"><span class="label">Signed On:</span> ${formatDateTime(wo.signature_date)}</div>
      </div>
    ` : '';
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Work Order ${woNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #1e40af; }
          .header { border-bottom: 2px solid #1e40af; padding-bottom: 10px; margin-bottom: 20px; }
          .section { margin-bottom: 20px; }
          .label { font-weight: bold; color: #4b5563; }
          .value { margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
          th { background-color: #f3f4f6; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Work Order: ${woNumber}</h1>
          <p><strong>Created:</strong> ${new Date().toLocaleString()}</p>
        </div>
        <div class="section">
          <h2>Work Order Details</h2>
          <div class="value"><span class="label">Building:</span> ${building}</div>
          <div class="value"><span class="label">Priority:</span> ${wo.priority || 'N/A'}</div>
          <div class="value"><span class="label">Status:</span> ${(status || '').replace('_', ' ').toUpperCase()}</div>
          <div class="value"><span class="label">Age:</span> ${age} days</div>
          <div class="value"><span class="label">Date Entered:</span> ${formatDate(dateEntered)}</div>
          <div class="value"><span class="label">Requestor:</span> ${requestor}</div>
          <div class="value"><span class="label">NTE:</span> $${nte.toFixed(2)}</div>
        </div>
        <div class="section">
          <h2>Description</h2>
          <p>${description}</p>
        </div>
        <div class="section">
          <h2>Team</h2>
          <div class="value"><span class="label">Lead Tech:</span> ${leadTech.first_name || ''} ${leadTech.last_name || ''}</div>
          ${currentTeamList.map((member, idx) => 
            `<div class="value"><span class="label">Helper ${idx + 1}:</span> ${member.user?.first_name || ''} ${member.user?.last_name || ''}</div>`
          ).join('')}
        </div>
        ${signatureSection}
        ${wo.comments ? `
          <div class="section">
            <h2>Comments</h2>
            <p style="white-space: pre-wrap;">${wo.comments}</p>
          </div>
        ` : ''}
        ${!wo.customer_signature ? `
          <div class="section" style="margin-top: 40px;">
            <p><strong>Signature:</strong> ___________________________ <strong>Date:</strong> _______________</p>
          </div>
        ` : ''}
        <button onclick="window.print()" style="margin-top: 20px; padding: 10px 20px; background: #1e40af; color: white; border: none; cursor: pointer; border-radius: 5px;">Print</button>
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
            <h3 className="font-bold mb-3 text-blue-400">📋 {t('workOrderDetails')}</h3>
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
                  <p className="text-blue-400 text-xs mt-1">
                    {t('seeCommentsForHistory')}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Primary Assignment */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-3">👷 {t('primaryAssignment')}</h3>
            <div className="bg-gray-700 rounded-lg p-3">
              <p className="font-semibold">
                {leadTech.first_name || t('unknown')} {leadTech.last_name || ''}
              </p>
              <p className="text-xs text-gray-400">
                {language === 'en' ? 'Lead Tech' : 'Técnico Principal'}
              </p>
            </div>
          </div>

          {/* Team Members Section - Simplified (no hours inputs) */}
          <TeamMembersSection
            currentTeamList={currentTeamList}
            status={status}
            saving={saving}
            onLoadTeamMembers={onLoadTeamMembers}
            onRemoveTeamMember={onRemoveTeamMember}
          />

          {/* Update Status */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-3">📊 {t('updateStatus')}</h3>
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

          {/* Daily Hours Section - NEW */}
          <DailyHoursSection
            workOrder={wo}
            currentUser={currentUser}
            currentTeamList={currentTeamList}
          />

          {/* Materials & Equipment Section */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-3">🛠️ {language === 'en' ? 'Materials & Equipment' : 'Materiales y Equipo'}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t('materialCost')}</label>
                <input
                  type="number"
                  step="0.01"
                  value={getFieldValue('material_cost')}
                  onChange={(e) => handleFieldChange('material_cost', e.target.value)}
                  onBlur={(e) => onUpdateField(wo.wo_id, 'material_cost', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
                  disabled={saving || status === 'completed'}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t('emfEquipment')}</label>
                <input
                  type="number"
                  step="0.01"
                  value={getFieldValue('emf_equipment_cost')}
                  onChange={(e) => handleFieldChange('emf_equipment_cost', e.target.value)}
                  onBlur={(e) => onUpdateField(wo.wo_id, 'emf_equipment_cost', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
                  disabled={saving || status === 'completed'}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t('trailerCost')}</label>
                <input
                  type="number"
                  step="0.01"
                  value={getFieldValue('trailer_cost')}
                  onChange={(e) => handleFieldChange('trailer_cost', e.target.value)}
                  onBlur={(e) => onUpdateField(wo.wo_id, 'trailer_cost', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
                  disabled={saving || status === 'completed'}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t('rentalCost')}</label>
                <input
                  type="number"
                  step="0.01"
                  value={getFieldValue('rental_cost')}
                  onChange={(e) => handleFieldChange('rental_cost', e.target.value)}
                  onBlur={(e) => onUpdateField(wo.wo_id, 'rental_cost', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
                  disabled={saving || status === 'completed'}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Email Photos Section */}
          <EmailPhotosSection
            workOrder={wo}
            currentUser={currentUser}
          />

          {/* Cost Summary Section */}
          <CostSummarySection
            workOrder={wo}
            currentTeamList={currentTeamList}
          />

          {/* Signature Display */}
          <SignatureDisplay workOrder={wo} />

          {/* Comments */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-3">💬 {language === 'en' ? 'Comments & Notes' : 'Comentarios y Notas'}</h3>
            <div className="mb-3 max-h-40 overflow-y-auto bg-gray-700 rounded-lg p-3">
              {wo.comments ? (
                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans">
                  {wo.comments}
                </pre>
              ) : (
                <p className="text-gray-500 text-sm">{language === 'en' ? 'No comments yet' : 'Aún no hay comentarios'}</p>
              )}
            </div>
            {status !== 'completed' && (
              <>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={language === 'en' ? 'Add a comment...' : 'Agregar un comentario...'}
                  className="w-full px-3 py-2 bg-gray-700 rounded-lg mb-2 text-sm text-white"
                  rows="3"
                  disabled={saving}
                />
                <button
                  onClick={onAddComment}
                  disabled={saving || !newComment.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-lg text-sm font-semibold disabled:bg-gray-600"
                >
                  {language === 'en' ? 'Add Comment' : 'Agregar Comentario'}
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
