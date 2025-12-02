// useWorkOrders.js - Work Orders Management Hook (WITH SIGNATURE SUPPORT)

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export function useWorkOrders(currentUser) {
  const [workOrders, setWorkOrders] = useState([]);
  const [completedWorkOrders, setCompletedWorkOrders] = useState([]);
  const [selectedWO, setSelectedWO] = useState(null);
  const [saving, setSaving] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [editingField, setEditingField] = useState({});
  
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

  // Add comment with bilingual support
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
    saveSignature  // ADD THIS EXPORT
  };
}
