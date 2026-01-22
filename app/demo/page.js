// app/demo/page.js
'use client';

import Link from 'next/link';

// PCS Logo Component
function PCSLogo({ size = 'md' }) {
  const sizes = {
    sm: { container: 'w-8 h-8', text: 'text-sm' },
    md: { container: 'w-10 h-10 sm:w-12 sm:h-12', text: 'text-lg sm:text-xl' },
    lg: { container: 'w-14 h-14 sm:w-16 sm:h-16', text: 'text-xl sm:text-2xl' },
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
      <nav className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <PCSLogo size="md" />
            <div>
              <span className="text-white font-bold text-base sm:text-xl">PCS FieldService</span>
              <span className="text-cyan-400 text-xs sm:text-sm block -mt-0.5 sm:-mt-1">Interactive Demo</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <a 
              href="https://pcsllc.dev" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white text-sm hidden md:block transition"
            >
              pcsllc.dev
            </a>
            <Link href="/demo/dashboard" className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition text-xs sm:text-sm shadow-lg shadow-blue-500/25">
              Launch Demo →
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 md:py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-cyan-500/20 text-cyan-300 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm mb-4 sm:mb-6 border border-cyan-500/30">
            <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
            <span className="hidden xs:inline">Live Interactive Demo -</span> No Sign Up Required
          </div>
          
          {/* Large PCS Logo */}
          <div className="flex justify-center mb-6 sm:mb-8">
            <PCSLogo size="lg" />
          </div>
          
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 sm:mb-6 leading-tight px-2">
            Complete Field Service
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent"> Management System</span>
          </h1>
          
          <p className="text-base sm:text-lg md:text-xl text-blue-100 mb-6 sm:mb-8 max-w-2xl mx-auto px-2">
            Experience PCS FieldService - a full-featured FSM platform for commercial contractors.
            Work orders, scheduling, time tracking, invoicing, and mobile app - all in one system.
          </p>

          {/* Main CTAs */}
          <div className="flex flex-col gap-3 sm:gap-4 justify-center mb-8 sm:mb-12 px-2">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Link 
                href="/demo/dashboard" 
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold text-base sm:text-lg transition transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30"
              >
                🖥️ Dashboard Demo
              </Link>
              <Link 
                href="/demo/mobile" 
                className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold text-base sm:text-lg transition transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/30"
              >
                📱 Mobile App Demo
              </Link>
            </div>
            <Link 
              href="/demo/invoices" 
              className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold text-base sm:text-lg transition transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30 sm:w-auto sm:mx-auto"
            >
              💰 Invoicing Demo
            </Link>
          </div>

          {/* Stats */}
          <div className="bg-slate-800/50 border border-blue-500/20 rounded-xl p-4 sm:p-6 max-w-2xl mx-auto backdrop-blur-sm">
            <h3 className="text-white font-semibold mb-3 sm:mb-4 text-sm sm:text-base">What's in the Demo?</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-sm">
              {stats.map((stat, i) => (
                <div key={i} className="text-center">
                  <div className={`text-xl sm:text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-slate-400 text-xs sm:text-sm">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Sample Company Info */}
      <section className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 sm:p-6 max-w-xl mx-auto text-center backdrop-blur-sm">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2 sm:mb-3">
            <span className="text-xl sm:text-2xl">🏢</span>
            <span className="text-white font-semibold text-sm sm:text-base">Demo Company: Summit Mechanical Services</span>
          </div>
          <p className="text-slate-400 text-xs sm:text-sm">
            Explore with realistic sample data including work orders, technicians, 
            comments, photos, NTE requests, and more. All changes are temporary - 
            feel free to click around!
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <h2 className="text-xl sm:text-2xl font-bold text-white text-center mb-2">All Features Included</h2>
        <p className="text-slate-400 text-center mb-6 sm:mb-8 text-sm sm:text-base">Try every feature in the demo - nothing is locked</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 max-w-5xl mx-auto">
          {features.map((feature, i) => (
            <div key={i} className="bg-slate-800/30 rounded-lg p-3 sm:p-4 text-center hover:bg-slate-800/50 transition border border-slate-700/50 hover:border-blue-500/30">
              <div className="text-xl sm:text-2xl mb-1 sm:mb-2">{feature.icon}</div>
              <h3 className="text-white font-medium text-xs sm:text-sm mb-1">{feature.title}</h3>
              <p className="text-slate-400 text-[10px] sm:text-xs leading-tight">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* New Features Highlight */}
      <section className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-blue-900/30 to-cyan-900/30 border border-blue-500/30 rounded-xl p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4 flex items-center gap-2">
              <span>✨</span> Latest Features
            </h2>
            <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-slate-800/50 rounded-lg p-3 sm:p-4 border border-slate-700/50">
                <h3 className="text-cyan-400 font-semibold mb-1 sm:mb-2 text-sm sm:text-base">⚠️ Missing Hours Report</h3>
                <p className="text-slate-300 text-xs sm:text-sm">Track work orders where techs haven't logged hours. Multi-select filters for techs and statuses. Export to CSV.</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3 sm:p-4 border border-slate-700/50">
                <h3 className="text-blue-400 font-semibold mb-1 sm:mb-2 text-sm sm:text-base">🔍 Multi-Select Filters</h3>
                <p className="text-slate-300 text-xs sm:text-sm">Filter work orders by multiple techs, statuses, priorities, and billing statuses simultaneously.</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3 sm:p-4 border border-slate-700/50">
                <h3 className="text-teal-400 font-semibold mb-1 sm:mb-2 text-sm sm:text-base">📱 Carrier Auto-Detect</h3>
                <p className="text-slate-300 text-xs sm:text-sm">Automatically detect phone carrier for SMS notifications. NumVerify API integration.</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3 sm:p-4 border border-slate-700/50">
                <h3 className="text-indigo-400 font-semibold mb-1 sm:mb-2 text-sm sm:text-base">📧 Email Auto-Import</h3>
                <p className="text-slate-300 text-xs sm:text-sm">Automatically import work orders from dispatch emails via Gmail integration.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-bold text-white text-center mb-6 sm:mb-8">How The Demo Works</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-lg sm:text-xl mx-auto mb-3 sm:mb-4 shadow-lg shadow-blue-500/30">1</div>
              <h3 className="text-white font-semibold mb-2 text-sm sm:text-base">Production Code</h3>
              <p className="text-slate-400 text-xs sm:text-sm">This is the exact same system used in production - same UI, same features, same workflows.</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-lg sm:text-xl mx-auto mb-3 sm:mb-4 shadow-lg shadow-blue-500/30">2</div>
              <h3 className="text-white font-semibold mb-2 text-sm sm:text-base">Realistic Data</h3>
              <p className="text-slate-400 text-xs sm:text-sm">Sample work orders, technicians, and locations that mirror real-world commercial contractor operations.</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-lg sm:text-xl mx-auto mb-3 sm:mb-4 shadow-lg shadow-blue-500/30">3</div>
              <h3 className="text-white font-semibold mb-2 text-sm sm:text-base">Fully Interactive</h3>
              <p className="text-slate-400 text-xs sm:text-sm">Make changes, assign techs, log hours, create invoices - click "Reset" anytime to start fresh.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="max-w-2xl mx-auto">
          <div className="bg-slate-800/50 border border-blue-500/20 rounded-xl p-4 sm:p-6 text-center backdrop-blur-sm">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-2">Ready for Your Business?</h2>
            <p className="text-slate-400 mb-4 text-sm">PCS FieldService is available for commercial contractors</p>
            <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-2 sm:gap-4 text-sm">
              <div className="bg-slate-700/50 px-3 sm:px-4 py-2 rounded-lg border border-slate-600/50">
                <span className="text-cyan-400 font-bold">$149/mo</span>
                <span className="text-slate-400 ml-2">Small Teams</span>
              </div>
              <div className="bg-slate-700/50 px-3 sm:px-4 py-2 rounded-lg border border-blue-500/30">
                <span className="text-blue-400 font-bold">$299/mo</span>
                <span className="text-slate-400 ml-2">Growing Teams</span>
              </div>
              <div className="bg-slate-700/50 px-3 sm:px-4 py-2 rounded-lg border border-slate-600/50">
                <span className="text-indigo-400 font-bold">$499/mo</span>
                <span className="text-slate-400 ml-2">Enterprise</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">Contact us for custom pricing and onboarding</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 rounded-xl sm:rounded-2xl p-6 sm:p-8 text-center max-w-2xl mx-auto shadow-xl shadow-blue-500/20">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">Ready to Explore?</h2>
          <p className="text-blue-100 mb-4 sm:mb-6 text-sm sm:text-base">Jump in and see how the system works. No account needed.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
            <Link 
              href="/demo/dashboard" 
              className="inline-block bg-white hover:bg-blue-50 text-blue-600 px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold transition shadow-lg text-sm sm:text-base"
            >
              🖥️ Launch Dashboard
            </Link>
            <Link 
              href="/demo/mobile" 
              className="inline-block bg-slate-900 hover:bg-slate-800 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold transition shadow-lg text-sm sm:text-base"
            >
              📱 Try Mobile App
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 border-t border-slate-800">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          {/* Logo & Company */}
          <div className="flex items-center gap-2 sm:gap-3">
            <PCSLogo size="sm" />
            <div>
              <span className="text-white font-semibold text-sm sm:text-base">PCS FieldService</span>
              <span className="text-slate-500 text-xs sm:text-sm block">Professional Commercial Solutions LLC</span>
            </div>
          </div>
          
          {/* Links */}
          <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm">
            <a 
              href="https://pcsllc.dev" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 transition font-medium"
            >
              pcsllc.dev
            </a>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">Demo Version</span>
          </div>
        </div>
        
        {/* Copyright */}
        <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-800/50 text-center">
          <p className="text-slate-500 text-xs sm:text-sm">
            © {currentYear} Professional Commercial Solutions LLC. All rights reserved.
          </p>
          <p className="text-slate-600 text-[10px] sm:text-xs mt-1">
            Developed by <a href="https://pcsllc.dev" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:text-cyan-400 transition">PCS LLC</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
