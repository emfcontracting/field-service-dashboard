// app/mobile/components/MissingDataAlertModal.js
'use client';

import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * Vollbild Missing-Data Alert für den Tech beim App-Open.
 *
 * Zeigt ALLE aktiven missing_data WOs des Techs in einer scrollbaren Liste.
 * Tech kann pro WO:
 *   - "Fix Now"  -> Modal schließt, WO wird geöffnet
 *   - "Can't fix" -> Reason-Prompt -> 4h Snooze (Banner bleibt)
 *
 * Props:
 *   - workOrders: Array von WOs mit status='missing_data'
 *   - onFixNow: (wo) => void   -> Parent öffnet die WO
 *   - onSnooze: (woId, reason) => Promise<void>
 *   - onClose: () => void      -> Wird nur aufgerufen wenn ALLE WOs gesnoozed sind
 *                                 (sonst kann Tech die nicht wegklicken)
 */

const ITEM_LABELS_EN = {
  photos: '📷 Photos',
  writeup: '✍️ Write-up',
  daily_hours: '⏱️ Daily Hours',
  material_costs: '💲 Material costs',
  signature: '✒️ Signature',
  checkin_checkout: '🚪 Check-in/out',
  other: '❓ Other'
};

const ITEM_LABELS_ES = {
  photos: '📷 Fotos',
  writeup: '✍️ Informe',
  daily_hours: '⏱️ Horas diarias',
  material_costs: '💲 Costos de material',
  signature: '✒️ Firma',
  checkin_checkout: '🚪 Entrada/Salida',
  other: '❓ Otro'
};

export default function MissingDataAlertModal({
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
      // Parent will re-evaluate and close the modal if no more active alerts remain.
    } catch (err) {
      alert(t('Failed to snooze: ', 'Error al posponer: ') + (err.message || 'unknown'));
    } finally {
      setSubmittingSnooze(false);
    }
  };

  if (workOrders.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex flex-col">
      {/* Header — pulsing red */}
      <div className="bg-red-700 text-white px-4 py-5 text-center shadow-lg animate-pulse">
        <div className="text-4xl mb-1">🚩</div>
        <div className="text-xl font-bold tracking-wide">
          {t('MISSING DATA ALERT', 'DATOS FALTANTES')}
        </div>
        <div className="text-sm text-red-100 mt-1">
          {workOrders.length === 1
            ? t('1 work order needs your attention', '1 orden de trabajo necesita tu atención')
            : t(
                `${workOrders.length} work orders need your attention`,
                `${workOrders.length} órdenes de trabajo necesitan tu atención`
              )
          }
        </div>
      </div>

      {/* Scrollable WO list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {workOrders.map(wo => {
          const items = Array.isArray(wo.missing_data_items) ? wo.missing_data_items : [];
          const isSnoozing = snoozingWoId === wo.wo_id;

          return (
            <div
              key={wo.wo_id}
              className="bg-red-900/40 border-2 border-red-500/60 rounded-xl p-4 shadow-lg"
            >
              {/* WO header */}
              <div className="mb-3">
                <div className="font-bold text-lg text-white">{wo.wo_number}</div>
                {wo.building && (
                  <div className="text-sm text-red-200">{wo.building}</div>
                )}
              </div>

              {/* Item badges */}
              {items.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {items.map(item => (
                    <span
                      key={item}
                      className="bg-red-500/30 border border-red-400/50 text-red-100 px-2 py-0.5 rounded text-xs font-semibold"
                    >
                      {labels[item] || item}
                    </span>
                  ))}
                </div>
              )}

              {/* Comment from office — prominent */}
              {wo.missing_data_comment && (
                <div className="bg-black/40 border border-red-500/30 rounded-lg p-3 mb-3 text-sm text-white whitespace-pre-wrap leading-relaxed">
                  {wo.missing_data_comment}
                </div>
              )}

              {/* Flagged-at info */}
              {wo.missing_data_flagged_at && (
                <div className="text-xs text-red-300/80 mb-3">
                  {t('Flagged ', 'Marcado ')}
                  {new Date(wo.missing_data_flagged_at).toLocaleString()}
                </div>
              )}

              {/* Action buttons OR snooze form */}
              {!isSnoozing ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => onFixNow(wo)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-lg font-bold transition active:scale-95"
                  >
                    {t('✅ Fix Now', '✅ Solucionar')}
                  </button>
                  <button
                    onClick={() => handleSnoozeStart(wo)}
                    className="px-4 py-3 bg-[#1e1e2e] hover:bg-[#2d2d44] border border-red-500/40 text-red-200 rounded-lg font-semibold transition text-sm"
                  >
                    {t("Can't fix now", 'No puedo ahora')}
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
                      "Why can't you fix this right now? (Office will be notified)",
                      '¿Por qué no puedes solucionarlo ahora? (Se notificará a la oficina)'
                    )}
                    className="w-full bg-black/40 border border-red-500/40 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-red-400 text-sm"
                  />
                  <div className="text-xs text-red-300/80">
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
