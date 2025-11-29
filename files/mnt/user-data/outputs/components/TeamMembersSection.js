// Team Members Section Component
export default function TeamMembersSection({
  currentTeamList,
  status,
  saving,
  onLoadTeamMembers,
  getTeamFieldValue,
  handleTeamFieldChange,
  handleUpdateTeamMemberField
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold">Team Members</h3>
        {status !== 'completed' && (
          <button
            onClick={onLoadTeamMembers}
            className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg text-sm font-semibold"
          >
            + Add Helper/Tech
          </button>
        )}
      </div>
      {currentTeamList.length > 0 ? (
        <div className="space-y-4">
          {currentTeamList.map((member) => (
            <div key={member.assignment_id} className="bg-gray-700 rounded-lg p-3">
              <p className="font-semibold mb-3">
                {member.user?.first_name || 'Unknown'} {member.user?.last_name || ''}
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">RT (hrs)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={getTeamFieldValue(member, 'hours_regular')}
                    onChange={(e) => handleTeamFieldChange(member.assignment_id, 'hours_regular', e.target.value)}
                    onBlur={(e) => handleUpdateTeamMemberField(member.assignment_id, 'hours_regular', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 bg-gray-600 rounded text-white text-sm"
                    disabled={saving || status === 'completed'}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">OT (hrs)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={getTeamFieldValue(member, 'hours_overtime')}
                    onChange={(e) => handleTeamFieldChange(member.assignment_id, 'hours_overtime', e.target.value)}
                    onBlur={(e) => handleUpdateTeamMemberField(member.assignment_id, 'hours_overtime', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 bg-gray-600 rounded text-white text-sm"
                    disabled={saving || status === 'completed'}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Miles</label>
                  <input
                    type="number"
                    step="0.1"
                    value={getTeamFieldValue(member, 'miles')}
                    onChange={(e) => handleTeamFieldChange(member.assignment_id, 'miles', e.target.value)}
                    onBlur={(e) => handleUpdateTeamMemberField(member.assignment_id, 'miles', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 bg-gray-600 rounded text-white text-sm"
                    disabled={saving || status === 'completed'}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-400 text-sm text-center py-2">No additional team members yet</p>
      )}
    </div>
  );
}