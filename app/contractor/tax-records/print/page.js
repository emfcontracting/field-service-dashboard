'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import {
  DEFAULT_TAX_CATEGORIES,
  TAX_CATEGORY_GROUPS,
  mergeCategories,
  groupCategories,
} from '@/lib/taxRecordCategories';

const supabase = getSupabase();

export default function TaxRecordsPrintPage() {
  const searchParams = useSearchParams();
  const year = parseInt(searchParams.get('year') || new Date().getFullYear(), 10);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [emfIncome, setEmfIncome] = useState(null);

  useEffect(() => {
    const userData = sessionStorage.getItem('contractor_user');
    if (!userData) {
      window.location.href = '/contractor';
      return;
    }
    try {
      setUser(JSON.parse(userData));
    } catch {
      window.location.href = '/contractor';
    }
  }, []);

  useEffect(() => {
    if (user) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, year]);

  async function loadData() {
    setLoading(true);
    try {
      const [recordsRes, catsRes] = await Promise.all([
        fetch(`/api/contractor/tax-records?user_id=${user.user_id}&year=${year}`),
        fetch(`/api/contractor/tax-categories?user_id=${user.user_id}`),
      ]);
      const recordsData = await recordsRes.json();
      const catsData    = await catsRes.json();
      setRecords(recordsData.records || []);
      setCustomCategories(catsData.categories || []);

      // Fetch EMF income summary
      await loadEMFIncome();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadEMFIncome() {
    const startDate = `${year}-01-01`;
    const endDate   = `${year}-12-31`;

    const { data: invoices } = await supabase
      .from('subcontractor_invoices')
      .select('*')
      .eq('user_id', user.user_id)
      .eq('status', 'paid')
      .gte('period_start', startDate)
      .lte('period_end', endDate);

    if (!invoices || invoices.length === 0) {
      setEmfIncome({ count: 0, items: [] });
      return;
    }

    const invoiceIds = invoices.map(i => i.invoice_id);
    const { data: items } = await supabase
      .from('subcontractor_invoice_items')
      .select('*')
      .in('invoice_id', invoiceIds);

    const summary = {
      regularHours: 0, regularAmount: 0,
      otHours: 0,     otAmount: 0,
      mileage: 0,     mileageAmount: 0,
      materials: 0, hotels: 0, food: 0, otherCustom: 0,
    };

    for (const item of items || []) {
      const amt = parseFloat(item.amount || 0);
      const qty = parseFloat(item.quantity || 0);
      if (item.item_type === 'hours') {
        const desc = (item.description || '').toLowerCase();
        if (desc.includes('overtime') || desc.includes(' ot')) {
          summary.otHours += qty;
          summary.otAmount += amt;
        } else {
          summary.regularHours += qty;
          summary.regularAmount += amt;
        }
      } else if (item.item_type === 'mileage') {
        summary.mileage += qty;
        summary.mileageAmount += amt;
      } else if (item.item_type === 'material') {
        summary.materials += amt;
      } else if (item.item_type === 'custom') {
        const desc = (item.description || '').toLowerCase();
        if (desc.includes('hotel') || desc.includes('lodging')) summary.hotels += amt;
        else if (desc.includes('food') || desc.includes('meal') || desc.includes('per diem')) summary.food += amt;
        else summary.otherCustom += amt;
      }
    }

    setEmfIncome({ count: invoices.length, summary, invoices });
  }

  const allCategories = useMemo(() => mergeCategories(customCategories), [customCategories]);
  const groupedCategories = useMemo(() => groupCategories(allCategories), [allCategories]);

  const totalsByCategory = useMemo(() => {
    const map = {};
    for (const rec of records) {
      map[rec.category_name] = (map[rec.category_name] || 0) + parseFloat(rec.amount);
    }
    return map;
  }, [records]);

  const totalsByGroup = useMemo(() => {
    const map = {};
    for (const rec of records) {
      const cat = allCategories.find(c => c.name === rec.category_name);
      const group = cat ? cat.group : 'custom';
      map[group] = (map[group] || 0) + parseFloat(rec.amount);
    }
    return map;
  }, [records, allCategories]);

  const personalTotal = records.reduce((s, r) => s + parseFloat(r.amount), 0);
  const incomeTotal = emfIncome?.summary
    ? Object.values(emfIncome.summary).filter((_, i) => i % 2 === 1).reduce((a, b) => a + b, 0)
    : 0;

  if (loading || !user) {
    return <div className="p-8 text-center">Loading tax report...</div>;
  }

  return (
    <div className="bg-white text-black min-h-screen">
      {/* Print button (hidden when printing) */}
      <div className="no-print bg-gray-100 p-4 flex justify-between items-center sticky top-0 z-10 border-b">
        <div>
          <a href={`/contractor/tax-records?year=${year}`} className="text-blue-600 hover:underline">
            ← Back to Tax Records
          </a>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
          >
            🖨️ Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-8 print:p-4">
        {/* Header */}
        <div className="border-b-2 border-gray-800 pb-4 mb-6">
          <h1 className="text-3xl font-bold">Tax Report — {year}</h1>
          <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
            <div>
              <div className="font-semibold">{user.first_name} {user.last_name}</div>
              <div className="text-gray-600">{user.email}</div>
            </div>
            <div className="text-right">
              <div className="text-gray-600">Generated: {new Date().toLocaleDateString()}</div>
              <div className="text-gray-600">Tax Year: {year}</div>
            </div>
          </div>
        </div>

        {/* Overall Summary */}
        <div className="bg-gray-100 rounded-lg p-4 mb-6 print:bg-gray-100">
          <h2 className="text-lg font-bold mb-2">📊 Summary</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-600">EMF Income (Paid)</div>
              <div className="text-xl font-bold text-green-700">${incomeTotal.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-600">Personal Expenses</div>
              <div className="text-xl font-bold text-red-700">${personalTotal.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-600">Net (rough)</div>
              <div className="text-xl font-bold">${(incomeTotal - personalTotal).toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* Section 1: EMF Income */}
        {emfIncome && emfIncome.count > 0 && (
          <section className="mb-8 break-inside-avoid">
            <h2 className="text-xl font-bold mb-3 border-b border-gray-300 pb-1">
              💼 EMF Contracting Income
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-200">
                  <th className="px-2 py-1 text-left">Category</th>
                  <th className="px-2 py-1 text-right">Quantity</th>
                  <th className="px-2 py-1 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-2 py-1">Regular Hours (RT)</td>
                  <td className="px-2 py-1 text-right">{emfIncome.summary.regularHours.toFixed(2)}</td>
                  <td className="px-2 py-1 text-right">${emfIncome.summary.regularAmount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="px-2 py-1">Overtime Hours (OT)</td>
                  <td className="px-2 py-1 text-right">{emfIncome.summary.otHours.toFixed(2)}</td>
                  <td className="px-2 py-1 text-right">${emfIncome.summary.otAmount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="px-2 py-1">Mileage</td>
                  <td className="px-2 py-1 text-right">{emfIncome.summary.mileage.toFixed(0)}</td>
                  <td className="px-2 py-1 text-right">${emfIncome.summary.mileageAmount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="px-2 py-1">Materials</td>
                  <td className="px-2 py-1"></td>
                  <td className="px-2 py-1 text-right">${emfIncome.summary.materials.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="px-2 py-1">Hotels / Lodging</td>
                  <td className="px-2 py-1"></td>
                  <td className="px-2 py-1 text-right">${emfIncome.summary.hotels.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="px-2 py-1">Food / Per Diem</td>
                  <td className="px-2 py-1"></td>
                  <td className="px-2 py-1 text-right">${emfIncome.summary.food.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="px-2 py-1">Other Reimbursements</td>
                  <td className="px-2 py-1"></td>
                  <td className="px-2 py-1 text-right">${emfIncome.summary.otherCustom.toFixed(2)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="bg-green-100 font-bold border-t-2 border-green-700">
                  <td className="px-2 py-1">Total EMF Income</td>
                  <td className="px-2 py-1"></td>
                  <td className="px-2 py-1 text-right">${incomeTotal.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
            <div className="text-xs text-gray-600 mt-2">
              Based on {emfIncome.count} paid invoice{emfIncome.count !== 1 ? 's' : ''}.
            </div>
          </section>
        )}

        {/* Section 2: Personal Expenses by Group */}
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-3 border-b border-gray-300 pb-1">
            💰 Personal & Business Expenses
          </h2>
          {Object.entries(groupedCategories).map(([groupKey, cats]) => {
            const groupInfo = TAX_CATEGORY_GROUPS.find(g => g.key === groupKey);
            if (!groupInfo) return null;
            const groupTotal = totalsByGroup[groupKey] || 0;
            // Skip empty groups in print
            const hasAny = cats.some(c => (totalsByCategory[c.name] || 0) > 0);
            if (!hasAny) return null;

            return (
              <div key={groupKey} className="mb-4 break-inside-avoid">
                <div
                  className="px-2 py-1 font-semibold flex justify-between"
                  style={{ backgroundColor: groupInfo.color + '40' }}
                >
                  <span>{groupInfo.icon} {groupInfo.label}</span>
                  <span>${groupTotal.toFixed(2)}</span>
                </div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-200">
                    {cats.filter(c => (totalsByCategory[c.name] || 0) > 0).map(cat => (
                      <tr key={cat.category_id}>
                        <td className="px-2 py-1 pl-6">{cat.name}</td>
                        <td className="px-2 py-1 text-right">${(totalsByCategory[cat.name] || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          {records.length > 0 && (
            <div className="bg-red-50 border-t-2 border-red-700 px-2 py-1 font-bold flex justify-between mt-2">
              <span>Total Personal Expenses</span>
              <span>${personalTotal.toFixed(2)}</span>
            </div>
          )}
        </section>

        {/* Section 3: Itemized Detail */}
        <section className="mb-8 break-before-page">
          <h2 className="text-xl font-bold mb-3 border-b border-gray-300 pb-1">
            📋 Itemized Detail
          </h2>
          {records.length === 0 ? (
            <div className="text-gray-500 italic">No records for {year}</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-200">
                  <th className="px-2 py-1 text-left">Date</th>
                  <th className="px-2 py-1 text-left">INV #</th>
                  <th className="px-2 py-1 text-left">Category</th>
                  <th className="px-2 py-1 text-right">Amount</th>
                  <th className="px-2 py-1 text-left">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {records.map(rec => (
                  <tr key={rec.record_id}>
                    <td className="px-2 py-1">{rec.entry_date}</td>
                    <td className="px-2 py-1">{rec.invoice_ref || ''}</td>
                    <td className="px-2 py-1">{rec.category_name}</td>
                    <td className="px-2 py-1 text-right">${parseFloat(rec.amount).toFixed(2)}</td>
                    <td className="px-2 py-1">{rec.notes || ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-200 font-bold border-t-2 border-gray-700">
                  <td colSpan="3" className="px-2 py-1 text-right">Total:</td>
                  <td className="px-2 py-1 text-right">${personalTotal.toFixed(2)}</td>
                  <td className="px-2 py-1"></td>
                </tr>
              </tfoot>
            </table>
          )}
        </section>

        {/* Footer */}
        <div className="border-t border-gray-300 pt-2 text-xs text-gray-500 mt-8">
          <div>EMF Contracting LLC — PCS FieldService Tax Report</div>
          <div>This report is for the contractor's tax preparation. Verify all figures with original receipts.</div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 0.5in; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
