// components/CostSummarySection.js - Bilingual Cost Summary with Tech Material Support
import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../utils/translations';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function CostSummarySection({ workOrder, currentTeamList }) {
  const { language } = useLanguage();
  const t = (key) => translations[language][key] || key;
  const supabase = createClientComponentClient();
  
  const [dailyTotals, setDailyTotals] = useState({
    totalRT: 0,
    totalOT: 0,
    totalMiles: 0,
    totalTechMaterial: 0
  });
  const [legacyTotals, setLegacyTotals] = useState({
    totalRT: 0,
    totalOT: 0,
    totalMiles: 0
  });
  const [loading, setLoading] = useState(true);
  
  const wo = workOrder || {};
  const nte = wo.nte || 0;

  // Load all totals
  useEffect(() => {
    if (wo.wo_id) {
      loadAllTotals();
    }
  }, [wo.wo_id, currentTeamList]);

  async function loadAllTotals() {
    try {
      setLoading(true);
      
      // 1. Calculate legacy totals from work_orders and assignments
      const primaryRT = parseFloat(wo.hours_regular) || 0;
      const primaryOT = parseFloat(wo.hours_overtime) || 0;
      const primaryMiles = parseFloat(wo.miles) || 0;

      let teamRT = 0;
      let teamOT = 0;
      let teamMiles = 0;

      if (currentTeamList && Array.isArray(currentTeamList)) {
        currentTeamList.forEach(member => {
          if (member) {
            teamRT += parseFloat(member.hours_regular) || 0;
            teamOT += parseFloat(member.hours_overtime) || 0;
            teamMiles += parseFloat(member.miles) || 0;
          }
        });
      }

      const legacyTotal = {
        totalRT: primaryRT + teamRT,
        totalOT: primaryOT + teamOT,
        totalMiles: primaryMiles + teamMiles
      };
      setLegacyTotals(legacyTotal);

      // 2. Load daily hours totals from daily_hours_log table (including tech_material_cost)
      const { data, error } = await supabase
        .from('daily_hours_log')
        .select('hours_regular, hours_overtime, miles, tech_material_cost')
        .eq('wo_id', wo.wo_id);

      if (error) {
        console.error('Error loading daily totals:', error);
        setDailyTotals({ totalRT: 0, totalOT: 0, totalMiles: 0, totalTechMaterial: 0 });
        return;
      }

      // Calculate totals from daily logs
      const dailyTotal = (data || []).reduce((acc, log) => ({
        totalRT: acc.totalRT + (parseFloat(log.hours_regular) || 0),
        totalOT: acc.totalOT + (parseFloat(log.hours_overtime) || 0),
        totalMiles: acc.totalMiles + (parseFloat(log.miles) || 0),
        totalTechMaterial: acc.totalTechMaterial + (parseFloat(log.tech_material_cost) || 0)
      }), { totalRT: 0, totalOT: 0, totalMiles: 0, totalTechMaterial: 0 });

      setDailyTotals(dailyTotal);

    } catch (err) {
      console.error('Error in loadAllTotals:', err);
    } finally {
      setLoading(false);
    }
  }

  // Combined totals = legacy + daily hours
  const totalRT = legacyTotals.totalRT + dailyTotals.totalRT;
  const totalOT = legacyTotals.totalOT + dailyTotals.totalOT;
  const totalMiles = legacyTotals.totalMiles + dailyTotals.totalMiles;
  
  const adminHours = 2;

  const laborCost = (totalRT * 64) + (totalOT * 96) + (adminHours * 64);
  
  // EMF Material (company paid)
  const emfMaterialBase = parseFloat(wo.material_cost) || 0;
  const emfMaterialWithMarkup = emfMaterialBase * 1.25;
  
  // Tech Material (tech purchased, for reimbursement)
  const techMaterialBase = dailyTotals.totalTechMaterial;
  const techMaterialWithMarkup = techMaterialBase * 1.25;
  
  // Total Material = EMF + Tech
  const totalMaterialBase = emfMaterialBase + techMaterialBase;
  const totalMaterialWithMarkup = emfMaterialWithMarkup + techMaterialWithMarkup;
  
  const equipmentBase = parseFloat(wo.emf_equipment_cost) || 0;
  const equipmentWithMarkup = equipmentBase * 1.25;
  const trailerBase = parseFloat(wo.trailer_cost) || 0;
  const trailerWithMarkup = trailerBase * 1.25;
  const rentalBase = parseFloat(wo.rental_cost) || 0;
  const rentalWithMarkup = rentalBase * 1.25;
  const mileageCost = totalMiles * 1.00;
  const grandTotal = laborCost + totalMaterialWithMarkup + equipmentWithMarkup + trailerWithMarkup + rentalWithMarkup + mileageCost;
  const remaining = nte - grandTotal;

  // Check if there's legacy data to show
  const hasLegacyData = legacyTotals.totalRT > 0 || legacyTotals.totalOT > 0 || legacyTotals.totalMiles > 0;
  const hasDailyData = dailyTotals.totalRT > 0 || dailyTotals.totalOT > 0 || dailyTotals.totalMiles > 0;
  const hasTechMaterial = techMaterialBase > 0;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="font-bold mb-3 text-blue-400">💰 {t('costSummary')}</h3>
      
      {loading ? (
        <div className="text-center text-gray-400 py-4">{t('loading')}...</div>
      ) : (
        <>
          {/* Source breakdown info */}
          {(hasLegacyData && hasDailyData) && (
            <div className="bg-blue-900/30 rounded-lg p-2 mb-3 text-xs text-blue-300">
              <p>📊 {language === 'en' ? 'Includes legacy hours + daily log entries' : 'Incluye horas anteriores + registros diarios'}</p>
            </div>
          )}

          {/* Labor Section */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">{t('teamRTHours')}</span>
              <span>{totalRT.toFixed(2)} {t('hrs')} × $64 = ${(totalRT * 64).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">{t('teamOTHours')}</span>
              <span>{totalOT.toFixed(2)} {t('hrs')} × $96 = ${(totalOT * 96).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-yellow-400">
              <span>{t('adminHours')}</span>
              <span>2 {t('hrs')} × $64 = $128.00</span>
            </div>
            <div className="flex justify-between font-bold border-t border-gray-700 pt-2">
              <span>{t('totalLabor')}</span>
              <span className="text-green-500">${laborCost.toFixed(2)}</span>
            </div>
          </div>

          <div className="border-t border-gray-600 my-4"></div>

          {/* Materials Section - Split EMF and Tech */}
          <div className="mb-3">
            <div className="text-sm font-semibold text-gray-300 mb-2">
              {language === 'en' ? '📦 Materials' : '📦 Materiales'}
            </div>
            
            {/* EMF Material */}
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400 ml-2">
                {language === 'en' ? 'EMF Material (company)' : 'Material EMF (empresa)'}
              </span>
              <span>${emfMaterialBase.toFixed(2)}</span>
            </div>
            {emfMaterialBase > 0 && (
              <div className="flex justify-between text-sm text-yellow-400 mb-2">
                <span className="ml-4">{t('markup')}</span>
                <span>+ ${(emfMaterialBase * 0.25).toFixed(2)}</span>
              </div>
            )}
            
            {/* Tech Material */}
            <div className="flex justify-between text-sm mb-1">
              <span className="text-orange-400 ml-2">
                {language === 'en' ? 'Tech Material (reimbursable)' : 'Material Técnico (reembolsable)'}
              </span>
              <span className="text-orange-400">${techMaterialBase.toFixed(2)}</span>
            </div>
            {techMaterialBase > 0 && (
              <div className="flex justify-between text-sm text-yellow-400 mb-2">
                <span className="ml-4">{t('markup')}</span>
                <span>+ ${(techMaterialBase * 0.25).toFixed(2)}</span>
              </div>
            )}
            
            {/* Total Material */}
            {(emfMaterialBase > 0 || techMaterialBase > 0) && (
              <div className="flex justify-between text-sm font-semibold border-t border-gray-700 pt-1 mt-1">
                <span className="text-gray-300 ml-2">
                  {language === 'en' ? 'Total Material (w/ markup)' : 'Material Total (con margen)'}
                </span>
                <span>${totalMaterialWithMarkup.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Equipment */}
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">{t('equipment')}</span>
            <span>${equipmentBase.toFixed(2)}</span>
          </div>
          {equipmentBase > 0 && (
            <div className="flex justify-between text-sm text-yellow-400 mb-3">
              <span className="ml-4">{t('markup')}</span>
              <span>+ ${(equipmentBase * 0.25).toFixed(2)}</span>
            </div>
          )}

          {/* Trailer */}
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">{t('trailer')}</span>
            <span>${trailerBase.toFixed(2)}</span>
          </div>
          {trailerBase > 0 && (
            <div className="flex justify-between text-sm text-yellow-400 mb-3">
              <span className="ml-4">{t('markup')}</span>
              <span>+ ${(trailerBase * 0.25).toFixed(2)}</span>
            </div>
          )}

          {/* Rental */}
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">{t('rental')}</span>
            <span>${rentalBase.toFixed(2)}</span>
          </div>
          {rentalBase > 0 && (
            <div className="flex justify-between text-sm text-yellow-400 mb-3">
              <span className="ml-4">{t('markup')}</span>
              <span>+ ${(rentalBase * 0.25).toFixed(2)}</span>
            </div>
          )}

          {/* Mileage */}
          <div className="flex justify-between text-sm mb-4">
            <span className="text-gray-400">{t('totalMileage')}</span>
            <span>{totalMiles.toFixed(1)} mi × $1.00 = ${mileageCost.toFixed(2)}</span>
          </div>

          {/* Grand Total */}
          <div className="border-t-2 border-gray-700 pt-3">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">{t('nteBudget')}</span>
              <span>${nte.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">{language === 'en' ? 'Total Cost:' : 'Costo Total:'}</span>
              <span className="font-bold">${grandTotal.toFixed(2)}</span>
            </div>
            <div className={`flex justify-between font-bold text-lg ${remaining >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              <span>{t('remaining')}</span>
              <span>${remaining.toFixed(2)}</span>
            </div>
            {remaining < 0 && (
              <p className="text-red-400 text-xs text-center mt-2">
                ⚠️ {language === 'en' ? 'Over budget!' : '¡Sobre el presupuesto!'}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
