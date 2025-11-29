// mobile/utils/timeTracking.js

export function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ latitude: null, longitude: null });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => {
        console.error('Geolocation error:', error);
        resolve({ latitude: null, longitude: null });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}

export function calculateElapsedTime(timeIn, timeOut = null) {
  if (!timeIn) return '0:00';
  
  const start = new Date(timeIn);
  const end = timeOut ? new Date(timeOut) : new Date();
  const diff = end - start;
  
  if (diff < 0) return '0:00';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${hours}:${minutes.toString().padStart(2, '0')}`;
}

export function formatTimeForDisplay(dateString) {
  if (!dateString) return 'Not set';
  
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

export async function loadTeamForWorkOrder(supabase, woId) {
  try {
    const { data, error } = await supabase
      .from('work_order_team')
      .select(`
        *,
        user:users(user_id, first_name, last_name, email, role, hourly_rate)
      `)
      .eq('wo_id', woId);

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err) {
    console.error('Error loading team:', err);
    return { success: false, error: err.message, data: [] };
  }
}

export async function addTeamMember(supabase, woId, userId) {
  try {
    const { error } = await supabase
      .from('work_order_team')
      .insert({
        wo_id: woId,
        user_id: userId,
        joined_at: new Date().toISOString()
      });

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('Error adding team member:', err);
    return { success: false, error: err.message };
  }
}

export async function removeTeamMember(supabase, teamId) {
  try {
    const { error } = await supabase
      .from('work_order_team')
      .delete()
      .eq('team_id', teamId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('Error removing team member:', err);
    return { success: false, error: err.message };
  }
}

export async function updateTeamMemberTime(supabase, teamId, updates) {
  try {
    const { error } = await supabase
      .from('work_order_team')
      .update(updates)
      .eq('team_id', teamId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('Error updating team member time:', err);
    return { success: false, error: err.message };
  }
}