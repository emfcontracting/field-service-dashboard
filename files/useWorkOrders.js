// Custom Hook - Work Orders Management
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import * as workOrderService from '../services/workOrderService';

export function useWorkOrders(currentUser) {
  const [workOrders, setWorkOrders] = useState([]);
  const [completedWorkOrders, setCompletedWorkOrders] = useState([]);
  const [selectedWO, setSelectedWO] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState({});
  const [newComment, setNewComment] = useState('');
  
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
    const data = await workOrderService.loadActiveWorkOrders(supabase, currentUser);
    setWorkOrders(data);
  }

  async function loadCompletedWorkOrders() {
    const data = await workOrderService.loadCompletedWorkOrders(supabase, currentUser);
    setCompletedWorkOrders(data);
  }

  async function checkIn(woId) {
    try {
      setSaving(true);
      await workOrderService.checkIn(supabase, woId, currentUser);
      await loadWorkOrders();
      
      if (selectedWO && selectedWO.wo_id === woId) {
        const updated = await workOrderService.getWorkOrder(supabase, woId);
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
      await workOrderService.checkOut(supabase, woId, currentUser);
      await loadWorkOrders();
      
      if (selectedWO && selectedWO.wo_id === woId) {
        const updated = await workOrderService.getWorkOrder(supabase, woId);
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
      await workOrderService.completeWorkOrder(supabase, selectedWO.wo_id, currentUser);
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
      await workOrderService.updateField(supabase, woId, field, value);
      setSelectedWO({ ...selectedWO, [field]: value });
      setEditingField({});
    } catch (err) {
      alert('Error updating: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function addComment() {
    if (!newComment.trim() || !selectedWO) return;

    try {
      setSaving(true);
      await workOrderService.addComment(supabase, selectedWO.wo_id, newComment, currentUser);
      setNewComment('');
      await loadWorkOrders();
      
      const updated = await workOrderService.getWorkOrder(supabase, selectedWO.wo_id);
      setSelectedWO(updated);
    } catch (err) {
      alert('Error adding comment: ' + err.message);
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

  return {
    workOrders,
    completedWorkOrders,
    selectedWO,
    setSelectedWO,
    saving,
    newComment,
    setNewComment,
    editingField,
    checkIn,
    checkOut,
    completeWorkOrder,
    updateField,
    addComment,
    handleFieldChange,
    getFieldValue,
    loadWorkOrders
  };
}
