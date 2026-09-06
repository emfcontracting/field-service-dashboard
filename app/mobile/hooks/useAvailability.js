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

  // "Have work / need work" — only relevant when the tech is available.
  const [hasWork, setHasWork] = useState(null);       // true = has work, false = needs work
  const [workReason, setWorkReason] = useState('');   // 'return_trip' | 'waiting_material' | 'other'
  const [workNote, setWorkNote] = useState('');
  const [manualOpen, setManualOpen] = useState(false); // tech opened the gate themselves

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

    // Already answered today (this session)? Nothing to poll — the gate is done
    // until the date changes.
    const todayKey = `availabilityDone:${currentUser.user_id}:${availabilityService.calculateAvailabilityWindow().today || new Date().toDateString()}`;
    try { if (localStorage.getItem(todayKey)) { setHasSubmittedToday(true); setShowAvailabilityModal(false); setAvailabilityBlocked(false); return; } } catch {}

    // Offline / server unreachable: NEVER lock the tech out. A failed query is
    // "unknown", not "not submitted" — leave the gate open and re-check on the
    // next tick when the connection is back.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setShowAvailabilityModal(false);
      setAvailabilityBlocked(false);
      return;
    }
    let todaySubmission;
    try {
      todaySubmission = await availabilityService.checkTodaySubmission(supabase, currentUser.user_id);
    } catch (e) {
      console.warn('availability check failed (offline?):', e?.message);
      setShowAvailabilityModal(false);
      setAvailabilityBlocked(false);
      return;
    }

    if (todaySubmission) {
      setHasSubmittedToday(true);
      setShowAvailabilityModal(false);
      setAvailabilityBlocked(false);
      try { localStorage.setItem(todayKey, '1'); } catch {}
      return;
    }

    // Calculate if we should show modal
    const { hour, dayOfWeek } = availabilityService.calculateAvailabilityWindow();
    const { show, blocked } = availabilityService.shouldShowAvailabilityModal(hour, dayOfWeek, false);

    setShowAvailabilityModal(show);
    setAvailabilityBlocked(blocked);
  }

  function resetForm() {
    setScheduledWork(false);
    setEmergencyWork(false);
    setNotAvailable(false);
    setHasWork(null);
    setWorkReason('');
    setWorkNote('');
  }

  async function submitAvailability() {
    if (!currentUser) return;

    if (!scheduledWork && !emergencyWork && !notAvailable) {
      alert('Please select at least one availability option');
      return;
    }

    // Work-status is required when the tech is available.
    const available = !notAvailable && (scheduledWork || emergencyWork);
    if (available && hasWork === null) {
      alert('Please choose: do you already have work, or do you need work?');
      return;
    }
    if (available && hasWork === true && !workReason) {
      alert('Please pick why you already have work (return trip, waiting on material, or other).');
      return;
    }

    try {
      setSaving(true);
      await availabilityService.submitAvailability(
        supabase,
        currentUser.user_id,
        scheduledWork,
        emergencyWork,
        notAvailable,
        { hasWork, reason: workReason || null, note: workNote || null }
      );

      try { localStorage.setItem(`availabilityDone:${currentUser.user_id}:${availabilityService.calculateAvailabilityWindow().today || new Date().toDateString()}`, '1'); } catch {}
      setHasSubmittedToday(true);
      setShowAvailabilityModal(false);
      setAvailabilityBlocked(false);
      setManualOpen(false);
      resetForm();

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
        setHasWork(null);
        setWorkReason('');
        setWorkNote('');
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

  // Tech picks "I have work" (true) or "I need work" (false).
  function handleWorkChoice(choice) {
    setHasWork(choice);
    if (choice === false) {
      setWorkReason('');
      setWorkNote('');
    }
  }

  // Manual open/close (tech taps the "My Availability" button).
  function openAvailability() {
    resetForm();
    setManualOpen(true);
  }
  function closeAvailability() {
    setManualOpen(false);
    resetForm();
  }

  return {
    showAvailabilityModal,
    availabilityBlocked,
    scheduledWork,
    emergencyWork,
    notAvailable,
    hasSubmittedToday,
    saving,
    hasWork,
    workReason,
    workNote,
    submitAvailability,
    handleAvailabilityChange,
    handleWorkChoice,
    setWorkReason,
    setWorkNote,
    manualOpen,
    openAvailability,
    closeAvailability
  };
}
