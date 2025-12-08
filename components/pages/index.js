'use client';

import { useState } from 'react';
import Head from 'next/head';

export default function LandingPage() {
  const [showVideoModal, setShowVideoModal] = useState(false);

  const features = [
    {
      icon: '📋',
      title: 'Work Order Management',
      description: 'Track jobs from creation through invoicing. Real-time status updates, priority handling, and complete job history.'
    },
    {
      icon: '👥',
      title: 'Team Coordination',
      description: 'Assign lead techs, technicians, and helpers. SMS notifications keep everyone informed of new assignments.'
    },
    {
      icon: '📱',
      title: 'Mobile App for Techs',
      description: 'Field technicians check in/out, log hours, add comments, and upload photos - all from their phone.'
    },
    {
      icon: '💰',
      title: 'Cost Tracking & NTE',
      description: 'Automatic cost calculations with labor, materials, equipment, and mileage. NTE increase workflows for CBRE and property managers.'
    },
    {
      icon: '📅',
      title: 'Calendar & Scheduling',
      description: 'Drag-and-drop scheduling with capacity planning. See technician workloads at a glance.'
    },
    {
      icon: '📶',
      title: 'Works Offline',
      description: 'Techs can work in basements, remote areas - anywhere. Data syncs automatically when connection returns.'
    },
    {
      icon: '📊',
      title: 'Aging Reports & Alerts',
      description: 'Automatic flags for stale work orders. Daily email alerts keep jobs moving.'
    },
    {
      icon: '🧾',
      title: 'Invoice Generation',
      description: 'One-click professional invoices with all labor, materials, and costs itemized.'
    }
  ];

  const testimonials = [
    {
      quote: "Finally, a system that understands how CBRE contractors actually work. The NTE workflow alone saves us hours every week.",
      name: "Field Service Manager",
      company: "Mechanical Contractor"
    },
    {
      quote: "Our techs love the mobile app. They can log their time right from the job site instead of doing paperwork at the end of the day.",
      name: "Operations Director",
      company: "HVAC Service Company"
    }
  ];

  return (
    <>
      <Head>
        <title>PCS FieldService - Field Service Management Software</title>
        <meta name="description" content="Complete field service management for CBRE contractors and commercial service companies. Work orders, scheduling, mobile app, cost tracking, and more." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

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
                <span className="text-blue-300 text-sm block -mt-1">by Professional Commercial Solutions</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <a href="#features" className="text-blue-200 hover:text-white transition hidden sm:block">Features</a>
              <a href="#pricing" className="text-blue-200 hover:text-white transition hidden sm:block">Pricing</a>
              <a href="/demo" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition">
                Try Demo
              </a>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="container mx-auto px-6 py-16 md:py-24">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-block bg-blue-500/20 text-blue-300 px-4 py-1 rounded-full text-sm mb-6">
              Built by contractors, for contractors
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Field Service Management
              <span className="text-blue-400"> That Actually Works</span>
            </h1>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Complete work order tracking, technician scheduling, cost management, and invoicing. 
              Designed specifically for CBRE contractors and commercial service companies.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="/demo"
                className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold text-lg transition shadow-lg shadow-blue-500/30"
              >
                🚀 Try Interactive Demo
              </a>
              <a 
                href="#features"
                className="border border-blue-400 text-blue-300 hover:bg-blue-500/20 px-8 py-4 rounded-lg font-semibold text-lg transition"
              >
                Learn More
              </a>
            </div>
            <p className="text-blue-300 mt-4 text-sm">No signup required. Explore the full system.</p>
          </div>

          {/* Dashboard Preview */}
          <div className="mt-16 max-w-5xl mx-auto">
            <div className="bg-slate-800 rounded-xl shadow-2xl overflow-hidden border border-slate-700">
              <div className="bg-slate-700 px-4 py-3 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-slate-400 text-sm ml-4">PCS FieldService Dashboard</span>
              </div>
              <div className="p-6 bg-gradient-to-br from-slate-800 to-slate-900">
                {/* Mock Dashboard Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-3xl font-bold text-white">12</div>
                    <div className="text-blue-300 text-sm">Active Jobs</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-3xl font-bold text-green-400">5</div>
                    <div className="text-blue-300 text-sm">Completed Today</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-3xl font-bold text-yellow-400">3</div>
                    <div className="text-blue-300 text-sm">Pending NTE</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-3xl font-bold text-blue-400">8</div>
                    <div className="text-blue-300 text-sm">Techs on Field</div>
                  </div>
                </div>
                {/* Mock Work Order List */}
                <div className="bg-slate-700/30 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-600 text-slate-400 text-sm font-medium grid grid-cols-4 gap-4">
                    <span>Work Order</span>
                    <span>Location</span>
                    <span>Tech</span>
                    <span>Status</span>
                  </div>
                  {[
                    { wo: 'WO-2024-0891', loc: 'Gateway Office Complex', tech: 'Robert J.', status: 'In Progress', color: 'blue' },
                    { wo: 'WO-2024-0888', loc: 'Innovation Campus', tech: 'Carlos R.', status: 'In Progress', color: 'blue' },
                    { wo: 'WO-2024-0893', loc: 'Republic Tower', tech: 'David W.', status: 'NTE Pending', color: 'yellow' },
                  ].map((row, i) => (
                    <div key={i} className="px-4 py-3 border-b border-slate-600/50 text-slate-300 text-sm grid grid-cols-4 gap-4">
                      <span className="text-blue-400">{row.wo}</span>
                      <span>{row.loc}</span>
                      <span>{row.tech}</span>
                      <span className={`inline-block px-2 py-1 rounded text-xs bg-${row.color}-500/20 text-${row.color}-400`}>
                        {row.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 bg-slate-900/50">
          <div className="container mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Everything You Need to Run Your Operation
              </h2>
              <p className="text-blue-200 max-w-2xl mx-auto">
                From dispatching techs to generating invoices, PCS FieldService handles the complete workflow.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {features.map((feature, i) => (
                <div 
                  key={i}
                  className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 hover:border-blue-500/50 transition group"
                >
                  <div className="text-4xl mb-4">{feature.icon}</div>
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-400 transition">
                    {feature.title}
                  </h3>
                  <p className="text-slate-400 text-sm">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Mobile App Section */}
        <section className="py-20">
          <div className="container mx-auto px-6">
            <div className="flex flex-col lg:flex-row items-center gap-12 max-w-6xl mx-auto">
              <div className="flex-1">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                  Mobile App Your Techs Will Actually Use
                </h2>
                <ul className="space-y-4">
                  {[
                    'One-tap check-in and check-out',
                    'Log hours, mileage, materials on the go',
                    'Upload photos directly from camera',
                    'View work order details and history',
                    'Request NTE increases from the field',
                    'Works offline - syncs when connected'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-blue-100">
                      <span className="text-green-400">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <a 
                  href="/demo/mobile"
                  className="inline-block mt-8 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition"
                >
                  Try Mobile Demo →
                </a>
              </div>
              <div className="flex-1">
                <div className="bg-slate-800 rounded-3xl p-4 max-w-xs mx-auto shadow-2xl border border-slate-700">
                  <div className="bg-slate-900 rounded-2xl overflow-hidden">
                    {/* Mock Phone Screen */}
                    <div className="bg-blue-600 px-4 py-3 text-white text-center font-medium">
                      📱 PCS FieldService
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="bg-blue-500/20 rounded-lg p-3">
                        <div className="text-blue-300 text-xs">Current Job</div>
                        <div className="text-white font-medium">WO-2024-0891</div>
                        <div className="text-slate-400 text-sm">Gateway Office Complex</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button className="bg-green-500 text-white py-2 rounded-lg text-sm font-medium">
                          ✓ Check In
                        </button>
                        <button className="bg-slate-700 text-slate-300 py-2 rounded-lg text-sm">
                          📸 Photos
                        </button>
                      </div>
                      <div className="bg-slate-800 rounded-lg p-3">
                        <div className="text-slate-400 text-xs mb-2">Today's Hours</div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-300">Regular:</span>
                          <span className="text-white">6.5 hrs</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-300">Mileage:</span>
                          <span className="text-white">42 mi</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* NTE Workflow Section */}
        <section className="py-20 bg-slate-900/50">
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                NTE Workflows Built for CBRE
              </h2>
              <p className="text-blue-200 mb-12">
                We understand the quote and approval process. Techs can request increases from the field, 
                and office staff track approval status through to completion.
              </p>

              <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
                <div className="bg-slate-800 rounded-lg px-6 py-4 text-center">
                  <div className="text-2xl mb-2">📝</div>
                  <div className="text-white font-medium">Request</div>
                  <div className="text-slate-400 text-sm">Tech submits from field</div>
                </div>
                <div className="text-blue-400 text-2xl hidden md:block">→</div>
                <div className="bg-slate-800 rounded-lg px-6 py-4 text-center">
                  <div className="text-2xl mb-2">📤</div>
                  <div className="text-white font-medium">Submit</div>
                  <div className="text-slate-400 text-sm">Office sends to CBRE</div>
                </div>
                <div className="text-blue-400 text-2xl hidden md:block">→</div>
                <div className="bg-slate-800 rounded-lg px-6 py-4 text-center">
                  <div className="text-2xl mb-2">✅</div>
                  <div className="text-white font-medium">Approved</div>
                  <div className="text-slate-400 text-sm">Work continues</div>
                </div>
                <div className="text-blue-400 text-2xl hidden md:block">→</div>
                <div className="bg-slate-800 rounded-lg px-6 py-4 text-center">
                  <div className="text-2xl mb-2">🧾</div>
                  <div className="text-white font-medium">Invoice</div>
                  <div className="text-slate-400 text-sm">All costs tracked</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20">
          <div className="container mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Simple, Transparent Pricing
              </h2>
              <p className="text-blue-200">
                No hidden fees. No per-user charges that explode as you grow.
              </p>
            </div>

            <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
              {/* Starter Plan */}
              <div className="bg-slate-800 rounded-xl p-8 border border-slate-700">
                <div className="text-blue-400 font-medium mb-2">Starter</div>
                <div className="text-4xl font-bold text-white mb-1">
                  $199<span className="text-lg text-slate-400">/month</span>
                </div>
                <div className="text-slate-400 mb-6">Up to 10 technicians</div>
                <ul className="space-y-3 mb-8">
                  {[
                    'Unlimited work orders',
                    'Dashboard & mobile app',
                    'Cost tracking & invoicing',
                    'Email notifications',
                    'Calendar scheduling',
                    'Photo uploads',
                    'Basic reporting'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-slate-300 text-sm">
                      <span className="text-green-400">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <a 
                  href="#contact"
                  className="block text-center bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-medium transition"
                >
                  Get Started
                </a>
              </div>

              {/* Professional Plan */}
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-8 relative">
                <div className="absolute top-0 right-0 bg-yellow-400 text-slate-900 text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-xl">
                  MOST POPULAR
                </div>
                <div className="text-blue-200 font-medium mb-2">Professional</div>
                <div className="text-4xl font-bold text-white mb-1">
                  $399<span className="text-lg text-blue-200">/month</span>
                </div>
                <div className="text-blue-200 mb-6">Unlimited technicians</div>
                <ul className="space-y-3 mb-8">
                  {[
                    'Everything in Starter',
                    'Unlimited technicians',
                    'SMS notifications',
                    'Aging reports & alerts',
                    'CBRE quote workflow',
                    'Offline mode',
                    'QuickBooks integration',
                    'Priority support'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-white text-sm">
                      <span className="text-green-300">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <a 
                  href="#contact"
                  className="block text-center bg-white hover:bg-blue-50 text-blue-600 py-3 rounded-lg font-bold transition"
                >
                  Get Started
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section id="contact" className="py-20 bg-blue-600">
          <div className="container mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Ready to Streamline Your Operation?
            </h2>
            <p className="text-blue-100 mb-8 max-w-2xl mx-auto">
              See how PCS FieldService can help your team work smarter. Try the demo or schedule a call.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="/demo"
                className="bg-white hover:bg-blue-50 text-blue-600 px-8 py-4 rounded-lg font-semibold text-lg transition"
              >
                Try Interactive Demo
              </a>
              <a 
                href="mailto:info@pcsolutions.com?subject=PCS FieldService Inquiry"
                className="border-2 border-white text-white hover:bg-white/10 px-8 py-4 rounded-lg font-semibold text-lg transition"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-slate-900 py-12 border-t border-slate-800">
          <div className="container mx-auto px-6">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="flex items-center gap-3 mb-4 md:mb-0">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">P</span>
                </div>
                <span className="text-white font-semibold">PCS FieldService</span>
              </div>
              <div className="text-slate-400 text-sm">
                © 2024 Professional Commercial Solutions LLC. All rights reserved.
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
