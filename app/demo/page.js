// app/demo/page.js
'use client';

import Link from 'next/link';

export default function DemoLandingPage() {
  const features = [
    { icon: '📋', title: 'Work Order Management', description: 'Track jobs from creation through completion.' },
    { icon: '👥', title: 'Team Assignments', description: 'Assign leads, techs, and helpers to jobs.' },
    { icon: '📱', title: 'Mobile App', description: 'Field techs check in/out, log hours, upload photos.' },
    { icon: '💰', title: 'NTE Tracking', description: 'Monitor costs and request NTE increases.' },
    { icon: '📅', title: 'Calendar View', description: 'Visual scheduling with drag-and-drop.' },
    { icon: '⏰', title: 'Aging Reports', description: 'Track stale work orders automatically.' },
    { icon: '✅', title: 'Daily Availability', description: 'Techs submit daily availability status.' },
    { icon: '🧾', title: 'Invoice Generation', description: 'One-click professional invoices.' }
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
            PCS FieldService
            <span className="text-blue-400"> Demo</span>
          </h1>
          
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Experience the complete PCS field service management system with realistic sample data.
            Full-featured FSM for electrical contractors serving commercial facilities.
          </p>

          {/* Main CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link 
              href="/demo/dashboard" 
              className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition transform hover:scale-105"
            >
              🖥️ Dashboard Demo
            </Link>
            <Link 
              href="/demo/mobile" 
              className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition transform hover:scale-105"
            >
              📱 Mobile App Demo
            </Link>
          </div>

          {/* What's Included */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 max-w-2xl mx-auto">
            <h3 className="text-white font-semibold mb-4">What's in the Demo?</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">28</div>
                <div className="text-slate-400">Work Orders</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">10</div>
                <div className="text-slate-400">Team Members</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">10</div>
                <div className="text-slate-400">UPS Locations</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-400">All</div>
                <div className="text-slate-400">Features</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-white text-center mb-8">Features You Can Try</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {features.map((feature, i) => (
            <div key={i} className="bg-slate-800/30 rounded-lg p-4 text-center hover:bg-slate-800/50 transition">
              <div className="text-2xl mb-2">{feature.icon}</div>
              <h3 className="text-white font-medium text-sm mb-1">{feature.title}</h3>
              <p className="text-slate-400 text-xs">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-8">How The Demo Works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">1</div>
              <h3 className="text-white font-semibold mb-2">Same System</h3>
              <p className="text-slate-400 text-sm">This is the exact same dashboard used in production - same UI, same features.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">2</div>
              <h3 className="text-white font-semibold mb-2">Sample Data</h3>
              <p className="text-slate-400 text-sm">Realistic work orders, technicians, and UPS locations - all randomly generated.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">3</div>
              <h3 className="text-white font-semibold mb-2">Fully Interactive</h3>
              <p className="text-slate-400 text-sm">Make changes, assign techs, update statuses - click "Reset" to start fresh.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 py-12">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-center max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-4">Ready to Explore?</h2>
          <p className="text-blue-100 mb-6">Jump in and see how the system works. No account needed.</p>
          <Link 
            href="/demo/dashboard" 
            className="inline-block bg-white hover:bg-blue-50 text-blue-600 px-6 py-3 rounded-lg font-semibold transition"
          >
            Launch Demo Dashboard
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-8 border-t border-slate-800">
        <div className="flex flex-col md:flex-row justify-between items-center text-slate-400 text-sm">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">⚡</span>
            </div>
            <span>PCS FieldService - Professional Commercial Solutions</span>
          </div>
          <div>Demo Version</div>
        </div>
      </footer>
    </div>
  );
}
