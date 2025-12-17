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

  function getTeamFieldValue(member, field) {
    const key = `team_${member.assignment_id}_${field}`;
    return editingField.hasOwnProperty(key) ? editingField[key] : (member[field] || '');
  }

  return {
    teamMembers,
    currentTeamList,
    showTeamModal,
    setShowTeamModal,
    saving,
    loadAllTeamMembers,
    addTeamMember,
    updateTeamMemberField,
    handleTeamFieldChange,
    getTeamFieldValue,
    loadTeamForWorkOrder
  };
}
