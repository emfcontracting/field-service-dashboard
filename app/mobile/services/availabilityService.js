// Availability Service - Daily availability management

export async function checkTodaySubmission(supabase, userId) {
  const today = new Date().toISOString().split('T')[0];
  
  const { data: todaySubmission } = await supabase
    .from('daily_availability')
    .select('*')
    .eq('user_id', userId)
    .eq('availability_date', today)
    .single();

  return todaySubmission;
}

export function calculateAvailabilityWindow() {
  const now = new Date();
  const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hour = estTime.getHours();
  const dayOfWeek = estTime.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const today = estTime.toISOString().split('T')[0];

  return { hour, dayOfWeek, today };
}

export function shouldShowAvailabilityModal(hour, dayOfWeek, hasSubmittedToday) {
  if (hasSubmittedToday) {
    return { show: false, blocked: false };
  }

  // Friday (5): Only ask about TODAY's emergencies (5pm onwards, blocked until reply)
  if (dayOfWeek === 5) {
    if (hour >= 17) {
      return { show: true, blocked: true };
    }
    return { show: false, blocked: false };
  }

  // Sunday (0): Ask about TOMORROW (Monday) - scheduled and emergency work (5pm onwards, blocked until reply)
  if (dayOfWeek === 0) {
    if (hour >= 17) {
      return { show: true, blocked: true };
    }
    return { show: false, blocked: false };
  }

  // Monday-Thursday (1-4): Ask about TOMORROW and TODAY's emergencies (5pm onwards, blocked until reply)
  if (dayOfWeek >= 1 && dayOfWeek <= 4) {
    if (hour >= 17) {
      return { show: true, blocked: true };
    }
    return { show: false, blocked: false };
  }

  // Saturday (6): No availability check needed
  return { show: false, blocked: false };
}

export async function submitAvailability(supabase, userId, scheduledWork, emergencyWork, notAvailable) {
  const today = new Date().toISOString().split('T')[0];

  const { error } = await supabase
    .from('daily_availability')
    .insert({
      user_id: userId,
      availability_date: today,
      scheduled_work: scheduledWork,
      emergency_work: emergencyWork,
      not_available: notAvailable,
      submitted_at: new Date().toISOString()
    });

  if (error) throw error;
  
  return true;
}
