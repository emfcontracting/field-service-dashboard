// app/demo/page.js
'use client';

import Link from 'next/link';

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
    { icon: '📧', title: 'Email Integration', description: 'Auto-import work orders from CBRE dispatch emails.' },
    { icon: '📱', title: 'SMS Notifications', description: 'Text alerts to techs via carrier gateways.' },
    { icon: '🔍', title: 'Multi-Select Filters', description: 'Filter by multiple techs, statuses, priorities at once.' },
  ];

  const stats = [
    { value: '28', label: 'Work Orders', color: 'text-blue-400' },
    { value: '10', label: 'Team Members', color: 'text-green-400' },
    { value: '10', label: 'Locations', color: 'text-purple-400' },
    { value: '5', label: 'Status Types', color: 'text-yellow-400' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">⚡</span>
            </div>
            <div>
              <span className="text-white font-bold text-xl">PCS FieldService</span>
              <span className="text-blue-300 text-sm block -mt-1">Interactive Demo</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/demo/dashboard" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition text-sm">
              Launch Demo →
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-12 md:py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-300 px-4 py-2 rounded-full text-sm mb-6">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            Live Interactive Demo - No Sign Up Required
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
            Complete Field Service
            <span className="text-blue-400"> Management System</span>
          </h1>
          
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Experience PCS FieldService - a full-featured FSM platform for commercial contractors.
            Work orders, scheduling, time tracking, invoicing, and mobile app - all in one system.
          </p>

          {/* Main CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link 
              href="/demo/dashboard" 
              className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition transform hover:scale-105 flex items-center justify-center gap-2"
            >
              🖥️ Dashboard Demo
            </Link>
            <Link 
              href="/demo/mobile" 
              className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition transform hover:scale-105 flex items-center justify-center gap-2"
            >
              📱 Mobile App Demo
            </Link>
            <Link 
              href="/demo/invoices" 
              className="bg-purple-500 hover:bg-purple-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition transform hover:scale-105 flex items-center justify-center gap-2"
            >
              💰 Invoicing Demo
            </Link>
          </div>

          {/* Stats */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 max-w-2xl mx-auto">
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

      {/* Features Grid */}
      <section className="container mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-white text-center mb-2">All Features Included</h2>
        <p className="text-slate-400 text-center mb-8">Try every feature in the demo - nothing is locked</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {features.map((feature, i) => (
            <div key={i} className="bg-slate-800/30 rounded-lg p-4 text-center hover:bg-slate-800/50 transition border border-slate-700/50">
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
          <div className="bg-gradient-to-r from-orange-900/30 to-red-900/30 border border-orange-500/30 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span>✨</span> Latest Features
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-slate-800/50 rounded-lg p-4">
                <h3 className="text-orange-400 font-semibold mb-2">⚠️ Missing Hours Report</h3>
                <p className="text-slate-300 text-sm">Track work orders where techs haven't logged hours. Multi-select filters for techs and statuses. Export to CSV.</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4">
                <h3 className="text-blue-400 font-semibold mb-2">🔍 Multi-Select Filters</h3>
                <p className="text-slate-300 text-sm">Filter work orders by multiple techs, statuses, priorities, and CBRE statuses simultaneously.</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4">
                <h3 className="text-green-400 font-semibold mb-2">📱 Carrier Auto-Detect</h3>
                <p className="text-slate-300 text-sm">Automatically detect phone carrier for SMS notifications. NumVerify API integration.</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4">
                <h3 className="text-purple-400 font-semibold mb-2">📧 Email Auto-Import</h3>
                <p className="text-slate-300 text-sm">Automatically import work orders from CBRE dispatch emails via Gmail integration.</p>
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
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">1</div>
              <h3 className="text-white font-semibold mb-2">Production Code</h3>
              <p className="text-slate-400 text-sm">This is the exact same system used in production - same UI, same features, same workflows.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">2</div>
              <h3 className="text-white font-semibold mb-2">Realistic Data</h3>
              <p className="text-slate-400 text-sm">Sample work orders, technicians, and locations that mirror real-world commercial contractor operations.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">3</div>
              <h3 className="text-white font-semibold mb-2">Fully Interactive</h3>
              <p className="text-slate-400 text-sm">Make changes, assign techs, log hours, create invoices - click "Reset" anytime to start fresh.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center">
            <h2 className="text-xl font-bold text-white mb-2">Ready for Your Business?</h2>
            <p className="text-slate-400 mb-4">PCS FieldService is available for commercial contractors</p>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <div className="bg-slate-700/50 px-4 py-2 rounded-lg">
                <span className="text-green-400 font-bold">$149/mo</span>
                <span className="text-slate-400 ml-2">Small Teams</span>
              </div>
              <div className="bg-slate-700/50 px-4 py-2 rounded-lg">
                <span className="text-blue-400 font-bold">$299/mo</span>
                <span className="text-slate-400 ml-2">Growing Teams</span>
              </div>
              <div className="bg-slate-700/50 px-4 py-2 rounded-lg">
                <span className="text-purple-400 font-bold">$499/mo</span>
                <span className="text-slate-400 ml-2">Enterprise</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">Contact us for custom pricing and onboarding</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 py-12">
        <div className="bg-gradient-to-r from-blue-600 to-purple-700 rounded-2xl p-8 text-center max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-4">Ready to Explore?</h2>
          <p className="text-blue-100 mb-6">Jump in and see how the system works. No account needed.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link 
              href="/demo/dashboard" 
              className="inline-block bg-white hover:bg-blue-50 text-blue-600 px-6 py-3 rounded-lg font-semibold transition"
            >
              🖥️ Launch Dashboard
            </Link>
            <Link 
              href="/demo/mobile" 
              className="inline-block bg-green-500 hover:bg-green-400 text-white px-6 py-3 rounded-lg font-semibold transition"
            >
              📱 Try Mobile App
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-8 border-t border-slate-800">
        <div className="flex flex-col md:flex-row justify-between items-center text-slate-400 text-sm">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">⚡</span>
            </div>
            <span>PCS FieldService - Professional Commercial Solutions LLC</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Demo Version</span>
            <span className="text-slate-600">|</span>
            <span className="text-blue-400">Built for CBRE Contractors</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
