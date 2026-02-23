// components/quotes/NTEIncreaseList.js - Display NTE Increases on Work Order
// SNAPSHOT PRINCIPLE: Shows saved/frozen values from the NTE request, NOT recalculated costs
// The ticket can accumulate more costs, but the NTE request always shows its saved state
import { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

export default function NTEIncreaseList({ 
  quotes = [],
  loading = false,
  onNewQuote,
  onViewQuote,
  onDeleteQuote,
  workOrder,
  currentTeamList,
  nteIncreases,
  onEdit,
  onDelete,
  onPrint,
  onRefresh 
}) {
  const { language } = useLanguage();
  
  // Support both prop naming conventions
  const quotesList = quotes.length > 0 ? quotes : (nteIncreases || []);
  const isLoading = loading;
  const wo = workOrder || {};
  const currentNTE = parseFloat(wo.nte) || 0;

  // Handle view/edit action
  const handleView = (quote) => {
    if (onViewQuote) onViewQuote(quote);
    else if (onEdit) onEdit(quote);
  };

  // Handle delete action
  const handleDelete = (quoteId) => {
    if (onDeleteQuote) onDeleteQuote(quoteId);
    else if (onDelete) onDelete(quoteId);
  };

  // Status badge component
  const StatusBadge = ({ quote }) => {
    const status = quote.nte_status || (quote.is_verbal_nte ? 'verbal_approved' : 'pending');
    const configs = {
      'verbal_approved': { bg: 'bg-orange-500', icon: '📞', label: language === 'en' ? 'Verbal NTE' : 'NTE Verbal' },
      'pending': { bg: 'bg-blue-500', icon: '📄', label: language === 'en' ? 'Written - Pending' : 'Escrito - Pendiente' },
      'submitted': { bg: 'bg-yellow-500', icon: '📤', label: language === 'en' ? 'Submitted' : 'Enviado' },
      'approved': { bg: 'bg-green-500', icon: '✅', label: language === 'en' ? 'Approved' : 'Aprobado' },
      'rejected': { bg: 'bg-red-500', icon: '❌', label: language === 'en' ? 'Rejected' : 'Rechazado' }
    };
    const config = configs[status] || configs['pending'];
    
    return (
      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${config.bg} text-white`}>
        {config.icon} {config.label}
      </span>
    );
  };

  return (
    <div className="bg-yellow-900/50 rounded-lg p-4 border-2 border-yellow-600">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-yellow-300 flex items-center gap-2">
          💰 {language === 'en' ? 'NTE Increase Requests' : 'Solicitudes de Aumento NTE'}
        </h3>
        <div className="flex gap-2">
          {onRefresh && (
            <button onClick={onRefresh} className="text-yellow-400 text-sm flex items-center gap-1">
              🔄
            </button>
          )}
          {onNewQuote && (
            <button 
              onClick={onNewQuote}
              className="bg-yellow-600 hover:bg-yellow-500 px-3 py-1 rounded text-sm font-semibold"
            >
              + {language === 'en' ? 'New' : 'Nuevo'}
            </button>
          )}
        </div>
      </div>
      
      {isLoading ? (
        <div className="text-center py-4 text-gray-400">
          {language === 'en' ? 'Loading...' : 'Cargando...'}
        </div>
      ) : quotesList.length === 0 ? (
        <div className="text-center py-4 text-gray-400 text-sm">
          {language === 'en' ? 'No NTE increase requests yet' : 'Sin solicitudes de aumento NTE'}
        </div>
      ) : (
        <div className="space-y-4">
          {quotesList.map((quote) => {
            // SNAPSHOT PRINCIPLE: Use stored values from the quote, NOT recalculated
            const snapshotCurrentCosts = parseFloat(quote.current_costs_snapshot) || 0;
            const storedOriginalNTE = parseFloat(quote.original_nte) || 0;
            const storedNewNTE = parseFloat(quote.new_nte_amount) || 0;
            
            // Additional work costs from stored fields
            const laborTotal = parseFloat(quote.labor_total) || 0;
            const materialsWithMarkup = parseFloat(quote.materials_with_markup) || 0;
            const equipmentWithMarkup = parseFloat(quote.equipment_with_markup) || 0;
            const rentalWithMarkup = parseFloat(quote.rental_with_markup) || 0;
            const trailerWithMarkup = parseFloat(quote.trailer_with_markup) || 0;
            const mileageTotal = parseFloat(quote.mileage_total) || 0;
            const additionalTotal = parseFloat(quote.grand_total) || 0;
            
            // Use stored projected total, or calculate from snapshot + additional
            const projectedTotal = storedNewNTE > 0 ? storedNewNTE : (snapshotCurrentCosts + additionalTotal);
            // Use stored original NTE, or fall back to current work order NTE
            const originalNTE = storedOriginalNTE > 0 ? storedOriginalNTE : currentNTE;
            
            const status = quote.nte_status || (quote.is_verbal_nte ? 'verbal_approved' : 'pending');
            
            return (
              <div key={quote.quote_id} className="bg-gray-800 rounded-lg p-4 border border-yellow-700">
                {/* Header with badge and actions */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <StatusBadge quote={quote} />
                    <div className="text-gray-400 text-xs mt-1">
                      {new Date(quote.created_at).toLocaleDateString()}
                      {quote.updated_at && quote.updated_at !== quote.created_at && (
                        <span className="ml-2 text-gray-500">
                          ({language === 'en' ? 'edited' : 'editado'} {new Date(quote.updated_at).toLocaleDateString()})
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {onPrint && (
                      <button onClick={() => onPrint(quote)} className="bg-gray-600 hover:bg-gray-500 p-2 rounded text-sm" title="Print">
                        🖨️
                      </button>
                    )}
                    {(onViewQuote || onEdit) && (
                      <button onClick={() => handleView(quote)} className="bg-yellow-600 hover:bg-yellow-500 p-2 rounded text-sm" title="View/Edit">
                        ✏️
                      </button>
                    )}
                    {(onDeleteQuote || onDelete) && (
                      <button onClick={() => handleDelete(quote.quote_id)} className="bg-red-600 hover:bg-red-500 p-2 rounded text-sm" title="Delete">
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Description */}
                {quote.description && (
                  <div className="text-sm text-gray-300 mb-3 italic">"{quote.description}"</div>
                )}
                
                {/* Verbal approved by */}
                {quote.is_verbal_nte && quote.verbal_approved_by && (
                  <div className="text-sm text-orange-300 mb-3">
                    {language === 'en' ? 'Approved by' : 'Aprobado por'}: {quote.verbal_approved_by}
                  </div>
                )}
                
                {/* Cost Summary - SNAPSHOT VALUES */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {/* Left Column - Additional Work Costs (frozen) */}
                  <div className="space-y-1">
                    <div className="text-gray-400 text-xs uppercase mb-1">
                      {language === 'en' ? 'Additional Work' : 'Trabajo Adicional'}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Labor</span>
                      <span>${laborTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{language === 'en' ? 'Materials' : 'Materiales'}</span>
                      <span>${materialsWithMarkup.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{language === 'en' ? 'Equipment' : 'Equipo'}</span>
                      <span>${equipmentWithMarkup.toFixed(2)}</span>
                    </div>
                    {rentalWithMarkup > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">{language === 'en' ? 'Rental' : 'Renta'}</span>
                        <span>${rentalWithMarkup.toFixed(2)}</span>
                      </div>
                    )}
                    {trailerWithMarkup > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Trailer</span>
                        <span>${trailerWithMarkup.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-400">{language === 'en' ? 'Mileage' : 'Millaje'}</span>
                      <span>${mileageTotal.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  {/* Right Column - Summary (SNAPSHOT) */}
                  <div className="space-y-1">
                    <div className="text-gray-400 text-xs uppercase mb-1">
                      {language === 'en' ? 'Summary (at time of request)' : 'Resumen (al momento de solicitud)'}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-300">{language === 'en' ? 'Accrued' : 'Acumulado'}</span>
                      <span className="text-blue-300">${snapshotCurrentCosts.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-yellow-300">+ {language === 'en' ? 'Additional' : 'Adicional'}</span>
                      <span className="text-yellow-300">${additionalTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-gray-600 pt-1">
                      <span>{language === 'en' ? 'Projected' : 'Proyectado'}</span>
                      <span>${projectedTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                {/* NTE Summary Bar */}
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">{language === 'en' ? 'Original NTE:' : 'NTE Original:'}</span>
                    <span>${originalNTE.toFixed(2)}</span>
                  </div>
                  
                  {/* Status-dependent display */}
                  {status === 'approved' || status === 'verbal_approved' ? (
                    <div className="bg-green-800 rounded-lg p-3 flex justify-between items-center">
                      <span className="font-bold text-green-300">
                        {language === 'en' ? 'New NTE (Approved):' : 'Nuevo NTE (Aprobado):'}
                      </span>
                      <span className="text-xl font-bold text-green-200">
                        ${projectedTotal.toFixed(2)}
                      </span>
                    </div>
                  ) : status === 'rejected' ? (
                    <div className="bg-red-800 rounded-lg p-3 flex justify-between items-center">
                      <span className="font-bold text-red-300">
                        {language === 'en' ? 'Rejected' : 'Rechazado'}
                      </span>
                      <span className="text-lg font-bold text-red-200 line-through">
                        ${projectedTotal.toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    <div className="bg-yellow-800 rounded-lg p-3 flex justify-between items-center">
                      <span className="font-bold text-yellow-300">
                        {language === 'en' ? 'New NTE Requested:' : 'Nuevo NTE Solicitado:'}
                      </span>
                      <span className="text-xl font-bold text-yellow-200">
                        ${projectedTotal.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Approved info */}
                {quote.approved_at && (
                  <div className="text-xs text-green-400 mt-2">
                    ✅ {language === 'en' ? 'Approved' : 'Aprobado'} {new Date(quote.approved_at).toLocaleDateString()}
                    {quote.approved_by && ` - ${quote.approved_by}`}
                  </div>
                )}
                
                {/* Created by */}
                {(quote.users || quote.creator) && (
                  <div className="text-xs text-gray-500 mt-2">
                    {language === 'en' ? 'Created by' : 'Creado por'}: {
                      quote.users?.first_name || quote.creator?.first_name || ''
                    } {
                      quote.users?.last_name || quote.creator?.last_name || ''
                    }
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
