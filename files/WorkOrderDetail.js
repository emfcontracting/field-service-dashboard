// Work Order Detail View Component
import { formatDate, formatDateTime, calculateAge, getStatusBadge } from '../utils/helpers';
import CostSummarySection from './CostSummarySection';
import EmailPhotosSection from './EmailPhotosSection';
import PrimaryTechFieldData from './PrimaryTechFieldData';
import TeamMembersSection from './TeamMembersSection';

export default function WorkOrderDetail({
  workOrder,
  currentUser,
  currentTeamList,
  saving,
  newComment,
  setNewComment,
  onBack,
  onCheckIn,
  onCheckOut,
  onCompleteWorkOrder,
  onUpdateField,
  onAddComment,
  onLoadTeamMembers,
  onShowChangePin,
  onLogout,
  getFieldValue,
  handleFieldChange,
  getTeamFieldValue,
  handleTeamFieldChange,
  handleUpdateTeamMemberField
}) {
  const wo = workOrder || {};
  const woNumber = wo.wo_number || 'Unknown';
  const building = wo.building || 'Unknown Location';
  const description = wo.work_order_description || 'No description';
  const status = wo.status || 'assigned';
  const nte = wo.nte || 0;
  const dateEntered = wo.date_entered;
  const requestor = wo.requestor || 'N/A';
  const leadTech = wo.lead_tech || {};

  function handlePrintWO() {
    const age = calculateAge(dateEntered);
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Unable to open print window. Please check your popup settings.');
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Work Order ${woNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #1e40af; }
          .header { border-bottom: 2px solid #1e40af; padding-bottom: 10px; margin-bottom: 20px; }
          .section { margin-bottom: 20px; }
          .label { font-weight: bold; color: #4b5563; }
          .value { margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
          th { background-color: #f3f4f6; }
          @media print {
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Work Order: ${woNumber}</h1>
          <p><strong>Created:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="section">
          <h2>Work Order Details</h2>
          <div class="value"><span class="label">Building:</span> ${building}</div>
          <div class="value"><span class="label">Priority:</span> ${wo.priority || 'N/A'}</div>
          <div class="value"><span class="label">Status:</span> ${(status || '').replace('_', ' ').toUpperCase()}</div>
          <div class="value"><span class="label">Age:</span> ${age} days</div>
          <div class="value"><span class="label">Date Entered:</span> ${formatDate(dateEntered)}</div>
          <div class="value"><span class="label">Requestor:</span> ${requestor}</div>
          <div class="value"><span class="label">NTE:</span> $${nte.toFixed(2)}</div>
        </div>
        
        <div class="section">
          <h2>Description</h2>
          <p>${description}</p>
        </div>
        
        <div class="section">
          <h2>Team</h2>
          <div class="value"><span class="label">Lead Tech:</span> ${leadTech.first_name || ''} ${leadTech.last_name || ''}</div>
          ${currentTeamList.map((member, idx) => 
            `<div class="value"><span class="label">Helper ${idx + 1}:</span> ${member.user?.first_name || ''} ${member.user?.last_name || ''}</div>`
          ).join('')}
        </div>
        
        <div class="section">
          <h2>Time & Costs</h2>
          <table>
            <tr>
              <th>Item</th>
              <th>Amount</th>
            </tr>
            <tr>
              <td>Regular Hours</td>
              <td>${wo.hours_regular || 0} hrs</td>
            </tr>
            <tr>
              <td>Overtime Hours</td>
              <td>${wo.hours_overtime || 0} hrs</td>
            </tr>
            <tr>
              <td>Miles</td>
              <td>${wo.miles || 0} mi</td>
            </tr>
            <tr>
              <td>Material Cost</td>
              <td>$${(wo.material_cost || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td>Equipment Cost</td>
              <td>$${(wo.emf_equipment_cost || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td>Trailer Cost</td>
              <td>$${(wo.trailer_cost || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td>Rental Cost</td>
              <td>$${(wo.rental_cost || 0).toFixed(2)}</td>
            </tr>
          </table>
        </div>
        
        ${wo.comments ? `
          <div class="section">
            <h2>Comments</h2>
            <p style="white-space: pre-wrap;">${wo.comments}</p>
          </div>
        ` : ''}
        
        <div class="section" style="margin-top: 40px;">
          <p><strong>Signature:</strong> ___________________________ <strong>Date:</strong> _______________</p>
        </div>
        
        <button onclick="window.print()" style="margin-top: 20px; padding: 10px 20px; background: #1e40af; color: white; border: none; cursor: pointer; border-radius: 5px;">
          Print
        </button>
      </body>
      </html>
    `);
    
    printWindow.document.close();
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={onBack}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold">{woNumber}</h1>
          <div className="flex gap-2">
            {/* Only show Dashboard for admin/office */}
            {(currentUser.role === 'admin' || currentUser.role === 'office') && (
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg text-sm"
                title="Dashboard"
              >
                💻
              </button>
            )}
            <button
              onClick={onShowChangePin}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm"
            >
              🔑
            </button>
            <button
              onClick={onLogout}
              className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg text-sm"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Work Order Details */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-3 text-blue-400">Work Order Details</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-400">Building:</span>
                <p className="font-semibold">{building}</p>
              </div>
              <div>
                <span className="text-gray-400">Requestor:</span>
                <p className="font-semibold">{requestor}</p>
              </div>
              <div>
                <span className="text-gray-400">Description:</span>
                <p className="text-gray-300">{description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-700">
                <div>
                  <span className="text-gray-400">Date Entered:</span>
                  <p className="font-semibold">{formatDate(dateEntered)}</p>
                </div>
                <div>
                  <span className="text-gray-400">Age:</span>
                  <p className="font-semibold text-orange-500">{calculateAge(dateEntered)} days</p>
                </div>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                <span className="text-gray-400">NTE (Not to Exceed):</span>
                <span className="text-green-500 font-bold text-lg">${nte.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-3">Quick Actions</h3>
            <button
              onClick={handlePrintWO}
              className="w-full bg-gray-700 hover:bg-gray-600 py-3 rounded-lg font-semibold"
            >
              🖨️ Print WO
            </button>
          </div>

          {/* Check In/Out */}
          {status !== 'completed' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => onCheckIn(wo.wo_id)}
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700 py-4 rounded-lg font-bold text-lg transition active:scale-95 disabled:bg-gray-600"
                >
                  ✔ CHECK IN
                </button>
                <button
                  onClick={() => onCheckOut(wo.wo_id)}
                  disabled={saving}
                  className="bg-orange-600 hover:bg-orange-700 py-4 rounded-lg font-bold text-lg transition active:scale-95 disabled:bg-gray-600"
                >
                  ⏸ CHECK OUT
                </button>
              </div>
              {wo.time_in && (
                <div className="bg-gray-800 rounded-lg p-3 text-center text-sm">
                  <p className="text-gray-400">
                    First Check-In: {formatDate(wo.time_in)}
                    {wo.time_out && (
                      <> • First Check-Out: {formatDate(wo.time_out)}</>
                    )}
                  </p>
                  <p className="text-blue-400 text-xs mt-1">
                    See Comments below for full check-in/out history
                  </p>
                </div>
              )}
            </>
          )}

          {/* Primary Assignment */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-3">Primary Assignment</h3>
            <div className="bg-gray-700 rounded-lg p-3">
              <p className="font-semibold">
                {leadTech.first_name || 'Unknown'} {leadTech.last_name || ''}
              </p>
            </div>
          </div>

          {/* Team Members Section */}
          <TeamMembersSection
            currentTeamList={currentTeamList}
            status={status}
            saving={saving}
            onLoadTeamMembers={onLoadTeamMembers}
            getTeamFieldValue={getTeamFieldValue}
            handleTeamFieldChange={handleTeamFieldChange}
            handleUpdateTeamMemberField={handleUpdateTeamMemberField}
          />

          {/* Update Status */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-3">Update Status</h3>
            <select
              value={status}
              onChange={(e) => onUpdateField(wo.wo_id, 'status', e.target.value)}
              disabled={saving || status === 'completed'}
              className="w-full px-4 py-3 bg-blue-600 rounded-lg text-white font-semibold text-center"
            >
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="pending">Pending</option>
              <option value="needs_return">Needs Return</option>
              <option value="return_trip">Return Trip</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Primary Tech Field Data */}
          <PrimaryTechFieldData
            workOrder={wo}
            status={status}
            saving={saving}
            getFieldValue={getFieldValue}
            handleFieldChange={handleFieldChange}
            handleUpdateField={onUpdateField}
          />

          {/* Email Photos Section */}
          <EmailPhotosSection
            workOrder={wo}
            currentUser={currentUser}
          />

          {/* Cost Summary Section */}
          <CostSummarySection
            workOrder={wo}
            currentTeamList={currentTeamList}
          />

          {/* Comments */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-3">Comments & Notes</h3>
            <div className="mb-3 max-h-40 overflow-y-auto bg-gray-700 rounded-lg p-3">
              {wo.comments ? (
                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans">
                  {wo.comments}
                </pre>
              ) : (
                <p className="text-gray-500 text-sm">No comments yet</p>
              )}
            </div>
            {status !== 'completed' && (
              <>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="w-full px-3 py-2 bg-gray-700 rounded-lg mb-2 text-sm text-white"
                  rows="3"
                  disabled={saving}
                />
                <button
                  onClick={onAddComment}
                  disabled={saving || !newComment.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-lg text-sm font-semibold disabled:bg-gray-600"
                >
                  Add Comment
                </button>
              </>
            )}
          </div>

          {/* Complete Work Order Button */}
          {wo.time_out && status !== 'completed' && (
            <button
              onClick={onCompleteWorkOrder}
              disabled={saving}
              className="w-full bg-green-600 hover:bg-green-700 py-4 rounded-lg font-bold text-lg transition active:scale-95"
            >
              ✅ Complete Work Order
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
