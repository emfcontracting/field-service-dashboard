// hooks/useDailyHours.js - Custom Hook for Daily Hours Management
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import * as dailyHoursService from '../services/dailyHoursService';

export function useDailyHours(selectedWO, currentUser) {
  const [dailyLogs, setDailyLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const supabase = createClientComponentClient();

  // Load daily hours when work order changes
  useEffect(() => {
    if (selectedWO && selectedWO.wo_id) {
      loadDailyHours(selectedWO.wo_id);
    }
  }, [selectedWO?.wo_id]);

  /**
   * Load all daily hours logs for current work order
   */
  async function loadDailyHours(woId) {
    if (!woId) return;

    try {
      setLoading(true);
      const logs = await dailyHoursService.loadDailyHoursForWorkOrder(supabase, woId);
      setDailyLogs(logs);
    } catch (err) {
      console.error('Error loading daily hours:', err);
      alert('Error loading daily hours: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Add new daily hours entry
   */
  async function addDailyHours(hoursData) {
    if (!selectedWO) return;

    try {
      setSaving(true);

      // Prepare the data
      const dataToSave = {
        woId: selectedWO.wo_id,
        userId: hoursData.userId,
        assignmentId: hoursData.assignmentId || null,
        workDate: hoursData.workDate,
        hoursRegular: parseFloat(hoursData.hoursRegular) || 0,
        hoursOvertime: parseFloat(hoursData.hoursOvertime) || 0,
        miles: parseFloat(hoursData.miles) || 0,
        notes: hoursData.notes || null
      };

      // Save to database
      const newLog = await dailyHoursService.addDailyHours(supabase, dataToSave);
      
      // Add to local state
      setDailyLogs([newLog, ...dailyLogs]);

      // Show success message
      alert('✅ Daily hours logged successfully!');

      return newLog;
    } catch (err) {
      console.error('Error adding daily hours:', err);
      
      // Handle duplicate date error
      if (err.message.includes('duplicate') || err.message.includes('already exists')) {
        alert('⚠️ Hours already logged for this date. Please edit the existing entry or choose a different date.');
      } else {
        alert('Error logging hours: ' + err.message);
      }
      
      throw err;
    } finally {
      setSaving(false);
    }
  }

  /**
   * Update existing daily hours entry
   */
  async function updateDailyHours(logId, updates) {
    try {
      setSaving(true);

      await dailyHoursService.updateDailyHours(supabase, logId, updates);

      // Update local state
      setDailyLogs(dailyLogs.map(log => 
        log.log_id === logId 
          ? { ...log, ...updates }
          : log
      ));

      alert('✅ Hours updated successfully!');
    } catch (err) {
      console.error('Error updating daily hours:', err);
      alert('Error updating hours: ' + err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  }

  /**
   * Delete daily hours entry
   */
  async function deleteDailyHours(logId) {
    const confirmed = window.confirm(
      'Are you sure you want to delete this daily hours entry? This cannot be undone.'
    );

    if (!confirmed) return;

    try {
      setSaving(true);

      await dailyHoursService.deleteDailyHours(supabase, logId);

      // Remove from local state
      setDailyLogs(dailyLogs.filter(log => log.log_id !== logId));

      alert('✅ Hours entry deleted successfully!');
    } catch (err) {
      console.error('Error deleting daily hours:', err);
      alert('Error deleting hours: ' + err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  }

  /**
   * Download daily hours log as CSV for a specific user
   */
  async function downloadUserLogs(userId) {
    if (!selectedWO) return;

    try {
      const userLogs = dailyLogs.filter(log => log.user_id === userId);
      
      if (userLogs.length === 0) {
        alert('No hours logged to download');
        return;
      }

      // Get user name
      const userName = userLogs[0].user 
        ? `${userLogs[0].user.first_name}_${userLogs[0].user.last_name}`.replace(/\s+/g, '_')
        : 'User';

      // Generate CSV
      const csv = dailyHoursService.generateCSV(userLogs);
      
      // Create download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedWO.wo_number}_${userName}_Daily_Hours.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      alert('✅ Hours log downloaded successfully!');
    } catch (err) {
      console.error('Error downloading logs:', err);
      alert('Error downloading logs: ' + err.message);
    }
  }

  /**
   * Download complete work order hours log (all team members)
   */
  async function downloadAllLogs() {
    if (!selectedWO || dailyLogs.length === 0) {
      alert('No hours logged to download');
      return;
    }

    try {
      // Generate CSV with all logs
      const csv = dailyHoursService.generateCSV(dailyLogs);
      
      // Create download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedWO.wo_number}_Complete_Daily_Hours.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      alert('✅ Complete hours log downloaded successfully!');
    } catch (err) {
      console.error('Error downloading logs:', err);
      alert('Error downloading logs: ' + err.message);
    }
  }

  /**
   * Calculate total hours summary from daily logs
   */
  function calculateTotalSummary() {
    return dailyLogs.reduce((totals, log) => ({
      totalRT: totals.totalRT + (parseFloat(log.hours_regular) || 0),
      totalOT: totals.totalOT + (parseFloat(log.hours_overtime) || 0),
      totalMiles: totals.totalMiles + (parseFloat(log.miles) || 0),
      totalHours: totals.totalHours + (parseFloat(log.hours_regular) || 0) + (parseFloat(log.hours_overtime) || 0)
    }), {
      totalRT: 0,
      totalOT: 0,
      totalMiles: 0,
      totalHours: 0
    });
  }

  return {
    dailyLogs,
    loading,
    saving,
    addDailyHours,
    updateDailyHours,
    deleteDailyHours,
    downloadUserLogs,
    downloadAllLogs,
    calculateTotalSummary,
    loadDailyHours
  };
}
