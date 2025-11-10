// mobile/utils/availabilityHelpers.js

export async function checkAvailabilityStatus(supabase, userId, userRole) {
  const eligibleRoles = ['tech', 'helper', 'lead_tech'];
  if (!eligibleRoles.includes(userRole)) {
    return {
      isBlocked: false,
      hasSubmitted: true,
      canSubmit: false,
      message: null
    };
  }

  const now = new Date();
  const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hour = estTime.getHours();
  const dayOfWeek = estTime.getDay(); // 0 = Sunday, 6 = Saturday
  
  // FIX: Format date correctly for Supabase (YYYY-MM-DD)
  const year = estTime.getFullYear();
  const month = String(estTime.getMonth() + 1).padStart(2, '0');
  const day = String(estTime.getDate()).padStart(2, '0');
  const today = `${year}-${month}-${day}`;

  // Check if already submitted today
  const { data: todaySubmission, error } = await supabase
    .from('daily_availability')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle(); // Use maybeSingle() instead of single() to handle no results

  if (error && error.code !== 'PGRST116') {
    console.error('Error checking availability:', error);
  }

  const hasSubmitted = !!todaySubmission;

  // Only block on weekdays (Monday-Friday) after 8 PM EST
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const isAfter8PM = hour >= 20;
  const isBlocked = isWeekday && isAfter8PM && !hasSubmitted;

  let message = null;
  if (isBlocked) {
    message = '🚫 Access blocked until you submit tomorrow\'s availability (6-8 PM EST)';
  } else if (!hasSubmitted && isWeekday && hour >= 18) {
    message = '⚠️ Please submit your availability for tomorrow (6-8 PM EST)';
  }

  return {
    isBlocked,
    hasSubmitted,
    message,
    canSubmit: isWeekday && hour >= 18 && hour < 20
  };
}

export async function submitAvailability(
  supabase,
  userId,
  { scheduledWork, emergencyWork, notAvailable }
) {
  try {
    const now = new Date();
    const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    
    // Get tomorrow's date in EST - FIX: Format correctly
    const tomorrow = new Date(estTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    const tomorrowDate = `${year}-${month}-${day}`;

    const { error } = await supabase
      .from('daily_availability')
      .upsert({
        user_id: userId,
        date: tomorrowDate,
        scheduled_work: scheduledWork,
        emergency_work: emergencyWork,
        not_available: notAvailable,
        submitted_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,date'
      });

    if (error) throw error;

    return {
      success: true,
      message: 'Availability submitted successfully!'
    };
  } catch (err) {
    console.error('Error submitting availability:', err);
    return {
      success: false,
      error: 'Error submitting availability: ' + err.message
    };
  }
}

export async function getTodayAvailability(supabase, userId) {
  try {
    const now = new Date();
    const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    
    // FIX: Format date correctly
    const year = estTime.getFullYear();
    const month = String(estTime.getMonth() + 1).padStart(2, '0');
    const day = String(estTime.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    const { data, error } = await supabase
      .from('daily_availability')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle(); // Use maybeSingle() to handle no results gracefully

    if (error && error.code !== 'PGRST116') throw error;

    return {
      success: true,
      data: data || null
    };
  } catch (err) {
    console.error('Error getting today\'s availability:', err);
    return {
      success: false,
      error: err.message,
      data: null
    };
  }
}