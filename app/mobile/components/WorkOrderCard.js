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
  
  // Highlight card border for escalation / returned-for-review
  const isEscalation = workOrder.cbre_status === 'escalation';
  const isRejected = workOrder.cbre_status === 'quote_rejected' || workOrder.cbre_status === 'invoice_rejected';
  const isTechReview = workOrder.status === 'tech_review';
  const cardBorder = isTechReview
    ? 'border-l-4 border-yellow-400'
    : isEscalation 
      ? 'border-l-4 border-red-500' 
      : isRejected 
        ? 'border-l-4 border-orange-500' 
        : '';
  
  return (
    <div
      onClick={onClick}
      className={`bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition cursor-pointer active:scale-98 ${cardBorder}`}
    >
      {/* Row 1: WO Number + Priority + Work Status */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-lg">{workOrder.wo_number}</span>
          <span className={`text-sm ${getPriorityColor(workOrder.priority)}`}>
            {getPriorityBadge(workOrder.priority)}
          </span>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${
          workOrder.status === 'tech_review'
            ? 'bg-yellow-400 text-black font-bold animate-pulse'
            : 'bg-gray-700'
        }`}>
          {getStatusBadge(workOrder.status)}
        </span>
      </div>
      
      {/* CBRE Status Badge - prominent, right below WO number */}
      {workOrder.cbre_status && (
        <div className="mb-2">
          <NTEStatusBadge cbreStatus={workOrder.cbre_status} language={language} />
        </div>
      )}
      
      <h3 className="font-semibold mb-1">{workOrder.building}</h3>
      <p className="text-sm text-gray-400 mb-2 line-clamp-2">{workOrder.work_order_description}</p>
      
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
