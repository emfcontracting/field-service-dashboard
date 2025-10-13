'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function MobileDashboard() {
  const [user, setUser] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);
  const supabase = createClientComponentClient();

  useEffect(() => {
    // Check if user is logged in
    const userData = localStorage.getItem('mobile_user');
    if (!userData) {
      window.location.href = '/mobile/login';
      return;
    }
    setUser(JSON.parse(userData));
    fetchWorkOrders(JSON.parse(userData).user_id);
  }, []);

  const fetchWorkOrders = async (userId) => {
    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .eq('lead_tech_id', userId)
      .order('created_at', { ascending: false });

    if (data) setWorkOrders(data);
  };

  const handleLogout = () => {
    localStorage.removeItem('mobile_user');
    window.location.href = '/mobile/login';
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-blue-600 text-white p-6 shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Welcome back,</h1>
            <p className="text-blue-100">{user.first_name}</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg font-semibold"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl shadow">
            <p className="text-gray-500 text-sm">Active Jobs</p>
            <p className="text-3xl font-bold text-blue-600">
              {workOrders.filter(wo => wo.status !== 'completed').length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow">
            <p className="text-gray-500 text-sm">Completed</p>
            <p className="text-3xl font-bold text-green-600">
              {workOrders.filter(wo => wo.status === 'completed').length}
            </p>
          </div>
        </div>

        {/* Work Orders List */}
        <h2 className="text-xl font-bold mb-4">My Work Orders</h2>
        <div className="space-y-3">
          {workOrders.length === 0 ? (
            <div className="bg-white p-8 rounded-xl shadow text-center">
              <p className="text-gray-500">No work orders assigned yet</p>
            </div>
          ) : (
            workOrders.map((wo) => (
              <div
                key={wo.wo_id}
                className="bg-white p-4 rounded-xl shadow-md active:bg-gray-50 cursor-pointer"
                onClick={() => window.location.href = `/mobile/work-order/${wo.wo_id}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-bold text-lg">WO #{wo.wo_number}</p>
                    <p className="text-sm text-gray-600">{wo.building}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    wo.status === 'completed' ? 'bg-green-100 text-green-700' :
                    wo.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {wo.status?.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{wo.work_order_description}</p>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Priority: {wo.priority}</span>
                  <span>{new Date(wo.date_entered).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Settings Link */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <button
          onClick={() => window.location.href = '/mobile/settings'}
          className="w-full bg-gray-100 hover:bg-gray-200 px-4 py-3 rounded-xl font-semibold text-gray-700"
        >
          ⚙️ Settings (Change PIN)
        </button>
      </div>
    </div>
  );
}