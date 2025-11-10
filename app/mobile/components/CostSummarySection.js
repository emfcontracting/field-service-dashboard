// app/mobile/components/TeamMembersSection.js
'use client';

import { useState, useEffect } from 'react';
import { loadTeamForWorkOrder } from '../utils/timeTracking';

export default function TeamMembersSection({ workOrder, supabase, saving, setSaving }) {
  const [teamMembers, setTeamMembers] = useState([]);

  useEffect(() => {
    if (workOrder?.wo_id) {
      fetchTeamMembers();
    }
  }, [workOrder?.wo_id]);

  const fetchTeamMembers = async () => {
    const result = await loadTeamForWorkOrder(supabase, workOrder.wo_id);
    if (result.success) {
      setTeamMembers(result.data);
    }
  };

  if (teamMembers.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-white">👥 Team Members</h3>
          <span className="text-gray-500 text-sm">No team members</span>
        </div>
        <p className="text-gray-400 text-sm text-center py-3">
          Use the Team button above to add team members
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-white">👥 Team Members</h3>
        <span className="text-blue-400 text-sm">{teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="space-y-2">
        {teamMembers.map((member) => (
          <div
            key={member.team_id}
            className="bg-gray-700 rounded p-3"
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="text-white font-medium">
                  {member.user?.first_name} {member.user?.last_name}
                </div>
                <div className="text-gray-400 text-sm capitalize">
                  {member.user?.role?.replace('_', ' ')}
                </div>
                {member.time_in && (
                  <div className="text-green-500 text-xs mt-1">
                    ✓ Checked in
                  </div>
                )}
              </div>
              <div className="text-right">
                {member.hours_regular > 0 && (
                  <div className="text-xs text-gray-400">
                    RT: {member.hours_regular.toFixed(2)}h
                  </div>
                )}
                {member.hours_overtime > 0 && (
                  <div className="text-xs text-gray-400">
                    OT: {member.hours_overtime.toFixed(2)}h
                  </div>
                )}
                {member.miles > 0 && (
                  <div className="text-xs text-gray-400">
                    Miles: {member.miles}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 text-xs text-gray-500 text-center">
        Use Team button to add or remove members
      </div>
    </div>
  );
}