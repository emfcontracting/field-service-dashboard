'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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

  useEffect(() => {
    const userData = sessionStorage.getItem('contractor_user');
    if (!userData) {
      router.push('/contractor');
      return;
    }
    
    try {
      const parsed = JSON.parse(userData);
      setUser(parsed);
      
      if (parsed.needsPinSetup) {
        router.push('/contractor/settings');
        return;
      }
      
      loadDashboardData(parsed.user_id, parsed.profile);
    } catch (e) {
      console.error('Error parsing user data:', e);
      router.push('/contractor');
    }
  }, [router]);

  async function loadDashboardData(userId, profile) {
    try {
      // Get current period (last 2 weeks)
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - 14);
      const periodStartStr = periodStart.toISOString().split('T')[0];

      // Get hours and mileage for current period
      const { data: hoursData, error: hoursError } = await supabase
        .from('daily_hours_log')
        .select('hours_regular, hours_overtime, miles')
        .eq('user_id', userId)
        .gte('work_date', periodStartStr);

      if (hoursError) {
        console.error('Error fetching hours:', hoursError);
      }

      let totalRegular = 0;
      let totalOT = 0;
      let totalMiles = 0;

      (hoursData || []).forEach(entry => {
        totalRegular += parseFloat(entry.hours_regular || 0);
        totalOT += parseFloat(entry.hours_overtime || 0);
        totalMiles += parseFloat(entry.miles || 0);
      });

      const hourlyRate = parseFloat(profile?.hourly_rate || 35);
      const otRate = parseFloat(profile?.ot_rate || 52.50);
      const mileageRate = parseFloat(profile?.mileage_rate || 0.67);

      const hoursAmount = (totalRegular * hourlyRate) + (totalOT * otRate);
      const mileageAmount = totalMiles * mileageRate;

      // Get recent invoices
      const { data: invoices, error: invoicesError } = await supabase
        .from('subcontractor_invoices')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (invoicesError) {
        console.error('Error fetching invoices:', invoicesError);
      }

      // Count pending/sent invoices
      const pending = (invoices || []).filter(i => i.status === 'sent').length;

      // Sum paid this month
      const monthStart = new Date();
      monthStart.setDate(1);
      const paidThisMonth = (invoices || [])
        .filter(i => i.status === 'paid' && new Date(i.sent_at) >= monthStart)
        .reduce((sum, i) => sum + parseFloat(i.grand_total || 0), 0);

      setStats({
        currentPeriodHours: totalRegular + totalOT,
        currentPeriodMiles: totalMiles,
        currentPeriodAmount: hoursAmount + mileageAmount,
        pendingInvoices: pending,
        paidThisMonth
      });

      setRecentInvoices(invoices || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem('contractor_user');
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
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Current Period</p>
            <p className="text-2xl font-bold">{stats.currentPeriodHours.toFixed(1)}h</p>
            <p className="text-xs text-gray-500">{stats.currentPeriodMiles.toFixed(0)} miles</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Uninvoiced</p>
            <p className="text-2xl font-bold text-green-400">${stats.currentPeriodAmount.toFixed(2)}</p>
            <p className="text-xs text-gray-500">Ready to invoice</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Pending</p>
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
          <Link
            href="/contractor/settings"
            className="block text-center text-sm text-blue-400 hover:text-blue-300 mt-3"
          >
            Update Rates →
          </Link>
        </div>

        {/* Main Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      {new Date(invoice.period_start).toLocaleDateString()} - {new Date(invoice.period_end).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">${parseFloat(invoice.grand_total || 0).toFixed(2)}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      invoice.status === 'paid' 
                        ? 'bg-green-500/20 text-green-400'
                        : invoice.status === 'sent'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {invoice.status.toUpperCase()}
                    </span>
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
