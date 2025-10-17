// app/dashboard/layout.js
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  
  // Standard password for admin/office users
  const STANDARD_PASSWORD = 'admin123';

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Check localStorage for session
      const savedEmail = localStorage.getItem('dashboardEmail');
      const savedPassword = localStorage.getItem('dashboardPassword');
      
      if (!savedEmail || savedPassword !== STANDARD_PASSWORD) {
        // Not logged in or invalid password, redirect to home/login
        router.push('/');
        return;
      }

      // Get user from database
      const { data: userData, error } = await supabase
        .from('users')
        .select('user_id, email, role, first_name, last_name, is_active')
        .eq('email', savedEmail)
        .single();

      if (error || !userData) {
        console.error('User not found in database');
        // Clear invalid session
        localStorage.removeItem('dashboardEmail');
        localStorage.removeItem('dashboardPassword');
        localStorage.removeItem('dashboardUser');
        router.push('/');
        return;
      }

      // Check if user is active
      if (!userData.is_active) {
        alert('Your account is inactive. Please contact administrator.');
        // Clear session
        localStorage.removeItem('dashboardEmail');
        localStorage.removeItem('dashboardPassword');
        localStorage.removeItem('dashboardUser');
        router.push('/');
        return;
      }

      // Check role-based access
      const allowedRoles = ['admin', 'office'];
      if (!allowedRoles.includes(userData.role)) {
        // User doesn't have permission
        alert('Access Denied: Field workers should use the Mobile App.');
        // Clear session
        localStorage.removeItem('dashboardEmail');
        localStorage.removeItem('dashboardPassword');
        localStorage.removeItem('dashboardUser');
        router.push('/');
        return;
      }

      // User is authorized
      setUserInfo(userData);
      setAuthorized(true);
    } catch (err) {
      console.error('Auth check error:', err);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    // Clear all session data
    localStorage.removeItem('dashboardEmail');
    localStorage.removeItem('dashboardPassword');
    localStorage.removeItem('dashboardUser');
    // Redirect to home
    router.push('/');
  };

  // Show loading screen while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Show unauthorized screen (this shouldn't normally appear due to redirects)
  if (!authorized) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center bg-red-900 bg-opacity-50 p-8 rounded-lg">
          <h2 className="text-2xl font-bold text-white mb-4">Access Denied</h2>
          <p className="text-gray-300 mb-6">
            You don't have permission to access the dashboard.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => router.push('/')}
              className="block w-full bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold text-white transition"
            >
              Go to Home
            </button>
            <button
              onClick={() => router.push('/mobile')}
              className="block w-full bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-semibold text-white transition"
            >
              Open Mobile App
            </button>
          </div>
        </div>
      </div>
    );
  }

  // User is authorized, show dashboard with user info
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* User info bar at the top */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-2">
        <div className="max-w-7xl mx-auto flex justify-between items-center text-sm">
          <div className="text-gray-400">
            Logged in as: <span className="text-white font-semibold">
              {userInfo?.first_name} {userInfo?.last_name}
            </span>
            <span className="ml-2 px-2 py-1 bg-blue-600 rounded text-xs text-white">
              {userInfo?.role?.toUpperCase()}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-white transition"
          >
            Logout
          </button>
        </div>
      </div>
      
      {/* Render dashboard content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 text-center py-4 text-sm border-t border-gray-700 mt-auto">
        <div className="container mx-auto px-4">
          <p className="text-xs text-gray-500">
            © 2025 PCS LLC. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}