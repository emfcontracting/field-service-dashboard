'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import Link from 'next/link';

const supabase = getSupabase();

export default function TaxReport() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [invoices, setInvoices] = useState([]);
  const [lineItems, setLineItems] = useState([]);
  const [summary, setSummary] = useState(null);

  const availableYears = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= 2024; y--) {
    availableYears.push(y);
  }

  useEffect(() => {
    const userData = sessionStorage.getItem('contractor_user');
    if (!userData) {
      router.push('/contractor');
      return;
    }
    
    try {
      const parsed = JSON.parse(userData);
      setUser(parsed);
    } catch (e) {
      console.error('Error parsing user data:', e);
      router.push('/contractor');
    }
  }, [router]);

  useEffect(() => {
    if (user) {
      loadYearData(user.user_id, year);
    }
  }, [user, year]);

  async function loadYearData(userId, selectedYear) {
    setLoading(true);
    try {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;

      // Get all paid invoices for the year
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('subcontractor_invoices')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'paid')
        .gte('period_start', startDate)
        .lte('period_end', endDate)
        .order('period_start', { ascending: true });

      if (invoicesError) throw invoicesError;
      setInvoices(invoicesData || []);

      // Get all line items for these invoices
      if (invoicesData && invoicesData.length > 0) {
        const invoiceIds = invoicesData.map(inv => inv.invoice_id);
        const { data: itemsData, error: itemsError } = await supabase
          .from('subcontractor_invoice_items')
          .select('*')
          .in('invoice_id', invoiceIds)
          .order('work_date', { ascending: true });

        if (itemsError) throw itemsError;
        setLineItems(itemsData || []);

        // Calculate summary
        calculateSummary(invoicesData, itemsData || []);
      } else {
        setLineItems([]);
        setSummary(null);
      }

    } catch (error) {
      console.error('Error loading year data:', error);
    } finally {
      setLoading(false);
    }
  }

  function calculateSummary(invoices, items) {
    // Categorize line items
    const hoursItems = items.filter(i => i.item_type === 'hours');
    const mileageItems = items.filter(i => i.item_type === 'mileage');
    const materialItems = items.filter(i => i.item_type === 'material');
    const customItems = items.filter(i => i.item_type === 'custom');

    // Categorize custom items by description keywords
    const hotelItems = customItems.filter(i => 
      i.description?.toLowerCase().includes('hotel') || 
      i.description?.toLowerCase().includes('lodging') ||
      i.description?.toLowerCase().includes('room')
    );
    const foodItems = customItems.filter(i => 
      i.description?.toLowerCase().includes('food') || 
      i.description?.toLowerCase().includes('meal') ||
      i.description?.toLowerCase().includes('per diem') ||
      i.description?.toLowerCase().includes('breakfast') ||
      i.description?.toLowerCase().includes('lunch') ||
      i.description?.toLowerCase().includes('dinner')
    );
    const otherItems = customItems.filter(i => 
      !hotelItems.includes(i) && !foodItems.includes(i)
    );

    // Calculate totals
    const totalRegularHours = hoursItems
      .filter(i => i.description?.toLowerCase().includes('regular') || !i.description?.toLowerCase().includes('overtime'))
      .reduce((sum, i) => sum + parseFloat(i.quantity || 0), 0);
    
    const totalOTHours = hoursItems
      .filter(i => i.description?.toLowerCase().includes('overtime') || i.description?.toLowerCase().includes('ot'))
      .reduce((sum, i) => sum + parseFloat(i.quantity || 0), 0);

    const totalLaborAmount = hoursItems.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
    const totalMiles = mileageItems.reduce((sum, i) => sum + parseFloat(i.quantity || 0), 0);
    const totalMileageAmount = mileageItems.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
    const totalMaterialAmount = materialItems.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
    const totalHotelAmount = hotelItems.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
    const totalFoodAmount = foodItems.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
    const totalOtherAmount = otherItems.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
    const grandTotal = invoices.reduce((sum, inv) => sum + parseFloat(inv.grand_total || 0), 0);

    setSummary({
      invoiceCount: invoices.length,
      totalRegularHours,
      totalOTHours,
      totalLaborAmount,
      totalMiles,
      totalMileageAmount,
      totalMaterialAmount,
      totalHotelAmount,
      totalFoodAmount,
      totalOtherAmount,
      grandTotal,
      // Detailed items for export
      hoursItems,
      mileageItems,
      materialItems,
      hotelItems,
      foodItems,
      otherItems
    });
  }

  function downloadCSV() {
    if (!summary || lineItems.length === 0) return;

    // Create CSV content
    let csv = 'Tax Report ' + year + '\n';
    csv += 'Generated: ' + new Date().toLocaleDateString() + '\n\n';
    
    csv += 'SUMMARY\n';
    csv += 'Category,Quantity,Amount\n';
    csv += `Labor (Regular Hours),${summary.totalRegularHours.toFixed(1)} hrs,$${summary.totalLaborAmount.toFixed(2)}\n`;
    csv += `Labor (OT Hours),${summary.totalOTHours.toFixed(1)} hrs,(included above)\n`;
    csv += `Mileage,${summary.totalMiles.toFixed(0)} miles,$${summary.totalMileageAmount.toFixed(2)}\n`;
    csv += `Material Reimbursement,,$${summary.totalMaterialAmount.toFixed(2)}\n`;
    csv += `Hotel/Lodging,,$${summary.totalHotelAmount.toFixed(2)}\n`;
    csv += `Food/Meals,,$${summary.totalFoodAmount.toFixed(2)}\n`;
    csv += `Other Items,,$${summary.totalOtherAmount.toFixed(2)}\n`;
    csv += `GRAND TOTAL,,$${summary.grandTotal.toFixed(2)}\n\n`;

    csv += 'DETAILED LINE ITEMS\n';
    csv += 'Date,Invoice,Category,Description,Quantity,Rate,Amount\n';
    
    lineItems.forEach(item => {
      const invoice = invoices.find(inv => inv.invoice_id === item.invoice_id);
      csv += `${item.work_date || ''},${invoice?.invoice_number || ''},${item.item_type || ''},"${(item.description || '').replace(/"/g, '""')}",${item.quantity || ''},${item.rate || ''},$${parseFloat(item.amount || 0).toFixed(2)}\n`;
    });

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tax_Report_${year}_${user?.first_name || 'Contractor'}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  function printReport() {
    window.print();
  }

  if (!user) {
    return null;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#111827', color: 'white' }}>
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; }
          header, .no-print { display: none !important; }
          .print-content { 
            background: white !important; 
            color: black !important;
            box-shadow: none !important;
          }
          .print-content * { color: black !important; }
        }
      `}</style>

      {/* Header */}
      <header className="no-print" style={{ backgroundColor: '#1f2937', borderBottom: '1px solid #374151', padding: '16px' }}>
        <div style={{ maxWidth: '1024px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Link href="/contractor/dashboard" style={{ padding: '8px 12px', backgroundColor: '#374151', borderRadius: '8px', fontSize: '14px', color: 'white', textDecoration: 'none' }}>
              ← Back
            </Link>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>📊 Year-End Tax Report</h1>
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0 0 0' }}>Income breakdown for tax preparation</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              style={{ 
                padding: '10px 16px', 
                backgroundColor: '#374151', 
                border: '1px solid #4b5563',
                borderRadius: '8px', 
                color: 'white',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              onClick={downloadCSV}
              disabled={!summary || invoices.length === 0}
              style={{ 
                padding: '10px 16px', 
                backgroundColor: summary && invoices.length > 0 ? '#059669' : '#4b5563', 
                borderRadius: '8px', 
                fontSize: '14px', 
                fontWeight: 'bold',
                color: 'white', 
                border: 'none', 
                cursor: summary && invoices.length > 0 ? 'pointer' : 'not-allowed'
              }}
            >
              📥 Download CSV
            </button>
            <button
              onClick={printReport}
              style={{ 
                padding: '10px 16px', 
                backgroundColor: '#6b7280', 
                borderRadius: '8px', 
                fontSize: '14px', 
                fontWeight: 'bold',
                color: 'white', 
                border: 'none', 
                cursor: 'pointer'
              }}
            >
              🖨️ Print
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: '1024px', margin: '0 auto', padding: '16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
            Loading {year} data...
          </div>
        ) : invoices.length === 0 ? (
          <div style={{ backgroundColor: '#1f2937', borderRadius: '12px', padding: '48px', textAlign: 'center' }}>
            <p style={{ fontSize: '48px', marginBottom: '16px' }}>📭</p>
            <p style={{ color: '#9ca3af', marginBottom: '8px' }}>No paid invoices found for {year}</p>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>Only invoices marked as &quot;Paid&quot; are included in this report</p>
          </div>
        ) : (
          <div className="print-content" style={{ backgroundColor: '#ffffff', color: '#111827', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            {/* Report Header */}
            <div style={{ backgroundColor: '#1f2937', color: 'white', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>TAX REPORT {year}</h2>
                  <p style={{ color: '#9ca3af', marginTop: '4px' }}>{user.profile?.business_name || `${user.first_name} ${user.last_name}`}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>Generated</p>
                  <p style={{ fontWeight: '500', margin: '4px 0 0 0' }}>{new Date().toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            <div style={{ padding: '24px' }}>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                <div style={{ backgroundColor: '#f3f4f6', borderRadius: '8px', padding: '16px' }}>
                  <p style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>Total Income</p>
                  <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#059669', margin: 0 }}>${summary?.grandTotal.toFixed(2)}</p>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{summary?.invoiceCount} invoices</p>
                </div>
                <div style={{ backgroundColor: '#f3f4f6', borderRadius: '8px', padding: '16px' }}>
                  <p style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>Labor Income</p>
                  <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#2563eb', margin: 0 }}>${summary?.totalLaborAmount.toFixed(2)}</p>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{summary?.totalRegularHours.toFixed(1)}h reg + {summary?.totalOTHours.toFixed(1)}h OT</p>
                </div>
                <div style={{ backgroundColor: '#f3f4f6', borderRadius: '8px', padding: '16px' }}>
                  <p style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>Mileage Reimbursement</p>
                  <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#7c3aed', margin: 0 }}>${summary?.totalMileageAmount.toFixed(2)}</p>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{summary?.totalMiles.toFixed(0)} miles</p>
                </div>
              </div>

              {/* Detailed Breakdown */}
              <h3 style={{ fontWeight: 'bold', color: '#374151', borderBottom: '2px solid #e5e7eb', paddingBottom: '8px', marginBottom: '16px' }}>Income Breakdown by Category</h3>
              
              <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse', marginBottom: '32px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb' }}>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Category</th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Quantity</th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Amount</th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px' }}>💼 <strong>Labor (Regular Hours)</strong></td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>{summary?.totalRegularHours.toFixed(1)} hrs</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: '500' }}>${summary?.totalLaborAmount.toFixed(2)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#6b7280' }}>{((summary?.totalLaborAmount / summary?.grandTotal) * 100).toFixed(1)}%</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: '#f9fafb' }}>
                    <td style={{ padding: '12px', paddingLeft: '32px', color: '#6b7280' }}>↳ Overtime Hours</td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#6b7280' }}>{summary?.totalOTHours.toFixed(1)} hrs</td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#6b7280' }}>(included above)</td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#6b7280' }}>-</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px' }}>🚗 <strong>Mileage Reimbursement</strong></td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>{summary?.totalMiles.toFixed(0)} miles</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: '500' }}>${summary?.totalMileageAmount.toFixed(2)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#6b7280' }}>{((summary?.totalMileageAmount / summary?.grandTotal) * 100).toFixed(1)}%</td>
                  </tr>
                  {summary?.totalMaterialAmount > 0 && (
                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px' }}>🔧 <strong>Material Reimbursement</strong></td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>-</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: '500', color: '#ea580c' }}>${summary?.totalMaterialAmount.toFixed(2)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#6b7280' }}>{((summary?.totalMaterialAmount / summary?.grandTotal) * 100).toFixed(1)}%</td>
                    </tr>
                  )}
                  {summary?.totalHotelAmount > 0 && (
                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px' }}>🏨 <strong>Hotel / Lodging</strong></td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>-</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: '500' }}>${summary?.totalHotelAmount.toFixed(2)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#6b7280' }}>{((summary?.totalHotelAmount / summary?.grandTotal) * 100).toFixed(1)}%</td>
                    </tr>
                  )}
                  {summary?.totalFoodAmount > 0 && (
                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px' }}>🍽️ <strong>Food / Meals / Per Diem</strong></td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>-</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: '500' }}>${summary?.totalFoodAmount.toFixed(2)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#6b7280' }}>{((summary?.totalFoodAmount / summary?.grandTotal) * 100).toFixed(1)}%</td>
                    </tr>
                  )}
                  {summary?.totalOtherAmount > 0 && (
                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px' }}>📦 <strong>Other Items</strong></td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>-</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: '500' }}>${summary?.totalOtherAmount.toFixed(2)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#6b7280' }}>{((summary?.totalOtherAmount / summary?.grandTotal) * 100).toFixed(1)}%</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#f9fafb' }}>
                    <td style={{ padding: '16px', fontWeight: 'bold', fontSize: '16px' }}>TOTAL INCOME</td>
                    <td style={{ padding: '16px' }}></td>
                    <td style={{ padding: '16px', textAlign: 'right', fontWeight: 'bold', fontSize: '18px', color: '#059669' }}>${summary?.grandTotal.toFixed(2)}</td>
                    <td style={{ padding: '16px', textAlign: 'right', fontWeight: 'bold' }}>100%</td>
                  </tr>
                </tfoot>
              </table>

              {/* Invoice List */}
              <h3 style={{ fontWeight: 'bold', color: '#374151', borderBottom: '2px solid #e5e7eb', paddingBottom: '8px', marginBottom: '16px' }}>Invoices Included ({invoices.length})</h3>
              
              <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb' }}>
                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Invoice #</th>
                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Period</th>
                    <th style={{ padding: '10px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Hours</th>
                    <th style={{ padding: '10px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Miles</th>
                    <th style={{ padding: '10px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Total</th>
                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Paid Date</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv, idx) => (
                    <tr key={inv.invoice_id} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '10px', fontWeight: '500' }}>{inv.invoice_number}</td>
                      <td style={{ padding: '10px', color: '#6b7280' }}>
                        {new Date(inv.period_start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(inv.period_end + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        {(parseFloat(inv.total_regular_hours || 0) + parseFloat(inv.total_ot_hours || 0)).toFixed(1)}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{parseFloat(inv.total_miles || 0).toFixed(0)}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: '500' }}>${parseFloat(inv.grand_total || 0).toFixed(2)}</td>
                      <td style={{ padding: '10px', color: '#059669' }}>
                        {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Tax Notes */}
              <div style={{ backgroundColor: '#fef3c7', borderRadius: '8px', padding: '16px', marginTop: '24px', border: '1px solid #fcd34d' }}>
                <h4 style={{ fontWeight: 'bold', color: '#92400e', marginBottom: '8px' }}>⚠️ Important Tax Notes</h4>
                <ul style={{ color: '#78350f', fontSize: '13px', margin: 0, paddingLeft: '20px' }}>
                  <li>This report is for informational purposes only and is not tax advice.</li>
                  <li>Mileage reimbursement may or may not be taxable depending on how it was reported - consult your tax professional.</li>
                  <li>Keep all receipts and documentation for material reimbursements.</li>
                  <li>As a subcontractor, you may be responsible for self-employment taxes.</li>
                  <li>Consult a qualified tax professional for advice specific to your situation.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
