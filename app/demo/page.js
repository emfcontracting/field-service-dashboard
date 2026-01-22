// app/demo/page.js
'use client';

import Link from 'next/link';

// PCS Logo Component
function PCSLogo({ size = 'md' }) {
  const sizes = {
    sm: { container: 'w-8 h-8', text: 'text-sm' },
    md: { container: 'w-12 h-12', text: 'text-xl' },
    lg: { container: 'w-16 h-16', text: 'text-2xl' },
  };
  
  return (
    <div className={`${sizes[size].container} bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25`}>
      <span className={`text-white font-black ${sizes[size].text} tracking-tight`}>PCS</span>
    </div>
  );
}

export default function DemoLandingPage() {
  const features = [
    { icon: '📋', title: 'Work Order Management', description: 'Track jobs from creation through completion with full status workflow.' },
    { icon: '👥', title: 'Team Assignments', description: 'Assign leads, techs, and helpers to jobs with role-based access.' },
    { icon: '📱', title: 'Mobile App (PWA)', description: 'Field techs check in/out, log hours, offline support, bilingual.' },
    { icon: '💰', title: 'NTE & Cost Tracking', description: 'Monitor costs, markups, and request NTE increases.' },
    { icon: '📅', title: 'Calendar View', description: 'Visual scheduling with drag-and-drop assignments.' },
    { icon: '⏰', title: 'Aging Reports', description: 'Track stale work orders with automated email alerts.' },
    { icon: '⚠️', title: 'Missing Hours Report', description: 'Identify work orders missing time entries with multi-select filters.' },
    { icon: '✅', title: 'Daily Availability', description: 'Techs submit daily availability for scheduling.' },
    { icon: '🧾', title: 'Invoice Generation', description: 'Auto-calculate from logged hours with markup rates.' },
    { icon: '📧', title: 'Email Integration', description: 'Auto-import work orders from dispatch emails.' },
    { icon: '📱', title: 'SMS Notifications', description: 'Text alerts to techs via carrier gateways.' },
    { icon: '🔍', title: 'Multi-Select Filters', description: 'Filter by multiple techs, statuses, priorities at once.' },
  ];

  const stats = [
    { value: '28', label: 'Work Orders', color: 'text-blue-400' },
    { value: '10', label: 'Team Members', color: 'text-cyan-400' },
    { value: '10', label: 'Locations', color: 'text-blue-300' },
    { value: '5', label: 'Status Types', color: 'text-cyan-300' },
  ];

  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PCSLogo size="md" />
            <div>
              <span className="text-white font-bold text-xl">PCS FieldService</span>
              <span className="text-cyan-400 text-sm block -mt-1">Interactive Demo</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a 
              href="https://www.pcsllc.dev" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white text-sm hidden sm:block transition"
            >
              pcsllc.dev
            </a>
            <Link href="/demo/dashboard" className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-4 py-2 rounded-lg font-medium transition text-sm shadow-lg shadow-blue-500/25">
              Launch Demo →
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-12 md:py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-cyan-500/20 text-cyan-300 px-4 py-2 rounded-full text-sm mb-6 border border-cyan-500/30">
            <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
            Live Interactive Demo - No Sign Up Required
          </div>
          
          {/* Large PCS Logo */}
          <div className="flex justify-center mb-8">
            <PCSLogo size="lg" />
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
            Complete Field Service
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent"> Management System</span>
          </h1>
          
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Experience PCS FieldService - a full-featured FSM platform for commercial contractors.
            Work orders, scheduling, time tracking, invoicing, and mobile app - all in one system.
          </p>

          {/* Main CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link 
              href="/demo/dashboard" 
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30"
            >
              🖥️ Dashboard Demo
            </Link>
            <Link 
              href="/demo/mobile" 
              className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/30"
            >
              📱 Mobile App Demo
            </Link>
            <Link 
              href="/demo/invoices" 
              className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30"
            >
              💰 Invoicing Demo
            </Link>
          </div>

          {/* Stats */}
          <div className="bg-slate-800/50 border border-blue-500/20 rounded-xl p-6 max-w-2xl mx-auto backdrop-blur-sm">
            <h3 className="text-white font-semibold mb-4">What's in the Demo?</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {stats.map((stat, i) => (
                <div key={i} className="text-center">
                  <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-slate-400">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Sample Company Info */}
      <section className="container mx-auto px-6 py-8">
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 max-w-xl mx-auto text-center backdrop-blur-sm">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="text-2xl">🏢</span>
            <span className="text-white font-semibold">Demo Company: Summit Mechanical Services</span>
          </div>
          <p className="text-slate-400 text-sm">
            Explore with realistic sample data including work orders, technicians, 
            comments, photos, NTE requests, and more. All changes are temporary - 
            feel free to click around!
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-white text-center mb-2">All Features Included</h2>
        <p className="text-slate-400 text-center mb-8">Try every feature in the demo - nothing is locked</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {features.map((feature, i) => (
            <div key={i} className="bg-slate-800/30 rounded-lg p-4 text-center hover:bg-slate-800/50 transition border border-slate-700/50 hover:border-blue-500/30">
              <div className="text-2xl mb-2">{feature.icon}</div>
              <h3 className="text-white font-medium text-sm mb-1">{feature.title}</h3>
              <p className="text-slate-400 text-xs">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* New Features Highlight */}
      <section className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-blue-900/30 to-cyan-900/30 border border-blue-500/30 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span>✨</span> Latest Features
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                <h3 className="text-cyan-400 font-semibold mb-2">⚠️ Missing Hours Report</h3>
                <p className="text-slate-300 text-sm">Track work orders where techs haven't logged hours. Multi-select filters for techs and statuses. Export to CSV.</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                <h3 className="text-blue-400 font-semibold mb-2">🔍 Multi-Select Filters</h3>
                <p className="text-slate-300 text-sm">Filter work orders by multiple techs, statuses, priorities, and billing statuses simultaneously.</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                <h3 className="text-teal-400 font-semibold mb-2">📱 Carrier Auto-Detect</h3>
                <p className="text-slate-300 text-sm">Automatically detect phone carrier for SMS notifications. NumVerify API integration.</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                <h3 className="text-indigo-400 font-semibold mb-2">📧 Email Auto-Import</h3>
                <p className="text-slate-300 text-sm">Automatically import work orders from dispatch emails via Gmail integration.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-8">How The Demo Works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-4 shadow-lg shadow-blue-500/30">1</div>
              <h3 className="text-white font-semibold mb-2">Production Code</h3>
              <p className="text-slate-400 text-sm">This is the exact same system used in production - same UI, same features, same workflows.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-4 shadow-lg shadow-blue-500/30">2</div>
              <h3 className="text-white font-semibold mb-2">Realistic Data</h3>
              <p className="text-slate-400 text-sm">Sample work orders, technicians, and locations that mirror real-world commercial contractor operations.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-4 shadow-lg shadow-blue-500/30">3</div>
              <h3 className="text-white font-semibold mb-2">Fully Interactive</h3>
              <p className="text-slate-400 text-sm">Make changes, assign techs, log hours, create invoices - click "Reset" anytime to start fresh.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="bg-slate-800/50 border border-blue-500/20 rounded-xl p-6 text-center backdrop-blur-sm">
            <h2 className="text-xl font-bold text-white mb-2">Ready for Your Business?</h2>
            <p className="text-slate-400 mb-4">PCS FieldService is available for commercial contractors</p>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <div className="bg-slate-700/50 px-4 py-2 rounded-lg border border-slate-600/50">
                <span className="text-cyan-400 font-bold">$149/mo</span>
                <span className="text-slate-400 ml-2">Small Teams</span>
              </div>
              <div className="bg-slate-700/50 px-4 py-2 rounded-lg border border-blue-500/30">
                <span className="text-blue-400 font-bold">$299/mo</span>
                <span className="text-slate-400 ml-2">Growing Teams</span>
              </div>
              <div className="bg-slate-700/50 px-4 py-2 rounded-lg border border-slate-600/50">
                <span className="text-indigo-400 font-bold">$499/mo</span>
                <span className="text-slate-400 ml-2">Enterprise</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">Contact us for custom pricing and onboarding</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 py-12">
        <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 rounded-2xl p-8 text-center max-w-2xl mx-auto shadow-xl shadow-blue-500/20">
          <h2 className="text-2xl font-bold text-white mb-4">Ready to Explore?</h2>
          <p className="text-blue-100 mb-6">Jump in and see how the system works. No account needed.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link 
              href="/demo/dashboard" 
              className="inline-block bg-white hover:bg-blue-50 text-blue-600 px-6 py-3 rounded-lg font-semibold transition shadow-lg"
            >
              🖥️ Launch Dashboard
            </Link>
            <Link 
              href="/demo/mobile" 
              className="inline-block bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-lg font-semibold transition shadow-lg"
            >
              📱 Try Mobile App
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-8 border-t border-slate-800">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Logo & Company */}
          <div className="flex items-center gap-3">
            <PCSLogo size="sm" />
            <div>
              <span className="text-white font-semibold">PCS FieldService</span>
              <span className="text-slate-500 text-sm block">Professional Commercial Solutions LLC</span>
            </div>
          </div>
          
          {/* Links */}
          <div className="flex items-center gap-6 text-sm">
            <a 
              href="https://www.pcsllc.dev" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 transition font-medium"
            >
              www.pcsllc.dev
            </a>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">Demo Version</span>
          </div>
        </div>
        
        {/* Copyright */}
        <div className="mt-6 pt-6 border-t border-slate-800/50 text-center">
          <p className="text-slate-500 text-sm">
            © {currentYear} Professional Commercial Solutions LLC. All rights reserved.
          </p>
          <p className="text-slate-600 text-xs mt-1">
            Developed by <a href="https://www.pcsllc.dev" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:text-cyan-400 transition">PCS LLC</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
