// app/demo/mobile/page.js
// Demo Mobile App - Matching the Original Mobile App Design & Structure
// For Summit Mechanical Services (Demo Company)
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { DEMO_USERS, generateDemoWorkOrders, getCBREStatusBadge } from '../mockData';

// Get field workers for demo
const FIELD_USERS = DEMO_USERS.filter(u => ['lead_tech', 'tech', 'helper'].includes(u.role));
const OFFICE_USERS = DEMO_USERS.filter(u => ['admin', 'office'].includes(u.role));

// Generate work orders once
const ALL_WORK_ORDERS = generateDemoWorkOrders();

// Helper functions (matching original)
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function calculateAge(dateString) {
  if (!dateString) return 0;
  const entered = new Date(dateString);
  const now = new Date();
  return Math.floor((now - entered) / (1000 * 60 * 60 * 24));
}

function getPriorityColor(priority) {
  switch (priority?.toLowerCase()) {
    case 'emergency': return 'text-red-500';
    case 'high': return 'text-orange-500';
    case 'medium': return 'text-yellow-500';
    default: return 'text-gray-400';
  }
}

function getPriorityBadge(priority) {
  switch (priority?.toLowerCase()) {
    case 'emergency': return '🔴';
    case 'high': return '🟠';
    case 'medium': return '🟡';
    default: return '🟢';
  }
}

function getStatusBadge(status) {
  switch (status) {
    case 'in_progress': return '🔧 In Progress';
    case 'assigned': return '📋 Assigned';
    case 'completed': return '✅ Completed';
    case 'pending': return '⏳ Pending';
    case 'tech_review': return '🔍 Tech Review';
    case 'return_trip': return '🔄 Return Trip';
    default: return status;
  }
}

// Demo Banner Component
function DemoBanner({ onBack }) {
  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>🎯</span>
          <span className="text-sm font-medium">Demo Mode</span>
        </div>
        <Link href="/demo" className="bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-xs">
          ← Demo Home
        </Link>
      </div>
    </div>
  );
}

// Login Screen Component
function LoginScreen({ onLogin, error, setError }) {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <DemoBanner />
      
      <div className="flex flex-col items-center justify-center p-6 pt-12">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4">
          <span className="text-white text-4xl font-bold">P</span>
        </div>
        
        <h1 className="text-2xl font-bold mb-1">PCS FieldService</h1>
        <p className="text-gray-400 mb-6">Mobile Tech App</p>

        <div className="w-full max-w-sm mb-6">
          <p className="text-center text-gray-400 text-sm mb-3">
            Select a technician to explore the mobile app:
          </p>
          
          <div className="space-y-2">
            {FIELD_USERS.map(user => (
              <button
                key={user.user_id}
                onClick={() => onLogin(user)}
                className="w-full bg-gray-800 hover:bg-gray-700 p-3 rounded-lg flex items-center gap-3 transition"
              >
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-lg font-bold">
                  {user.first_name[0]}
                </div>
                <div className="text-left flex-1">
                  <div className="font-semibold text-sm">{user.first_name} {user.last_name}</div>
                  <div className="text-xs text-gray-400 capitalize">{user.role.replace('_', ' ')}</div>
                </div>
                <span className="text-gray-500">→</span>
              </button>
            ))}
          </div>
        </div>

        <div className="w-full max-w-sm flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-gray-700"></div>
          <span className="text-gray-500 text-sm">or login manually</span>
          <div className="flex-1 h-px bg-gray-700"></div>
        </div>

        <div className="w-full max-w-sm space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@company.com"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">PIN</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter your 4-digit PIN"
              maxLength={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-center text-2xl tracking-widest focus:border-blue-500 focus:outline-none"
            />
          </div>
          
          {error && (
            <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={() => {
              const user = [...FIELD_USERS, ...OFFICE_USERS].find(u => 
                u.email.toLowerCase() === email.toLowerCase()
              );
              if (user) {
                onLogin(user);
              } else {
                setError('User not found. Try selecting from the list above.');
              }
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold"
          >
            Login
          </button>
        </div>

        <p className="text-gray-500 text-xs mt-8">
          Demo: Any email from the list above works
        </p>
      </div>
    </div>
  );
}

// Work Orders List Component
function WorkOrdersList({
  currentUser,
  workOrders,
  onSelectWO,
  onShowCompleted,
  onShowChangePin,
  onLogout,
  onSwitchUser
}) {
  const [weatherExpanded, setWeatherExpanded] = useState(false);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <DemoBanner />

      <div className="bg-gray-800 p-3 sticky top-0 z-10">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">P</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-sm leading-tight">👋 {currentUser.first_name}</p>
                <span className="text-xs bg-green-600 px-1.5 py-0.5 rounded">🌐</span>
              </div>
              <p className="text-[10px] text-gray-400 leading-tight">{currentUser.role.replace('_', ' ').toUpperCase()}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg text-sm"
          >
            Logout
          </button>
        </div>

        <div className="mb-2 px-3 py-2 rounded-lg text-xs bg-blue-900/50 border border-blue-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>📥</span>
            <span className="text-blue-300">
              {workOrders.length} work orders loaded for demo
            </span>
          </div>
          <button
            onClick={onSwitchUser}
            className="text-blue-400 hover:text-blue-300 font-medium"
          >
            Switch User
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0">
            🌐 EN
          </button>
          
          {(currentUser.role === 'admin' || currentUser.role === 'office') && (
            <Link
              href="/demo/dashboard"
              className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0"
            >
              💻 Dashboard
            </Link>
          )}
          <button
            onClick={onShowCompleted}
            className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0"
          >
            ✅ Completed
          </button>
          <button
            onClick={onShowChangePin}
            className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0"
          >
            🔒 PIN
          </button>
        </div>
      </div>

      <div className="p-4">
        <div 
          className="bg-gray-800 rounded-lg p-3 mb-4 cursor-pointer"
          onClick={() => setWeatherExpanded(!weatherExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">☀️</span>
              <div>
                <span className="font-bold">72°F</span>
                <span className="text-gray-400 text-sm ml-2">Columbia, SC</span>
              </div>
            </div>
            <span className="text-gray-500">{weatherExpanded ? '▲' : '▼'}</span>
          </div>
          {weatherExpanded && (
            <div className="mt-3 pt-3 border-t border-gray-700 grid grid-cols-4 gap-2 text-center text-xs">
              <div><div className="text-lg">🌅</div><div className="text-gray-400">68°</div></div>
              <div><div className="text-lg">☀️</div><div className="text-gray-400">75°</div></div>
              <div><div className="text-lg">⛅</div><div className="text-gray-400">71°</div></div>
              <div><div className="text-lg">🌙</div><div className="text-gray-400">62°</div></div>
            </div>
          )}
        </div>

        <div className="mb-4">
          <h2 className="text-xl font-bold">My Work Orders</h2>
          <p className="text-gray-400 text-sm">
            {workOrders.length} active work {workOrders.length === 1 ? 'order' : 'orders'}
          </p>
        </div>

        <div className="space-y-3">
          {workOrders.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-gray-400 text-lg">No active work orders</p>
              <p className="text-gray-500 text-sm mt-2">Check back later for new assignments</p>
            </div>
          ) : (
            workOrders.map(wo => {
              const cbreBadge = getCBREStatusBadge(wo.cbre_status);
              return (
                <div
                  key={wo.wo_id}
                  onClick={() => onSelectWO(wo)}
                  className={`bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition cursor-pointer active:scale-[0.99] ${wo.cbre_status === 'escalation' ? 'border-2 border-red-500' : ''}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-lg">{wo.wo_number}</span>
                      <span className={`ml-2 text-sm ${getPriorityColor(wo.priority)}`}>
                        {getPriorityBadge(wo.priority)}
                      </span>
                    </div>
                    <span className="text-xs bg-gray-700 px-2 py-1 rounded-full ml-2 flex-shrink-0">
                      {getStatusBadge(wo.status)}
                    </span>
                  </div>
                  
                  {cbreBadge && (
                    <div className="mb-2">
                      <span className={`text-xs px-2 py-1 rounded ${cbreBadge.color}`}>
                        {cbreBadge.shortText}
                      </span>
                    </div>
                  )}
                  
                  <h3 className="font-semibold mb-1">{wo.building}</h3>
                  <p className="text-sm text-gray-400 mb-2 line-clamp-2">{wo.work_order_description}</p>
                  
                  <div className="flex flex-wrap justify-between items-center text-xs text-gray-500 gap-1">
                    <div>
                      <span>Entered: {formatDate(wo.date_entered)}</span>
                      <span className="ml-2 text-orange-500 font-semibold">
                        {calculateAge(wo.date_entered)} days old
                      </span>
                    </div>
                    <span className="text-green-500 font-bold">NTE: ${(wo.nte || 0).toFixed(2)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// Work Order Detail Component - ALL SECTIONS ON ONE SCROLLABLE PAGE (matching original)
function WorkOrderDetail({
  workOrder,
  currentUser,
  onBack,
  onCheckIn,
  onCheckOut,
  onComplete,
  onShowChangePin,
  onLogout
}) {
  const cbreBadge = getCBREStatusBadge(workOrder.cbre_status);
  const [newComment, setNewComment] = useState('');
  const [commentSaveStatus, setCommentSaveStatus] = useState('idle');
  const [status, setStatus] = useState(workOrder.status);
  
  // Daily Hours State
  const [dailyHours, setDailyHours] = useState({
    regular_time: '',
    overtime: '',
    miles: '',
    tech_material_cost: '',
    work_date: new Date().toISOString().split('T')[0]
  });

  // Mock daily logs
  const [dailyLogs] = useState([
    { work_date: new Date(Date.now() - 86400000).toISOString().split('T')[0], regular_time: 6, overtime: 2, miles: 30, user_id: currentUser.user_id },
    { work_date: new Date(Date.now() - 172800000).toISOString().split('T')[0], regular_time: 8, overtime: 0, miles: 25, user_id: currentUser.user_id }
  ]);

  // Mock team members
  const [teamMembers] = useState([
    { user_id: 'tm1', first_name: 'James', last_name: 'Wilson', role: 'tech', regular_time: 4, overtime: 1, miles: 15 },
    { user_id: 'tm2', first_name: 'Tyler', last_name: 'Anderson', role: 'helper', regular_time: 6, overtime: 0, miles: 0 }
  ]);

  // Mock comments
  const [comments] = useState('On site, starting assessment.\n\nParts ordered from supply house - waiting for delivery.\n\nWork completed, all systems tested and operational.');

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    setCommentSaveStatus('saving');
    setTimeout(() => {
      setCommentSaveStatus('success');
      setNewComment('');
      setTimeout(() => setCommentSaveStatus('idle'), 2000);
    }, 500);
  };

  const handleSaveHours = () => {
    alert('✅ Hours Saved - Demo Only');
  };

  // Calculate costs (matching original)
  const laborRate = 64;
  const otRate = 96;
  const mileRate = 1;
  const markup = 1.25;

  const myHours = dailyLogs.filter(l => l.user_id === currentUser.user_id).reduce((sum, log) => sum + (log.regular_time || 0), 0);
  const myOT = dailyLogs.filter(l => l.user_id === currentUser.user_id).reduce((sum, log) => sum + (log.overtime || 0), 0);
  const myMiles = dailyLogs.filter(l => l.user_id === currentUser.user_id).reduce((sum, log) => sum + (log.miles || 0), 0);
  
  const teamHours = teamMembers.reduce((sum, tm) => sum + (tm.regular_time || 0), 0);
  const teamOT = teamMembers.reduce((sum, tm) => sum + (tm.overtime || 0), 0);
  const teamMiles = teamMembers.reduce((sum, tm) => sum + (tm.miles || 0), 0);

  const totalHours = myHours + teamHours;
  const totalOT = myOT + teamOT;
  const totalMiles = myMiles + teamMiles;

  const laborCost = (totalHours * laborRate + totalOT * otRate) * markup;
  const mileageCost = totalMiles * mileRate * markup;
  const materialCost = (workOrder.material_cost || 0) * markup;
  const equipmentCost = (workOrder.equipment_cost || 0) * markup;
  const trailerCost = (workOrder.trailer_cost || 0) * markup;
  const rentalCost = (workOrder.rental_cost || 0) * markup;
  const totalCost = laborCost + mileageCost + materialCost + equipmentCost + trailerCost + rentalCost;
  const remainingBudget = (workOrder.nte || 0) - totalCost;

  const wo = workOrder;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={onBack}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold">{wo.wo_number}</h1>
          <div className="flex gap-2">
            {(currentUser.role === 'admin' || currentUser.role === 'office') && (
              <Link
                href="/demo/dashboard"
                className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg text-sm"
                title="Dashboard"
              >
                💻
              </Link>
            )}
            <button
              onClick={onShowChangePin}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm"
            >
              🔒
            </button>
            <button
              onClick={onLogout}
              className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg text-sm"
            >
              Logout
            </button>
          </div>
        </div>

        {/* CBRE Status Banner */}
        {cbreBadge && (
          <div className={`mb-4 px-4 py-2 rounded-lg ${cbreBadge.color}`}>
            {cbreBadge.text}
          </div>
        )}

        <div className="space-y-4">
          {/* Work Order Details */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-3 text-blue-400">📋 Work Order Details</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-400">Building:</span>
                <p className="font-semibold">{wo.building}</p>
              </div>
              <div>
                <span className="text-gray-400">Address:</span>
                <p className="text-gray-300">{wo.address}</p>
              </div>
              <div>
                <span className="text-gray-400">Requestor:</span>
                <p className="font-semibold">{wo.requestor || 'N/A'}</p>
              </div>
              <div>
                <span className="text-gray-400">Description:</span>
                <p className="text-gray-300">{wo.work_order_description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-700">
                <div>
                  <span className="text-gray-400">Date Entered:</span>
                  <p className="font-semibold">{formatDate(wo.date_entered)}</p>
                </div>
                <div>
                  <span className="text-gray-400">Age:</span>
                  <p className="font-semibold text-orange-500">{calculateAge(wo.date_entered)} days</p>
                </div>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                <span className="text-gray-400">NTE:</span>
                <span className="text-green-500 font-bold text-lg">${(wo.nte || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-3">⚡ Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => alert('Print WO - Demo Only')}
                className="bg-gray-700 hover:bg-gray-600 py-3 rounded-lg font-semibold"
              >
                🖨️ Print WO
              </button>
              {status !== 'completed' && !wo.customer_signature && (
                <button
                  onClick={() => alert('Get Signature - Demo Only')}
                  className="bg-purple-600 hover:bg-purple-700 py-3 rounded-lg font-semibold"
                >
                  ✍️ Get Signature
                </button>
              )}
              {wo.customer_signature && (
                <button
                  onClick={() => alert('View Certificate - Demo Only')}
                  className="bg-green-600 hover:bg-green-700 py-3 rounded-lg font-semibold"
                >
                  📄 Certificate
                </button>
              )}
              <button
                onClick={() => alert('Download CSV - Demo Only')}
                className="bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold"
              >
                📥 My Hours CSV
              </button>
            </div>
          </div>

          {/* Check In/Out */}
          {status !== 'completed' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    onCheckIn();
                    alert('✅ Checked In - Demo Only');
                  }}
                  className="bg-green-600 hover:bg-green-700 py-4 rounded-lg font-bold text-lg transition active:scale-95"
                >
                  ✓ Check In
                </button>
                <button
                  onClick={() => {
                    onCheckOut();
                    alert('⏸ Checked Out - Demo Only');
                  }}
                  className="bg-orange-600 hover:bg-orange-700 py-4 rounded-lg font-bold text-lg transition active:scale-95"
                >
                  ⏸ Check Out
                </button>
              </div>
              {wo.time_in && (
                <div className="bg-gray-800 rounded-lg p-3 text-center text-sm">
                  <p className="text-gray-400">
                    First Check In: {formatDate(wo.time_in)}
                    {wo.time_out && (
                      <> • First Check Out: {formatDate(wo.time_out)}</>
                    )}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Primary Assignment */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-3">👤 Primary Assignment</h3>
            <div className="bg-gray-700 rounded-lg p-3">
              <p className="font-semibold">
                {wo.lead_tech?.first_name || currentUser.first_name} {wo.lead_tech?.last_name || currentUser.last_name}
              </p>
            </div>
          </div>

          {/* Update Status */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-3">📊 Update Status</h3>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={status === 'completed'}
              className="w-full px-4 py-3 bg-blue-600 rounded-lg text-white font-semibold text-center"
            >
              <option value="assigned">📋 Assigned</option>
              <option value="in_progress">🔧 In Progress</option>
              <option value="pending">⏳ Pending</option>
              <option value="tech_review">🔍 Tech Review</option>
              <option value="return_trip">🔄 Return Trip</option>
            </select>
          </div>

          {/* Additional Costs - Materials, Equipment, Trailer, Rental */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-3">💵 Additional Costs</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">Material Cost $</label>
                <input 
                  type="number" 
                  step="0.01"
                  defaultValue={wo.material_cost || ''}
                  placeholder="0.00"
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1" 
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Equipment Cost $</label>
                <input 
                  type="number" 
                  step="0.01"
                  defaultValue={wo.equipment_cost || ''}
                  placeholder="0.00"
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1" 
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Trailer Cost $</label>
                <input 
                  type="number" 
                  step="0.01"
                  defaultValue={wo.trailer_cost || ''}
                  placeholder="0.00"
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1" 
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Rental Cost $</label>
                <input 
                  type="number" 
                  step="0.01"
                  defaultValue={wo.rental_cost || ''}
                  placeholder="0.00"
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1" 
                />
              </div>
            </div>
            <button
              onClick={() => alert('Costs Saved - Demo Only')}
              className="w-full bg-gray-700 hover:bg-gray-600 py-2 rounded-lg font-semibold mt-3"
            >
              💾 Save Costs
            </button>
          </div>

          {/* NTE Increases */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-3">📈 NTE Increases</h3>
            <p className="text-gray-400 text-sm mb-3">Request additional budget when costs exceed NTE</p>
            <button
              onClick={() => alert('Request NTE Increase - Demo Only')}
              className="w-full bg-orange-600 hover:bg-orange-700 py-3 rounded-lg font-semibold"
            >
              + Request NTE Increase
            </button>
          </div>

          {/* Primary Tech Daily Hours */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-3">⏱️ My Daily Hours</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">Regular Hours</label>
                <input 
                  type="number" 
                  step="0.5"
                  value={dailyHours.regular_time}
                  onChange={(e) => setDailyHours({...dailyHours, regular_time: e.target.value})}
                  placeholder="0"
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1" 
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Overtime</label>
                <input 
                  type="number" 
                  step="0.5"
                  value={dailyHours.overtime}
                  onChange={(e) => setDailyHours({...dailyHours, overtime: e.target.value})}
                  placeholder="0"
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1" 
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Miles</label>
                <input 
                  type="number" 
                  value={dailyHours.miles}
                  onChange={(e) => setDailyHours({...dailyHours, miles: e.target.value})}
                  placeholder="0"
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1" 
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Work Date</label>
                <input 
                  type="date" 
                  value={dailyHours.work_date}
                  onChange={(e) => setDailyHours({...dailyHours, work_date: e.target.value})}
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1" 
                />
              </div>
            </div>
            <button
              onClick={handleSaveHours}
              className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-bold mt-3"
            >
              💾 Save Hours
            </button>
            
            {/* Hours Log History */}
            {dailyLogs.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <h4 className="text-sm font-semibold mb-2 text-gray-400">My Hours Log</h4>
                <div className="space-y-2">
                  {dailyLogs.filter(l => l.user_id === currentUser.user_id).map((log, i) => (
                    <div key={i} className="flex justify-between py-2 border-b border-gray-700 last:border-0 text-sm">
                      <span className="text-gray-400">{formatDate(log.work_date)}</span>
                      <span>{log.regular_time}h RT, {log.overtime}h OT, {log.miles} mi</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-gray-700 flex justify-between text-sm">
                  <span className="text-gray-400">My Total</span>
                  <span className="font-bold">{myHours}h RT, {myOT}h OT, {myMiles} mi</span>
                </div>
              </div>
            )}
          </div>

          {/* Team Members Daily Hours */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-3">👥 Team Members</h3>
            <button
              onClick={() => alert('Add Team Member - Demo Only')}
              className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-semibold mb-3"
            >
              + Add Team Member
            </button>
            
            {teamMembers.length > 0 ? (
              <div className="space-y-3">
                {teamMembers.map(member => (
                  <div key={member.user_id} className="bg-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center font-bold text-sm">
                          {member.first_name[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{member.first_name} {member.last_name}</div>
                          <div className="text-xs text-gray-400 capitalize">{member.role}</div>
                        </div>
                      </div>
                      <button className="text-red-400 hover:text-red-300 text-xs">Remove</button>
                    </div>
                    <div className="text-sm text-gray-300">
                      {member.regular_time}h RT, {member.overtime}h OT, {member.miles} mi
                    </div>
                  </div>
                ))}
                <div className="mt-2 pt-2 border-t border-gray-700 flex justify-between text-sm">
                  <span className="text-gray-400">Team Total</span>
                  <span className="font-bold">{teamHours}h RT, {teamOT}h OT, {teamMiles} mi</span>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center py-4">No team members added yet</p>
            )}
          </div>

          {/* Email Photos Section */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-3">📸 Photos</h3>
            <p className="text-gray-400 text-sm mb-3">
              Email photos to the office for this work order
            </p>
            <div className="space-y-2">
              <button
                onClick={() => alert('Email Photos - Demo Only')}
                className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold"
              >
                📧 Email Photos to Office
              </button>
              <button
                onClick={() => alert('Email Receipts - Demo Only')}
                className="w-full bg-green-600 hover:bg-green-700 py-3 rounded-lg font-semibold"
              >
                🧾 Email Receipts
              </button>
            </div>
          </div>

          {/* Cost Summary Section */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-3">💰 Cost Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-700">
                <span className="text-gray-400">Labor ({totalHours} hrs @ ${laborRate})</span>
                <span>${(totalHours * laborRate * markup).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-700">
                <span className="text-gray-400">Overtime ({totalOT} hrs @ ${otRate})</span>
                <span>${(totalOT * otRate * markup).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-700">
                <span className="text-gray-400">Mileage ({totalMiles} mi @ ${mileRate})</span>
                <span>${mileageCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-700">
                <span className="text-gray-400">Materials</span>
                <span>${materialCost.toFixed(2)}</span>
              </div>
              {equipmentCost > 0 && (
                <div className="flex justify-between py-2 border-b border-gray-700">
                  <span className="text-gray-400">Equipment</span>
                  <span>${equipmentCost.toFixed(2)}</span>
                </div>
              )}
              {trailerCost > 0 && (
                <div className="flex justify-between py-2 border-b border-gray-700">
                  <span className="text-gray-400">Trailer</span>
                  <span>${trailerCost.toFixed(2)}</span>
                </div>
              )}
              {rentalCost > 0 && (
                <div className="flex justify-between py-2 border-b border-gray-700">
                  <span className="text-gray-400">Rental</span>
                  <span>${rentalCost.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 text-xs text-gray-500">
                <span>* All costs include 25% markup</span>
              </div>
              <div className="flex justify-between py-3 font-bold text-lg border-t border-gray-700">
                <span>Total</span>
                <span className="text-green-400">${totalCost.toFixed(2)}</span>
              </div>
            </div>

            {/* NTE Budget */}
            <div className={`mt-4 rounded-lg p-4 ${remainingBudget >= 0 ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
              <div className="flex justify-between items-center">
                <span className={remainingBudget >= 0 ? 'text-green-400' : 'text-red-400'}>NTE Budget</span>
                <span className="font-bold">${(wo.nte || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-gray-400">Current Costs</span>
                <span>${totalCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-600">
                <span className="font-bold">Remaining</span>
                <span className={`font-bold text-lg ${remainingBudget >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${remainingBudget.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Comments and Notes */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-3">💬 Comments and Notes</h3>
            <div className="mb-3 max-h-40 overflow-y-auto bg-gray-700 rounded-lg p-3">
              {comments ? (
                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans">
                  {comments}
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
                  disabled={commentSaveStatus === 'saving'}
                />
                
                <button
                  onClick={handleAddComment}
                  disabled={commentSaveStatus === 'saving' || !newComment || !newComment.trim()}
                  className={`w-full py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    commentSaveStatus === 'success'
                      ? 'bg-green-600 hover:bg-green-700'
                      : commentSaveStatus === 'error'
                      ? 'bg-red-600 hover:bg-red-700'
                      : commentSaveStatus === 'saving'
                      ? 'bg-gray-600 cursor-wait'
                      : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600'
                  }`}
                >
                  {commentSaveStatus === 'saving' && '⏳ Saving...'}
                  {commentSaveStatus === 'success' && '✅ Saved!'}
                  {commentSaveStatus === 'error' && '❌ Error - Tap to Retry'}
                  {commentSaveStatus === 'idle' && '💾 Save Comment'}
                </button>
              </>
            )}
          </div>

          {/* Complete Work Order Button */}
          {status !== 'completed' && (
            <button
              onClick={() => {
                onComplete();
                alert('✅ Work Order Completed - Demo Only');
              }}
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

// Completed Work Orders Component
function CompletedWorkOrders({ currentUser, completedWorkOrders, onBack, onSelectWO }) {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <DemoBanner />
      
      <div className="bg-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-2xl">←</button>
        <div className="flex-1">
          <div className="font-bold">Completed Work Orders</div>
          <div className="text-sm text-gray-400">{completedWorkOrders.length} completed</div>
        </div>
      </div>

      <div className="p-4">
        {completedWorkOrders.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-gray-400">No completed work orders</p>
          </div>
        ) : (
          <div className="space-y-3">
            {completedWorkOrders.map(wo => (
              <div
                key={wo.wo_id}
                onClick={() => onSelectWO(wo)}
                className="bg-gray-800 rounded-lg p-4 cursor-pointer hover:bg-gray-750"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold">{wo.wo_number}</span>
                  <span className="text-xs bg-green-600 px-2 py-1 rounded">✅ Completed</span>
                </div>
                <p className="text-sm text-gray-400">{wo.building}</p>
                <p className="text-xs text-gray-500 mt-1">Completed: {formatDate(wo.date_completed)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// User Picker Modal
function UserPickerModal({ currentUser, onSelect, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-xl w-full max-w-sm p-4">
        <h3 className="font-bold mb-4">Switch Technician</h3>
        <div className="space-y-2">
          {FIELD_USERS.map(user => (
            <button
              key={user.user_id}
              onClick={() => onSelect(user)}
              className={`w-full p-3 rounded-lg flex items-center gap-3 transition ${
                user.user_id === currentUser?.user_id 
                  ? 'bg-blue-600' 
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center font-bold">
                {user.first_name[0]}
              </div>
              <div className="text-left">
                <div className="font-semibold">{user.first_name} {user.last_name}</div>
                <div className="text-xs text-gray-400 capitalize">{user.role.replace('_', ' ')}</div>
              </div>
              {user.user_id === currentUser?.user_id && (
                <span className="ml-auto text-xs">Current</span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-full mt-4 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// Change PIN Modal
function ChangePinModal({ show, onClose }) {
  if (!show) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-xl w-full max-w-sm p-4">
        <h3 className="font-bold mb-4">Change PIN</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-400">Current PIN</label>
            <input type="password" maxLength={4} className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1 text-center text-xl tracking-widest" />
          </div>
          <div>
            <label className="text-sm text-gray-400">New PIN</label>
            <input type="password" maxLength={4} className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1 text-center text-xl tracking-widest" />
          </div>
          <div>
            <label className="text-sm text-gray-400">Confirm New PIN</label>
            <input type="password" maxLength={4} className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1 text-center text-xl tracking-widest" />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg">
            Cancel
          </button>
          <button 
            onClick={() => {
              alert('PIN Changed - Demo Only');
              onClose();
            }} 
            className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-semibold"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// MAIN COMPONENT
export default function DemoMobilePage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedWO, setSelectedWO] = useState(null);
  const [showCompletedPage, setShowCompletedPage] = useState(false);
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [error, setError] = useState('');

  const myWorkOrders = currentUser 
    ? ALL_WORK_ORDERS.filter(wo => 
        wo.lead_tech_id === currentUser.user_id || 
        wo.status === 'pending' ||
        (wo.status === 'assigned' && !wo.lead_tech_id)
      ).filter(wo => wo.status !== 'completed').slice(0, 8)
    : [];

  const completedWorkOrders = ALL_WORK_ORDERS.filter(wo => wo.status === 'completed').slice(0, 5);

  const handleLogin = (user) => {
    setCurrentUser(user);
    setError('');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedWO(null);
    setShowCompletedPage(false);
  };

  if (!currentUser) {
    return (
      <LoginScreen 
        onLogin={handleLogin}
        error={error}
        setError={setError}
      />
    );
  }

  if (selectedWO) {
    return (
      <WorkOrderDetail
        workOrder={selectedWO}
        currentUser={currentUser}
        onBack={() => {
          setSelectedWO(null);
          if (selectedWO.status === 'completed') {
            setShowCompletedPage(true);
          }
        }}
        onCheckIn={() => {}}
        onCheckOut={() => {}}
        onComplete={() => {}}
        onShowChangePin={() => setShowChangePinModal(true)}
        onLogout={handleLogout}
      />
    );
  }

  if (showCompletedPage) {
    return (
      <CompletedWorkOrders
        currentUser={currentUser}
        completedWorkOrders={completedWorkOrders}
        onBack={() => setShowCompletedPage(false)}
        onSelectWO={setSelectedWO}
      />
    );
  }

  return (
    <>
      <WorkOrdersList
        currentUser={currentUser}
        workOrders={myWorkOrders}
        onSelectWO={setSelectedWO}
        onShowCompleted={() => setShowCompletedPage(true)}
        onShowChangePin={() => setShowChangePinModal(true)}
        onLogout={handleLogout}
        onSwitchUser={() => setShowUserPicker(true)}
      />
      
      {showUserPicker && (
        <UserPickerModal
          currentUser={currentUser}
          onSelect={(user) => {
            setCurrentUser(user);
            setShowUserPicker(false);
          }}
          onClose={() => setShowUserPicker(false)}
        />
      )}
      
      <ChangePinModal
        show={showChangePinModal}
        onClose={() => setShowChangePinModal(false)}
      />
    </>
  );
}
