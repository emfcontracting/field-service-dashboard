// app/dashboard/components/TeamMemberModal.js
'use client';

import { useState } from 'react';
import { addTeamMember } from '../utils/dataFetchers';

export default function TeamMemberModal({ workOrder, users, supabase, onClose, onTeamMemberAdded }) {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('helper');
  const [saving, setSaving] = useState(false);

  // Filter available users (exclude already assigned)
  const availableUsers = users.filter(u => 
    (u.role === 'lead_tech' || u.role === 'tech' || u.role === 'helper') &&
    u.user_id !== workOrder.lead_tech_id &&
    !(workOrder.teamMembers || []).some(tm => tm.user_id === u.user_id)
  );

  // Group users by role for better organization
  const groupedUsers = {
    lead_tech: availableUsers.filter(u => u.role === 'lead_tech'),
    tech: availableUsers.filter(u => u.role === 'tech'),
    helper: availableUsers.filter(u => u.role === 'helper')
  };

  const handleAddTeamMember = async () => {
    if (!selectedUserId) {
      alert('Please select a team member');
      return;
    }

    setSaving(true);

    try {
      await addTeamMember(supabase, workOrder.wo_id, selectedUserId, selectedRole);
      
      // Fetch updated team members
      const { data: updatedTeamMembers } = await supabase
        .from('work_order_assignments')
        .select(`
          *,
          user:users(first_name, last_name, email, role)
        `)
        .eq('wo_id', workOrder.wo_id);
      
      const selectedUser = users.find(u => u.user_id === selectedUserId);
      alert(`✅ ${selectedUser.first_name} ${selectedUser.last_name} added to team!`);
      
      // Update the work order with new team members
      onTeamMemberAdded({ 
        ...workOrder, 
        teamMembers: updatedTeamMembers || [] 
      });
    } catch (error) {
      alert('Failed to add team member: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-600 p-6 w-full max-w-md">
        <h3 className="text-xl font-bold text-white mb-4">Add Team Member</h3>
        
        <div className="space-y-4">
          {/* Team Member Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Select Team Member
            </label>
            {availableUsers.length === 0 ? (
              <div className="bg-yellow-900 text-yellow-200 p-4 rounded-lg text-sm">
                <div className="font-semibold mb-1">⚠️ No Available Team Members</div>
                <p>All active technicians and helpers are already assigned to this work order.</p>
              </div>
            ) : (
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                size={Math.min(availableUsers.length + 1, 8)}
              >
                <option value="">Choose a person...</option>
                
                {/* Lead Techs */}
                {groupedUsers.lead_tech.length > 0 && (
                  <>
                    <optgroup label="Lead Technicians">
                      {groupedUsers.lead_tech.map(user => (
                        <option key={user.user_id} value={user.user_id}>
                          {user.first_name} {user.last_name}
                        </option>
                      ))}
                    </optgroup>
                  </>
                )}
                
                {/* Technicians */}
                {groupedUsers.tech.length > 0 && (
                  <>
                    <optgroup label="Technicians">
                      {groupedUsers.tech.map(user => (
                        <option key={user.user_id} value={user.user_id}>
                          {user.first_name} {user.last_name}
                        </option>
                      ))}
                    </optgroup>
                  </>
                )}
                
                {/* Helpers */}
                {groupedUsers.helper.length > 0 && (
                  <>
                    <optgroup label="Helpers">
                      {groupedUsers.helper.map(user => (
                        <option key={user.user_id} value={user.user_id}>
                          {user.first_name} {user.last_name}
                        </option>
                      ))}
                    </optgroup>
                  </>
                )}
              </select>
            )}
          </div>

          {/* Role on this Job */}
          {selectedUserId && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Role on this Job
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="helper">Helper</option>
                <option value="tech">Technician</option>
                <option value="lead_tech">Co-Lead Tech</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                This defines their role for this specific work order
              </p>
            </div>
          )}

          {/* Selected User Info */}
          {selectedUserId && (() => {
            const selectedUser = users.find(u => u.user_id === selectedUserId);
            if (selectedUser) {
              return (
                <div className="bg-gray-700 rounded-lg p-3">
                  <div className="text-sm text-gray-400 mb-1">Selected:</div>
                  <div className="font-semibold">{selectedUser.first_name} {selectedUser.last_name}</div>
                  <div className="text-xs text-gray-400">{selectedUser.email}</div>
                  <div className="text-xs text-gray-400">
                    Current Role: {selectedUser.role.replace('_', ' ').toUpperCase()}
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Info Box */}
          <div className="bg-blue-900 rounded-lg p-3 text-blue-200 text-sm">
            <div className="font-semibold mb-1">ℹ️ Team Member Info:</div>
            <ul className="text-xs space-y-1">
              <li>• Team members can log hours and mileage</li>
              <li>• They will see this work order in the mobile app</li>
              <li>• You can update their hours after adding them</li>
              <li>• Role on job doesn't change their system role</li>
            </ul>
          </div>
        </div>

        {/* Modal Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 border border-gray-500 text-white rounded-lg font-semibold transition"
          >
            Cancel
          </button>
          <button
            onClick={handleAddTeamMember}
            disabled={saving || !selectedUserId}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition"
          >
            {saving ? 'Adding...' : 'Add Member'}
          </button>
        </div>
      </div>
    </div>
  );
}