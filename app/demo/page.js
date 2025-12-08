'use client';

import Link from 'next/link';

export default function DemoLandingPage() {
  const features = [
    { icon: '📋', title: 'Work Order Management', description: 'Track jobs from creation through invoicing.' },
    { icon: '👥', title: 'Team Coordination', description: 'Assign leads, techs, and helpers with SMS notifications.' },
    { icon: '📱', title: 'Mobile App', description: 'Techs check in/out, log hours, upload photos.' },
    { icon: '💰', title: 'Cost Tracking & NTE', description: 'Automatic cost calculations and NTE workflows.' },
    { icon: '📅', title: 'Calendar Scheduling', description: 'Drag-and-drop scheduling with capacity planning.' },
    { icon: '📶', title: 'Works Offline', description: 'Data syncs automatically when connection returns.' },
    { icon: '📊', title: 'Aging Reports', description: 'Automatic alerts for stale work orders.' },
    { icon: '🧾', title: 'Invoice Generation', description: 'One-click professional invoices.' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">P</span>
            </div>
            <div>
              <span className="text-white font-bold text-xl">PCS FieldService</span>
              <span className="text-blue-300 text-sm block -mt-1">Interactive Demo</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/demo/dashboard" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition text-sm">
              Try Dashboard
            </Link>
            <Link href="/demo/mobile" className="border border-blue-400 text-blue-300 hover:bg-blue-500/20 px-4 py-2 rounded-lg font-medium transition text-sm">
              Try Mobile App
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
            See PCS FieldService
            <span className="text-blue-400"> In Action</span>
          </h1>
          
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Explore our complete field service management system with realistic sample data. 
            Click around, make changes, and see how it works.
          </p>

          {/* Demo Options */}
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-12">
            <Link href="/demo/dashboard" className="group bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-xl p-6 text-left transition-all">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-blue-500/20 rounded-xl flex items-center justify-center text-3xl group-hover:scale-110 transition">🖥️</div>
                <div>
                  <h3 className="text-xl font-bold text-white">Dashboard</h3>
                  <p className="text-blue-300 text-sm">For office staff & managers</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-4">
                Manage work orders, schedule techs, track costs, generate invoices.
              </p>
              <div className="flex items-center text-blue-400 font-medium">Open Dashboard →</div>
            </Link>

            <Link href="/demo/mobile" className="group bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-xl p-6 text-left transition-all">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-green-500/20 rounded-xl flex items-center justify-center text-3xl group-hover:scale-110 transition">📱</div>
                <div>
                  <h3 className="text-xl font-bold text-white">Mobile App</h3>
                  <p className="text-green-300 text-sm">For field technicians</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-4">
                Check in/out, log hours, add comments, upload photos.
              </p>
              <div className="flex items-center text-green-400 font-medium">Open Mobile App →</div>
            </Link>
          </div>

          {/* Sample Company */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 max-w-xl mx-auto">
            <div className="flex items-center justify-center gap-3 mb-3">
              <span className="text-2xl">🏢</span>
              <span className="text-white font-semibold">Demo Company: Summit Mechanical Services</span>
            </div>
            <p className="text-slate-400 text-sm">
              Explore with realistic sample data including work orders, technicians, comments, and more.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-white text-center mb-8">What You Can Try</h2>
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

      {/* CTA */}
      <section className="container mx-auto px-6 py-12">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-center max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-4">Ready to Get Started?</h2>
          <p className="text-blue-100 mb-6">Contact us to set up your own PCS FieldService account.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/demo/dashboard" className="bg-white hover:bg-blue-50 text-blue-600 px-6 py-3 rounded-lg font-semibold transition">
              Try Dashboard Demo
            </Link>
            <a href="mailto:info@pcsllc.com" className="border-2 border-white text-white hover:bg-white/10 px-6 py-3 rounded-lg font-semibold transition">
              Contact Sales
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-8 border-t border-slate-800">
        <div className="flex flex-col md:flex-row justify-between items-center text-slate-400 text-sm">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">P</span>
            </div>
            <span>PCS FieldService by Professional Commercial Solutions LLC</span>
          </div>
          <div>© {new Date().getFullYear()} All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
