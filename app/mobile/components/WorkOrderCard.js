// mobile/components/WorkOrderCard.js
'use client';

import {
  formatDate,
  calculateAge,
  getPriorityBadge,
  getPriorityColor,
  getStatusBadge
} from '../utils/formatters';
import { useLanguage } from '../contexts/LanguageContext';

// NTE/CBRE status badge for techs to see at a glance
function NTEStatusBadge({ cbreStatus, language }) {
  if (!cbreStatus) return null;
  
  const configs = {
    'pending_quote': { 
      bg: 'bg-orange-600', 
      text: language === 'en' ? '📋 NTE Pending' : '📋 NTE Pendiente' 
    },
    'quote_submitted': { 
      bg: 'bg-blue-600', 
      text: language === 'en' ? '📤 NTE Submitted' : '📤 NTE Enviado' 
    },
    'quote_approved': { 
      bg: 'bg-green-600', 
      text: language === 'en' ? '✅ NTE Approved' : '✅ NTE Aprobado' 
    },
    'quote_rejected': { 
      bg: 'bg-red-600', 
      text: language === 'en' ? '❌ NTE Rejected' : '❌ NTE Rechazado' 
    },
    'escalation': { 
      bg: 'bg-red-600 animate-pulse', 
      text: language === 'en' ? '🚨 Escalation' : '🚨 Escalación' 
    },
    'reassigned': { 
      bg: 'bg-purple-600', 
      text: language === 'en' ? '🔄 Reassigned' : '🔄 Reasignado' 
    },
    'cancelled': { 
      bg: 'bg-gray-600', 
      text: language === 'en' ? '🚫 Cancelled' : '🚫 Cancelado' 
    }
  };
  
  const config = configs[cbreStatus];
  if (!config) return null;
  
  return (
    <span className={`${config.bg} text-white text-xs px-2 py-0.5 rounded-full font-semibold`}>
      {config.text}
    </span>
  );
}

export default function WorkOrderCard({ workOrder, onClick }) {
  const { language } = useLanguage();
  
  return (
    <div
      onClick={onClick}
      className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition cursor-pointer active:scale-98"
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <span className="font-bold text-lg">{workOrder.wo_number}</span>
          <span className={`ml-2 text-sm ${getPriorityColor(workOrder.priority)}`}>
            {getPriorityBadge(workOrder.priority)}
          </span>
        </div>
        <span className="text-xs bg-gray-700 px-2 py-1 rounded-full">
          {getStatusBadge(workOrder.status)}
        </span>
      </div>
      
      <h3 className="font-semibold mb-1">{workOrder.building}</h3>
      <p className="text-sm text-gray-400 mb-2">{workOrder.work_order_description}</p>
      
      {/* NTE Status Badge - visible to tech at a glance */}
      {workOrder.cbre_status && (
        <div className="mb-2">
          <NTEStatusBadge cbreStatus={workOrder.cbre_status} language={language} />
        </div>
      )}
      
      <div className="flex justify-between items-center text-xs text-gray-500">
        <div>
          <span>{language === 'en' ? 'Entered' : 'Ingresado'}: {formatDate(workOrder.date_entered)}</span>
          <span className="ml-2 text-orange-500 font-semibold">
            {calculateAge(workOrder.date_entered)} {language === 'en' ? 'days old' : 'días'}
          </span>
        </div>
        <span className="text-green-500 font-bold">
          NTE: ${(workOrder.nte || 0).toFixed(2)}
        </span>
      </div>
    </div>
  );
}
