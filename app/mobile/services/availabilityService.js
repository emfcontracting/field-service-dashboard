// Availability Service - Daily availability management
import { getTodayEST, getNowEST, getESTTimeInfo } from '../utils/dateUtils';

export async function checkTodaySubmission(supabase, userId) {
  const today = getTodayEST();

  const { data: todaySubmission } = await supabase
    .from('daily_availability')
    .select('*')
    .eq('user_id', userId)
    .eq('availability_date', today)
    .maybeSingle();

  return todaySubmission;
}

export function calculateAvailabilityWindow() {
  const { hour, dayOfWeek, date } = getESTTimeInfo();
  return { hour, dayOfWeek, today: date };
}

// 5pm (17:00) EST onwards, blocked until answered. Sunday + Monday–Friday all
// prompt for tomorrow's scheduled work + today's emergencies. Friday's
// "tomorrow" is Saturday, so regular Saturday work is now offered on Friday.
// Saturday itself: no check.
export function shouldShowAvailabilityModal(hour, dayOfWeek, hasSubmittedToday) {
  if (hasSubmittedToday) {
    return { show: false, blocked: false };
  }

  // Saturday (6): no availability check.
  if (dayOfWeek === 6) {
    return { show: false, blocked: false };
  }

  // Sunday (0) + Monday–Friday (1–5): 5pm+ EST, blocked until answered.
  if (hour >= 17) {
    return { show: true, blocked: true };
  }
  return { show: false, blocked: false };
}

export async function submitAvailability(
  supabase,
  userId,
  scheduledWork,
  emergencyWork,
  notAvailable,
  workStatus = { hasWork: null, reason: null, note: null }
) {
  const today = getTodayEST();
  const available = !notAvailable && (scheduledWork || emergencyWork);
  const hasWork = available ? workStatus.hasWork : null;

  // Use upsert to handle cases where a record might already exist
  const { error } = await supabase
    .from('daily_availability')
    .upsert({
      user_id: userId,
      availability_date: today,
      scheduled_work: scheduledWork,
      emergency_work: emergencyWork,
      not_available: notAvailable,
      has_work: hasWork,
      work_status_reason: hasWork === true ? (workStatus.reason ?? null) : null,
      work_status_note: hasWork === true ? ((workStatus.note && workStatus.note.trim()) || null) : null,
      submitted_at: getNowEST()  // Use EST timestamp
    }, {
      onConflict: 'user_id,availability_date'
    });

  if (error) throw error;

  return true;
}
