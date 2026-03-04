'use client';

import Link from 'next/link';

function PCSLogo({ size = 'md' }) {
  const sizes = {
    sm: { box: 'w-8 h-8',   text: 'text-sm' },
    md: { box: 'w-11 h-11', text: 'text-lg' },
    lg: { box: 'w-16 h-16', text: 'text-2xl' },
  };
  return (
    <div className={`${sizes[size].box} bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25 flex-shrink-0`}>
      <span className={`text-white font-black ${sizes[size].text} tracking-tight`}>PCS</span>
    </div>
  );
}

const FEATURES = [
  { icon: '📋', title: 'Work Order Management',  desc: 'Track jobs from creation through completion with full status workflow.' },
  { icon: '👥', title: 'Team Assignments',        desc: 'Assign leads, techs, and helpers to jobs with role-based access.' },
  { icon: '📱', title: 'Mobile App (PWA)',        desc: 'Field techs check in/out, log hours, offline support, bilingual.' },
  { icon: '💰', title: 'NTE & Cost Tracking',     desc: 'Monitor costs, markups, and request NTE increases.' },
  { icon: '📅', title: 'Calendar View',           desc: 'Visual scheduling with drag-and-drop assignments.' },
  { icon: '⏰', title: 'Aging Reports',           desc: 'Track stale work orders with automated email alerts.' },
  { icon: '⚠️', title: 'Missing Hours Report',   desc: 'Identify work orders missing time entries with multi-select filters.' },
  { icon: '✅', title: 'Daily Availability',      desc: 'Techs submit daily availability for scheduling.' },
  { icon: '🧾', title: 'Invoice Generation',      desc: 'Auto-calculate from logged hours with markup rates.' },
  { icon: '📧', title: 'Email Integration',       desc: 'Auto-import work orders from dispatch emails.' },
  { icon: '📱', title: 'SMS Notifications',       desc: 'Text alerts to techs via carrier gateways.' },
  { icon: '🔍', title: 'Multi-Select Filters',    desc: 'Filter by multiple techs, statuses, priorities at once.' },
];

const LATEST = [
  { color: 'text-cyan-400',   title: 'Missing Hours Report',  desc: 'Track work orders where techs have not logged hours. Multi-select filters for techs and statuses. Export to CSV.' },
  { color: 'text-blue-400',   title: 'Multi-Select Filters',  desc: 'Filter work orders by multiple techs, statuses, priorities, and billing statuses simultaneously.' },
  { color: 'text-teal-400',   title: 'Carrier Auto-Detect',   desc: 'Automatically detect phone carrier for SMS notifications. NumVerify API integration.' },
  { color: 'text-indigo-400', title: 'Email Auto-Import',     desc: 'Automatically import work orders from dispatch emails via Gmail integration.' },
];

const STEPS = [
  { n: 1, title: 'Production Code',   desc: 'This is the exact same system used in production — same UI, same features, same workflows.' },
  { n: 2, title: 'Realistic Data',    desc: 'Sample work orders, technicians, and locations that mirror real-world commercial contractor operations.' },
  { n: 3, title: 'Fully Interactive', desc: 'Make changes, assign techs, log hours, create invoices — click "Reset" anytime to start fresh.' },
];

const PRICING = [
  { price: '$149/mo', label: 'Small Teams',   color: 'text-cyan-400',   border: 'border-[#1e1e2e]' },
  { price: '$299/mo', label: 'Growing Teams', color: 'text-blue-400',   border: 'border-blue-500/30' },
  { price: '$499/mo', label: 'Enterprise',    color: 'text-indigo-400', border: 'border-[#1e1e2e]' },
];

export default function DemoLandingPage() {
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-200">

      {/* ── Nav ── */}
      <nav className="border-b border-[#1e1e2e] bg-[#0d0d14]/80 backdrop-blur sticky top-0 z-20 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PCSLogo size="sm" />
            <div>
              <p className="text-white font-bold text-base leading-tight">PCS FieldService</p>
              <p className="text-cyan-400 text-xs leading-tight">Interactive Demo</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://pcsllc.dev" target="_blank" rel="noopener noreferrer"
              className="text-slate-500 hover:text-slate-300 text-sm transition hidden md:block">
              pcsllc.dev
            </a>
            <Link href="/demo/dashboard"
              className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white px-4 py-2 rounded-lg font-semibold text-sm transition shadow-lg shadow-blue-500/20">
              Launch Demo →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-6 py-16 md:py-24 text-center">
        {/* Live badge */}
        <div className="inline-flex items-center gap-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 px-4 py-2 rounded-full text-xs font-semibold mb-8">
          <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"/>
          Live Interactive Demo — No Sign Up Required
        </div>

        <div className="flex justify-center mb-8">
          <PCSLogo size="lg" />
        </div>

        <h1 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
          Complete Field Service
          <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent"> Management</span>
        </h1>

        <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          Experience PCS FieldService — a full-featured FSM platform for commercial contractors.
          Work orders, scheduling, time tracking, invoicing, and mobile app — all in one system.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row justify-center gap-3 mb-12">
          <Link href="/demo/dashboard"
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white px-7 py-4 rounded-xl font-semibold text-base transition shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2">
            🖥️ Dashboard Demo
          </Link>
          <Link href="/demo/mobile"
            className="bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white px-7 py-4 rounded-xl font-semibold text-base transition shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2">
            📱 Mobile App Demo
          </Link>
          <Link href="/demo/invoices"
            className="bg-[#1e1e2e] border border-[#2d2d44] hover:border-blue-500/40 hover:bg-[#2d2d44] text-slate-200 px-7 py-4 rounded-xl font-semibold text-base transition flex items-center justify-center gap-2">
            💰 Invoicing Demo
          </Link>
        </div>

        {/* Stats box */}
        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-2xl p-6 max-w-lg mx-auto">
          <p className="text-slate-500 text-xs uppercase tracking-widest font-semibold mb-4">What is in the Demo?</p>
          <div className="grid grid-cols-4 gap-4">
            {[
              { v: '28', l: 'Work Orders', c: 'text-blue-400' },
              { v: '10', l: 'Team Members', c: 'text-cyan-400' },
              { v: '10', l: 'Locations',    c: 'text-blue-300' },
              { v: '5',  l: 'Statuses',     c: 'text-cyan-300' },
            ].map(s => (
              <div key={s.l} className="text-center">
                <p className={`text-2xl font-black font-mono ${s.c}`}>{s.v}</p>
                <p className="text-slate-600 text-[10px] mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Demo company info ── */}
      <section className="max-w-6xl mx-auto px-6 pb-10">
        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-5 max-w-xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-xl">🏢</span>
            <p className="text-white font-semibold text-sm">Demo Company: Summit Mechanical Services</p>
          </div>
          <p className="text-slate-500 text-xs leading-relaxed">
            Explore with realistic sample data including work orders, technicians, comments, photos, NTE requests, and more.
            All changes are temporary — feel free to click around!
          </p>
        </div>
      </section>

      {/* ── Features grid ── */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-white text-center mb-2">All Features Included</h2>
        <p className="text-slate-500 text-center text-sm mb-8">Try every feature in the demo — nothing is locked</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {FEATURES.map((f, i) => (
            <div key={i} className="bg-[#0d0d14] border border-[#1e1e2e] hover:border-blue-500/30 rounded-xl p-4 text-center transition">
              <div className="text-2xl mb-2">{f.icon}</div>
              <p className="text-slate-200 font-semibold text-xs mb-1">{f.title}</p>
              <p className="text-slate-600 text-[10px] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Latest features ── */}
      <section className="max-w-6xl mx-auto px-6 py-10">
        <div className="bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border border-blue-500/20 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
            <span>✨</span> Latest Features
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {LATEST.map((l, i) => (
              <div key={i} className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-4">
                <p className={`font-semibold text-sm mb-1.5 ${l.color}`}>{l.title}</p>
                <p className="text-slate-500 text-xs leading-relaxed">{l.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="max-w-6xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-bold text-white text-center mb-10">How The Demo Works</h2>
        <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {STEPS.map(s => (
            <div key={s.n} className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-full flex items-center justify-center text-white font-black text-xl mx-auto mb-4 shadow-lg shadow-blue-500/25">
                {s.n}
              </div>
              <p className="text-white font-semibold mb-2 text-sm">{s.title}</p>
              <p className="text-slate-500 text-xs leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="max-w-6xl mx-auto px-6 py-10">
        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-2xl p-8 max-w-xl mx-auto text-center">
          <h2 className="text-xl font-bold text-white mb-1">Ready for Your Business?</h2>
          <p className="text-slate-500 text-sm mb-6">PCS FieldService is available for commercial contractors</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            {PRICING.map(p => (
              <div key={p.label} className={`bg-[#0a0a0f] border ${p.border} rounded-xl px-5 py-3`}>
                <p className={`${p.color} font-black text-lg font-mono`}>{p.price}</p>
                <p className="text-slate-500 text-xs mt-0.5">{p.label}</p>
              </div>
            ))}
          </div>
          <p className="text-slate-700 text-xs mt-5">Contact us for custom pricing and onboarding</p>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="max-w-6xl mx-auto px-6 py-10">
        <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 rounded-2xl p-8 text-center max-w-2xl mx-auto shadow-2xl shadow-blue-500/20">
          <h2 className="text-2xl font-bold text-white mb-3">Ready to Explore?</h2>
          <p className="text-blue-100 mb-6 text-sm">Jump in and see how the system works. No account needed.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link href="/demo/dashboard"
              className="bg-white hover:bg-blue-50 text-blue-700 px-6 py-3 rounded-xl font-semibold transition shadow-lg text-sm">
              🖥️ Launch Dashboard
            </Link>
            <Link href="/demo/mobile"
              className="bg-[#0d0d14] hover:bg-[#1e1e2e] text-white px-6 py-3 rounded-xl font-semibold transition shadow-lg text-sm">
              📱 Try Mobile App
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#1e1e2e] mt-4 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <PCSLogo size="sm" />
            <div>
              <p className="text-white font-semibold text-sm">PCS FieldService</p>
              <p className="text-slate-600 text-xs">Professional Commercial Solutions LLC</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <a href="https://pcsllc.dev" target="_blank" rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 transition font-medium">pcsllc.dev</a>
            <span className="text-slate-700">|</span>
            <span className="text-slate-600">Demo Version</span>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-6 pt-6 border-t border-[#1e1e2e] text-center">
          <p className="text-slate-600 text-xs">© {year} Professional Commercial Solutions LLC. All rights reserved.</p>
          <p className="text-slate-700 text-[10px] mt-1">
            Developed by <a href="https://pcsllc.dev" target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:text-cyan-400 transition">PCS LLC</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
