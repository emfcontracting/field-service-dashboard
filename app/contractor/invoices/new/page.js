'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import Link from 'next/link';

const supabase = getSupabase();

export default function CreateInvoice() {
  const router = useRouter();
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState(null);

  const [clientType, setClientType] = useState('emf');
  const [otherClient, setOtherClient] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    email: ''
  });

  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [hoursData, setHoursData] = useState([]);
  const [loadingHours, setLoadingHours] = useState(false);
  const [lineItems, setLineItems] = useState([]);
  const [rates, setRates] = useState({ hourly: 35, ot: 52.50, mileage: 0.67 });

  useEffect(() => {
    const userData = sessionStorage.getItem('contractor_user');
    if (!userData) { router.push('/contractor'); return; }
    
    try {
      const parsed = JSON.parse(userData);
      setUser(parsed);
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 14);
      setPeriodEnd(end.toISOString().split('T')[0]);
      setPeriodStart(start.toISOString().split('T')[0]);
      if (parsed.profile) {
        setRates({
          hourly: parseFloat(parsed.profile.hourly_rate || 35),
          ot: parseFloat(parsed.profile.ot_rate || 52.50),
          mileage: parseFloat(parsed.profile.mileage_rate || 0.67)
        });
      }
      setLoading(false);
    } catch (e) {
      router.push('/contractor');
    }
  }, [router]);

  async function pullHours() {
    if (!periodStart || !periodEnd) { setMessage({ type: 'error', text: 'Please select date range' }); return; }
    setLoadingHours(true);
    setMessage(null);
    try {
      const { data, error } = await supabase
        .from('daily_hours_log')
        .select('*, work_order:work_orders(wo_number, building, work_order_description)')
        .eq('user_id', user.user_id)
        .gte('work_date', periodStart)
        .lte('work_date', periodEnd)
        .order('work_date', { ascending: true });
      if (error) throw error;
      setHoursData(data || []);
      if (!data || data.length === 0) {
        setMessage({ type: 'warning', text: 'No hours found for this period' });
      } else {
        setMessage({ type: 'success', text: `Found ${data.length} entries` });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to pull hours data' });
    } finally {
      setLoadingHours(false);
    }
  }

  function addLineItem() {
    setLineItems([...lineItems, { id: Date.now(), description: '', quantity: 1, rate: 0, amount: 0 }]);
  }

  function updateLineItem(id, field, value) {
    setLineItems(lineItems.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === 'quantity' || field === 'rate') {
        updated.amount = (parseFloat(updated.quantity) || 0) * (parseFloat(updated.rate) || 0);
      }
      return updated;
    }));
  }

  function removeLineItem(id) {
    setLineItems(lineItems.filter(item => item.id !== id));
  }

  const totalRegularHours = hoursData.reduce((sum, h) => sum + parseFloat(h.hours_regular || 0), 0);
  const totalOTHours = hoursData.reduce((sum, h) => sum + parseFloat(h.hours_overtime || 0), 0);
  const totalMiles = hoursData.reduce((sum, h) => sum + parseFloat(h.miles || 0), 0);
  const hoursAmount = (totalRegularHours * rates.hourly) + (totalOTHours * rates.ot);
  const mileageAmount = totalMiles * rates.mileage;
  const lineItemsAmount = lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const grandTotal = clientType === 'emf' ? (hoursAmount + mileageAmount + lineItemsAmount) : lineItemsAmount;

  function generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const day = String(new Date().getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const initials = (user?.first_name?.[0] || '') + (user?.last_name?.[0] || '');
    return 'INV-' + year + month + day + '-' + initials.toUpperCase() + random;
  }

  async function saveEMFInvoice() {
    if (hoursData.length === 0 && lineItems.length === 0) {
      setMessage({ type: 'error', text: 'No data to invoice' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const year = new Date().getFullYear();
      const initials = (user.first_name?.[0] || '') + (user.last_name?.[0] || '');
      const { count } = await supabase.from('subcontractor_invoices').select('*', { count: 'exact', head: true }).eq('user_id', user.user_id);
      const invoiceNumber = 'SUB-' + year + '-' + initials.toUpperCase() + '-' + String((count || 0) + 1).padStart(3, '0');

      const { data: invoice, error: invoiceError } = await supabase.from('subcontractor_invoices').insert({
        user_id: user.user_id,
        invoice_number: invoiceNumber,
        period_start: periodStart,
        period_end: periodEnd,
        total_regular_hours: totalRegularHours,
        total_ot_hours: totalOTHours,
        total_hours_amount: hoursAmount,
        total_miles: totalMiles,
        total_mileage_amount: mileageAmount,
        total_line_items_amount: lineItemsAmount,
        grand_total: grandTotal,
        hourly_rate_used: rates.hourly,
        ot_rate_used: rates.ot,
        mileage_rate_used: rates.mileage,
        status: 'draft',
        sent_to_email: 'emfcontractingsc2@gmail.com'
      }).select().single();

      if (invoiceError) throw invoiceError;

      const itemsToInsert = [];
      for (const entry of hoursData) {
        if (parseFloat(entry.hours_regular || 0) > 0) {
          itemsToInsert.push({ invoice_id: invoice.invoice_id, wo_id: entry.wo_id, item_type: 'hours', description: 'Regular Hours - ' + (entry.work_order?.wo_number || 'N/A') + ' - ' + (entry.work_order?.building || ''), quantity: parseFloat(entry.hours_regular), rate: rates.hourly, amount: parseFloat(entry.hours_regular) * rates.hourly, work_date: entry.work_date });
        }
        if (parseFloat(entry.hours_overtime || 0) > 0) {
          itemsToInsert.push({ invoice_id: invoice.invoice_id, wo_id: entry.wo_id, item_type: 'hours', description: 'OT Hours - ' + (entry.work_order?.wo_number || 'N/A') + ' - ' + (entry.work_order?.building || ''), quantity: parseFloat(entry.hours_overtime), rate: rates.ot, amount: parseFloat(entry.hours_overtime) * rates.ot, work_date: entry.work_date });
        }
        if (parseFloat(entry.miles || 0) > 0) {
          itemsToInsert.push({ invoice_id: invoice.invoice_id, wo_id: entry.wo_id, item_type: 'mileage', description: 'Mileage - ' + (entry.work_order?.wo_number || 'N/A'), quantity: parseFloat(entry.miles), rate: rates.mileage, amount: parseFloat(entry.miles) * rates.mileage, work_date: entry.work_date });
        }
      }
      for (const item of lineItems) {
        if (item.description && item.amount > 0) {
          itemsToInsert.push({ invoice_id: invoice.invoice_id, item_type: 'custom', description: item.description, quantity: parseFloat(item.quantity) || 1, rate: parseFloat(item.rate) || 0, amount: parseFloat(item.amount) || 0 });
        }
      }
      if (itemsToInsert.length > 0) {
        await supabase.from('subcontractor_invoice_items').insert(itemsToInsert);
      }
      setMessage({ type: 'success', text: 'Invoice ' + invoiceNumber + ' created!' });
      setTimeout(() => router.push('/contractor/invoices'), 1500);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to create invoice' });
    } finally {
      setSaving(false);
    }
  }

  async function generateOtherClientPDF() {
    if (!otherClient.name) { setMessage({ type: 'error', text: 'Please enter client name' }); return; }
    if (lineItems.length === 0) { setMessage({ type: 'error', text: 'Please add at least one line item' }); return; }

    setGenerating(true);
    setMessage(null);

    try {
      const invNum = generateInvoiceNumber();
      const bName = user.profile?.business_name || (user.first_name + ' ' + user.last_name);
      
      // Call API to generate PDF
      const response = await fetch('/api/contractor/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceNumber: invNum,
          fromName: bName,
          fromAddress: user.profile?.business_address || '',
          fromEmail: user.email,
          toName: otherClient.name,
          toAddress: otherClient.address || '',
          toCity: otherClient.city || '',
          toState: otherClient.state || '',
          toZip: otherClient.zip || '',
          toEmail: otherClient.email || '',
          lineItems: lineItems.map(item => ({
            description: item.description,
            quantity: parseFloat(item.quantity || 0),
            rate: parseFloat(item.rate || 0),
            amount: parseFloat(item.amount || 0)
          })),
          total: lineItemsAmount
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      // Download the PDF
      const blob = await response.blob();
      
      // Check if mobile device
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
        || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
      
      if (isMobile) {
        // Mobile: Convert blob to base64 and open viewer page
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result;
          const newTab = window.open();
          if (newTab) {
            newTab.document.write(`
              <!DOCTYPE html>
              <html>
              <head>
                <title>${invNum}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                  body { margin: 0; padding: 0; background: #333; display: flex; flex-direction: column; min-height: 100vh; }
                  .toolbar { background: #1f2937; padding: 12px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
                  .toolbar a, .toolbar button { background: #3b82f6; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; border: none; font-size: 16px; cursor: pointer; }
                  .toolbar a:hover, .toolbar button:hover { background: #2563eb; }
                  iframe { flex: 1; width: 100%; border: none; }
                </style>
              </head>
              <body>
                <div class="toolbar">
                  <a href="${base64data}" download="${invNum}.pdf">📥 Download PDF</a>
                  <button onclick="window.print()">🖨️ Print</button>
                </div>
                <iframe src="${base64data}"></iframe>
              </body>
              </html>
            `);
            newTab.document.close();
          } else {
            // Fallback
            const link = document.createElement('a');
            link.href = base64data;
            link.download = invNum + '.pdf';
            link.click();
          }
        };
        reader.readAsDataURL(blob);
        setMessage({ type: 'success', text: 'PDF opened! Tap Download to save.' });
      } else {
        // Desktop: Use normal download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = invNum + '.pdf';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setMessage({ type: 'success', text: 'PDF downloaded!' });
      }
    } catch (error) {
      console.error('PDF error:', error);
      setMessage({ type: 'error', text: 'Failed to generate PDF' });
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><div className="text-white">Loading...</div></div>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white">

      <header className="bg-gray-800 border-b border-gray-700 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/contractor/invoices" className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">← Cancel</Link>
            <h1 className="text-xl font-bold">📝 Create Invoice</h1>
          </div>
        </div>
      </header>

      {message && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-50 ${message.type === 'success' ? 'bg-green-600' : message.type === 'warning' ? 'bg-yellow-600' : 'bg-red-600'}`}>
          {message.text}
        </div>
      )}

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h2 className="font-bold mb-4">👤 Select Client</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <button onClick={() => { setClientType('emf'); setHoursData([]); }} className={`p-4 rounded-lg border-2 text-left ${clientType === 'emf' ? 'border-blue-500 bg-blue-500/20' : 'border-gray-600 hover:border-gray-500'}`}>
              <div className="font-bold">EMF Contracting LLC</div>
              <div className="text-sm text-gray-400">Pull hours from work orders</div>
            </button>
            <button onClick={() => { setClientType('other'); setHoursData([]); }} className={`p-4 rounded-lg border-2 text-left ${clientType === 'other' ? 'border-blue-500 bg-blue-500/20' : 'border-gray-600 hover:border-gray-500'}`}>
              <div className="font-bold">Other Client</div>
              <div className="text-sm text-gray-400">Create custom invoice</div>
            </button>
          </div>

          {clientType === 'other' && (
            <div className="space-y-3 pt-4 border-t border-gray-700">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Client/Company Name *</label>
                <input type="text" value={otherClient.name} onChange={(e) => setOtherClient({ ...otherClient, name: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2" placeholder="ABC Company" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Street Address</label>
                <input type="text" value={otherClient.address} onChange={(e) => setOtherClient({ ...otherClient, address: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2" placeholder="123 Main St" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">City</label>
                  <input type="text" value={otherClient.city} onChange={(e) => setOtherClient({ ...otherClient, city: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">State</label>
                  <input type="text" value={otherClient.state} onChange={(e) => setOtherClient({ ...otherClient, state: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2" placeholder="SC" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">ZIP</label>
                  <input type="text" value={otherClient.zip} onChange={(e) => setOtherClient({ ...otherClient, zip: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input type="email" value={otherClient.email} onChange={(e) => setOtherClient({ ...otherClient, email: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2" placeholder="client@example.com" />
              </div>
            </div>
          )}
        </div>

        {clientType === 'emf' && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <h2 className="font-bold mb-4">📅 Select Date Range</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Start Date</label>
                <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">End Date</label>
                <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2" />
              </div>
            </div>
            <button onClick={pullHours} disabled={loadingHours} className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-medium disabled:opacity-50">
              {loadingHours ? '⏳ Pulling Data...' : '📥 Pull My Hours & Mileage'}
            </button>
          </div>
        )}

        {clientType === 'emf' && hoursData.length > 0 && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <h2 className="font-bold mb-4">📋 Review Hours & Mileage</h2>
            <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-gray-700/50 rounded-lg">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Hourly Rate</label>
                <div className="relative">
                  <span className="absolute left-2 top-2 text-gray-400 text-sm">$</span>
                  <input type="number" step="0.01" value={rates.hourly} onChange={(e) => setRates({ ...rates, hourly: parseFloat(e.target.value) || 0 })} className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-6 pr-2 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">OT Rate</label>
                <div className="relative">
                  <span className="absolute left-2 top-2 text-gray-400 text-sm">$</span>
                  <input type="number" step="0.01" value={rates.ot} onChange={(e) => setRates({ ...rates, ot: parseFloat(e.target.value) || 0 })} className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-6 pr-2 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Mileage Rate</label>
                <div className="relative">
                  <span className="absolute left-2 top-2 text-gray-400 text-sm">$</span>
                  <input type="number" step="0.01" value={rates.mileage} onChange={(e) => setRates({ ...rates, mileage: parseFloat(e.target.value) || 0 })} className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-6 pr-2 py-1.5 text-sm" />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-left border-b border-gray-700">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Work Order</th>
                    <th className="pb-2 text-right">Reg Hrs</th>
                    <th className="pb-2 text-right">OT Hrs</th>
                    <th className="pb-2 text-right">Miles</th>
                    <th className="pb-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {hoursData.map((entry, idx) => {
                    const regAmount = parseFloat(entry.hours_regular || 0) * rates.hourly;
                    const otAmount = parseFloat(entry.hours_overtime || 0) * rates.ot;
                    const mileAmount = parseFloat(entry.miles || 0) * rates.mileage;
                    const rowTotal = regAmount + otAmount + mileAmount;
                    return (
                      <tr key={idx} className="border-b border-gray-700/50">
                        <td className="py-2">{new Date(entry.work_date).toLocaleDateString()}</td>
                        <td className="py-2">
                          <div className="font-medium">{entry.work_order?.wo_number || 'N/A'}</div>
                          <div className="text-xs text-gray-500 truncate max-w-[200px]">{entry.work_order?.building}</div>
                        </td>
                        <td className="py-2 text-right">{parseFloat(entry.hours_regular || 0).toFixed(1)}</td>
                        <td className="py-2 text-right">{parseFloat(entry.hours_overtime || 0).toFixed(1)}</td>
                        <td className="py-2 text-right">{parseFloat(entry.miles || 0).toFixed(0)}</td>
                        <td className="py-2 text-right font-medium">${rowTotal.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-gray-600">
                  <tr className="font-bold">
                    <td className="pt-3">TOTALS</td>
                    <td className="pt-3"></td>
                    <td className="pt-3 text-right">{totalRegularHours.toFixed(1)}</td>
                    <td className="pt-3 text-right">{totalOTHours.toFixed(1)}</td>
                    <td className="pt-3 text-right">{totalMiles.toFixed(0)}</td>
                    <td className="pt-3 text-right text-green-400">${(hoursAmount + mileageAmount).toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold">{clientType === 'emf' ? '➕ Additional Line Items (Optional)' : '📋 Invoice Line Items *'}</h2>
            <button onClick={addLineItem} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm">+ Add Item</button>
          </div>
          {lineItems.length === 0 ? (
            <p className="text-gray-500 text-sm">{clientType === 'emf' ? 'No additional items. Click "Add Item" to add materials, supplies, etc.' : 'Click "Add Item" to add services, materials, etc.'}</p>
          ) : (
            <div className="space-y-3">
              {lineItems.map(item => (
                <div key={item.id} className="flex gap-2 items-start">
                  <input type="text" value={item.description} onChange={(e) => updateLineItem(item.id, 'description', e.target.value)} className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm" placeholder="Description" />
                  <input type="number" value={item.quantity} onChange={(e) => updateLineItem(item.id, 'quantity', e.target.value)} className="w-16 bg-gray-700 border border-gray-600 rounded-lg px-2 py-2 text-sm text-center" placeholder="Qty" />
                  <div className="relative">
                    <span className="absolute left-2 top-2 text-gray-400 text-sm">$</span>
                    <input type="number" step="0.01" value={item.rate} onChange={(e) => updateLineItem(item.id, 'rate', e.target.value)} className="w-24 bg-gray-700 border border-gray-600 rounded-lg pl-6 pr-2 py-2 text-sm" placeholder="Rate" />
                  </div>
                  <div className="w-24 py-2 text-right font-medium">${(parseFloat(item.amount) || 0).toFixed(2)}</div>
                  <button onClick={() => removeLineItem(item.id)} className="p-2 text-red-400 hover:text-red-300">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h2 className="font-bold mb-4">📊 Invoice Summary</h2>
          <div className="space-y-2">
            {clientType === 'emf' && (
              <>
                <div className="flex justify-between"><span className="text-gray-400">Regular Hours ({totalRegularHours.toFixed(1)}h × ${rates.hourly})</span><span>${(totalRegularHours * rates.hourly).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">OT Hours ({totalOTHours.toFixed(1)}h × ${rates.ot})</span><span>${(totalOTHours * rates.ot).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Mileage ({totalMiles.toFixed(0)} mi × ${rates.mileage})</span><span>${mileageAmount.toFixed(2)}</span></div>
              </>
            )}
            {lineItemsAmount > 0 && (
              <div className="flex justify-between"><span className="text-gray-400">{clientType === 'emf' ? 'Additional Items' : 'Line Items'}</span><span>${lineItemsAmount.toFixed(2)}</span></div>
            )}
            <div className="border-t border-gray-600 pt-2 mt-2">
              <div className="flex justify-between text-xl font-bold"><span>TOTAL</span><span className="text-green-400">${grandTotal.toFixed(2)}</span></div>
            </div>
          </div>
        </div>

        {clientType === 'emf' ? (
          <button onClick={saveEMFInvoice} disabled={saving || (hoursData.length === 0 && lineItems.length === 0)} className="w-full bg-green-600 hover:bg-green-700 py-4 rounded-lg font-medium disabled:opacity-50">
            {saving ? '⏳ Creating...' : '✓ Create Invoice'}
          </button>
        ) : (
          <button onClick={generateOtherClientPDF} disabled={generating || !otherClient.name || lineItems.length === 0} className="w-full bg-blue-600 hover:bg-blue-700 py-4 rounded-lg font-medium disabled:opacity-50">
            {generating ? '⏳ Generating...' : '📄 Download Invoice PDF'}
          </button>
        )}
      </div>
    </div>
  );
}
