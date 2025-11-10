// mobile/components/TeamModal.js
'use client';

import { useState, useEffect } from 'react';
import { 
  loadTeamForWorkOrder, 
  addTeamMember, 
  removeTeamMember 
} from '../utils/timeTracking';

export default function TeamModal({ 
  isOpen, 
  onClose, 
  workOrder, 
  currentUser,
  supabase, 
  saving, 
  setSaving 
}) {
  const [allUsers, setAllUsers] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);

  useEffect(() => {
    if (isOpen && workOrder?.wo_id) {
      fetchAllUsers();
      fetchTeamMembers();
    }
  }, [isOpen, workOrder?.wo_id]);

  const fetchAllUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .in('role', ['lead_tech', 'tech', 'helper'])
        .neq('user_id', currentUser.user_id)
        .order('first_name');

      if (error) throw error;
      setAllUsers(data || []);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const fetchTeamMembers = async () => {
    const result = await loadTeamForWorkOrder(supabase, workOrder.wo_id);
    if (result.success) {
      setTeamMembers(result.data);
    }
  };

  const handleAddTeamMember = async (userId) => {
    setSaving(true);
    const result = await addTeamMember(supabase, workOrder.wo_id, userId);
    
    if (result.success) {
      await fetchTeamMembers();
    } else {
      alert('Error adding team member: ' + result.error);
    }
    setSaving(false);
  };

  const handleRemoveTeamMember = async (teamId) => {
    if (!confirm('Remove this team member?')) return;

    setSaving(true);
    const result = await removeTeamMember(supabase, teamId);
    
    if (result.success) {
      await fetchTeamMembers();
    } else {
      alert('Error removing team member: ' + result.error);
    }
    setSaving(false);
  };

  if (!isOpen) return null;

  const teamMemberUserIds = teamMembers.map(tm => tm.user_id);
  const availableUsers = allUsers.filter(u => !teamMemberUserIds.includes(u.user_id));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">👥 Team Members</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Current Team Members */}
        <div className="mb-6">
          <h3 className="font-semibold mb-2 text-sm text-gray-400">Current Team</h3>
          {teamMembers.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No team members yet</p>
          ) : (
            <div className="space-y-2">
              {teamMembers.map((member) => (
                <div key={member.team_id} className="bg-gray-700 rounded p-3 flex justify-between items-center">
                  <div>
                    <div className="font-semibold">
                      {member.user?.first_name} {member.user?.last_name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {member.user?.role.replace('_', ' ').toUpperCase()}
                    </div>
                    {member.time_in && (
                      <div className="text-xs text-green-500 mt-1">
                        ✓ Checked in
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveTeamMember(member.team_id)}
                    disabled={saving}
                    className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm disabled:bg-gray-600"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Available Users */}
        <div>
          <h3 className="font-semibold mb-2 text-sm text-gray-400">Add Team Member</h3>
          {availableUsers.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No available workers</p>
          ) : (
            <div className="space-y-2">
              {availableUsers.map((user) => (
                <div key={user.user_id} className="bg-gray-700 rounded p-3 flex justify-between items-center">
                  <div>
                    <div className="font-semibold">
                      {user.first_name} {user.last_name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {user.role.replace('_', ' ').toUpperCase()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddTeamMember(user.user_id)}
                    disabled={saving}
                    className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm disabled:bg-gray-600"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-6 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg"
        >
          Close
        </button>
      </div>
    </div>
  );
}