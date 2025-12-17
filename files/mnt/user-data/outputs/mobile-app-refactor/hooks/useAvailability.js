// useAvailability.js - Availability Tracking Hook

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { ELIGIBLE_AVAILABILITY_ROLES, AVAILABILITY_DEADLINE_HOUR } from '../utils/constants';

export function useAvailability(currentUser) {
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [availabilityBlocked, setAvailabilityBlocked] = useState(false);
  const [scheduledWork, setScheduledWork] = useState(false);
  const [emergencyWork, setEmergencyWork] = useState(false);
  const [notAvailable, setNotAvailable] = useState(false);
  const [hasSubmittedToday, setHasSubmittedToday] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (!currentUser) return;
    
    checkAvailabilityStatus();
    
    const availabilityInterval = setInterval(() => {
      checkAvailabilityStatus();
    }, 60000);

    return () => {
      clearInterval(availabilityInterval);
    };
  }, [currentUser]);

  async function checkAvailabilityStatus() {
    if (!currentUser) return;

    if (!ELIGIBLE_AVAILABILITY_ROLES.includes(currentUser.role)) {
      return;
    }

    const now = new Date();
    const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const hour = estTime.getHours();
    const dayOfWeek = estTime.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
    const today = estTime.toISOString().split('T')[0];

    // Check if already submitted today
    const { data: todaySubmission } = await supabase
      .from('daily_availability')
      .select('*')
      .eq('user_id', currentUser.user_id)
      .eq('availability_date', today)
      .single();

    if (todaySubmission) {
      setHasSubmittedToday(true);
      setShowAvailabilityModal(false);
      setAvailabilityBlocked(false);
      return;
    }

    // Friday (5): Only ask about TODAY's emergencies (6pm-8pm window)
    if (dayOfWeek === 5) {
      if (hour >= 18 && hour < AVAILABILITY_DEADLINE_HOUR) {
        setShowAvailabilityModal(true);
        setAvailabilityBlocked(false);
      } else if (hour >= AVAILABILITY_DEADLINE_HOUR) {
        setAvailabilityBlocked(true);
        setShowAvailabilityModal(true);
      } else {
        setShowAvailabilityModal(false);
        setAvailabilityBlocked(false);
      }
      return;
    }

    // Sunday (0): Ask about TOMORROW (Monday) - scheduled and emergency work
    if (dayOfWeek === 0) {
      if (hour >= 18 && hour < AVAILABILITY_DEADLINE_HOUR) {
        setShowAvailabilityModal(true);
        setAvailabilityBlocked(false);
      } else if (hour >= AVAILABILITY_DEADLINE_HOUR) {
        setAvailabilityBlocked(true);
        setShowAvailabilityModal(true);
      } else {
        setShowAvailabilityModal(false);
        setAvailabilityBlocked(false);
      }
      return;
    }

    // Monday-Thursday (1-4): Ask about TOMORROW and TODAY's emergencies
    if (dayOfWeek >= 1 && dayOfWeek <= 4) {
      if (hour >= 18 && hour < AVAILABILITY_DEADLINE_HOUR) {
        setShowAvailabilityModal(true);
        setAvailabilityBlocked(false);
      } else if (hour >= AVAILABILITY_DEADLINE_HOUR) {
        setAvailabilityBlocked(true);
        setShowAvailabilityModal(true);
      } else {
        setShowAvailabilityModal(false);
        setAvailabilityBlocked(false);
      }
      return;
    }

    // Saturday (6): No availability check needed
    setShowAvailabilityModal(false);
    setAvailabilityBlocked(false);
  }

  async function handleAvailabilitySubmit() {
    if (!currentUser) return;

    if (!scheduledWork && !emergencyWork && !notAvailable) {
      alert('Please select at least one availability option');
      return;
    }

    try {
      setSaving(true);
      const today = new Date().toISOString().split('T')[0];

      const { error } = await supabase
        .from('daily_availability')
        .insert({
          user_id: currentUser.user_id,
          availability_date: today,
          scheduled_work: scheduledWork,
          emergency_work: emergencyWork,
          not_available: notAvailable,
          submitted_at: new Date().toISOString()
        });

      if (error) throw error;

      setHasSubmittedToday(true);
      setShowAvailabilityModal(false);
      setAvailabilityBlocked(false);
      
      setScheduledWork(false);
      setEmergencyWork(false);
      setNotAvailable(false);

      alert('✅ Availability submitted successfully!');
    } catch (err) {
      alert('Error submitting availability: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleAvailabilityChange(option) {
    if (option === 'notAvailable') {
      if (!notAvailable) {
        setNotAvailable(true);
        setScheduledWork(false);
        setEmergencyWork(false);
      } else {
        setNotAvailable(false);
      }
    } else {
      if (notAvailable) return;

      if (option === 'scheduledWork') {
        setScheduledWork(!scheduledWork);
      } else if (option === 'emergencyWork') {
        setEmergencyWork(!emergencyWork);
      }
    }
  }

  return {
    showAvailabilityModal,
    setShowAvailabilityModal,
    availabilityBlocked,
    scheduledWork,
    emergencyWork,
    notAvailable,
    hasSubmittedToday,
    saving,
    checkAvailabilityStatus,
    handleAvailabilitySubmit,
    handleAvailabilityChange
  };
}
