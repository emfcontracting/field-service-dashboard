// Custom Hook - Daily Availability Management
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import * as availabilityService from '../services/availabilityService';

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
    
    const interval = setInterval(() => {
      checkAvailabilityStatus();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [currentUser]);

  async function checkAvailabilityStatus() {
    if (!currentUser) return;

    const eligibleRoles = ['tech', 'helper', 'lead_tech'];
    if (!eligibleRoles.includes(currentUser.role)) {
      return;
    }

    // Check if already submitted today
    const todaySubmission = await availabilityService.checkTodaySubmission(supabase, currentUser.user_id);
    
    if (todaySubmission) {
      setHasSubmittedToday(true);
      setShowAvailabilityModal(false);
      setAvailabilityBlocked(false);
      return;
    }

    // Calculate if we should show modal
    const { hour, dayOfWeek } = availabilityService.calculateAvailabilityWindow();
    const { show, blocked } = availabilityService.shouldShowAvailabilityModal(hour, dayOfWeek, false);
    
    setShowAvailabilityModal(show);
    setAvailabilityBlocked(blocked);
  }

  async function submitAvailability() {
    if (!currentUser) return;

    if (!scheduledWork && !emergencyWork && !notAvailable) {
      alert('Please select at least one availability option');
      return;
    }

    try {
      setSaving(true);
      await availabilityService.submitAvailability(
        supabase,
        currentUser.user_id,
        scheduledWork,
        emergencyWork,
        notAvailable
      );

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
    availabilityBlocked,
    scheduledWork,
    emergencyWork,
    notAvailable,
    hasSubmittedToday,
    saving,
    submitAvailability,
    handleAvailabilityChange
  };
}
