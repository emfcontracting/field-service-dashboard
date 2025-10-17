// app/page.js - Updated with standard password authentication
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LandingPage() {
  const router = useRouter();
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Standard password for admin/office users
  const STANDARD_PASSWORD = 'admin123';

  // Check if user is already logged in
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Check localStorage for saved session
      const savedEmail = localStorage.getItem('dashboardEmail');
      const savedPassword = localStorage.getItem('dashboardPassword');
      
      if (savedEmail && savedPassword === STANDARD_PASSWORD) {
        // Verify user still exists and is active
        const { data: userData, error } = await supabase
          .from('users')
          .select('*')
          .eq('email', savedEmail)
          .eq('is_active', true)
          .single();

        if (userData && ['admin', 'office'].includes(userData.role)) {
          setIsAuthenticated(true);
          setCurrentUser(userData);
        } else {
          // Clear invalid session
          localStorage.removeItem('dashboardEmail');
          localStorage.removeItem('dashboardPassword');
        }
      }
    } catch (err) {
      console.error('Auth check error:', err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Check if password matches standard password
      if (password !== STANDARD_PASSWORD) {
        throw new Error('Invalid password. Please contact administrator.');
      }

      // Get user from database by email
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (userError || !userData) {
        throw new Error('User not found. Please check your email address.');
      }

      if (!userData.is_active) {
        throw new Error('Your account is inactive. Please contact administrator.');
      }

      // Check role-based access
      const allowedRoles = ['admin', 'office'];
      if (!allowedRoles.includes(userData.role)) {
        throw new Error('Access denied. Field workers should use the Mobile App.');
      }

      // Save to localStorage for session persistence
      localStorage.setItem('dashboardEmail', email.toLowerCase());
      localStorage.setItem('dashboardPassword', password);
      localStorage.setItem('dashboardUser', JSON.stringify(userData));

      // Set authenticated state
      setIsAuthenticated(true);
      setCurrentUser(userData);

      // Redirect to dashboard
      router.push('/dashboard');
      
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    // Clear localStorage
    localStorage.removeItem('dashboardEmail');
    localStorage.removeItem('dashboardPassword');
    localStorage.removeItem('dashboardUser');
    
    setIsAuthenticated(false);
    setCurrentUser(null);
    setShowLogin(false);
  };

  // If not showing login modal, show landing page
  if (!showLogin) {
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
                {isAuthenticated ? (
                  <>
                    <div className="flex items-center gap-2 text-white">
                      <span className="text-sm text-gray-400">Welcome,</span>
                      <span className="font-semibold">{currentUser?.first_name}</span>
                      <span className="px-2 py-1 bg-blue-600 rounded text-xs">
                        {currentUser?.role?.toUpperCase()}
                      </span>
                    </div>
                    <button
                      onClick={() => router.push('/dashboard')}
                      className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-semibold text-white transition"
                    >
                      Go to Dashboard
                    </button>
                    <button
                      onClick={handleLogout}
                      className="bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded-lg font-semibold text-white transition"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setShowLogin(true)}
                      className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-semibold text-white transition"
                    >
                      Admin/Office Login
                    </button>
                    <a
                      href="/mobile"
                      className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-semibold text-white transition"
                    >
                      Field Workers →
                    </a>
                  </>
                )}
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
                Streamline your work orders, track field operations, and manage your team 
                with our comprehensive field service management platform.
              </p>
              <div className="flex gap-4 justify-center">
                {isAuthenticated ? (
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="bg-blue-600 hover:bg-blue-700 px-8 py-4 rounded-lg font-bold text-lg text-white transition transform hover:scale-105"
                  >
                    Open Dashboard →
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setShowLogin(true)}
                      className="bg-blue-600 hover:bg-blue-700 px-8 py-4 rounded-lg font-bold text-lg text-white transition transform hover:scale-105"
                    >
                      Admin/Office Login →
                    </button>
                    <a
                      href="/mobile"
                      className="bg-green-600 hover:bg-green-700 px-8 py-4 rounded-lg font-bold text-lg text-white transition transform hover:scale-105"
                    >
                      Field Workers App →
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="py-20 bg-gray-900 bg-opacity-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center text-white mb-12">
              Everything You Need to Manage Field Operations
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
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
                  <li>• Password: Contact administrator</li>
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
                © 2024 EMF Contracting LLC. All rights reserved.
              </div>
              <div className="flex gap-6 text-gray-400">
                {isAuthenticated && (
                  <a href="/dashboard" className="hover:text-white transition">Dashboard</a>
                )}
                <a href="/mobile" className="hover:text-white transition">Mobile App</a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // Login Modal
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="bg-white w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg p-3">
            <img 
              src="/emf-logo.png" 
              alt="EMF Contracting LLC" 
              className="w-full h-full object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = '<div class="text-2xl font-bold text-gray-800">EMF</div>';
              }}
            />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard Login</h1>
          <p className="text-gray-300">Admin & Office Access Only</p>
        </div>

        {/* Login Form */}
        <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-gray-700">
          <form onSubmit={handleLogin}>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@emfcontracting.com"
                className="w-full px-4 py-3 text-white bg-gray-800 bg-opacity-50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                required
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1">
                Use your registered email address
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-3 text-white bg-gray-800 bg-opacity-50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                Standard password for all admin/office users
              </p>
            </div>

            {error && (
              <div className="mb-6 p-3 bg-red-900 bg-opacity-50 border border-red-600 rounded-lg">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed py-3 rounded-lg text-white font-bold text-lg transition transform hover:scale-105"
            >
              {loading ? 'Verifying...' : 'Login to Dashboard'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-700">
            <div className="text-center">
              <button
                onClick={() => setShowLogin(false)}
                className="text-gray-400 hover:text-white transition text-sm"
              >
                ← Back to Home
              </button>
            </div>
            <div className="mt-4 text-center">
              <p className="text-gray-400 text-sm mb-2">Field Worker?</p>
              <a
                href="/mobile"
                className="inline-block bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg text-white font-semibold transition"
              >
                Open Mobile App →
              </a>
            </div>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm">
            Forgot password? Contact your system administrator
          </p>
          <p className="text-gray-500 text-xs mt-2">
            Default password: admin123
          </p>
        </div>
      </div>
    </div>
  );
}