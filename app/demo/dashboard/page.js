'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { DemoProvider, useDemo } from '../DemoContext';

function DemoBanner() {
  const { showDemoBanner, setShowDemoBanner, resetDemo } = useDemo();
  if (!showDemoBanner) return null;
  
  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg">🎯</span>
          <span className="font-medium">Demo Mode</span>
          <span className="text-amber-100 text-sm hidden sm:inline">- Exploring as Summit Mechanical Services</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={resetDemo} className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm transition">Reset Demo</button>
          <button onClick={() => setShowDemoBanner(false)} className="hover:bg-white/20 p-1 rounded transition">✕</button>
        </div>
      </div>
    </div>
  );
}

function Notifications() {
  const { notifications } = useDemo();
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {notifications.map((notif) => (
        <div key={notif.id} className={`px-4 py-3 rounded-lg shadow-lg text-white ${notif.type === 'success' ? 'bg-green-500' : notif.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}>
          {notif.message}
        </div>
      ))}
    </div>
  );
}

function StatsCards({ onFilterChange, currentFilter }) {
  const { getStats } = useDemo();
  const stats = getStats();
  
  const cards = [
    { label: 'New', value: stats.new, color: 'blue', filter: 'new', icon: '📥' },
    { label: 'Assigned', value: stats.assigned, color: 'purple', filter: 'assigned', icon: '👤' },
    { label: 'In Progress', value: stats.inProgress, color: 'amber', filter: 'in_progress', icon: '🔧' },
    { label: 'Completed', value: stats.completed, color: 'green', filter: 'completed', icon: '✅' },
    { label: 'Emergency', value: stats.emergency, color: 'red', filter: 'emergency', icon: '🚨' },
    { label: 'Pending NTE', value: stats.pendingCbreQuote, color: 'orange', filter: 'pending_cbre_quote', icon: '💰' },
  ];
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {cards.map((card) => (
        <button
          key={card.filter}
          onClick={() => onFilterChange(currentFilter === card.filter ? null : card.filter)}
          className={`bg-white rounded-xl p-4 shadow-sm border-2 transition-all hover:shadow-md text-left ${currentFilter === card.filter ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent'}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">{card.icon}</span>
            <span className={`text-2xl font-bold ${card.color === 'blue' ? 'text-blue-600' : card.color === 'purple' ? 'text-purple-600' : card.color === 'amber' ? 'text-amber-600' : card.color === 'green' ? 'text-green-600' : card.color === 'red' ? 'text-red-600' : 'text-orange-600'}`}>{card.value}</span>
          </div>
          <div className="text-sm text-gray-600">{card.label}</div>
        </button>
      ))}
    </div>
  );
}

function WorkOrdersTable({ filter, onSelectWorkOrder }) {
  const { workOrders, getUserById, getTeamForWorkOrder } = useDemo();
  
  const filteredOrders = useMemo(() => {
    let filtered = [...workOrders];
    if (filter === 'emergency') {
      filtered = filtered.filter(wo => wo.priority === 'emergency' && !['completed', 'invoiced'].includes(wo.status));
    } else if (filter === 'pending_cbre_quote') {
      filtered = filtered.filter(wo => wo.billing_status === 'pending_cbre_quote');
    } else if (filter) {
      filtered = filtered.filter(wo => wo.status === filter);
    }
    return filtered.sort((a, b) => {
      const priorityOrder = { emergency: 0, high: 1, medium: 2, low: 3 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) return priorityOrder[a.priority] - priorityOrder[b.priority];
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [workOrders, filter]);
  
  const getStatusBadge = (status) => {
    const styles = { new: 'bg-blue-100 text-blue-700', assigned: 'bg-purple-100 text-purple-700', in_progress: 'bg-amber-100 text-amber-700', completed: 'bg-green-100 text-green-700', invoiced: 'bg-gray-100 text-gray-700' };
    return styles[status] || 'bg-gray-100 text-gray-700';
  };
  
  const getPriorityBadge = (priority) => {
    const styles = { emergency: 'bg-red-500 text-white', high: 'bg-orange-100 text-orange-700', medium: 'bg-blue-100 text-blue-700', low: 'bg-gray-100 text-gray-600' };
    return styles[priority] || 'bg-gray-100 text-gray-600';
  };
  
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Work Orders {filter && <span className="text-blue-500">({filteredOrders.length})</span>}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">WO #</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Assigned</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">NTE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredOrders.map((wo) => {
              const tech = wo.assigned_tech ? getUserById(wo.assigned_tech) : null;
              return (
                <tr key={wo.id} onClick={() => onSelectWorkOrder(wo)} className="hover:bg-blue-50 cursor-pointer transition">
                  <td className="px-6 py-4"><span className="text-blue-600 font-medium">{wo.wo_number}</span></td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{wo.building_name}</div>
                    <div className="text-xs text-gray-500 truncate max-w-xs">{wo.location}</div>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    {tech ? <span className="text-sm text-gray-900">{tech.name}</span> : <span className="text-sm text-gray-400 italic">Unassigned</span>}
                  </td>
                  <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityBadge(wo.priority)}`}>{wo.priority}</span></td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(wo.status)}`}>{wo.status.replace('_', ' ')}</span>
                    {wo.billing_status && <span className="ml-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">NTE</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 hidden lg:table-cell">${wo.nte_amount?.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredOrders.length === 0 && <div className="px-6 py-12 text-center text-gray-500">No work orders found</div>}
      </div>
    </div>
  );
}

function WorkOrderDetailModal({ workOrder, onClose }) {
  const { users, getUserById, getCommentsForWorkOrder, getTeamForWorkOrder, getDailyHoursForWorkOrder, updateStatus, assignTech, addComment, checkIn, checkOut, completeWorkOrder, currentDemoUser } = useDemo();
  const [activeTab, setActiveTab] = useState('details');
  const [newComment, setNewComment] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  
  if (!workOrder) return null;
  
  const comments = getCommentsForWorkOrder(workOrder.id);
  const team = getTeamForWorkOrder(workOrder.id);
  const dailyHours = getDailyHoursForWorkOrder(workOrder.id);
  const assignedTech = workOrder.assigned_tech ? getUserById(workOrder.assigned_tech) : null;
  const leadTechs = users.filter(u => u.role === 'lead' && u.is_active);
  
  const handleAddComment = () => {
    if (!newComment.trim()) return;
    addComment(workOrder.id, currentDemoUser?.id || 'demo-user-002', newComment);
    setNewComment('');
  };
  
  const handleAssign = (techId) => {
    assignTech(workOrder.id, techId, new Date().toISOString().split('T')[0]);
    setShowAssignModal(false);
  };

  const laborTotal = workOrder.legacy_labor_total || 0;
  const materialTotal = workOrder.legacy_material_total || 0;
  const equipmentTotal = workOrder.legacy_equipment_total || 0;
  const mileageTotal = workOrder.legacy_mileage_total || 0;
  const totalCost = laborTotal + materialTotal + equipmentTotal + mileageTotal;
  
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{workOrder.wo_number}</h2>
            <p className="text-sm text-gray-500">{workOrder.building_name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition text-xl">✕</button>
        </div>
        
        <div className="flex border-b border-gray-200 px-6 overflow-x-auto">
          {['details', 'team', 'comments', 'costs'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-3 font-medium text-sm capitalize transition whitespace-nowrap ${activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
              {tab}
            </button>
          ))}
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {workOrder.status === 'new' && <button onClick={() => setShowAssignModal(true)} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition">Assign Tech</button>}
                {workOrder.status === 'assigned' && <button onClick={() => checkIn(workOrder.id)} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition">Check In</button>}
                {workOrder.status === 'in_progress' && !workOrder.check_out_time && <button onClick={() => checkOut(workOrder.id)} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition">Check Out</button>}
                {workOrder.status === 'in_progress' && <button onClick={() => completeWorkOrder(workOrder.id)} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition">Mark Complete</button>}
                {workOrder.status === 'completed' && <button onClick={() => updateStatus(workOrder.id, 'invoiced')} className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition">Mark Invoiced</button>}
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div><h4 className="text-sm font-medium text-gray-500 mb-1">Location</h4><p className="text-gray-900">{workOrder.location}</p></div>
                <div><h4 className="text-sm font-medium text-gray-500 mb-1">Client</h4><p className="text-gray-900">{workOrder.client_name}</p></div>
                <div><h4 className="text-sm font-medium text-gray-500 mb-1">Assigned Tech</h4><p className="text-gray-900">{assignedTech?.name || 'Unassigned'}</p></div>
                <div><h4 className="text-sm font-medium text-gray-500 mb-1">NTE Amount</h4><p className="text-gray-900 font-semibold">${workOrder.nte_amount?.toLocaleString()}</p></div>
              </div>
              <div><h4 className="text-sm font-medium text-gray-500 mb-1">Description</h4><p className="text-gray-900">{workOrder.description}</p></div>
            </div>
          )}
          
          {activeTab === 'team' && (
            <div className="space-y-4">
              {team.length > 0 ? team.map((member) => (
                <div key={member.id} className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">{member.user?.name?.charAt(0) || '?'}</div>
                  <div><div className="font-medium text-gray-900">{member.user?.name || 'Unknown'}</div><div className="text-sm text-gray-500 capitalize">{member.role}</div></div>
                </div>
              )) : <p className="text-gray-500 text-center py-8">No team members assigned</p>}
            </div>
          )}
          
          {activeTab === 'comments' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Add a comment..." className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500" onKeyDown={(e) => e.key === 'Enter' && handleAddComment()} />
                <button onClick={handleAddComment} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition">Add</button>
              </div>
              <div className="space-y-3">
                {comments.map((comment) => {
                  const user = getUserById(comment.user_id);
                  return (
                    <div key={comment.id} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-gray-900">{user?.name || 'Unknown'}</span>
                        <span className="text-xs text-gray-500">{new Date(comment.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-gray-700">{comment.comment}</p>
                    </div>
                  );
                })}
                {comments.length === 0 && <p className="text-gray-500 text-center py-8">No comments yet</p>}
              </div>
            </div>
          )}
          
          {activeTab === 'costs' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg"><div className="text-sm text-blue-600 mb-1">Labor</div><div className="text-2xl font-bold text-blue-700">${laborTotal.toFixed(2)}</div></div>
                <div className="p-4 bg-green-50 rounded-lg"><div className="text-sm text-green-600 mb-1">Materials</div><div className="text-2xl font-bold text-green-700">${materialTotal.toFixed(2)}</div></div>
                <div className="p-4 bg-purple-50 rounded-lg"><div className="text-sm text-purple-600 mb-1">Equipment</div><div className="text-2xl font-bold text-purple-700">${equipmentTotal.toFixed(2)}</div></div>
                <div className="p-4 bg-amber-50 rounded-lg"><div className="text-sm text-amber-600 mb-1">Mileage</div><div className="text-2xl font-bold text-amber-700">${mileageTotal.toFixed(2)}</div></div>
              </div>
              <div className="p-4 bg-gray-800 rounded-lg"><div className="text-sm text-gray-400 mb-1">Total Cost</div><div className="text-3xl font-bold text-white">${totalCost.toFixed(2)}</div></div>
            </div>
          )}
        </div>
        
        {showAssignModal && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-bold mb-4">Assign Technician</h3>
              <div className="space-y-3">
                {leadTechs.map((tech) => (
                  <button key={tech.id} onClick={() => handleAssign(tech.id)} className="w-full p-3 text-left border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-500 transition">
                    <div className="font-medium">{tech.name}</div>
                    <div className="text-sm text-gray-500 capitalize">{tech.role}</div>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowAssignModal(false)} className="mt-4 w-full py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DemoDashboardContent() {
  const [filter, setFilter] = useState(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const { getStats } = useDemo();
  const stats = getStats();
  
  return (
    <div className="min-h-screen bg-gray-100">
      <DemoBanner />
      <Notifications />
      
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center"><span className="text-white font-bold text-xl">P</span></div>
              <div><h1 className="text-xl font-bold text-gray-800">PCS FieldService</h1><p className="text-sm text-gray-500">Summit Mechanical Services</p></div>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/demo/mobile" className="text-blue-600 hover:text-blue-700 text-sm font-medium">Try Mobile App →</Link>
              <Link href="/demo" className="text-gray-500 hover:text-gray-700 text-sm">Back to Demo</Link>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white"><div className="text-3xl font-bold">{stats.total}</div><div className="text-blue-100">Total Work Orders</div></div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white"><div className="text-3xl font-bold">{stats.techsOnField}</div><div className="text-green-100">Techs on Field</div></div>
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-6 text-white"><div className="text-3xl font-bold">{stats.scheduledToday}</div><div className="text-amber-100">Scheduled Today</div></div>
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white"><div className="text-3xl font-bold">{stats.emergency}</div><div className="text-red-100">Emergencies</div></div>
        </div>
        
        <StatsCards onFilterChange={setFilter} currentFilter={filter} />
        
        {filter && <div className="mb-4"><button onClick={() => setFilter(null)} className="text-sm text-blue-600 hover:text-blue-700">← Clear filter</button></div>}
        
        <WorkOrdersTable filter={filter} onSelectWorkOrder={setSelectedWorkOrder} />
      </main>
      
      {selectedWorkOrder && <WorkOrderDetailModal workOrder={selectedWorkOrder} onClose={() => setSelectedWorkOrder(null)} />}
    </div>
  );
}

export default function DemoDashboard() {
  return (
    <DemoProvider>
      <DemoDashboardContent />
    </DemoProvider>
  );
}
