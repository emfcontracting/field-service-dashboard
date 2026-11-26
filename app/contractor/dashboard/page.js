'use client';

import { useState, useEffect } from 'react';
import { docReminders } from '@/lib/contractorDocs';
import StatusPill from '../components/StatusPill';
import { lastBillingWeek } from '@/lib/billingWeek';
import { daysBetweenET } from '@/lib/dates';
import { readContractorSession, clearContractorSession, saveContractorSession } from '@/lib/contractorSession';
import { fmtDate, fmtDateTime, fmtDateShort, parseDate, dateKeyET } from '@/lib/dates';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getTodayEST, getDateRangeEST, formatDateEST } from '../../mobile/utils/dateUtils';
import { setAppToken } from '@/lib/apiClient';
import { contractorApi } from '@/lib/contractorClient';

export default function ContractorDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    currentPeriodHours: 0,
    currentPeriodMiles: 0,
    currentPeriodAmount: 0,
    pendingInvoices: 0,
    paidThisMonth: 0
  });
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [week, setWeek] = useState(null);          // { start, end, entries, uninvoiced, amount, partly }
  const [todos, setTodos] = useState([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    const userData = readContractorSession();
    if (!userData) {
      router.push('/contractor');
      return;
    }
    
    try {
      const parsed = JSON.parse(userData);
      setUser(parsed);
      
      if (parsed.needsPinSetup || parsed.profile?.has_pin === false) {
        router.push('/contractor/welcome');
        return;
      }
      
      // Fresh profile (rates EMF changed, recurring lines) — fall back to the stored one.
      contractorApi.me()
        .then(({ profile }) => {
          const next = { ...parsed, profile: { ...parsed.profile, ...profile } };
          saveContractorSession(next);
          setUser(next);
          loadDashboardData(parsed.user_id, next.profile);
        })
        .catch(() => loadDashboardData(parsed.user_id, parsed.profile));
    } catch (e) {
      console.error('Error parsing user data:', e);
      router.push('/contractor');
    }
  }, [router]);

  async function loadDashboardData(userId, profile) {
    try {
      // The week that is due: last completed Friday–Thursday (lib/billingWeek)
      const w = lastBillingWeek(getTodayEST());
      let hoursData = [];
      let alreadyInvoiced = [];
      try {
        const r = await contractorApi.hoursChecked(w.start, w.end);
        hoursData = r.hours || [];
        alreadyInvoiced = r.already_invoiced || [];
      } catch (hoursError) { console.error('Error fetching hours:', hoursError); }

      const hourlyRate = parseFloat(profile?.hourly_rate || 35);
      const otRate = parseFloat(profile?.ot_rate || 52.50);
      const mileageRate = parseFloat(profile?.mileage_rate || 0.67);
      const billed = new Set(alreadyInvoiced.map(a => a.wo_id + '|' + a.work_date));
      const open = hoursData.filter(h => !billed.has(h.wo_id + '|' + h.work_date));

      let totalRegular = 0, totalOT = 0, totalMiles = 0, openAmount = 0;
      hoursData.forEach(e => {
        totalRegular += parseFloat(e.hours_regular || 0);
        totalOT += parseFloat(e.hours_overtime || 0);
        totalMiles += parseFloat(e.miles || 0);
      });
      open.forEach(e => {
        openAmount += parseFloat(e.hours_regular || 0) * hourlyRate
          + parseFloat(e.hours_overtime || 0) * otRate
          + parseFloat(e.miles || 0) * mileageRate
          + parseFloat(e.tech_material_cost || 0);
      });

      let invoices = [];
      try { ({ invoices } = await contractorApi.invoices()); }
      catch (invoicesError) { console.error('Error fetching invoices:', invoicesError); }

      const waiting = (invoices || []).filter(i => i.status === 'sent').length;

      // Paid this month (Eastern), by the date the sub marked it paid.
      const thisMonth = dateKeyET().slice(0, 7);
      const paidThisMonth = (invoices || [])
        .filter(i => i.status === 'paid' && i.paid_at && dateKeyET(parseDate(i.paid_at)).slice(0, 7) === thisMonth)
        .reduce((sum, i) => sum + parseFloat(i.grand_total || 0), 0);

      const recurringAmount = (profile?.recurring_lines || []).reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.rate) || 0), 0);
      setWeek({ ...w, entries: hoursData.length, uninvoiced: open.length, amount: openAmount + recurringAmount, recurring: (profile?.recurring_lines || []).length, partly: alreadyInvoiced.length > 0 });

      // To-do list, most urgent first
      const list = [];
      for (const inv of invoices || []) {
        if (inv.emf_review_status === 'rejected' && inv.status !== 'paid') {
          list.push({ key: 'rej' + inv.invoice_id, tone: 'red', text: `${inv.invoice_number} was rejected by EMF${inv.emf_review_note ? ': ' + inv.emf_review_note : ''}`, href: `/contractor/invoices/${inv.invoice_id}`, action: 'Fix' });
        }
      }
      for (const inv of invoices || []) {
        if (inv.status === 'draft') {
          list.push({ key: 'draft' + inv.invoice_id, tone: 'yellow', text: `${inv.invoice_number} is a draft — check it and send it`, href: `/contractor/invoices/${inv.invoice_id}`, action: 'Open' });
        }
      }
      for (const inv of invoices || []) {
        const days = inv.sent_at ? daysBetweenET(parseDate(inv.sent_at)) : 0;
        if (inv.status === 'sent' && days >= 30) {
          list.push({ key: 'old' + inv.invoice_id, tone: 'gray', text: `${inv.invoice_number} was sent ${days} days ago — paid yet?`, href: `/contractor/invoices/${inv.invoice_id}`, action: 'Open' });
        }
      }
      // Documents: W-9 / insurance missing, expired or expiring within 30 days
      try {
        const docs = await contractorApi.documents();
        for (const r of docReminders(docs, dateKeyET())) {
          list.push({ key: r.key, tone: r.tone, text: r.text, href: '/contractor/settings', action: 'Upload' });
        }
      } catch { /* documents are optional here */ }
      setTodos(list);

      setStats({
        currentPeriodHours: totalRegular + totalOT,
        currentPeriodMiles: totalMiles,
        currentPeriodAmount: openAmount,
        pendingInvoices: waiting,
        paidThisMonth
      });

      setRecentInvoices((invoices || []).slice(0, 5));
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  // One click: invoice the due week with everything EMF logged for it.
  async function createWeekInvoice() {
    if (!week) return;
    setCreating(true);
    setCreateError('');
    try {
      const invoice = await contractorApi.createInvoice({ period_start: week.start, period_end: week.end, line_items: [], use_recurring: true });
      router.push(`/contractor/invoices/${invoice.invoice_id}`);
    } catch (e) {
      setCreateError(e.message || 'Could not create the invoice');
      setCreating(false);
    }
  }

  function handleLogout() {
    clearContractorSession();
    router.push('/contractor');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">🧾 Contractor Portal</h1>
            <p className="text-sm text-gray-400">{user.first_name} {user.last_name}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/contractor/settings"
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
            >
              ⚙️ Settings
            </Link>
            <button
              onClick={handleLogout}
              className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* To do */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <h2 className="font-bold">✅ To do</h2>
          </div>
          <div className="divide-y divide-gray-700">
            {week && week.uninvoiced > 0 && (
              <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div>
                  <p className="font-medium">
                    Week {fmtDateShort(week.start)} – {fmtDateShort(week.end)} is ready to invoice
                  </p>
                  <p className="text-sm text-gray-400">
                    {week.uninvoiced} entr{week.uninvoiced === 1 ? 'y' : 'ies'}{week.recurring ? ` + ${week.recurring} weekly item${week.recurring === 1 ? '' : 's'}` : ''} · about ${week.amount.toFixed(2)}
                    {week.partly && ' · some entries of this week are already on another invoice'}
                  </p>
                  {createError && <p className="text-sm text-red-400 mt-1">{createError}</p>}
                </div>
                {week.partly ? (
                  <Link href="/contractor/invoices/new" className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-bold text-center">
                    Review & create
                  </Link>
                ) : (
                  <button onClick={createWeekInvoice} disabled={creating}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-bold disabled:opacity-50">
                    {creating ? 'Creating…' : 'Create invoice'}
                  </button>
                )}
              </div>
            )}
            {todos.map(t => (
              <Link key={t.key} href={t.href} className="p-4 flex items-center justify-between gap-3 hover:bg-gray-700/50">
                <span className={`text-sm ${t.tone === 'red' ? 'text-red-300' : t.tone === 'yellow' ? 'text-yellow-200' : 'text-gray-300'}`}>{t.text}</span>
                <span className="text-sm text-blue-400 whitespace-nowrap">{t.action} →</span>
              </Link>
            ))}
            {!(week && week.uninvoiced > 0) && todos.length === 0 && (
              <p className="p-4 text-sm text-gray-400">All caught up — nothing to do right now.</p>
            )}
          </div>
        </div>

        {/* Quick receipt */}
        <Link href="/contractor/tax-records?add=1"
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 rounded-xl py-3 font-bold">
          📸 Add receipt
        </Link>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Last Week{week ? ` (${fmtDateShort(week.start)}–${fmtDateShort(week.end)})` : ''}</p>
            <p className="text-2xl font-bold">{stats.currentPeriodHours.toFixed(1)}h</p>
            <p className="text-xs text-gray-500">{stats.currentPeriodMiles.toFixed(0)} miles</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Uninvoiced</p>
            <p className="text-2xl font-bold text-green-400">${stats.currentPeriodAmount.toFixed(2)}</p>
            <p className="text-xs text-gray-500">Last week, not invoiced yet</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Waiting</p>
            <p className="text-2xl font-bold text-yellow-400">{stats.pendingInvoices}</p>
            <p className="text-xs text-gray-500">Awaiting payment</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Paid This Month</p>
            <p className="text-2xl font-bold text-blue-400">${stats.paidThisMonth.toFixed(2)}</p>
          </div>
        </div>

        {/* Current Rates */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h2 className="font-bold mb-3">📊 Your Rates</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">${parseFloat(user.profile?.hourly_rate || 35).toFixed(2)}</p>
              <p className="text-xs text-gray-400">Hourly Rate</p>
            </div>
            <div>
              <p className="text-2xl font-bold">${parseFloat(user.profile?.ot_rate || 52.50).toFixed(2)}</p>
              <p className="text-xs text-gray-400">OT Rate</p>
            </div>
            <div>
              <p className="text-2xl font-bold">${parseFloat(user.profile?.mileage_rate || 0.67).toFixed(2)}</p>
              <p className="text-xs text-gray-400">Per Mile</p>
            </div>
          </div>
          <Link href="/contractor/settings" className="block text-center text-sm text-blue-400 hover:text-blue-300 mt-3">
            Change Rates →
          </Link>
        </div>

        {/* Main Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/contractor/invoices/new"
            className="bg-green-600 hover:bg-green-700 rounded-xl p-6 text-center transition"
          >
            <span className="text-4xl block mb-2">📝</span>
            <span className="text-xl font-bold">Create Invoice</span>
            <p className="text-green-200 text-sm mt-1">Pull hours & generate invoice</p>
          </Link>
          <Link
            href="/contractor/invoices"
            className="bg-blue-600 hover:bg-blue-700 rounded-xl p-6 text-center transition"
          >
            <span className="text-4xl block mb-2">📋</span>
            <span className="text-xl font-bold">View Invoices</span>
            <p className="text-blue-200 text-sm mt-1">History & status</p>
          </Link>
          <Link
            href="/contractor/tax-report"
            className="bg-purple-600 hover:bg-purple-700 rounded-xl p-6 text-center transition"
          >
            <span className="text-4xl block mb-2">📊</span>
            <span className="text-xl font-bold">Tax Report</span>
            <p className="text-purple-200 text-sm mt-1">Year-end income summary</p>
          </Link>
          <Link
            href="/contractor/tax-records"
            className="bg-yellow-600 hover:bg-yellow-700 rounded-xl p-6 text-center transition"
          >
            <span className="text-4xl block mb-2">💰</span>
            <span className="text-xl font-bold">Tax Records</span>
            <p className="text-yellow-200 text-sm mt-1">Track expenses & receipts</p>
          </Link>
        </div>

        {/* Recent Invoices */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <h2 className="font-bold">📄 Recent Invoices</h2>
          </div>
          {recentInvoices.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No invoices yet</p>
              <Link href="/contractor/invoices/new" className="text-blue-400 hover:text-blue-300 text-sm">
                Create your first invoice →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {recentInvoices.map(invoice => (
                <Link
                  key={invoice.invoice_id}
                  href={`/contractor/invoices/${invoice.invoice_id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-700/50 transition"
                >
                  <div>
                    <p className="font-medium">{invoice.invoice_number}</p>
                    <p className="text-sm text-gray-400">
                      {fmtDate(invoice.period_start)} - {fmtDate(invoice.period_end)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">${parseFloat(invoice.grand_total || 0).toFixed(2)}</p>
                    <StatusPill invoice={invoice} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
