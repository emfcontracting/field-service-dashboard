// app/mobile/components/UpdateRequiredAlertModal.js
'use client';

import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * Full-screen Update-Required alert shown to techs on app open.
 *
 * Behaves identically to MissingDataAlertModal but with BLUE theme and
 * different item labels. Lists all active update_required WOs the tech
 * has. Per WO the tech can:
 *   - "Fix Now"  -> Modal closes, WO opens
 *   - "Can't fix" -> Reason prompt -> 4h snooze (banner stays)
 *
 * Props:
 *   - workOrders: Array of WOs with status='update_required'
 *   - onFixNow: (wo) => void
 *   - onSnooze: (woId, reason) => Promise<void>
 *   - onClose: () => void (called when all WOs are snoozed)
 */

const ITEM_LABELS_EN = {
  nte_status:        '📞 NTE Status',
  material_delivery: '📦 Material Delivery',
  quote_status:      '💰 Quote Status',
  other:             '❓ Other'
};

const ITEM_LABELS_ES = {
  nte_status:        '📞 Estado NTE',
  material_delivery: '📦 Entrega de Material',
  quote_status:      '💰 Estado de Cotización',
  other:             '❓ Otro'
};

export default function UpdateRequiredAlertModal({
  workOrders = [],
  onFixNow,
  onSnooze,
  onClose
}) {
  const { language } = useLanguage();
  const isES = language === 'es';
  const labels = isES ? ITEM_LABELS_ES : ITEM_LABELS_EN;

  const [snoozingWoId, setSnoozingWoId] = useState(null);
  const [snoozeReason, setSnoozeReason] = useState('');
  const [submittingSnooze, setSubmittingSnooze] = useState(false);

  const t = (en, es) => isES ? es : en;

  const handleSnoozeStart = (wo) => {
    setSnoozingWoId(wo.wo_id);
    setSnoozeReason('');
  };

  const handleSnoozeCancel = () => {
    setSnoozingWoId(null);
    setSnoozeReason('');
  };

  const handleSnoozeSubmit = async () => {
    if (snoozeReason.trim().length < 10) {
      alert(t(
        'Please give a real reason (at least 10 characters).',
        'Por favor da una razón real (mínimo 10 caracteres).'
      ));
      return;
    }

    try {
      setSubmittingSnooze(true);
      await onSnooze(snoozingWoId, snoozeReason.trim());
      setSnoozingWoId(null);
      setSnoozeReason('');
    } catch (err) {
      alert(t('Failed to snooze: ', 'Error al posponer: ') + (err.message || 'unknown'));
    } finally {
      setSubmittingSnooze(false);
    }
  };

  if (workOrders.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex flex-col">
      {/* Header — pulsing BLUE */}
      <div className="bg-blue-700 text-white px-4 py-5 text-center shadow-lg animate-pulse">
        <div className="text-4xl mb-1">🔵</div>
        <div className="text-xl font-bold tracking-wide">
          {t('STATUS UPDATE REQUIRED', 'ACTUALIZACIÓN REQUERIDA')}
        </div>
        <div className="text-sm text-blue-100 mt-1">
          {workOrders.length === 1
            ? t('1 work order needs follow-up', '1 orden necesita seguimiento')
            : t(
                `${workOrders.length} work orders need follow-up`,
                `${workOrders.length} órdenes necesitan seguimiento`
              )
          }
        </div>
      </div>

      {/* Scrollable WO list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {workOrders.map(wo => {
          const items = Array.isArray(wo.update_required_items) ? wo.update_required_items : [];
          const isSnoozing = snoozingWoId === wo.wo_id;

          return (
            <div
              key={wo.wo_id}
              className="bg-blue-900/40 border-2 border-blue-500/60 rounded-xl p-4 shadow-lg"
            >
              {/* WO header */}
              <div className="mb-3">
                <div className="font-bold text-lg text-white">{wo.wo_number}</div>
                {wo.building && (
                  <div className="text-sm text-blue-200">{wo.building}</div>
                )}
              </div>

              {/* Item badges */}
              {items.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {items.map(item => (
                    <span
                      key={item}
                      className="bg-blue-500/30 border border-blue-400/50 text-blue-100 px-2 py-0.5 rounded text-xs font-semibold"
                    >
                      {labels[item] || item}
                    </span>
                  ))}
                </div>
              )}

              {/* Comment from office */}
              {wo.update_required_comment && (
                <div className="bg-black/40 border border-blue-500/30 rounded-lg p-3 mb-3 text-sm text-white whitespace-pre-wrap leading-relaxed">
                  {wo.update_required_comment}
                </div>
              )}

              {/* Flagged-at info */}
              {wo.update_required_flagged_at && (
                <div className="text-xs text-blue-300/80 mb-3">
                  {t('Flagged ', 'Marcado ')}
                  {new Date(wo.update_required_flagged_at).toLocaleString()}
                </div>
              )}

              {/* Action buttons OR snooze form */}
              {!isSnoozing ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => onFixNow(wo)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-lg font-bold transition active:scale-95"
                  >
                    {t('✅ Follow Up Now', '✅ Hacer Seguimiento')}
                  </button>
                  <button
                    onClick={() => handleSnoozeStart(wo)}
                    className="px-4 py-3 bg-[#1e1e2e] hover:bg-[#2d2d44] border border-blue-500/40 text-blue-200 rounded-lg font-semibold transition text-sm"
                  >
                    {t("Can't right now", 'Ahora no puedo')}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    autoFocus
                    value={snoozeReason}
                    onChange={(e) => setSnoozeReason(e.target.value)}
                    disabled={submittingSnooze}
                    rows={3}
                    placeholder={t(
                      "Why can't you follow up right now? (Office will be notified)",
                      '¿Por qué no puedes hacer seguimiento ahora? (Se notificará a la oficina)'
                    )}
                    className="w-full bg-black/40 border border-blue-500/40 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-blue-400 text-sm"
                  />
                  <div className="text-xs text-blue-300/80">
                    {snoozeReason.trim().length < 10
                      ? t(
                          `Need ${10 - snoozeReason.trim().length} more characters`,
                          `Faltan ${10 - snoozeReason.trim().length} caracteres`
                        )
                      : t('Alert will be hidden for 4 hours', 'La alerta se ocultará por 4 horas')
                    }
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSnoozeCancel}
                      disabled={submittingSnooze}
                      className="flex-1 bg-[#1e1e2e] border border-[#2d2d44] text-slate-300 px-3 py-2 rounded-lg text-sm font-semibold"
                    >
                      {t('Cancel', 'Cancelar')}
                    </button>
                    <button
                      onClick={handleSnoozeSubmit}
                      disabled={submittingSnooze || snoozeReason.trim().length < 10}
                      className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-900/50 disabled:text-amber-300/50 text-white px-3 py-2 rounded-lg text-sm font-bold transition"
                    >
                      {submittingSnooze
                        ? t('Saving...', 'Guardando...')
                        : t('💤 Snooze 4h', '💤 Posponer 4h')
                      }
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Bottom info bar */}
        <div className="bg-[#0d0d14] border border-[#2d2d44] rounded-lg p-3 text-xs text-slate-400 text-center mt-4">
          {t(
            'These work orders will stay pinned to the top of your list until resolved by office.',
            'Estas órdenes permanecerán al inicio de tu lista hasta que la oficina las resuelva.'
          )}
        </div>
      </div>
    </div>
  );
}
