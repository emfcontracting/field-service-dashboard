'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

const supabase = getSupabase();

const FEATURES = [
  { icon: '📋', color: 'text-blue-400',   title: 'Work Order Management',  desc: 'Create, assign, and track work orders from creation to completion with real-time status updates.' },
  { icon: '📱', color: 'text-emerald-400', title: 'Mobile Field App',        desc: 'Field workers check in/out, update progress, and submit time & materials from their phones.' },
  { icon: '💰', color: 'text-purple-400',  title: 'Invoicing & Billing',     desc: 'Automatic cost calculations with markups, invoice generation, and NTE budget tracking.' },
  { icon: '📅', color: 'text-yellow-400',  title: 'Availability Tracking',   desc: 'Track daily worker availability for scheduled and emergency work assignments.' },
  { icon: '👥', color: 'text-red-400',     title: 'Team Management',         desc: 'Manage technicians, helpers, and lead techs with role-based access control.' },
  { icon: '📊', color: 'text-cyan-400',    title: 'Real-time Analytics',     desc: 'Track performance metrics, costs, and productivity with comprehensive reporting.' },
];

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => { checkAuth(); }, []);

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: userData } = await supabase
        .from('users').select('role').eq('auth_id', user.id).single();
      if (userData && ['admin', 'office_staff'].includes(userData.role)) {
        router.push('/dashboard');
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-200">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-20 border-b border-[#1e1e2e] bg-[#0d0d14]/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/emf-logo.png" alt="EMF" className="h-9 w-auto"
              onError={e => { e.target.style.display = 'none'; }} />
            <span className="text-white font-bold text-lg">EMF Contracting LLC</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push('/login')}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
              Admin Login
            </button>
            <button onClick={() => router.push('/mobile')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
              Field Workers →
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-7xl mx-auto px-6 py-28 text-center">
        {/* Glow orb */}
        <div className="absolute left-1/2 -translate-x-1/2 top-32 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <h1 className="relative text-5xl md:text-6xl font-black text-white mb-6 leading-tight">
          Field Service Management
          <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent"> Simplified</span>
        </h1>
        <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          Streamline work orders, track field operations, and manage your team with our
          comprehensive field service management platform.
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <button onClick={() => router.push('/login')}
            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl font-bold text-base transition shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Admin / Office Login
          </button>
          <button onClick={() => router.push('/mobile')}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-xl font-bold text-base transition shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
            Field Workers App →
          </button>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="bg-[#0d0d14] border-t border-b border-[#1e1e2e] py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">Everything You Need to Manage Field Operations</h2>
            <p className="text-slate-500 text-sm">Powerful features designed for contracting businesses</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <div key={i} className="bg-[#0a0a0f] border border-[#1e1e2e] hover:border-blue-500/30 rounded-xl p-6 transition">
                <div className={`text-4xl mb-4 ${f.color}`}>{f.icon}</div>
                <h3 className="text-white font-bold text-base mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Access info ── */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-white text-center mb-8">Access Information</h2>
          <div className="grid md:grid-cols-2 gap-4">

            <div className="bg-[#0d0d14] border border-blue-500/25 rounded-xl p-6">
              <h3 className="text-blue-400 font-bold text-base mb-4 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                Admin & Office Users
              </h3>
              <ul className="space-y-2 text-sm text-slate-400">
                {['Access the web dashboard for full management','View all work orders and invoicing','Manage users and settings','Track availability and costs','Secure individual passwords'].map((t,i)=>(
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-blue-500 flex-shrink-0"/>
                    {t}
                  </li>
                ))}
              </ul>
              <button onClick={() => router.push('/login')}
                className="mt-5 w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-sm font-semibold transition">
                Admin Login →
              </button>
            </div>

            <div className="bg-[#0d0d14] border border-emerald-500/25 rounded-xl p-6">
              <h3 className="text-emerald-400 font-bold text-base mb-4 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                Field Workers
              </h3>
              <ul className="space-y-2 text-sm text-slate-400">
                {['Use the mobile app for field operations','Check in/out of work orders','Update time and materials','Submit daily availability','Login with email and 4-digit PIN'].map((t,i)=>(
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-emerald-500 flex-shrink-0"/>
                    {t}
                  </li>
                ))}
              </ul>
              <button onClick={() => router.push('/mobile')}
                className="mt-5 w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-lg text-sm font-semibold transition">
                Field App →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#1e1e2e] py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-slate-600 text-sm">© {new Date().getFullYear()} PCS LLC. All rights reserved.</p>
          <button onClick={() => router.push('/mobile')}
            className="text-slate-600 hover:text-slate-400 text-sm transition">
            Mobile App
          </button>
        </div>
      </footer>
    </div>
  );
}
