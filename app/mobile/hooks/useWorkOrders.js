// useWorkOrders.js - Work Orders Management Hook (WITH DAILY HOURS & SIGNATURE SUPPORT)

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export function useWorkOrders(currentUser) {
  const [workOrders, setWorkOrders] = useState([]);
  const [completedWorkOrders, setCompletedWorkOrders] = useState([]);
  const [selectedWO, setSelectedWO] = useState(null);
  const [saving, setSaving] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [editingField, setEditingField] = useState({});
  
  // DAILY HOURS LOG STATE
  const [dailyLogs, setDailyLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (!currentUser) return;
    
    loadWorkOrders();
    loadCompletedWorkOrders();

    const channel = supabase
      .channel('work-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_orders'
        },
        () => {
          loadWorkOrders();
          loadCompletedWorkOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  // Load daily logs when selected work order changes
  useEffect(() => {
    if (selectedWO?.wo_id) {
      loadDailyLogs(selectedWO.wo_id);
    } else {
      setDailyLogs([]);
    }
  }, [selectedWO?.wo_id]);

  async function loadWorkOrders() {
    if (!currentUser) return;

    try {
      const { data: leadWOs, error: leadError } = await supabase
        .from('work_orders')
        .select(`
          *,
          lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)
        `)
        .eq('lead_tech_id', currentUser.user_id)
        .in('status', ['assigned', 'in_progress', 'pending', 'needs_return', 'return_trip'])
        .order('priority', { ascending: true })
        .order('date_entered', { ascending: true });

      if (leadError) throw leadError;

      const { data: assignments, error: assignError } = await supabase
        .from('work_order_assignments')
        .select('wo_id, role_on_job')
        .eq('user_id', currentUser.user_id);

      if (assignError) throw assignError;

      let helperWOs = [];
      if (assignments && assignments.length > 0) {
        const woIds = assignments.map(a => a.wo_id);
        const { data: helperWOData, error: helperError } = await supabase
          .from('work_orders')
          .select(`
            *,
            lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)
          `)
          .in('wo_id', woIds)
          .in('status', ['assigned', 'in_progress', 'pending', 'needs_return', 'return_trip']);

        if (helperError) throw helperError;
        helperWOs = helperWOData || [];
      }

      const allWOs = [...(leadWOs || []), ...helperWOs];
      const uniqueWOs = Array.from(
        new Map(allWOs.map(wo => [wo.wo_id, wo])).values()
      );

      setWorkOrders(uniqueWOs);
    } catch (err) {
      console.error('Error loading work orders:', err);
    }
  }

  async function loadCompletedWorkOrders() {
    if (!currentUser) return;

    try {
      const { data: leadWOs, error: leadError } = await supabase
        .from('work_orders')
        .select(`
          *,
          lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)
        `)
        .eq('lead_tech_id', currentUser.user_id)
        .eq('status', 'completed')
        .order('date_completed', { ascending: false })
        .limit(50);

      const { data: assignments } = await supabase
        .from('work_order_assignments')
        .select('wo_id')
        .eq('user_id', currentUser.user_id);

      let helperWOs = [];
      if (assignments && assignments.length > 0) {
        const woIds = assignments.map(a => a.wo_id);
        const { data: helperWOData } = await supabase
          .from('work_orders')
          .select(`
            *,
            lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)
          `)
          .in('wo_id', woIds)
          .eq('status', 'completed')
          .order('date_completed', { ascending: false })
          .limit(50);

        helperWOs = helperWOData || [];
      }

      const allWOs = [...(leadWOs || []), ...helperWOs];
      const uniqueWOs = Array.from(
        new Map(allWOs.map(wo => [wo.wo_id, wo])).values()
      );

      setCompletedWorkOrders(uniqueWOs);
    } catch (err) {
      console.error('Error loading completed work orders:', err);
    }
  }

  // ==================== DAILY HOURS LOG FUNCTIONS ====================
  
  async function loadDailyLogs(woId) {
    if (!woId) return;
    
    try {
      setLoadingLogs(true);
      
      const { data, error } = await supabase
        .from('daily_hours_log')
        .select(`
          *,
          user:users(first_name, last_name)
        `)
        .eq('wo_id', woId)
        .order('work_date', { ascending: false });
      
      if (error) {
        console.error('Error loading daily logs:', error);
        setDailyLogs([]);
        return;
      }
      
      // Transform data to include log_id as id for compatibility
      const transformedData = (data || []).map(log => ({
        ...log,
        log_id: log.id || log.log_id
      }));
      
      setDailyLogs(transformedData);
    } catch (err) {
      console.error('Error in loadDailyLogs:', err);
      setDailyLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }

  async function addDailyHours(hoursData) {
    if (!selectedWO?.wo_id) {
      throw new Error('No work order selected');
    }

    try {
      setSaving(true);
      
      // Check for duplicate entry on same date for same user
      const { data: existing } = await supabase
        .from('daily_hours_log')
        .select('id')
        .eq('wo_id', selectedWO.wo_id)
        .eq('user_id', hoursData.userId)
        .eq('work_date', hoursData.workDate)
        .single();

      if (existing) {
        throw new Error('Hours already logged for this date. Edit the existing entry instead.');
      }

      const { error } = await supabase
        .from('daily_hours_log')
        .insert({
          wo_id: selectedWO.wo_id,
          user_id: hoursData.userId,
          assignment_id: hoursData.assignmentId || null,
          work_date: hoursData.workDate,
          hours_regular: hoursData.hoursRegular || 0,
          hours_overtime: hoursData.hoursOvertime || 0,
          miles: hoursData.miles || 0,
          notes: hoursData.notes || null,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      // Reload daily logs
      await loadDailyLogs(selectedWO.wo_id);
      
      return true;
    } catch (err) {
      console.error('Error adding daily hours:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  }

  function downloadLogs(userId = null) {
    if (!selectedWO || dailyLogs.length === 0) {
      alert('No logs to download');
      return;
    }

    // Filter logs if userId specified
    const logsToExport = userId 
      ? dailyLogs.filter(log => log.user_id === userId)
      : dailyLogs;

    if (logsToExport.length === 0) {
      alert('No logs found for this user');
      return;
    }

    // Create CSV content
    const headers = ['Date', 'User', 'Regular Hours', 'Overtime Hours', 'Miles', 'Notes', 'Created At'];
    const rows = logsToExport.map(log => [
      log.work_date,
      log.user ? `${log.user.first_name} ${log.user.last_name}` : 'Unknown',
      log.hours_regular || 0,
      log.hours_overtime || 0,
      log.miles || 0,
      `"${(log.notes || '').replace(/"/g, '""')}"`,
      new Date(log.created_at).toLocaleString()
    ]);

    const csvContent = [
      `Work Order: ${selectedWO.wo_number}`,
      `Building: ${selectedWO.building}`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedWO.wo_number}_hours_log.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ==================== CHECK IN/OUT FUNCTIONS ====================

  async function checkIn(woId) {
    try {
      setSaving(true);
      const now = new Date();
      const timestamp = now.toLocaleString();
      const isoTime = now.toISOString();
      
      const { data: wo } = await supabase
        .from('work_orders')
        .select('*')
        .eq('wo_id', woId)
        .single();
      
      const existingComments = wo.comments || '';
      const checkInNote = `[${timestamp}] ${currentUser.first_name} ${currentUser.last_name} - ✓ CHECKED IN`;
      const updatedComments = existingComments 
        ? `${existingComments}\n\n${checkInNote}`
        : checkInNote;
      
      const updateData = {
        comments: updatedComments,
        status: 'in_progress'
      };
      
      if (!wo.time_in) {
        updateData.time_in = isoTime;
      }
      
      const { error } = await supabase
        .from('work_orders')
        .update(updateData)
        .eq('wo_id', woId);

      if (error) throw error;

      await loadWorkOrders();
      if (selectedWO && selectedWO.wo_id === woId) {
        const { data: updated } = await supabase
          .from('work_orders')
          .select(`*, lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)`)
          .eq('wo_id', woId)
          .single();
        setSelectedWO(updated);
      }
    } catch (err) {
      alert('Error checking in: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function checkOut(woId) {
    try {
      setSaving(true);
      const now = new Date();
      const timestamp = now.toLocaleString();
      const isoTime = now.toISOString();
      
      const { data: wo } = await supabase
        .from('work_orders')
        .select('*')
        .eq('wo_id', woId)
        .single();
      
      const existingComments = wo.comments || '';
      const checkOutNote = `[${timestamp}] ${currentUser.first_name} ${currentUser.last_name} - ⏸ CHECKED OUT`;
      const updatedComments = existingComments 
        ? `${existingComments}\n\n${checkOutNote}`
        : checkOutNote;
      
      const updateData = {
        comments: updatedComments
      };
      
      if (!wo.time_out) {
        updateData.time_out = isoTime;
      }
      
      const { error } = await supabase
        .from('work_orders')
        .update(updateData)
        .eq('wo_id', woId);

      if (error) throw error;

      await loadWorkOrders();
      if (selectedWO && selectedWO.wo_id === woId) {
        const { data: updated } = await supabase
          .from('work_orders')
          .select(`*, lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)`)
          .eq('wo_id', woId)
          .single();
        setSelectedWO(updated);
      }
    } catch (err) {
      alert('Error checking out: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function completeWorkOrder() {
    if (!selectedWO) return;
    
    const confirmed = window.confirm(
      'Are you sure you want to mark this work order as completed? This action cannot be undone from the mobile app.'
    );
    
    if (!confirmed) return;

    try {
      setSaving(true);
      const now = new Date();
      const timestamp = now.toLocaleString();
      const isoTime = now.toISOString();
      
      const { data: wo } = await supabase
        .from('work_orders')
        .select('*')
        .eq('wo_id', selectedWO.wo_id)
        .single();
      
      const existingComments = wo.comments || '';
      const completionNote = `[${timestamp}] ${currentUser.first_name} ${currentUser.last_name} - ✅ WORK ORDER COMPLETED`;
      const updatedComments = existingComments 
        ? `${existingComments}\n\n${completionNote}`
        : completionNote;
      
      const { error } = await supabase
        .from('work_orders')
        .update({
          status: 'completed',
          date_completed: isoTime,
          comments: updatedComments
        })
        .eq('wo_id', selectedWO.wo_id);

      if (error) throw error;

      alert('Work order marked as completed! ✅');
      
      await loadWorkOrders();
      await loadCompletedWorkOrders();
      setSelectedWO(null);
    } catch (err) {
      alert('Error completing work order: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateField(woId, field, value) {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('work_orders')
        .update({ [field]: value })
        .eq('wo_id', woId);

      if (error) throw error;

      setSelectedWO({ ...selectedWO, [field]: value });
      setEditingField({});
    } catch (err) {
      alert('Error updating: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleFieldChange(field, value) {
    setEditingField({ ...editingField, [field]: value });
  }

  function getFieldValue(field) {
    if (!selectedWO) return '';
    return editingField.hasOwnProperty(field) ? editingField[field] : (selectedWO[field] || '');
  }

  // SIGNATURE SAVE FUNCTION
  async function saveSignature(signatureData) {
    if (!selectedWO) {
      throw new Error('No work order selected');
    }

    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('work_orders')
        .update({
          customer_signature: signatureData.signature,
          customer_name: signatureData.customerName,
          signature_date: signatureData.signedAt
        })
        .eq('wo_id', selectedWO.wo_id);

      if (error) throw error;

      // Reload the work order to get updated data
      const { data: updated, error: fetchError } = await supabase
        .from('work_orders')
        .select(`*, lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)`)
        .eq('wo_id', selectedWO.wo_id)
        .single();

      if (fetchError) throw fetchError;

      setSelectedWO(updated);
      await loadWorkOrders();
      
      return true;
    } catch (err) {
      console.error('Error saving signature:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  }

  // Add comment
  async function addComment(commentText) {
    if (!commentText || !commentText.trim() || !selectedWO) return;

    try {
      setSaving(true);
      
      const { data: wo } = await supabase
        .from('work_orders')
        .select('comments')
        .eq('wo_id', selectedWO.wo_id)
        .single();

      const existingComments = wo.comments || '';
      const timestamp = new Date().toLocaleString();
      
      const updatedComments = existingComments 
        ? `${existingComments}\n\n[${timestamp}] ${currentUser.first_name}: ${commentText}`
        : `[${timestamp}] ${currentUser.first_name}: ${commentText}`;

      const { error } = await supabase
        .from('work_orders')
        .update({ comments: updatedComments })
        .eq('wo_id', selectedWO.wo_id);

      if (error) throw error;

      setNewComment('');
      
      // Reload the selected work order
      const { data: updated } = await supabase
        .from('work_orders')
        .select(`*, lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)`)
        .eq('wo_id', selectedWO.wo_id)
        .single();
      
      setSelectedWO(updated);
      
    } catch (err) {
      alert('Error adding comment: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return {
    workOrders,
    completedWorkOrders,
    selectedWO,
    setSelectedWO,
    saving,
    newComment,
    setNewComment,
    editingField,
    setEditingField,
    loadWorkOrders,
    loadCompletedWorkOrders,
    checkIn,
    checkOut,
    completeWorkOrder,
    updateField,
    handleFieldChange,
    getFieldValue,
    addComment,
    saveSignature,
    // DAILY HOURS EXPORTS
    dailyLogs,
    loadingLogs,
    loadDailyLogs,
    addDailyHours,
    downloadLogs
  };
}
