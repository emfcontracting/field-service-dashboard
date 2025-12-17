// useTeamMembers.js - Team Management Hook

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export function useTeamMembers(selectedWO) {
  const [teamMembers, setTeamMembers] = useState([]);
  const [currentTeamList, setCurrentTeamList] = useState([]);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState({});
  
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (selectedWO && selectedWO.wo_id) {
      loadTeamForWorkOrder(selectedWO.wo_id).catch(err => {
        console.error('Error in useEffect loading team:', err);
      });
      setEditingField({});
    }
  }, [selectedWO?.wo_id]);

  async function loadTeamMembers() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .in('role', ['tech', 'helper', 'lead_tech'])
        .eq('is_active', true)
        .order('first_name');

      if (error) throw error;
      setTeamMembers(data || []);
      setShowTeamModal(true);
    } catch (err) {
      alert('Error loading team members: ' + err.message);
    }
  }

  async function handleAddTeamMember(memberId) {
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('work_order_assignments')
        .insert({
          wo_id: selectedWO.wo_id,
          user_id: memberId,
          role_on_job: 'helper'
        });

      if (error) throw error;

      await loadTeamForWorkOrder(selectedWO.wo_id);
      setShowTeamModal(false);
    } catch (err) {
      alert('Error adding team member: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function loadTeamForWorkOrder(woId) {
    if (!woId) {
      console.error('loadTeamForWorkOrder: No work order ID provided');
      setCurrentTeamList([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('work_order_assignments')
        .select(`
          assignment_id,
          user_id,
          role_on_job,
          hours_regular,
          hours_overtime,
          miles,
          user:users(first_name, last_name)
        `)
        .eq('wo_id', woId);
      
      if (error) {
        console.error('Error loading team for work order:', error);
        setCurrentTeamList([]);
        return;
      }
      
      console.log('Team loaded successfully:', data);
      setCurrentTeamList(data || []);
    } catch (err) {
      console.error('Exception in loadTeamForWorkOrder:', err);
      setCurrentTeamList([]);
    }
  }

  function handleTeamFieldChange(assignmentId, field, value) {
    setEditingField({ 
      ...editingField, 
      [`team_${assignmentId}_${field}`]: value 
    });
  }

  function getTeamFieldValue(member, field) {
    const key = `team_${member.assignment_id}_${field}`;
    return editingField.hasOwnProperty(key) ? editingField[key] : (member[field] || '');
  }

  async function handleUpdateTeamMemberField(assignmentId, field, value) {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('work_order_assignments')
        .update({ [field]: value })
        .eq('assignment_id', assignmentId);

      if (error) throw error;

      // Update the currentTeamList locally without refetching
      setCurrentTeamList(currentTeamList.map(member => 
        member.assignment_id === assignmentId 
          ? { ...member, [field]: value }
          : member
      ));

      // Clear the editing field for this specific team member field
      const key = `team_${assignmentId}_${field}`;
      const { [key]: removed, ...rest } = editingField;
      setEditingField(rest);
    } catch (err) {
      alert('Error updating team member: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return {
    teamMembers,
    currentTeamList,
    showTeamModal,
    setShowTeamModal,
    saving,
    loadTeamMembers,
    handleAddTeamMember,
    loadTeamForWorkOrder,
    handleTeamFieldChange,
    getTeamFieldValue,
    handleUpdateTeamMemberField
  };
}
