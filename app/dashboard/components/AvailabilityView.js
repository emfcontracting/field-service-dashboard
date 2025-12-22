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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [availLoading, setAvailLoading] = useState(false);

  useEffect(() => {
    loadAvailabilityData();
    
    const channel = supabase
      .channel('availability-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_availability' },
        () => loadAvailabilityData()
      )
      .subscribe();
    
    const interval = setInterval(() => loadAvailabilityData(), 30000);
    
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [selectedAvailDate]);

  const loadAvailabilityData = async () => {
    setAvailLoading(true);
    try {
      const { data: techUsers } = await supabase
        .from('users')
        .select('user_id, first_name, last_name, role, email, phone')
        .in('role', ['tech', 'helper', 'lead_tech'])
        .eq('is_active', true)
        .order('role')
        .order('first_name');

      const dateStr = getLocalDateString(selectedAvailDate);
      const { data: availability } = await supabase
        .from('daily_availability')
        .select('*')
        .eq('availability_date', dateStr);

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

  const getAvailabilityStatus = (user) => {
    if (!user.submitted) {
      return { text: 'Pending', icon: '⏰', color: 'text-yellow-400', bgColor: 'bg-yellow-900/70' };
    }
    if (user.not_available) {
      return { text: 'Not Available', icon: '🚫', color: 'text-red-400', bgColor: 'bg-red-900/70' };
    }
    if (user.scheduled_work && user.emergency_work) {
      return { text: 'Fully Available', icon: '✅', color: 'text-green-400', bgColor: 'bg-green-900/70' };
    }
    if (user.scheduled_work) {
      return { text: 'Scheduled Only', icon: '📅', color: 'text-blue-400', bgColor: 'bg-blue-900/70' };
    }
    if (user.emergency_work) {
      return { text: 'Emergency Only', icon: '🚨', color: 'text-orange-400', bgColor: 'bg-orange-900/70' };
    }
    return { text: 'Unknown', icon: '?', color: 'text-gray-400', bgColor: 'bg-gray-700' };
  };

  // Mobile-friendly user row
  const renderUserRow = (user) => {
    const status = getAvailabilityStatus(user);
    
    // Format submitted time
    const getSubmittedTime = () => {
      if (!user.submitted_at) return null;
      const date = new Date(user.submitted_at);
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    };
    
    const submittedTime = getSubmittedTime();
    
    return (
      <div key={user.user_id} className="px-3 md:px-4 py-2 md:py-3 hover:bg-gray-750 border-t border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          {/* Name and Email */}
          <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
            <div className="min-w-0 flex-1 md:w-48 md:flex-none">
              <div className="font-semibold text-sm md:text-base truncate">{user.first_name} {user.last_name}</div>
              <div className="text-[10px] md:text-xs text-gray-400 truncate">{user.email}</div>
            </div>
            {/* Status badge */}
            <div className={`px-2 md:px-3 py-0.5 md:py-1 rounded-full text-xs md:text-sm font-semibold ${status.bgColor} ${status.color} flex-shrink-0`}>
              <span className="mr-1">{status.icon}</span>
              <span className="hidden sm:inline">{status.text}</span>
            </div>
          </div>
          
          {/* Availability details */}
          <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm">
            {/* Submitted time - always show if submitted */}
            {user.submitted && submittedTime && (
              <span className="text-gray-400 text-[10px] md:text-xs">
                🕒 {submittedTime}
              </span>
            )}
            {/* Scheduled/Emergency indicators - hidden on small mobile */}
            <div className="hidden md:flex items-center gap-4">
              <span className={user.scheduled_work ? 'text-blue-400' : 'text-gray-600'}>
                {user.scheduled_work ? '✓' : '○'} Scheduled
              </span>
              <span className={user.emergency_work ? 'text-orange-400' : 'text-gray-600'}>
                {user.emergency_work ? '✓' : '○'} Emergency
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const stats = getAvailabilityStats();

  return (
    <div className="space-y-3 md:space-y-6">
      {/* Date Navigation */}
      <div className="bg-gray-800 rounded-lg p-3 md:p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
          <h2 className="text-base md:text-xl font-bold">Daily Availability Tracker</h2>
          
          {/* Date controls - scrollable on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => {
                const newDate = new Date(selectedAvailDate);
                newDate.setDate(newDate.getDate() - 1);
                setSelectedAvailDate(newDate);
              }}
              className="bg-gray-700 hover:bg-gray-600 px-2 md:px-3 py-1.5 md:py-2 rounded-lg flex-shrink-0"
            >
              ←
            </button>
            <input
              type="date"
              value={getLocalDateString(selectedAvailDate)}
              onChange={(e) => setSelectedAvailDate(parseLocalDate(e.target.value))}
              className="bg-gray-700 text-white px-2 md:px-4 py-1.5 md:py-2 rounded-lg text-sm flex-shrink-0"
            />
            <button
              onClick={() => {
                const newDate = new Date(selectedAvailDate);
                newDate.setDate(newDate.getDate() + 1);
                setSelectedAvailDate(newDate);
              }}
              className="bg-gray-700 hover:bg-gray-600 px-2 md:px-3 py-1.5 md:py-2 rounded-lg flex-shrink-0"
            >
              →
            </button>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-1 text-xs md:text-sm">
          <div className="text-gray-400">
            {selectedAvailDate.toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </div>
          <div className="text-gray-500">Auto-refresh: Every 30 seconds</div>
        </div>
      </div>

      {/* Stats Overview - Horizontal scroll on mobile */}
      <div className="flex gap-2 md:gap-4 overflow-x-auto pb-2 -mx-2 px-2 md:mx-0 md:px-0 md:grid md:grid-cols-7">
        <div className="bg-gray-800 rounded-lg p-2 md:p-4 text-center flex-shrink-0 min-w-[60px] md:min-w-0">
          <div className="text-lg md:text-2xl font-bold">{stats.total}</div>
          <div className="text-[10px] md:text-sm text-gray-400">Total</div>
        </div>
        <div className="bg-green-900/70 rounded-lg p-2 md:p-4 text-center flex-shrink-0 min-w-[60px] md:min-w-0">
          <div className="text-lg md:text-2xl font-bold text-green-400">{stats.submitted}</div>
          <div className="text-[10px] md:text-sm text-green-300">Submitted</div>
        </div>
        <div className="bg-green-800/70 rounded-lg p-2 md:p-4 text-center flex-shrink-0 min-w-[60px] md:min-w-0">
          <div className="text-lg md:text-2xl font-bold text-green-300">{stats.fullyAvailable}</div>
          <div className="text-[10px] md:text-sm text-green-200">✅ Fully</div>
        </div>
        <div className="bg-blue-900/70 rounded-lg p-2 md:p-4 text-center flex-shrink-0 min-w-[60px] md:min-w-0">
          <div className="text-lg md:text-2xl font-bold text-blue-400">{stats.scheduledOnly}</div>
          <div className="text-[10px] md:text-sm text-blue-300">📅 Sched</div>
        </div>
        <div className="bg-orange-900/70 rounded-lg p-2 md:p-4 text-center flex-shrink-0 min-w-[60px] md:min-w-0">
          <div className="text-lg md:text-2xl font-bold text-orange-400">{stats.emergencyOnly}</div>
          <div className="text-[10px] md:text-sm text-orange-300">🚨 Emerg</div>
        </div>
        <div className="bg-red-900/70 rounded-lg p-2 md:p-4 text-center flex-shrink-0 min-w-[60px] md:min-w-0">
          <div className="text-lg md:text-2xl font-bold text-red-400">{stats.notAvailable}</div>
          <div className="text-[10px] md:text-sm text-red-300">🚫 N/A</div>
        </div>
        <div className="bg-yellow-900/70 rounded-lg p-2 md:p-4 text-center flex-shrink-0 min-w-[60px] md:min-w-0">
          <div className="text-lg md:text-2xl font-bold text-yellow-400">{stats.pending}</div>
          <div className="text-[10px] md:text-sm text-yellow-300">⏰ Pend</div>
        </div>
      </div>

      {/* Availability by Role */}
      <div className="space-y-4 md:space-y-6">
        {/* Lead Techs */}
        {availabilityData.lead_tech?.length > 0 && (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="bg-purple-700 px-3 md:px-4 py-2 md:py-3">
              <h3 className="font-bold text-sm md:text-lg">Lead Technicians</h3>
            </div>
            <div>
              {availabilityData.lead_tech.map(renderUserRow)}
            </div>
          </div>
        )}

        {/* Technicians */}
        {availabilityData.tech?.length > 0 && (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="bg-blue-700 px-3 md:px-4 py-2 md:py-3">
              <h3 className="font-bold text-sm md:text-lg">Technicians</h3>
            </div>
            <div>
              {availabilityData.tech.map(renderUserRow)}
            </div>
          </div>
        )}

        {/* Helpers */}
        {availabilityData.helper?.length > 0 && (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="bg-gray-700 px-3 md:px-4 py-2 md:py-3">
              <h3 className="font-bold text-sm md:text-lg">Helpers</h3>
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
    </div>
  );
}
