// app/demo/mobile/page.js
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DEMO_USERS, generateDemoWorkOrders } from '../mockData';

// Get field workers for demo
const FIELD_USERS = DEMO_USERS.filter(u => ['lead_tech', 'tech', 'helper'].includes(u.role));

// Generate work orders once
const ALL_WORK_ORDERS = generateDemoWorkOrders();

export default function DemoMobilePage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedWO, setSelectedWO] = useState(null);
  const [activeTab, setActiveTab] = useState('details');
  const [showUserPicker, setShowUserPicker] = useState(false);

  // Filter work orders for current user
  const myWorkOrders = currentUser 
    ? ALL_WORK_ORDERS.filter(wo => 
        wo.lead_tech_id === currentUser.user_id || 
        wo.status === 'pending' ||
        (wo.status === 'assigned' && wo.lead_tech_id === currentUser.user_id)
      ).slice(0, 8)
    : [];

  const assignedToMe = myWorkOrders.filter(wo => wo.lead_tech_id === currentUser?.user_id);
  const inProgress = assignedToMe.filter(wo => wo.status === 'in_progress');

  // Login screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Demo Banner */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎯</span>
              <span className="font-bold">Mobile App Demo</span>
            </div>
            <Link href="/demo" className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm">
              ← Demo Home
            </Link>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center p-6 pt-20">
          {/* Logo */}
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6">
            <span className="text-white text-4xl">⚡</span>
          </div>
          
          <h1 className="text-2xl font-bold mb-2">PCS FieldService</h1>
          <p className="text-gray-400 mb-8">Mobile Tech App</p>

          <div className="w-full max-w-sm space-y-4">
            <p className="text-center text-gray-400 text-sm mb-4">
              Select a technician to explore the mobile app:
            </p>
            
            {FIELD_USERS.map(user => (
              <button
                key={user.user_id}
                onClick={() => setCurrentUser(user)}
                className="w-full bg-gray-800 hover:bg-gray-700 p-4 rounded-xl flex items-center gap-4 transition"
              >
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold">
                  {user.first_name[0]}
                </div>
                <div className="text-left flex-1">
                  <div className="font-semibold">{user.first_name} {user.last_name}</div>
                  <div className="text-sm text-gray-400 capitalize">{user.role.replace('_', ' ')}</div>
                </div>
                <span className="text-gray-500">→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Work order detail view
  if (selectedWO) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Header */}
        <div className="bg-gray-800 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSelectedWO(null)}
            className="text-2xl"
          >
            ←
          </button>
          <div className="flex-1">
            <div className="font-bold">{selectedWO.wo_number}</div>
            <div className="text-sm text-gray-400">{selectedWO.building}</div>
          </div>
          <span className={`px-2 py-1 rounded text-xs font-semibold ${
            selectedWO.status === 'in_progress' ? 'bg-blue-600' :
            selectedWO.status === 'assigned' ? 'bg-yellow-600' :
            selectedWO.status === 'completed' ? 'bg-green-600' :
            'bg-gray-600'
          }`}>
            {selectedWO.status.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          {['details', 'hours', 'comments', 'costs'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-semibold capitalize ${
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
          {activeTab === 'details' && (
            <div className="space-y-4">
              {/* Check In/Out Card */}
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="font-bold mb-3">Check In / Out</h3>
                {selectedWO.status === 'assigned' ? (
                  <button
                    onClick={() => alert('Check In - Demo Only')}
                    className="w-full bg-green-600 hover:bg-green-700 py-3 rounded-lg font-bold"
                  >
                    ✅ Check In
                  </button>
                ) : selectedWO.status === 'in_progress' ? (
                  <div className="space-y-2">
                    <div className="text-green-400 text-sm">✓ Checked in at 8:30 AM</div>
                    <button
                      onClick={() => alert('Check Out - Demo Only')}
                      className="w-full bg-red-600 hover:bg-red-700 py-3 rounded-lg font-bold"
                    >
                      🚪 Check Out
                    </button>
                  </div>
                ) : (
                  <div className="text-gray-400 text-center py-2">
                    Work order {selectedWO.status}
                  </div>
                )}
              </div>

              {/* Work Description */}
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="font-bold mb-2">Work Description</h3>
                <p className="text-gray-300 text-sm">{selectedWO.work_order_description}</p>
              </div>

              {/* Location */}
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="font-bold mb-2">Location</h3>
                <p className="text-gray-300">{selectedWO.building}</p>
                <p className="text-gray-400 text-sm">{selectedWO.address}</p>
              </div>

              {/* NTE */}
              <div className="bg-gray-800 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">NTE Budget</span>
                  <span className="text-xl font-bold text-yellow-400">${selectedWO.nte?.toFixed(2)}</span>
                </div>
              </div>

              {/* Complete Button */}
              {selectedWO.status === 'in_progress' && (
                <button
                  onClick={() => alert('Complete Work Order - Demo Only')}
                  className="w-full bg-purple-600 hover:bg-purple-700 py-4 rounded-xl font-bold text-lg"
                >
                  ✅ Mark as Complete
                </button>
              )}
            </div>
          )}

          {activeTab === 'hours' && (
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="font-bold mb-3">Log Daily Hours</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400">Regular Hours</label>
                    <input type="number" defaultValue="0" className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Overtime</label>
                    <input type="number" defaultValue="0" className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Miles</label>
                    <input type="number" defaultValue="0" className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Date</label>
                    <input type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1" />
                  </div>
                </div>
                <button
                  onClick={() => alert('Hours Logged - Demo Only')}
                  className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-bold mt-4"
                >
                  💾 Save Hours
                </button>
              </div>

              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="font-bold mb-3">Hours Log</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b border-gray-700">
                    <span className="text-gray-400">Today</span>
                    <span>4 hrs RT, 0 OT, 25 mi</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-400">Yesterday</span>
                    <span>6 hrs RT, 2 OT, 30 mi</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-xl p-4">
                <textarea
                  placeholder="Add a comment..."
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm resize-none"
                  rows={3}
                />
                <button
                  onClick={() => alert('Comment Added - Demo Only')}
                  className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-semibold mt-2 text-sm"
                >
                  Add Comment
                </button>
              </div>

              <div className="space-y-3">
                {[
                  { user: 'Marcus W.', text: 'On site, starting work.', time: '2 hours ago' },
                  { user: 'Office', text: 'Parts are at the supply house.', time: '5 hours ago' },
                ].map((comment, i) => (
                  <div key={i} className="bg-gray-800 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-semibold text-sm">{comment.user}</span>
                      <span className="text-xs text-gray-500">{comment.time}</span>
                    </div>
                    <p className="text-gray-300 text-sm">{comment.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'costs' && (
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="font-bold mb-3">Cost Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b border-gray-700">
                    <span className="text-gray-400">Labor (10 hrs @ $50)</span>
                    <span>$500.00</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-700">
                    <span className="text-gray-400">Overtime (2 hrs @ $75)</span>
                    <span>$150.00</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-700">
                    <span className="text-gray-400">Mileage (55 mi)</span>
                    <span>$55.00</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-700">
                    <span className="text-gray-400">Materials</span>
                    <span>$125.00</span>
                  </div>
                  <div className="flex justify-between py-3 font-bold text-lg">
                    <span>Total</span>
                    <span className="text-green-400">$830.00</span>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <span className="text-yellow-400">NTE Budget</span>
                  <span className="font-bold text-yellow-400">${selectedWO.nte?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-gray-400">Remaining</span>
                  <span className="font-bold text-green-400">${((selectedWO.nte || 0) - 830).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main work orders list
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Demo Banner */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>🎯</span>
            <span className="text-sm font-medium">Demo Mode</span>
          </div>
          <button
            onClick={() => setShowUserPicker(true)}
            className="bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-xs"
          >
            Switch User
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="bg-gray-800 px-4 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-lg">⚡</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold">👋 {currentUser.first_name}</span>
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              </div>
              <p className="text-xs text-gray-400 capitalize">{currentUser.role.replace('_', ' ')}</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Link
              href="/demo/dashboard"
              className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg text-sm font-semibold"
            >
              💻
            </Link>
            <button
              onClick={() => setCurrentUser(null)}
              className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 grid grid-cols-3 gap-3">
        <div className="bg-blue-600/20 border border-blue-600 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-blue-400">{inProgress.length}</div>
          <div className="text-xs text-gray-400">In Progress</div>
        </div>
        <div className="bg-yellow-600/20 border border-yellow-600 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-yellow-400">{assignedToMe.length}</div>
          <div className="text-xs text-gray-400">Assigned</div>
        </div>
        <div className="bg-green-600/20 border border-green-600 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-green-400">
            {ALL_WORK_ORDERS.filter(wo => wo.status === 'completed').length}
          </div>
          <div className="text-xs text-gray-400">Completed</div>
        </div>
      </div>

      {/* Work Orders List */}
      <div className="px-4 py-2">
        <h2 className="font-bold mb-3">My Work Orders</h2>
        <div className="space-y-3">
          {myWorkOrders.slice(0, 6).map(wo => (
            <div
              key={wo.wo_id}
              onClick={() => setSelectedWO(wo)}
              className="bg-gray-800 rounded-xl p-4 cursor-pointer hover:bg-gray-750 transition"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-bold">{wo.wo_number}</div>
                  <div className="text-sm text-gray-400">{wo.building}</div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  wo.priority === 'emergency' ? 'bg-red-600' :
                  wo.priority === 'high' ? 'bg-orange-600' :
                  'bg-gray-600'
                }`}>
                  {wo.priority.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-gray-300 line-clamp-2 mb-2">{wo.work_order_description}</p>
              <div className="flex justify-between items-center">
                <span className={`px-2 py-1 rounded text-xs ${
                  wo.status === 'in_progress' ? 'bg-blue-600' :
                  wo.status === 'assigned' ? 'bg-yellow-600' :
                  wo.status === 'completed' ? 'bg-green-600' :
                  'bg-gray-600'
                }`}>
                  {wo.status.replace('_', ' ').toUpperCase()}
                </span>
                <span className="text-yellow-400 font-semibold">${wo.nte}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User Picker Modal */}
      {showUserPicker && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl w-full max-w-sm p-4">
            <h3 className="font-bold mb-4">Switch Technician</h3>
            <div className="space-y-2">
              {FIELD_USERS.map(user => (
                <button
                  key={user.user_id}
                  onClick={() => {
                    setCurrentUser(user);
                    setShowUserPicker(false);
                  }}
                  className={`w-full p-3 rounded-lg flex items-center gap-3 transition ${
                    user.user_id === currentUser.user_id 
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
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowUserPicker(false)}
              className="w-full mt-4 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 px-4 py-3">
        <div className="flex justify-around">
          <button className="flex flex-col items-center text-blue-400">
            <span className="text-xl">📋</span>
            <span className="text-xs">Jobs</span>
          </button>
          <button 
            onClick={() => alert('Availability - Demo Only')}
            className="flex flex-col items-center text-gray-400"
          >
            <span className="text-xl">📅</span>
            <span className="text-xs">Availability</span>
          </button>
          <button
            onClick={() => alert('Messages - Demo Only')}
            className="flex flex-col items-center text-gray-400"
          >
            <span className="text-xl">💬</span>
            <span className="text-xs">Messages</span>
          </button>
          <Link href="/demo" className="flex flex-col items-center text-gray-400">
            <span className="text-xl">🏠</span>
            <span className="text-xs">Demo</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
