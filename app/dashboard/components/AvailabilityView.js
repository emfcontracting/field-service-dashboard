// app/dashboard/components/AvailabilityView.js
'use client';

import { useState, useEffect } from 'react';

// Helper function to get local date string (YYYY-MM-DD) without timezone issues
const getLocalDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper function to parse date string as local date
const parseLocalDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export default function AvailabilityView({ supabase, users }) {
  const [availabilityData, setAvailabilityData] = useState({});
  const [selectedAvailDate, setSelectedAvailDate] = useState(() => {
    // Initialize with today's date at midnight local time
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [availLoading, setAvailLoading] = useState(false);

  useEffect(() => {
    loadAvailabilityData();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('availability-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_availability'
        },
        () => {
          loadAvailabilityData();
        }
      )
      .subscribe();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadAvailabilityData();
    }, 30000);
    
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [selectedAvailDate]);

  const loadAvailabilityData = async () => {
    setAvailLoading(true);
    try {
      // Get all techs and helpers
      const { data: techUsers } = await supabase
        .from('users')
        .select('user_id, first_name, last_name, role, email, phone')
        .in('role', ['tech', 'helper', 'lead_tech'])
        .eq('is_active', true)
        .order('role')
        .order('first_name');

      // Get availability for selected date
      const dateStr = getLocalDateString(selectedAvailDate);
      const { data: availability } = await supabase
        .from('daily_availability')
        .select('*')
        .eq('availability_date', dateStr);

      // Combine and group by role
      const combined = (techUsers || []).map(user => {
        const userAvail = availability?.find(a => a.user_id === user.user_id);
        return {
          ...user,
          submitted: !!userAvail,
          scheduled_work: userAvail?.scheduled_work || false,
          emergency_work: userAvail?.emergency_work || false,
          not_available: userAvail?.not_available || false,
          submitted_at: userAvail?.submitted_at
        };
      });

      const grouped = {
        lead_tech: combined.filter(u => u.role === 'lead_tech'),
        tech: combined.filter(u => u.role === 'tech'),
        helper: combined.filter(u => u.role === 'helper')
      };

      setAvailabilityData(grouped);
    } catch (err) {
      console.error('Error loading availability:', err);
    } finally {
      setAvailLoading(false);
    }
  };

  const getAvailabilityStats = () => {
    const allUsers = [
      ...(availabilityData.lead_tech || []), 
      ...(availabilityData.tech || []), 
      ...(availabilityData.helper || [])
    ];
    
    return {
      total: allUsers.length,
      submitted: allUsers.filter(u => u.submitted).length,
      fullyAvailable: allUsers.filter(u => u.scheduled_work && u.emergency_work).length,
      scheduledOnly: allUsers.filter(u => u.scheduled_work && !u.emergency_work && !u.not_available).length,
      emergencyOnly: allUsers.filter(u => !u.scheduled_work && u.emergency_work && !u.not_available).length,
      notAvailable: allUsers.filter(u => u.not_available).length,
      pending: allUsers.filter(u => !u.submitted).length
    };
  };

  const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const formatAvailTime = (timestamp) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getAvailabilityStatus = (user) => {
    if (!user.submitted) {
      return { text: '⏰ Pending', color: 'text-yellow-400', bgColor: 'bg-yellow-900' };
    }
    if (user.not_available) {
      return { text: '🚫 Not Available', color: 'text-red-400', bgColor: 'bg-red-900' };
    }
    if (user.scheduled_work && user.emergency_work) {
      return { text: '✅ Fully Available', color: 'text-green-400', bgColor: 'bg-green-900' };
    }
    if (user.scheduled_work) {
      return { text: '📅 Scheduled Only', color: 'text-blue-400', bgColor: 'bg-blue-900' };
    }
    if (user.emergency_work) {
      return { text: '🚨 Emergency Only', color: 'text-orange-400', bgColor: 'bg-orange-900' };
    }
    return { text: 'Unknown', color: 'text-gray-400', bgColor: 'bg-gray-700' };
  };

  const renderUserRow = (user) => {
    const status = getAvailabilityStatus(user);
    return (
      <div key={user.user_id} className="px-4 py-3 hover:bg-gray-750 border-t border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-48">
              <div className="font-semibold">{user.first_name} {user.last_name}</div>
              <div className="text-xs text-gray-400">{user.email}</div>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-semibold ${status.bgColor} ${status.color}`}>
              {status.text}
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex gap-4">
              <span className={user.scheduled_work ? 'text-blue-400' : 'text-gray-600'}>
                {user.scheduled_work ? '✓ Scheduled' : '○ Scheduled'}
              </span>
              <span className={user.emergency_work ? 'text-orange-400' : 'text-gray-600'}>
                {user.emergency_work ? '✓ Emergency' : '○ Emergency'}
              </span>
              <span className={user.not_available ? 'text-red-400' : 'text-gray-600'}>
                {user.not_available ? '✓ Not Available' : '○ Not Available'}
              </span>
            </div>
            <div className="text-gray-400 w-24 text-right">
              {formatAvailTime(user.submitted_at)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const stats = getAvailabilityStats();

  return (
    <div className="space-y-6">
      {/* Date Navigation */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Daily Availability Tracker</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                const newDate = new Date(selectedAvailDate);
                newDate.setDate(newDate.getDate() - 1);
                setSelectedAvailDate(newDate);
              }}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg"
            >
              ←
            </button>
            <input
              type="date"
              value={getLocalDateString(selectedAvailDate)}
              onChange={(e) => setSelectedAvailDate(parseLocalDate(e.target.value))}
              className="bg-gray-700 text-white px-4 py-2 rounded-lg"
            />
            <button
              onClick={() => {
                const newDate = new Date(selectedAvailDate);
                newDate.setDate(newDate.getDate() + 1);
                setSelectedAvailDate(newDate);
              }}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg"
            >
              →
            </button>
            <button
              onClick={() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                setSelectedAvailDate(today);
              }}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
            >
              Today
            </button>
            <button
              onClick={loadAvailabilityData}
              disabled={availLoading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded-lg"
            >
              {availLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-400">
            {selectedAvailDate.toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
            {isWeekend(selectedAvailDate) && (
              <span className="ml-2 text-yellow-400">(Weekend - No tracking required)</span>
            )}
          </div>
          <div className="text-sm text-gray-400">
            Auto-refresh: Every 30 seconds
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-7 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-sm text-gray-400">Total Workers</div>
        </div>
        <div className="bg-green-900 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-400">{stats.submitted}</div>
          <div className="text-sm text-green-300">Submitted</div>
        </div>
        <div className="bg-green-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-300">{stats.fullyAvailable}</div>
          <div className="text-sm text-green-200">✅ Fully Available</div>
        </div>
        <div className="bg-blue-900 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{stats.scheduledOnly}</div>
          <div className="text-sm text-blue-300">📅 Scheduled</div>
        </div>
        <div className="bg-orange-900 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-orange-400">{stats.emergencyOnly}</div>
          <div className="text-sm text-orange-300">🚨 Emergency</div>
        </div>
        <div className="bg-red-900 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-400">{stats.notAvailable}</div>
          <div className="text-sm text-red-300">🚫 Not Available</div>
        </div>
        <div className="bg-yellow-900 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
          <div className="text-sm text-yellow-300">⏰ Pending</div>
        </div>
      </div>

      {/* Availability by Role */}
      <div className="space-y-6">
        {/* Lead Techs */}
        {availabilityData.lead_tech?.length > 0 && (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="bg-purple-700 px-4 py-3">
              <h3 className="font-bold text-lg">Lead Technicians</h3>
            </div>
            <div>
              {availabilityData.lead_tech.map(renderUserRow)}
            </div>
          </div>
        )}

        {/* Technicians */}
        {availabilityData.tech?.length > 0 && (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="bg-blue-700 px-4 py-3">
              <h3 className="font-bold text-lg">Technicians</h3>
            </div>
            <div>
              {availabilityData.tech.map(renderUserRow)}
            </div>
          </div>
        )}

        {/* Helpers */}
        {availabilityData.helper?.length > 0 && (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="bg-gray-700 px-4 py-3">
              <h3 className="font-bold text-lg">Helpers</h3>
            </div>
            <div>
              {availabilityData.helper.map(renderUserRow)}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!availLoading && 
         (!availabilityData.lead_tech?.length && 
          !availabilityData.tech?.length && 
          !availabilityData.helper?.length) && (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400">No field workers found</p>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-yellow-900 rounded-lg p-4">
        <div className="text-yellow-300 font-bold mb-2 flex items-center gap-2">
          <span className="text-xl">⚠️</span>
          <span>Daily Availability Requirements</span>
        </div>
        <ul className="text-sm text-yellow-200 space-y-1 ml-7">
          <li>• Workers must submit availability by 8:00 PM EST daily (Monday-Friday)</li>
          <li>• Weekend submissions (Saturday & Sunday) are not required</li>
          <li>• Mobile app locks after 8:00 PM if availability not submitted</li>
          <li>• Workers can select: Scheduled Work, Emergency Work, both, or Not Available</li>
          <li>• Use the date navigation to view historical availability data</li>
        </ul>
      </div>
    </div>
  );
}