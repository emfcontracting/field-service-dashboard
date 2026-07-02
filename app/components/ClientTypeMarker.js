// app/components/ClientTypeMarker.js
// ─────────────────────────────────────────────────────────────────────────────
// Prominent CBRE / UPS marker, centered, in client brand colors.
// Used at the top of ticket views (mobile detail, dashboard modal, cards)
// so techs can never confuse a CBRE ticket with a UPS ticket at a glance.
//
//   CBRE → green #003F2D bar, white text
//   UPS  → brown #644117 bar, gold #FFB500 text
//   NULL → amber warning bar; optionally renders "Set as CBRE / UPS" buttons
//          when `onSetClientType` is provided (admin/dashboard use).
//
// Tailwind can't compile dynamic hex classes, so colors are inline styles.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { getClientType, CLIENT_STYLES } from '@/lib/clientType';

export default function ClientTypeMarker({
  workOrder,
  size = 'md',            // 'sm' (cards) | 'md' (detail views) | 'lg' (hero)
  onSetClientType = null, // async (type) => void — shows set buttons when NULL
  className = ''
}) {
  const clientType = getClientType(workOrder);

  const sizeClasses = {
    sm: 'text-xs py-0.5 tracking-[0.2em]',
    md: 'text-lg py-1.5 tracking-[0.35em]',
    lg: 'text-2xl py-2.5 tracking-[0.4em]'
  };
  const sizeClass = sizeClasses[size] || sizeClasses.md;

  // Unknown client type → warning strip (blocks NTE creation elsewhere)
  if (!clientType) {
    return (
      <div
        className={`w-full rounded-md border-2 border-amber-500 bg-amber-900/60 text-center font-bold text-amber-300 ${sizeClass} ${className}`}
      >
        ⚠ CLIENT TYPE NOT SET
        {onSetClientType && (
          <div className="flex justify-center gap-2 py-1.5">
            <button
              type="button"
              onClick={() => onSetClientType('CBRE')}
              className="rounded px-3 py-1 text-xs font-bold tracking-normal text-white"
              style={{ backgroundColor: CLIENT_STYLES.CBRE.bgHex }}
            >
              Set as CBRE
            </button>
            <button
              type="button"
              onClick={() => onSetClientType('UPS')}
              className="rounded px-3 py-1 text-xs font-bold tracking-normal"
              style={{
                backgroundColor: CLIENT_STYLES.UPS.bgHex,
                color: CLIENT_STYLES.UPS.textHex
              }}
            >
              Set as UPS
            </button>
          </div>
        )}
      </div>
    );
  }

  const style = CLIENT_STYLES[clientType];

  return (
    <div
      className={`w-full rounded-md text-center font-extrabold ${sizeClass} ${className}`}
      style={{
        backgroundColor: style.bgHex,
        color: style.textHex,
        border: `1px solid ${style.accentHex}`
      }}
    >
      {style.label}
    </div>
  );
}
