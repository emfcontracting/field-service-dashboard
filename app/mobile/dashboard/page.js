'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function MobileDashboard() {
  const [user, setUser] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    try {
      // Get work orders where user is lead tech AND assigned to field
      const { data: leadTechWOs, error: leadError } = await supabase
        .from('work_orders')
        .select('*')
        .eq('lead_tech_id', userId)
        .eq('assigned_to_field', true)
        .order('created_at', { ascending: false });

      if (leadError) {
        console.error('Error fetching lead tech work orders:', leadError);
      }

      // Get work orders where user is assigned as team member
      const { data: assignments, error: assignError } = await supabase
        .from('work_order_assignments')
        .select('wo_id')
        .eq('user_id', userId);

      if (assignError) {
        console.error('Error fetching assignments:', assignError);
      }

      // Get the full work order details for assignments
      let assignedWOs = [];
      if (assignments && assignments.length > 0) {
        const woIds = assignments.map(a => a.wo_id);
        const { data: assignedWOData, error: assignedError } = await supabase
          .from('work_orders')
          .select('*')
          .in('wo_id', woIds)
          .order('created_at', { ascending: false });

        if (assignedError) {
          console.error('Error fetching assigned work orders:', assignedError);
        } else {
          assignedWOs = assignedWOData || [];
        }
      }

      // Combine and deduplicate work orders
      const allWOs = [...(leadTechWOs || []), ...assignedWOs];
      const uniqueWOs = Array.from(
        new Map(allWOs.map(wo => [wo.wo_id, wo])).values()
      );

      // Sort by date
      uniqueWOs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setWorkOrders(uniqueWOs);
    } catch (err) {
      console.error('Error fetching work orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('mobile_user');
    window.location.href = '/mobile/login';
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <div className="bg-blue-600 text-white p-6 shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Welcome back,</h1>
            <p className="text-blue-100">{user.first_name}</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg font-semibold active:bg-blue-900 transition"
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
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">My Work Orders</h2>
          <button
            onClick={() => fetchWorkOrders(user.user_id)}
            disabled={loading}
            className="bg-blue-100 hover:bg-blue-200 text-blue-600 px-3 py-1 rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {loading ? '⏳' : '🔄'} Refresh
          </button>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="bg-white p-8 rounded-xl shadow text-center">
              <p className="text-gray-500">Loading work orders...</p>
            </div>
          ) : workOrders.length === 0 ? (
            <div className="bg-white p-8 rounded-xl shadow text-center">
              <p className="text-gray-500">No work orders assigned yet</p>
              <p className="text-xs text-gray-400 mt-2">
                Work orders will appear here when assigned to you
              </p>
            </div>
          ) : (
            workOrders.map((wo) => (
              <div
                key={wo.wo_id}
                className="bg-white p-4 rounded-xl shadow-md active:bg-gray-50 cursor-pointer transition"
                onClick={() => window.location.href = `/mobile/work-order/${wo.wo_id}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-bold text-lg">WO #{wo.wo_number}</p>
                    <p className="text-sm text-gray-600">{wo.building}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      wo.status === 'completed' ? 'bg-green-100 text-green-700' :
                      wo.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {wo.status?.replace('_', ' ').toUpperCase()}
                    </span>
                    {wo.lead_tech_id === user.user_id && (
                      <span className="text-xs text-blue-600 font-semibold">
                        LEAD
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-700 mb-2 line-clamp-2">{wo.work_order_description}</p>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Priority: <span className="font-semibold">{wo.priority}</span></span>
                  <span>{new Date(wo.date_entered).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="grid grid-cols-2 gap-2 p-4">
          <button
            onClick={() => fetchWorkOrders(user.user_id)}
            className="bg-blue-100 hover:bg-blue-200 text-blue-600 px-4 py-3 rounded-xl font-semibold active:bg-blue-300 transition"
          >
            🔄 Refresh
          </button>
          <button
            onClick={() => window.location.href = '/mobile/settings'}
            className="bg-gray-100 hover:bg-gray-200 px-4 py-3 rounded-xl font-semibold text-gray-700 active:bg-gray-300 transition"
          >
            ⚙️ Settings
          </button>
        </div>
      </div>
    </div>
  );
}