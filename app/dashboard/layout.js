// app/dashboard/layout.js
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/login');
      } else if (event === 'SIGNED_IN') {
        checkAuth();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function checkAuth() {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push('/login');
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', user.id)
        .eq('is_active', true)
        .single();

      if (userError || !userData) {
        await supabase.auth.signOut();
        router.push('/login');
        return;
      }

      if (!['admin', 'office_staff'].includes(userData.role)) {
        await supabase.auth.signOut();
        alert('Access denied. Field workers should use the Mobile App.');
        router.push('/login');
        return;
      }

      setUserInfo(userData);
      setAuthenticated(true);
    } catch (error) {
      console.error('Auth check error:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* User info bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Logged in as: <span className="text-gray-900 font-semibold">
              {userInfo?.first_name} {userInfo?.last_name}
            </span>
            <span className="ml-2 px-2 py-1 bg-blue-600 rounded text-xs text-white">
              {userInfo?.role?.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => router.push('/settings')}
              className="text-gray-600 hover:text-gray-900 text-sm font-medium transition"
            >
              ⚙️ Settings
            </button>
            <button
              onClick={handleLogout}
              className="text-red-600 hover:text-red-700 text-sm font-medium transition"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
      
      {/* Dashboard content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}