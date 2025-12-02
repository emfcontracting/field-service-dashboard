// Custom Hook - Team Management
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import * as teamService from '../services/teamService';

export function useTeam(selectedWO) {
  const [teamMembers, setTeamMembers] = useState([]);
  const [currentTeamList, setCurrentTeamList] = useState([]);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState({});
  
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (selectedWO && selectedWO.wo_id) {
      loadTeamForWorkOrder(selectedWO.wo_id);
    }
  }, [selectedWO?.wo_id]);

  async function loadTeamForWorkOrder(woId) {
    const data = await teamService.loadTeamForWorkOrder(supabase, woId);
    setCurrentTeamList(data);
  }

  async function loadAllTeamMembers() {
    try {
      const data = await teamService.loadAllTeamMembers(supabase);
      setTeamMembers(data);
      setShowTeamModal(true);
    } catch (err) {
      alert('Error loading team members: ' + err.message);
    }
  }

  async function addTeamMember(memberId, woId, onComplete) {
    try {
      setSaving(true);
      await teamService.addTeamMember(supabase, woId, memberId);
      await loadTeamForWorkOrder(woId);
      setShowTeamModal(false);
      if (onComplete) onComplete();
    } catch (err) {
      alert('Error adding team member: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeTeamMember(assignmentId) {
    if (!selectedWO?.wo_id) return;
    
    const confirmed = window.confirm('Are you sure you want to remove this team member?');
    if (!confirmed) return;

    try {
      setSaving(true);
      await teamService.removeTeamMember(supabase, assignmentId);
      await loadTeamForWorkOrder(selectedWO.wo_id);
    } catch (err) {
      alert('Error removing team member: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateTeamMemberField(assignmentId, field, value) {
    try {
      setSaving(true);
      await teamService.updateTeamMemberField(supabase, assignmentId, field, value);
      
      // Update local state
      setCurrentTeamList(currentTeamList.map(member => 
        member.assignment_id === assignmentId 
          ? { ...member, [field]: value }
          : member
      ));

      // Clear editing field
      const key = `team_${assignmentId}_${field}`;
      const { [key]: removed, ...rest } = editingField;
      setEditingField(rest);
    } catch (err) {
      alert('Error updating team member: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleTeamFieldChange(assignmentId, field, value) {
    setEditingField({ 
      ...editingField, 
      [`team_${assignmentId}_${field}`]: value 
    });
  }

  // Updated to accept assignmentId directly for easier use in components
  function getTeamFieldValue(assignmentId, field) {
    const key = `team_${assignmentId}_${field}`;
    if (editingField.hasOwnProperty(key)) {
      return editingField[key];
    }
    // Find the member in currentTeamList
    const member = currentTeamList.find(m => m.assignment_id === assignmentId);
    return member ? (member[field] || '') : '';
  }

  return {
    teamMembers,
    currentTeamList,
    showTeamModal,
    setShowTeamModal,
    saving,
    loadAllTeamMembers,
    addTeamMember,
    removeTeamMember,
    updateTeamMemberField,
    handleTeamFieldChange,
    getTeamFieldValue,
    loadTeamForWorkOrder
  };
}
