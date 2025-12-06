// components/quotes/NTEIncreaseList.js - Display NTE Increases on Work Order
// CORRECTED: Shows Current Accrued + Additional = Projected Total (New NTE Needed)
import { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function NTEIncreaseList({ 
  quotes = [],
  loading = false,
  onNewQuote,
  onViewQuote,
  onDeleteQuote,
  // Also support alternate prop names for flexibility
  workOrder,
  nteIncreases,
  onEdit,
  onDelete,
  onPrint,
  onRefresh 
}) {
  const { language } = useLanguage();
  const supabase = createClientComponentClient();
  
  // Support both prop naming conventions
  const quotesList = quotes.length > 0 ? quotes : (nteIncreases || []);
  const isLoading = loading;
  
  const [existingCostsTotal, setExistingCostsTotal] = useState(0);
  const [calculatingCosts, setCalculatingCosts] = useState(false);
  const [wo, setWo] = useState(workOrder || {});
  
  // Get work order from first quote if not passed directly
  useEffect(() => {
    if (workOrder) {
      setWo(workOrder);
    } else if (quotesList.length > 0 && quotesList[0].wo_id) {
      // Fetch work order data if we have quotes but no workOrder prop
      fetchWorkOrder(quotesList[0].wo_id);
    }
  }, [workOrder, quotesList]);

  const fetchWorkOrder = async (woId) => {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select('*')
        .eq('wo_id', woId)
        .single();
      
      if (!error && data) {
        setWo(data);
      }
    } catch (err) {
      console.error('Error fetching work order:', err);
    }
  };
  
  // Calculate existing/accrued costs
  useEffect(() => {
    if (wo.wo_id) {
      calculateExistingCosts();
    }
  }, [wo.wo_id]);
  
  const calculateExistingCosts = async () => {
    if (!wo.wo_id) return;
    
    setCalculatingCosts(true);
    try {
      // Get daily hours logs
      const { data: dailyLogs } = await supabase
        .from('daily_hours_logs')
        .select('*')
        .eq('wo_id', wo.wo_id);
      
      // Get team member assignments  
      const { data: teamMembers } = await supabase
        .from('work_order_assignments')
        .select('*')
        .eq('wo_id', wo.wo_id);
      
      // Calculate labor from daily logs or legacy
      let totalRT = 0;
      let totalOT = 0;
      
      if (dailyLogs && dailyLogs.length > 0) {
        dailyLogs.forEach(log => {
          totalRT += parseFloat(log.regular_hours) || 0;
          totalOT += parseFloat(log.overtime_hours) || 0;
        });
      } else {
        totalRT = parseFloat(wo.hours_regular) || 0;
        totalOT = parseFloat(wo.hours_overtime) || 0;
        
        if (teamMembers) {
          teamMembers.forEach(tm => {
            totalRT += parseFloat(tm.hours_regular) || 0;
            totalOT += parseFloat(tm.hours_overtime) || 0;
          });
        }
      }
      
      const laborTotal = (totalRT * 64) + (totalOT * 96);
      const materialWithMarkup = (parseFloat(wo.material_cost) || 0) * 1.25;
      const equipmentWithMarkup = (parseFloat(wo.emf_equipment_cost) || 0) * 1.25;
      const trailerWithMarkup = (parseFloat(wo.trailer_cost) || 0) * 1.25;
      const rentalWithMarkup = (parseFloat(wo.rental_cost) || 0) * 1.25;
      
      let totalMileage = parseFloat(wo.miles) || 0;
      if (teamMembers) {
        teamMembers.forEach(tm => {
          totalMileage += parseFloat(tm.miles) || 0;
        });
      }
      const mileageCost = totalMileage * 1.00;
      const adminFee = 128;
      
      const total = laborTotal + materialWithMarkup + equipmentWithMarkup + 
                   trailerWithMarkup + rentalWithMarkup + mileageCost + adminFee;
      
      setExistingCostsTotal(total);
    } catch (err) {
      console.error('Error calculating existing costs:', err);
    }
    setCalculatingCosts(false);
  };
  
  const originalNTE = parseFloat(wo.nte) || 0;

  // Handle view/edit action - support both prop names
  const handleView = (quote) => {
    if (onViewQuote) onViewQuote(quote);
    else if (onEdit) onEdit(quote);
  };

  // Handle delete action - support both prop names
  const handleDelete = (quoteId) => {
    if (onDeleteQuote) onDeleteQuote(quoteId);
    else if (onDelete) onDelete(quoteId);
  };

  return (
    <div className="bg-yellow-900/50 rounded-lg p-4 border-2 border-yellow-600">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-yellow-300 flex items-center gap-2">
          💰 {language === 'en' ? 'NTE Increase Requests' : 'Solicitudes de Aumento NTE'}
        </h3>
        <div className="flex gap-2">
          {onRefresh && (
            <button 
              onClick={onRefresh}
              className="text-yellow-400 text-sm flex items-center gap-1"
            >
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
          {language === 'en' 
            ? 'No NTE increase requests yet' 
            : 'Sin solicitudes de aumento NTE'}
        </div>
      ) : (
        <div className="space-y-4">
          {quotesList.map((quote) => {
            const additionalTotal = parseFloat(quote.grand_total) || 0;
            const projectedTotal = existingCostsTotal + additionalTotal;
            const newNTENeeded = projectedTotal;
            
            return (
              <div 
                key={quote.quote_id} 
                className="bg-gray-800 rounded-lg p-4 border border-yellow-700"
              >
                {/* Header with badge and actions */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                      quote.is_verbal_nte 
                        ? 'bg-orange-500 text-white' 
                        : 'bg-blue-500 text-white'
                    }`}>
                      {quote.is_verbal_nte ? '📞 Verbal NTE' : '📄 Written NTE'}
                    </span>
                    <div className="text-gray-400 text-xs mt-1">
                      {new Date(quote.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {onPrint && (
                      <button
                        onClick={() => onPrint(quote)}
                        className="bg-gray-600 hover:bg-gray-500 p-2 rounded text-sm"
                        title="Print"
                      >
                        🖨️
                      </button>
                    )}
                    {(onViewQuote || onEdit) && (
                      <button
                        onClick={() => handleView(quote)}
                        className="bg-yellow-600 hover:bg-yellow-500 p-2 rounded text-sm"
                        title="View/Edit"
                      >
                        ✏️
                      </button>
                    )}
                    {(onDeleteQuote || onDelete) && (
                      <button
                        onClick={() => handleDelete(quote.quote_id)}
                        className="bg-red-600 hover:bg-red-500 p-2 rounded text-sm"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Description */}
                {quote.description && (
                  <div className="text-sm text-gray-300 mb-3 italic">
                    "{quote.description}"
                  </div>
                )}
                
                {/* Verbal approved by */}
                {quote.is_verbal_nte && quote.verbal_approved_by && (
                  <div className="text-sm text-orange-300 mb-3">
                    {language === 'en' ? 'Approved by' : 'Aprobado por'}: {quote.verbal_approved_by}
                  </div>
                )}
                
                {/* Cost Summary - Corrected Display */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {/* Left Column - Additional Work Costs */}
                  <div className="space-y-1">
                    <div className="text-gray-400 text-xs uppercase mb-1">
                      {language === 'en' ? 'Additional Work' : 'Trabajo Adicional'}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Labor</span>
                      <span>${(parseFloat(quote.labor_total) || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{language === 'en' ? 'Materials' : 'Materiales'}</span>
                      <span>${(parseFloat(quote.materials_with_markup) || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{language === 'en' ? 'Equipment' : 'Equipo'}</span>
                      <span>${(parseFloat(quote.equipment_with_markup) || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{language === 'en' ? 'Mileage' : 'Millaje'}</span>
                      <span>${(parseFloat(quote.mileage_total) || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Admin</span>
                      <span>${(parseFloat(quote.admin_fee) || 0).toFixed(2)}</span>
                    </div>
                  </div>
                  
                  {/* Right Column - Summary */}
                  <div className="space-y-1">
                    <div className="text-gray-400 text-xs uppercase mb-1">
                      {language === 'en' ? 'Summary' : 'Resumen'}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-300">{language === 'en' ? 'Current' : 'Actual'}</span>
                      <span className="text-blue-300">${existingCostsTotal.toFixed(2)}</span>
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
                  <div className="bg-green-800 rounded-lg p-3 flex justify-between items-center">
                    <span className="font-bold text-green-300">
                      {language === 'en' ? 'New NTE Needed:' : 'Nuevo NTE:'}
                    </span>
                    <span className="text-xl font-bold text-green-200">
                      ${newNTENeeded.toFixed(2)}
                    </span>
                  </div>
                </div>
                
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
