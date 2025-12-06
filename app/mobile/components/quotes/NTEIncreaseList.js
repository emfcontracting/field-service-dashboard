// components/quotes/NTEIncreaseList.js - Display NTE Increases on Work Order
// CORRECTED: Shows Current Accrued + Additional = Projected Total (New NTE Needed)
// Uses same calculation logic as CostSummarySection
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
  currentTeamList,
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
  
  // Calculate existing/accrued costs - SAME LOGIC AS CostSummarySection
  useEffect(() => {
    if (wo.wo_id) {
      calculateExistingCosts();
    }
  }, [wo.wo_id, currentTeamList]);
  
  const calculateExistingCosts = async () => {
    if (!wo.wo_id) return;
    
    setCalculatingCosts(true);
    try {
      // 1. Calculate legacy totals from work_orders and assignments
      const primaryRT = parseFloat(wo.hours_regular) || 0;
      const primaryOT = parseFloat(wo.hours_overtime) || 0;
      const primaryMiles = parseFloat(wo.miles) || 0;

      let teamRT = 0;
      let teamOT = 0;
      let teamMiles = 0;

      // Use passed currentTeamList if available
      if (currentTeamList && Array.isArray(currentTeamList)) {
        currentTeamList.forEach(member => {
          if (member) {
            teamRT += parseFloat(member.hours_regular) || 0;
            teamOT += parseFloat(member.hours_overtime) || 0;
            teamMiles += parseFloat(member.miles) || 0;
          }
        });
      } else {
        // Fallback: fetch team members from database
        const { data: teamMembers } = await supabase
          .from('work_order_assignments')
          .select('hours_regular, hours_overtime, miles')
          .eq('wo_id', wo.wo_id);
        
        if (teamMembers) {
          teamMembers.forEach(member => {
            teamRT += parseFloat(member.hours_regular) || 0;
            teamOT += parseFloat(member.hours_overtime) || 0;
            teamMiles += parseFloat(member.miles) || 0;
          });
        }
      }

      const legacyTotalRT = primaryRT + teamRT;
      const legacyTotalOT = primaryOT + teamOT;
      const legacyTotalMiles = primaryMiles + teamMiles;

      // 2. Load daily hours totals from daily_hours_log table (NOTE: singular, not plural!)
      const { data: dailyData, error: dailyError } = await supabase
        .from('daily_hours_log')
        .select('hours_regular, hours_overtime, miles')
        .eq('wo_id', wo.wo_id);

      let dailyTotalRT = 0;
      let dailyTotalOT = 0;
      let dailyTotalMiles = 0;

      if (!dailyError && dailyData) {
        dailyData.forEach(log => {
          dailyTotalRT += parseFloat(log.hours_regular) || 0;
          dailyTotalOT += parseFloat(log.hours_overtime) || 0;
          dailyTotalMiles += parseFloat(log.miles) || 0;
        });
      }

      // Combined totals = legacy + daily hours (same as CostSummarySection)
      const totalRT = legacyTotalRT + dailyTotalRT;
      const totalOT = legacyTotalOT + dailyTotalOT;
      const totalMiles = legacyTotalMiles + dailyTotalMiles;
      
      // Labor includes admin hours (2 hrs × $64 = $128)
      const adminHours = 2;
      const laborCost = (totalRT * 64) + (totalOT * 96) + (adminHours * 64);
      
      // Materials, Equipment, Trailer, Rental with 25% markup
      const materialBase = parseFloat(wo.material_cost) || 0;
      const materialWithMarkup = materialBase * 1.25;
      
      const equipmentBase = parseFloat(wo.emf_equipment_cost) || 0;
      const equipmentWithMarkup = equipmentBase * 1.25;
      
      const trailerBase = parseFloat(wo.trailer_cost) || 0;
      const trailerWithMarkup = trailerBase * 1.25;
      
      const rentalBase = parseFloat(wo.rental_cost) || 0;
      const rentalWithMarkup = rentalBase * 1.25;
      
      // Mileage
      const mileageCost = totalMiles * 1.00;
      
      // Grand total (same calculation as CostSummarySection)
      const grandTotal = laborCost + materialWithMarkup + equipmentWithMarkup + trailerWithMarkup + rentalWithMarkup + mileageCost;
      
      setExistingCostsTotal(grandTotal);
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
