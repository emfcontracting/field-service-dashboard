// Availability Service - Daily availability management
import { getTodayEST, getNowEST, getESTTimeInfo } from '../utils/dateUtils';

export async function checkTodaySubmission(supabase, userId) {
  const today = getTodayEST();
  
  const { data: todaySubmission } = await supabase
    .from('daily_availability')
    .select('*')
    .eq('user_id', userId)
    .eq('availability_date', today)
    .single();

  return todaySubmission;
}

export function calculateAvailabilityWindow() {
  const { hour, dayOfWeek, date } = getESTTimeInfo();
  return { hour, dayOfWeek, today: date };
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
  const today = getTodayEST();

  // Use upsert to handle cases where a record might already exist
  // This will update if exists, insert if not
  const { error } = await supabase
    .from('daily_availability')
    .upsert({
      user_id: userId,
      availability_date: today,
      scheduled_work: scheduledWork,
      emergency_work: emergencyWork,
      not_available: notAvailable,
      submitted_at: getNowEST()  // Use EST timestamp
    }, {
      onConflict: 'user_id,availability_date'
    });

  if (error) throw error;
  
  return true;
}
