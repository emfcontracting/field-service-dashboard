// app/page.js - Updated with password authentication
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

const supabase = getSupabase();

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('auth_id', user.id)
        .single();

      if (userData && ['admin', 'office_staff'].includes(userData.role)) {
        router.push('/dashboard');
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      {/* Navigation Bar */}
      <nav className="bg-gray-900 bg-opacity-50 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <img 
                src="/emf-logo.png" 
                alt="EMF" 
                className="h-10 w-auto"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              <span className="text-white font-bold text-xl">EMF Contracting LLC</span>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => router.push('/login')}
                className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-semibold text-white transition"
              >
                Admin/Office Login
              </button>
              <button
                onClick={() => router.push('/mobile')}
                className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-semibold text-white transition"
              >
                Field Workers →
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              Field Service Management
              <span className="text-blue-400"> Simplified</span>
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Streamline your work orders, track field operations, and manage your team with our
              comprehensive field service management platform.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => router.push('/login')}
                className="bg-blue-600 hover:bg-blue-700 px-8 py-4 rounded-lg font-bold text-lg text-white transition shadow-lg"
              >
                Admin/Office Login →
              </button>
              <button
                onClick={() => router.push('/mobile')}
                className="bg-green-600 hover:bg-green-700 px-8 py-4 rounded-lg font-bold text-lg text-white transition shadow-lg"
              >
                Field Workers App →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="py-20 bg-gray-900 bg-opacity-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              Everything You Need to Manage Field Operations
            </h2>
            <p className="text-gray-400">
              Powerful features designed for contracting businesses
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-gray-800 bg-opacity-50 backdrop-blur-sm rounded-lg p-6 border border-gray-700">
              <div className="text-blue-400 text-4xl mb-4">📋</div>
              <h3 className="text-xl font-bold text-white mb-2">Work Order Management</h3>
              <p className="text-gray-400">
                Create, assign, and track work orders from creation to completion with real-time status updates.
              </p>
            </div>
            <div className="bg-gray-800 bg-opacity-50 backdrop-blur-sm rounded-lg p-6 border border-gray-700">
              <div className="text-green-400 text-4xl mb-4">📱</div>
              <h3 className="text-xl font-bold text-white mb-2">Mobile Field App</h3>
              <p className="text-gray-400">
                Field workers can check in/out, update progress, and submit time & materials from their phones.
              </p>
            </div>
            <div className="bg-gray-800 bg-opacity-50 backdrop-blur-sm rounded-lg p-6 border border-gray-700">
              <div className="text-purple-400 text-4xl mb-4">💰</div>
              <h3 className="text-xl font-bold text-white mb-2">Invoicing & Billing</h3>
              <p className="text-gray-400">
                Automatic cost calculations with markups, invoice generation, and budget tracking.
              </p>
            </div>
            <div className="bg-gray-800 bg-opacity-50 backdrop-blur-sm rounded-lg p-6 border border-gray-700">
              <div className="text-yellow-400 text-4xl mb-4">📅</div>
              <h3 className="text-xl font-bold text-white mb-2">Availability Tracking</h3>
              <p className="text-gray-400">
                Track daily worker availability for scheduled and emergency work assignments.
              </p>
            </div>
            <div className="bg-gray-800 bg-opacity-50 backdrop-blur-sm rounded-lg p-6 border border-gray-700">
              <div className="text-red-400 text-4xl mb-4">👥</div>
              <h3 className="text-xl font-bold text-white mb-2">Team Management</h3>
              <p className="text-gray-400">
                Manage technicians, helpers, and lead techs with role-based access control.
              </p>
            </div>
            <div className="bg-gray-800 bg-opacity-50 backdrop-blur-sm rounded-lg p-6 border border-gray-700">
              <div className="text-cyan-400 text-4xl mb-4">📊</div>
              <h3 className="text-xl font-bold text-white mb-2">Real-time Analytics</h3>
              <p className="text-gray-400">
                Track performance metrics, costs, and productivity with comprehensive reporting.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Access Info Section */}
      <div className="py-16 bg-gray-800 bg-opacity-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center text-white mb-8">
            Access Information
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-blue-900 bg-opacity-50 rounded-lg p-6 border border-blue-700">
              <h3 className="text-xl font-bold text-blue-300 mb-3">🏢 Admin & Office Users</h3>
              <ul className="text-gray-300 space-y-2 text-sm">
                <li>• Access the web dashboard for full management</li>
                <li>• View all work orders and invoicing</li>
                <li>• Manage users and settings</li>
                <li>• Track availability and costs</li>
                <li>• Secure individual passwords</li>
              </ul>
            </div>
            <div className="bg-green-900 bg-opacity-50 rounded-lg p-6 border border-green-700">
              <h3 className="text-xl font-bold text-green-300 mb-3">🔧 Field Workers</h3>
              <ul className="text-gray-300 space-y-2 text-sm">
                <li>• Use the mobile app for field operations</li>
                <li>• Check in/out of work orders</li>
                <li>• Update time and materials</li>
                <li>• Submit daily availability</li>
                <li>• Login with email and 4-digit PIN</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="text-gray-400">
              © 2025 PCS LLC. All rights reserved.
            </div>
            <div className="flex gap-6 text-gray-400">
              <button 
                onClick={() => router.push('/mobile')} 
                className="hover:text-white transition"
              >
                Mobile App
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}