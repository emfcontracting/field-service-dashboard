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
    case 'needs_return': return '🔄 Needs Return';
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

// Login Screen Component (matching original LoginScreen.js)
function LoginScreen({ onLogin, error, setError }) {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <DemoBanner />
      
      <div className="flex flex-col items-center justify-center p-6 pt-12">
        {/* Logo */}
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4">
          <span className="text-white text-4xl font-bold">P</span>
        </div>
        
        <h1 className="text-2xl font-bold mb-1">PCS FieldService</h1>
        <p className="text-gray-400 mb-6">Mobile Tech App</p>

        {/* Demo Quick Select */}
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

        {/* Divider */}
        <div className="w-full max-w-sm flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-gray-700"></div>
          <span className="text-gray-500 text-sm">or login manually</span>
          <div className="flex-1 h-px bg-gray-700"></div>
        </div>

        {/* Manual Login Form */}
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

// Work Orders List Component (matching original WorkOrdersList.js)
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
      {/* Demo Banner */}
      <DemoBanner />

      {/* Header - Fixed at top (matching original) */}
      <div className="bg-gray-800 p-3 sticky top-0 z-10">
        {/* Top Row: Logo/Name and Logout */}
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">P</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-sm leading-tight">👋 {currentUser.first_name}</p>
                {/* Connection Status Indicator */}
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

        {/* Demo Mode Banner */}
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

        {/* Bottom Row: Action Buttons */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {/* Language Toggle (Demo) */}
          <button className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0">
            🌐 EN
          </button>
          
          {/* Dashboard Button for Admin/Office */}
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

      {/* Content */}
      <div className="p-4">
        {/* Weather Widget (Demo) */}
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
                  
                  {/* CBRE Status Badge */}
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

// Work Order Detail Component (matching original WorkOrderDetail.js structure)
function WorkOrderDetail({
  workOrder,
  currentUser,
  onBack,
  onCheckIn,
  onCheckOut,
  onComplete
}) {
  const [activeTab, setActiveTab] = useState('details');
  const cbreBadge = getCBREStatusBadge(workOrder.cbre_status);
  const [newComment, setNewComment] = useState('');
  const [commentSaveStatus, setCommentSaveStatus] = useState('idle'); // idle, saving, success, error
  
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
    { work_date: new Date(Date.now() - 86400000).toISOString().split('T')[0], regular_time: 6, overtime: 2, miles: 30 },
    { work_date: new Date(Date.now() - 172800000).toISOString().split('T')[0], regular_time: 8, overtime: 0, miles: 25 }
  ]);

  // Mock team members
  const [teamMembers] = useState([
    { user_id: 'tm1', first_name: 'Mike', last_name: 'Helper', role: 'helper', regular_time: 4, overtime: 0, miles: 0 }
  ]);

  // Mock comments
  const [comments] = useState([
    { id: 1, user_name: currentUser.first_name, comment: 'On site, starting work.', created_at: new Date(Date.now() - 7200000).toISOString() },
    { id: 2, user_name: 'Office', comment: 'Parts are at the supply house.', created_at: new Date(Date.now() - 18000000).toISOString() }
  ]);

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
    alert('Hours Saved - Demo Only');
  };

  // Calculate costs (matching original CostSummarySection logic)
  const laborRate = 64;
  const otRate = 96;
  const mileRate = 1;
  const markup = 1.25;

  const myHours = dailyLogs.reduce((sum, log) => sum + (log.regular_time || 0), 0);
  const myOT = dailyLogs.reduce((sum, log) => sum + (log.overtime || 0), 0);
  const myMiles = dailyLogs.reduce((sum, log) => sum + (log.miles || 0), 0);
  
  const teamHours = teamMembers.reduce((sum, tm) => sum + (tm.regular_time || 0), 0);
  const teamOT = teamMembers.reduce((sum, tm) => sum + (tm.overtime || 0), 0);
  const teamMiles = teamMembers.reduce((sum, tm) => sum + (tm.miles || 0), 0);

  const totalHours = myHours + teamHours;
  const totalOT = myOT + teamOT;
  const totalMiles = myMiles + teamMiles;

  const laborCost = (totalHours * laborRate + totalOT * otRate) * markup;
  const mileageCost = totalMiles * mileRate * markup;
  const materialCost = (workOrder.material_cost || 0) * markup;
  const totalCost = laborCost + mileageCost + materialCost;
  const remainingBudget = (workOrder.nte || 0) - totalCost;

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-4">
      {/* Demo Banner */}
      <DemoBanner />

      {/* Header */}
      <div className={`bg-gray-800 px-4 py-3 ${workOrder.cbre_status === 'escalation' ? 'border-b-2 border-red-500' : ''}`}>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-2xl">←</button>
          <div className="flex-1 min-w-0">
            <div className="font-bold truncate">{workOrder.wo_number}</div>
            <div className="text-sm text-gray-400 truncate">{workOrder.building}</div>
          </div>
          <span className={`px-2 py-1 rounded text-xs font-semibold flex-shrink-0 ${
            workOrder.status === 'in_progress' ? 'bg-blue-600' :
            workOrder.status === 'assigned' ? 'bg-yellow-600' :
            workOrder.status === 'completed' ? 'bg-green-600' :
            'bg-gray-600'
          }`}>
            {getStatusBadge(workOrder.status)}
          </span>
        </div>
        {/* CBRE Status Banner */}
        {cbreBadge && (
          <div className="mt-2">
            <span className={`text-xs px-3 py-1 rounded ${cbreBadge.color}`}>
              {cbreBadge.text}
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 bg-gray-800">
        {['details', 'hours', 'team', 'comments', 'costs', 'photos'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-xs font-semibold capitalize ${
              activeTab === tab 
                ? 'text-blue-400 border-b-2 border-blue-400' 
                : 'text-gray-400'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {/* DETAILS TAB */}
        {activeTab === 'details' && (
          <div className="space-y-4">
            {/* Check In/Out Card */}
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <span>⏰</span> Check In / Out
              </h3>
              {workOrder.status === 'assigned' ? (
                <button
                  onClick={() => {
                    onCheckIn();
                    alert('Checked In - Demo Only');
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 py-4 rounded-lg font-bold text-lg"
                >
                  ✅ CHECK IN
                </button>
              ) : workOrder.status === 'in_progress' ? (
                <div className="space-y-3">
                  <div className="bg-green-900/30 border border-green-700 rounded-lg p-3">
                    <div className="text-green-400 text-sm">✓ Checked in at 8:30 AM</div>
                    <div className="text-gray-400 text-xs mt-1">GPS: 34.0007, -81.0348</div>
                  </div>
                  <button
                    onClick={() => {
                      onCheckOut();
                      alert('Checked Out - Demo Only');
                    }}
                    className="w-full bg-red-600 hover:bg-red-700 py-4 rounded-lg font-bold text-lg"
                  >
                    🚪 CHECK OUT
                  </button>
                </div>
              ) : (
                <div className="text-gray-400 text-center py-4">
                  Work order {workOrder.status.replace('_', ' ')}
                </div>
              )}
            </div>

            {/* Work Description */}
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="font-bold mb-2 flex items-center gap-2">
                <span>📋</span> Work Description
              </h3>
              <p className="text-gray-300 text-sm leading-relaxed">{workOrder.work_order_description}</p>
            </div>

            {/* Location */}
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="font-bold mb-2 flex items-center gap-2">
                <span>📍</span> Location
              </h3>
              <p className="text-white font-medium">{workOrder.building}</p>
              <p className="text-gray-400 text-sm">{workOrder.address}</p>
              <button className="mt-3 w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-lg text-sm font-medium">
                📍 Open in Maps
              </button>
            </div>

            {/* Contact Info */}
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="font-bold mb-2 flex items-center gap-2">
                <span>👤</span> Site Contact
              </h3>
              <div className="space-y-2">
                <p className="text-white">{workOrder.requestor || 'Building Manager'}</p>
                <p className="text-gray-400 text-sm">{workOrder.requestor_phone || '(803) 555-0123'}</p>
                <button className="w-full bg-green-600 hover:bg-green-700 py-2 rounded-lg text-sm font-medium">
                  📞 Call Contact
                </button>
              </div>
            </div>

            {/* NTE Budget Summary */}
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400">NTE Budget</span>
                <span className="text-xl font-bold text-yellow-400">${workOrder.nte?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Current Costs</span>
                <span className="font-medium">${totalCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-700">
                <span className="font-bold">Remaining</span>
                <span className={`font-bold text-lg ${remainingBudget >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${remainingBudget.toFixed(2)}
                </span>
              </div>
              {remainingBudget < 0 && (
                <button className="mt-3 w-full bg-orange-600 hover:bg-orange-700 py-2 rounded-lg text-sm font-medium">
                  📈 Request NTE Increase
                </button>
              )}
            </div>

            {/* Complete Button */}
            {workOrder.status === 'in_progress' && (
              <button
                onClick={() => {
                  onComplete();
                  alert('Work Order Completed - Demo Only');
                }}
                className="w-full bg-purple-600 hover:bg-purple-700 py-4 rounded-xl font-bold text-lg"
              >
                ✅ Mark as Complete
              </button>
            )}
          </div>
        )}

        {/* HOURS TAB */}
        {activeTab === 'hours' && (
          <div className="space-y-4">
            {/* Daily Hours Entry */}
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <span>⏱️</span> Log Daily Hours
              </h3>
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
                  <label className="text-xs text-gray-400">Tech Materials $</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={dailyHours.tech_material_cost}
                    onChange={(e) => setDailyHours({...dailyHours, tech_material_cost: e.target.value})}
                    placeholder="0.00"
                    className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1" 
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className="text-xs text-gray-400">Work Date</label>
                <input 
                  type="date" 
                  value={dailyHours.work_date}
                  onChange={(e) => setDailyHours({...dailyHours, work_date: e.target.value})}
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1" 
                />
              </div>
              <button
                onClick={handleSaveHours}
                className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-bold mt-4"
              >
                💾 Save Hours
              </button>
            </div>

            {/* Hours Log History */}
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <span>📊</span> My Hours Log
              </h3>
              <div className="space-y-2">
                {dailyLogs.map((log, i) => (
                  <div key={i} className="flex justify-between py-2 border-b border-gray-700 last:border-0">
                    <span className="text-gray-400">{formatDate(log.work_date)}</span>
                    <span className="text-sm">
                      {log.regular_time}h RT, {log.overtime}h OT, {log.miles} mi
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-700">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total</span>
                  <span className="font-bold">
                    {myHours}h RT, {myOT}h OT, {myMiles} mi
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TEAM TAB */}
        {activeTab === 'team' && (
          <div className="space-y-4">
            {/* Add Team Member */}
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <span>👥</span> Team Members
              </h3>
              <button
                onClick={() => alert('Add Team Member - Demo Only')}
                className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold"
              >
                + Add Team Member
              </button>
            </div>

            {/* Team List */}
            {teamMembers.length > 0 ? (
              <div className="space-y-3">
                {teamMembers.map(member => (
                  <div key={member.user_id} className="bg-gray-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center font-bold">
                          {member.first_name[0]}
                        </div>
                        <div>
                          <div className="font-semibold">{member.first_name} {member.last_name}</div>
                          <div className="text-xs text-gray-400 capitalize">{member.role}</div>
                        </div>
                      </div>
                      <button className="text-red-400 hover:text-red-300 text-sm">Remove</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-gray-400">Regular</label>
                        <input type="number" defaultValue={member.regular_time} className="w-full bg-gray-700 rounded px-2 py-1 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">OT</label>
                        <input type="number" defaultValue={member.overtime} className="w-full bg-gray-700 rounded px-2 py-1 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Miles</label>
                        <input type="number" defaultValue={member.miles} className="w-full bg-gray-700 rounded px-2 py-1 text-sm" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-800 rounded-xl p-8 text-center">
                <div className="text-4xl mb-2">👥</div>
                <p className="text-gray-400">No team members added yet</p>
              </div>
            )}
          </div>
        )}

        {/* COMMENTS TAB */}
        {activeTab === 'comments' && (
          <div className="space-y-4">
            {/* Add Comment */}
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <span>💬</span> Add Comment
              </h3>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Enter your comment..."
                className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm resize-none"
                rows={3}
              />
              <button
                onClick={handleAddComment}
                disabled={commentSaveStatus === 'saving'}
                className={`w-full py-3 rounded-lg font-semibold mt-2 flex items-center justify-center gap-2 ${
                  commentSaveStatus === 'success' 
                    ? 'bg-green-600' 
                    : commentSaveStatus === 'error'
                    ? 'bg-red-600'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {commentSaveStatus === 'saving' && <span className="animate-spin">⟳</span>}
                {commentSaveStatus === 'success' && <span>✓</span>}
                {commentSaveStatus === 'error' && <span>✗</span>}
                {commentSaveStatus === 'idle' && '💾'}
                {commentSaveStatus === 'saving' ? 'Saving...' : 
                 commentSaveStatus === 'success' ? 'Saved!' :
                 commentSaveStatus === 'error' ? 'Error - Try Again' :
                 'Save Comment'}
              </button>
            </div>

            {/* Comments List */}
            <div className="space-y-3">
              {comments.map(comment => (
                <div key={comment.id} className="bg-gray-800 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-sm">{comment.user_name}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(comment.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm">{comment.comment}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* COSTS TAB */}
        {activeTab === 'costs' && (
          <div className="space-y-4">
            {/* Cost Summary */}
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <span>💰</span> Cost Summary
              </h3>
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
                <div className="flex justify-between py-2 text-xs text-gray-500">
                  <span>* All costs include 25% markup</span>
                </div>
                <div className="flex justify-between py-3 font-bold text-lg border-t border-gray-700">
                  <span>Total</span>
                  <span className="text-green-400">${totalCost.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* NTE Budget */}
            <div className={`rounded-xl p-4 ${remainingBudget >= 0 ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
              <div className="flex justify-between items-center">
                <span className={remainingBudget >= 0 ? 'text-green-400' : 'text-red-400'}>NTE Budget</span>
                <span className="font-bold">${workOrder.nte?.toFixed(2)}</span>
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

            {remainingBudget < 0 && (
              <button
                onClick={() => alert('Request NTE Increase - Demo Only')}
                className="w-full bg-orange-600 hover:bg-orange-700 py-3 rounded-lg font-bold"
              >
                📈 Request NTE Increase
              </button>
            )}
          </div>
        )}

        {/* PHOTOS TAB */}
        {activeTab === 'photos' && (
          <div className="space-y-4">
            {/* Email Photos */}
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <span>📸</span> Photos
              </h3>
              <p className="text-gray-400 text-sm mb-4">
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

            {/* Photo Gallery Placeholder */}
            <div className="bg-gray-800 rounded-xl p-8 text-center">
              <div className="text-4xl mb-2">📷</div>
              <p className="text-gray-400">Photos will appear here after upload</p>
              <p className="text-gray-500 text-sm mt-1">Demo mode - no actual uploads</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Completed Work Orders Component
function CompletedWorkOrders({ currentUser, completedWorkOrders, onBack, onSelectWO }) {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <DemoBanner />
      
      {/* Header */}
      <div className="bg-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-2xl">←</button>
        <div className="flex-1">
          <div className="font-bold">Completed Work Orders</div>
          <div className="text-sm text-gray-400">{completedWorkOrders.length} completed</div>
        </div>
      </div>

      {/* Content */}
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

  // Filter work orders for current user
  const myWorkOrders = currentUser 
    ? ALL_WORK_ORDERS.filter(wo => 
        wo.lead_tech_id === currentUser.user_id || 
        wo.status === 'pending' ||
        (wo.status === 'assigned' && !wo.lead_tech_id)
      ).filter(wo => wo.status !== 'completed').slice(0, 8)
    : [];

  const completedWorkOrders = ALL_WORK_ORDERS.filter(wo => wo.status === 'completed').slice(0, 5);

  // Login handler
  const handleLogin = (user) => {
    setCurrentUser(user);
    setError('');
  };

  // Logout handler
  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedWO(null);
    setShowCompletedPage(false);
  };

  // Login Screen
  if (!currentUser) {
    return (
      <LoginScreen 
        onLogin={handleLogin}
        error={error}
        setError={setError}
      />
    );
  }

  // Work Order Detail View
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
      />
    );
  }

  // Completed Work Orders Page
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

  // Main Work Orders List
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
      
      {/* Modals */}
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
