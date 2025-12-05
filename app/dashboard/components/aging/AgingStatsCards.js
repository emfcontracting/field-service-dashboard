// app/dashboard/components/aging/AgingStatsCards.js
'use client';

export default function AgingStatsCards({ stats, onFilterClick }) {
  const cards = [
    {
      id: 'critical',
      label: 'Critical',
      sublabel: '5+ days',
      value: stats.critical,
      icon: '🔴',
      bgColor: 'bg-red-900/50',
      borderColor: 'border-red-500',
      textColor: 'text-red-400'
    },
    {
      id: 'warning',
      label: 'Warning',
      sublabel: '3-4 days',
      value: stats.warning,
      icon: '🟠',
      bgColor: 'bg-orange-900/50',
      borderColor: 'border-orange-500',
      textColor: 'text-orange-400'
    },
    {
      id: 'stale',
      label: 'Stale',
      sublabel: '2-3 days',
      value: stats.stale,
      icon: '🟡',
      bgColor: 'bg-yellow-900/50',
      borderColor: 'border-yellow-500',
      textColor: 'text-yellow-400'
    },
    {
      id: 'all',
      label: 'Total Aging',
      sublabel: '2+ days',
      value: stats.total,
      icon: '⚠️',
      bgColor: 'bg-gray-800',
      borderColor: 'border-gray-600',
      textColor: 'text-white'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(card => (
        <button
          key={card.id}
          onClick={() => onFilterClick(card.id)}
          className={`
            ${card.bgColor} border-l-4 ${card.borderColor}
            rounded-lg p-4 text-left transition hover:ring-2 hover:ring-blue-400
          `}
        >
          <div className="flex items-center justify-between">
            <span className="text-2xl">{card.icon}</span>
            <span className={`text-3xl font-bold ${card.textColor}`}>
              {card.value}
            </span>
          </div>
          <div className="mt-2">
            <div className="font-semibold text-white">{card.label}</div>
            <div className="text-xs text-gray-400">{card.sublabel}</div>
          </div>
        </button>
      ))}

      {/* Oldest Work Order Highlight */}
      {stats.oldest && (
        <div className="col-span-2 md:col-span-4 bg-red-900/30 border border-red-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-red-400 font-semibold">🕐 OLDEST OPEN WORK ORDER</div>
              <div className="text-lg font-bold text-white mt-1">
                {stats.oldest.wo_number} - {stats.oldest.building}
              </div>
              <div className="text-sm text-gray-400 mt-1">
                {stats.oldest.work_order_description?.substring(0, 100)}
                {stats.oldest.work_order_description?.length > 100 ? '...' : ''}
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-red-400">
                {stats.oldest.aging.days}
              </div>
              <div className="text-sm text-gray-400">days old</div>
              {stats.oldest.lead_tech && (
                <div className="text-xs text-blue-400 mt-1">
                  👤 {stats.oldest.lead_tech.first_name} {stats.oldest.lead_tech.last_name}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
