'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { DemoProvider, useDemo } from '../DemoContext';

function DemoBanner() {
  const { showDemoBanner, setShowDemoBanner, resetDemo, currentDemoUser, setCurrentDemoUser, users } = useDemo();
  const [showUserPicker, setShowUserPicker] = useState(false);
  const techs = users.filter(u => ['lead', 'tech'].includes(u.role) && u.is_active);
  
  if (!showDemoBanner) return null;
  
  return (
    <>
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 text-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>🎯 Demo Mode</span>
            <button onClick={() => setShowUserPicker(true)} className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded text-xs">
              Playing as: {currentDemoUser?.name?.split(' ')[0]}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={resetDemo} className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded text-xs">Reset</button>
            <button onClick={() => setShowDemoBanner(false)} className="hover:bg-white/20 p-1 rounded">✕</button>
          </div>
        </div>
      </div>
      
      {showUserPicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowUserPicker(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Switch Demo User</h3>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {techs.map(user => (
                <button key={user.id} onClick={() => { setCurrentDemoUser(user); setShowUserPicker(false); }} className={`w-full p-3 text-left rounded-lg transition ${currentDemoUser?.id === user.id ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-50 hover:bg-gray-100'}`}>
                  <div className="font-medium">{user.name}</div>
                  <div className="text-sm text-gray-500 capitalize">{user.role}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setShowUserPicker(false)} className="mt-4 w-full py-2 text-gray-500">Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}

function Notifications() {
  const { notifications } = useDemo();
  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 space-y-2">
      {notifications.map((notif) => (
        <div key={notif.id} className={`px-4 py-3 rounded-lg shadow-lg text-white text-center ${notif.type === 'success' ? 'bg-green-500' : notif.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}>
          {notif.message}
        </div>
      ))}
    </div>
  );
}

function QuickStats() {
  const { getWorkOrdersForTech, currentDemoUser } = useDemo();
  const myOrders = getWorkOrdersForTech(currentDemoUser?.id || '');
  const inProgress = myOrders.filter(wo => wo.status === 'in_progress').length;
  const assigned = myOrders.filter(wo => wo.status === 'assigned').length;
  const completed = myOrders.filter(wo => wo.status === 'completed').length;
  
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-amber-50 rounded-lg p-3 text-center"><div className="text-2xl font-bold text-amber-600">{inProgress}</div><div className="text-xs text-amber-600">In Progress</div></div>
      <div className="bg-purple-50 rounded-lg p-3 text-center"><div className="text-2xl font-bold text-purple-600">{assigned}</div><div className="text-xs text-purple-600">Assigned</div></div>
      <div className="bg-green-50 rounded-lg p-3 text-center"><div className="text-2xl font-bold text-green-600">{completed}</div><div className="text-xs text-green-600">Completed</div></div>
    </div>
  );
}

function WorkOrderList({ onSelectWorkOrder }) {
  const { workOrders, getWorkOrdersForTech, currentDemoUser, getTeamForWorkOrder } = useDemo();
  const [filter, setFilter] = useState('my');
  
  const myWorkOrders = useMemo(() => {
    if (!currentDemoUser) return [];
    return getWorkOrdersForTech(currentDemoUser.id).filter(wo => !['invoiced'].includes(wo.status));
  }, [currentDemoUser, getWorkOrdersForTech]);
  
  const activeWorkOrders = useMemo(() => workOrders.filter(wo => ['new', 'assigned', 'in_progress'].includes(wo.status)), [workOrders]);
  const displayOrders = filter === 'my' ? myWorkOrders : activeWorkOrders;
  
  const getPriorityColor = (priority) => ({ emergency: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-blue-500', low: 'bg-gray-400' }[priority] || 'bg-gray-400');
  const getStatusBadge = (status) => ({ new: 'bg-blue-100 text-blue-700', assigned: 'bg-purple-100 text-purple-700', in_progress: 'bg-amber-100 text-amber-700', completed: 'bg-green-100 text-green-700' }[status] || 'bg-gray-100 text-gray-700');
  
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="flex border-b border-gray-200 bg-white">
        <button onClick={() => setFilter('my')} className={`flex-1 py-3 text-sm font-medium transition ${filter === 'my' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>My Jobs ({myWorkOrders.length})</button>
        <button onClick={() => setFilter('all')} className={`flex-1 py-3 text-sm font-medium transition ${filter === 'all' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>All Active ({activeWorkOrders.length})</button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {displayOrders.length === 0 ? (
          <div className="p-8 text-center text-gray-500"><div className="text-4xl mb-2">📋</div><p>No work orders found</p></div>
        ) : (
          <div className="divide-y divide-gray-100">
            {displayOrders.map(wo => {
              const team = getTeamForWorkOrder(wo.id);
              return (
                <button key={wo.id} onClick={() => onSelectWorkOrder(wo)} className="w-full p-4 text-left hover:bg-gray-50 active:bg-gray-100 transition">
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 mt-2 rounded-full ${getPriorityColor(wo.priority)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-gray-900">{wo.wo_number}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(wo.status)}`}>{wo.status.replace('_', ' ')}</span>
                      </div>
                      <div className="text-sm font-medium text-gray-800 truncate">{wo.building_name}</div>
                      <div className="text-xs text-gray-500 truncate">{wo.location}</div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                        {wo.scheduled_date && <span>📅 {wo.scheduled_date}</span>}
                        <span>💰 ${wo.nte_amount}</span>
                        {team.length > 0 && <span>👥 {team.length}</span>}
                      </div>
                    </div>
                    <span className="text-gray-400">›</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function WorkOrderDetail({ workOrder, onBack }) {
  const { currentDemoUser, getUserById, getCommentsForWorkOrder, getTeamForWorkOrder, getDailyHoursForWorkOrder, checkIn, checkOut, completeWorkOrder, addComment, logHours, addNotification } = useDemo();
  const [activeTab, setActiveTab] = useState('details');
  const [newComment, setNewComment] = useState('');
  const [showHoursModal, setShowHoursModal] = useState(false);
  const [hours, setHours] = useState({ regular: '', overtime: '', mileage: '', notes: '' });
  
  const comments = getCommentsForWorkOrder(workOrder.id);
  const team = getTeamForWorkOrder(workOrder.id);
  const dailyHours = getDailyHoursForWorkOrder(workOrder.id);
  const isCheckedIn = workOrder.check_in_time && !workOrder.check_out_time;
  const canCheckIn = workOrder.status === 'assigned' || (workOrder.status === 'in_progress' && !isCheckedIn);
  
  const handleCheckIn = () => checkIn(workOrder.id);
  const handleCheckOut = () => { checkOut(workOrder.id); setShowHoursModal(true); };
  const handleComplete = () => { completeWorkOrder(workOrder.id); onBack(); };
  const handleAddComment = () => { if (!newComment.trim()) return; addComment(workOrder.id, currentDemoUser.id, newComment); setNewComment(''); };
  const handleLogHours = () => {
    if (!hours.regular && !hours.overtime) { addNotification('Please enter hours', 'error'); return; }
    logHours(workOrder.id, currentDemoUser.id, new Date().toISOString().split('T')[0], parseFloat(hours.regular) || 0, parseFloat(hours.overtime) || 0, parseFloat(hours.mileage) || 0, hours.notes);
    setShowHoursModal(false); setHours({ regular: '', overtime: '', mileage: '', notes: '' });
  };
  
  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-white">
      <div className="bg-blue-600 text-white p-4">
        <button onClick={onBack} className="flex items-center gap-2 text-blue-100 mb-2"><span>←</span> Back</button>
        <h1 className="text-xl font-bold">{workOrder.wo_number}</h1>
        <p className="text-blue-100 text-sm">{workOrder.building_name}</p>
      </div>
      
      <div className="p-4 bg-gray-50 border-b border-gray-200 flex gap-2">
        {canCheckIn && !isCheckedIn && <button onClick={handleCheckIn} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-medium transition">✓ Check In</button>}
        {isCheckedIn && <button onClick={handleCheckOut} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-lg font-medium transition">Check Out</button>}
        {workOrder.status === 'in_progress' && <button onClick={handleComplete} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-medium transition">Complete</button>}
        {!canCheckIn && !isCheckedIn && workOrder.status !== 'in_progress' && <div className="flex-1 text-center py-3 text-gray-500">Status: {workOrder.status}</div>}
      </div>
      
      <div className="flex border-b border-gray-200">
        {['details', 'team', 'comments', 'hours'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 text-sm font-medium capitalize transition ${activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>{tab}</button>
        ))}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'details' && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg"><div className="text-xs text-gray-500 mb-1">Location</div><div className="font-medium">{workOrder.location}</div></div>
            <div className="p-4 bg-gray-50 rounded-lg"><div className="text-xs text-gray-500 mb-1">Description</div><div className="text-sm">{workOrder.description}</div></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg"><div className="text-xs text-blue-600 mb-1">NTE</div><div className="text-xl font-bold text-blue-700">${workOrder.nte_amount}</div></div>
              <div className="p-4 bg-gray-50 rounded-lg"><div className="text-xs text-gray-500 mb-1">Priority</div><div className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${workOrder.priority === 'emergency' ? 'bg-red-500 text-white' : workOrder.priority === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{workOrder.priority}</div></div>
            </div>
            {workOrder.check_in_time && <div className="p-4 bg-green-50 rounded-lg"><div className="text-xs text-green-600 mb-1">Checked In</div><div className="text-sm font-medium">{new Date(workOrder.check_in_time).toLocaleString()}</div></div>}
          </div>
        )}
        
        {activeTab === 'team' && (
          <div className="space-y-3">
            {team.length > 0 ? team.map(member => (
              <div key={member.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">{member.user?.name?.charAt(0) || '?'}</div>
                <div><div className="font-medium">{member.user?.name}</div><div className="text-sm text-gray-500 capitalize">{member.role}</div></div>
              </div>
            )) : <p className="text-center text-gray-500 py-8">No team assigned</p>}
          </div>
        )}
        
        {activeTab === 'comments' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add comment..." className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <button onClick={handleAddComment} className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium">Add</button>
            </div>
            <div className="space-y-3">
              {comments.map(comment => {
                const user = getUserById(comment.user_id);
                return <div key={comment.id} className="p-3 bg-gray-50 rounded-lg"><div className="flex items-center gap-2 mb-1"><span className="font-medium text-sm">{user?.name}</span><span className="text-xs text-gray-400">{new Date(comment.created_at).toLocaleString()}</span></div><p className="text-sm">{comment.comment}</p></div>;
              })}
              {comments.length === 0 && <p className="text-center text-gray-500 py-8">No comments</p>}
            </div>
          </div>
        )}
        
        {activeTab === 'hours' && (
          <div className="space-y-4">
            <button onClick={() => setShowHoursModal(true)} className="w-full bg-blue-500 text-white py-3 rounded-lg font-medium">+ Log Hours</button>
            <div className="space-y-3">
              {dailyHours.map(entry => (
                <div key={entry.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-start mb-1"><span className="font-medium text-sm">{entry.user?.name}</span><span className="text-xs text-gray-500">{entry.log_date}</span></div>
                  <div className="text-sm text-gray-600"><span className="text-blue-600">{entry.regular_hours}h reg</span>{entry.overtime_hours > 0 && <span className="text-amber-600 ml-2">{entry.overtime_hours}h OT</span>}{entry.mileage > 0 && <span className="text-gray-500 ml-2">{entry.mileage} mi</span>}</div>
                  {entry.notes && <p className="text-xs text-gray-500 mt-1">{entry.notes}</p>}
                </div>
              ))}
              {dailyHours.length === 0 && <p className="text-center text-gray-500 py-8">No hours logged</p>}
            </div>
          </div>
        )}
      </div>
      
      {showHoursModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">Log Hours</h3>
            <div className="space-y-4">
              <div><label className="block text-sm text-gray-600 mb-1">Regular Hours</label><input type="number" value={hours.regular} onChange={e => setHours({...hours, regular: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="0" /></div>
              <div><label className="block text-sm text-gray-600 mb-1">Overtime Hours</label><input type="number" value={hours.overtime} onChange={e => setHours({...hours, overtime: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="0" /></div>
              <div><label className="block text-sm text-gray-600 mb-1">Mileage</label><input type="number" value={hours.mileage} onChange={e => setHours({...hours, mileage: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="0" /></div>
              <div><label className="block text-sm text-gray-600 mb-1">Notes</label><textarea value={hours.notes} onChange={e => setHours({...hours, notes: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2" rows={2} placeholder="Work performed..." /></div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowHoursModal(false)} className="flex-1 py-2 text-gray-600 border border-gray-300 rounded-lg">Cancel</button>
              <button onClick={handleLogHours} className="flex-1 py-2 bg-blue-500 text-white rounded-lg font-medium">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DemoMobileContent() {
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const { currentDemoUser } = useDemo();
  
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <DemoBanner />
      <Notifications />
      
      {!selectedWorkOrder ? (
        <>
          <div className="bg-blue-600 text-white p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold">{currentDemoUser?.name?.charAt(0)}</div>
                <div><div className="font-semibold">{currentDemoUser?.name}</div><div className="text-blue-200 text-sm capitalize">{currentDemoUser?.role}</div></div>
              </div>
              <Link href="/demo/dashboard" className="text-blue-200 text-sm">Dashboard →</Link>
            </div>
          </div>
          <div className="p-4 bg-white border-b border-gray-200"><QuickStats /></div>
          <WorkOrderList onSelectWorkOrder={setSelectedWorkOrder} />
          <div className="bg-white border-t border-gray-200 p-2 flex justify-around">
            <button className="flex flex-col items-center p-2 text-blue-600"><span className="text-xl">📋</span><span className="text-xs">Jobs</span></button>
            <button className="flex flex-col items-center p-2 text-gray-400"><span className="text-xl">📅</span><span className="text-xs">Schedule</span></button>
            <button className="flex flex-col items-center p-2 text-gray-400"><span className="text-xl">⏱️</span><span className="text-xs">Hours</span></button>
            <button className="flex flex-col items-center p-2 text-gray-400"><span className="text-xl">👤</span><span className="text-xs">Profile</span></button>
          </div>
        </>
      ) : (
        <WorkOrderDetail workOrder={selectedWorkOrder} onBack={() => setSelectedWorkOrder(null)} />
      )}
    </div>
  );
}

export default function DemoMobile() {
  return (
    <DemoProvider>
      <DemoMobileContent />
    </DemoProvider>
  );
}
