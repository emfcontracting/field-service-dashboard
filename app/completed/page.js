'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function CompletedWorkOrders() {
  const [currentUser, setCurrentUser] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);
  const [selectedWO, setSelectedWO] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('');

  const [fieldData, setFieldData] = useState({
    hours_regular: 0,
    hours_overtime: 0,
    miles: 0,
    material_cost: 0,
    emf_equipment_cost: 0,
    trailer_cost: 0,
    rental_cost: 0
  });

  useEffect(() => {
    const savedSession = localStorage.getItem('mobile_session');
    if (savedSession) {
      const user = JSON.parse(savedSession);
      setCurrentUser(user);
      fetchCompletedWorkOrders(user.user_id);
    } else {
      window.location.href = '/mobile';
    }
  }, []);

  const fetchCompletedWorkOrders = async (userId) => {
    setLoading(true);
    
    // Get completed AND invoiced work orders where user is lead tech
const { data: leadTechWOs } = await supabase
  .from('work_orders')
  .select(`
    *,
    lead_tech:users!lead_tech_id(first_name, last_name)
  `)
  .eq('lead_tech_id', userId)
  .eq('status', 'completed')
  .eq('is_locked', true) // Only show invoiced work orders
  .order('date_completed', { ascending: false });

    // Get completed work orders where user is team member
    const { data: assignments } = await supabase
      .from('work_order_assignments')
      .select('wo_id')
      .eq('user_id', userId);

    let assignedWOs = [];
if (assignments && assignments.length > 0) {
  const woIds = assignments.map(a => a.wo_id);
  const { data: assignedWOData } = await supabase
    .from('work_orders')
    .select(`
      *,
      lead_tech:users!lead_tech_id(first_name, last_name)
    `)
    .in('wo_id', woIds)
    .eq('status', 'completed')
    .eq('is_locked', true) // Only show invoiced work orders
    .order('date_completed', { ascending: false });

  assignedWOs = assignedWOData || [];
}

    // Combine and deduplicate
    const allWOs = [...(leadTechWOs || []), ...assignedWOs];
    const uniqueWOs = Array.from(
      new Map(allWOs.map(wo => [wo.wo_id, wo])).values()
    );

    setWorkOrders(uniqueWOs);
    setLoading(false);
  };

  const selectWorkOrder = async (wo) => {
    setSelectedWO(wo);
    setUserRole(wo.lead_tech_id === currentUser?.user_id ? 'lead' : 'helper');

    setFieldData({
      hours_regular: wo.hours_regular || 0,
      hours_overtime: wo.hours_overtime || 0,
      miles: wo.miles || 0,
      material_cost: wo.material_cost || 0,
      emf_equipment_cost: wo.emf_equipment_cost || 0,
      trailer_cost: wo.trailer_cost || 0,
      rental_cost: wo.rental_cost || 0
    });

    await fetchTeamMembers(wo.wo_id);
  };

  const fetchTeamMembers = async (woId) => {
    const { data } = await supabase
      .from('work_order_assignments')
      .select(`
        *,
        user:users(first_name, last_name, email)
      `)
      .eq('wo_id', woId);

    setTeamMembers(data || []);
  };

  const getStatusColor = (status) => {
    return 'bg-green-600'; // Always green for completed
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      
      {!selectedWO && (
        <div>
          <div className="bg-gray-800 border-b border-gray-700 p-4 sticky top-0 z-10">
            <div className="flex justify-between items-center mb-2">
              <button
                onClick={() => window.location.href = '/mobile'}
                className="text-blue-400 hover:text-blue-300"
              >
                ← Back to Active Work Orders
              </button>
            </div>
            <h1 className="text-2xl font-bold">✅ Completed Work Orders</h1>
            <p className="text-sm text-gray-400">Reference past completed jobs</p>
          </div>

          <div className="p-4 space-y-3">
            {loading ? (
              <div className="text-center py-12 text-gray-400">Loading...</div>
            ) : workOrders.length === 0 ? (
              <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
                <div className="text-4xl mb-3">📋</div>
                <div className="font-semibold mb-2">No completed work orders yet</div>
                <div className="text-sm">Completed work orders will appear here for reference</div>
              </div>
            ) : (
              workOrders.map(wo => (
                <div
                  key={wo.wo_id}
                  onClick={() => selectWorkOrder(wo)}
                  className="bg-gray-800 rounded-lg p-4 cursor-pointer active:bg-gray-700"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-lg">{wo.wo_number}</div>
                      <div className="text-sm text-gray-400">{wo.building}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-green-600">
                        COMPLETED
                      </span>
                      {wo.is_locked && (
                        <span className="text-xs text-purple-400">🔒 INVOICED</span>
                      )}
                      {wo.acknowledged && !wo.is_locked && (
                        <span className="text-xs text-blue-400">✅ ACKNOWLEDGED</span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-300">
                    {wo.work_order_description.substring(0, 100)}...
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Completed: {wo.date_completed ? new Date(wo.date_completed).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {selectedWO && (
        <div className="pb-20">
          <div className="bg-gray-800 border-b border-gray-700 p-4 sticky top-0 z-10">
            <button
              onClick={() => setSelectedWO(null)}
              className="text-blue-400 mb-2"
            >
              ← Back to Completed List
            </button>
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold">{selectedWO.wo_number}</h1>
                <p className="text-sm text-gray-400">
                  {selectedWO.date_completed 
                    ? `Completed on ${new Date(selectedWO.date_completed).toLocaleDateString()}`
                    : 'Completed'
                  }
                </p>
              </div>
              <div className="flex gap-2">
                <span className="px-3 py-2 rounded-lg text-sm font-semibold bg-green-600">
                  COMPLETED
                </span>
                {selectedWO.is_locked && (
                  <span className="px-3 py-2 rounded-lg text-sm font-semibold bg-purple-600">
                    🔒 INVOICED
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 space-y-6">
            
            {(selectedWO.is_locked || selectedWO.acknowledged) && (
              <div className="bg-blue-900 text-blue-200 p-4 rounded-lg">
                <div className="font-bold text-lg">📋 Read-Only Reference</div>
                <div className="text-sm mt-1">
                  This completed work order is for reference purposes only.
                  {selectedWO.acknowledged && ' It has been acknowledged by the office.'}
                  {selectedWO.is_locked && ' An invoice has been generated.'}
                </div>
              </div>
            )}
            
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="text-lg font-bold mb-3">Work Order Details</h2>
              
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-400">Building:</span>
                  <div className="font-semibold">{selectedWO.building}</div>
                </div>
                
                <div>
                  <span className="text-gray-400">Requestor:</span>
                  <div className="font-semibold">{selectedWO.requestor || 'N/A'}</div>
                </div>
                
                <div>
                  <span className="text-gray-400">Description:</span>
                  <div className="mt-1">{selectedWO.work_order_description}</div>
                </div>

                <div>
                  <span className="text-gray-400">Priority:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs font-bold ${
                    selectedWO.priority === 'emergency' ? 'bg-red-100 text-red-700' :
                    selectedWO.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                    selectedWO.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {selectedWO.priority.toUpperCase()}
                  </span>
                </div>
                
                <div>
                  <span className="text-gray-400">Date Entered:</span>
                  <div>{new Date(selectedWO.date_entered).toLocaleDateString()}</div>
                </div>

                <div>
                  <span className="text-gray-400">Date Completed:</span>
                  <div>
                    {selectedWO.date_completed 
                      ? new Date(selectedWO.date_completed).toLocaleDateString()
                      : 'N/A'
                    }
                  </div>
                </div>

                <div>
                  <span className="text-gray-400">Age:</span>
                  <div>
                    {Math.floor((new Date(selectedWO.date_completed || new Date()) - new Date(selectedWO.date_entered)) / (1000 * 60 * 60 * 24))} days
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3">Lead Technician</h3>
              <div className="bg-gray-700 p-3 rounded-lg font-semibold">
                {selectedWO.lead_tech?.first_name} {selectedWO.lead_tech?.last_name}
              </div>
            </div>

            {teamMembers.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="font-bold mb-3">Team Members</h3>
                <div className="space-y-3">
                  {teamMembers.map(member => (
                    <div key={member.assignment_id} className="bg-gray-700 rounded-lg p-3">
                      <div className="font-bold">
                        {member.user?.first_name} {member.user?.last_name}
                      </div>
                      <div className="text-xs text-gray-400 capitalize mt-1">{member.role}</div>
                      
                      <div className="grid grid-cols-3 gap-2 text-sm mt-2">
                        <div>
                          <div className="text-xs text-gray-400">RT Hours</div>
                          <div className="font-semibold">{member.hours_regular || 0}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">OT Hours</div>
                          <div className="font-semibold">{member.hours_overtime || 0}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">Miles</div>
                          <div className="font-semibold">{member.miles || 0}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {userRole === 'lead' && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="font-bold mb-3">Primary Tech Hours & Costs</h3>
                
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-gray-400">Regular Hours (RT)</div>
                      <div className="text-xl font-bold">{fieldData.hours_regular}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Overtime Hours (OT)</div>
                      <div className="text-xl font-bold">{fieldData.hours_overtime}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-gray-400">Miles</div>
                      <div className="text-xl font-bold">{fieldData.miles}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Materials</div>
                      <div className="text-xl font-bold">${(fieldData.material_cost || 0).toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-gray-400">Equipment</div>
                      <div className="font-bold">${(fieldData.emf_equipment_cost || 0).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Trailer</div>
                      <div className="font-bold">${(fieldData.trailer_cost || 0).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Rental</div>
                      <div className="font-bold">${(fieldData.rental_cost || 0).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedWO.comments && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="font-bold mb-3">Comments</h3>
                <div className="bg-gray-700 rounded p-3 text-sm whitespace-pre-wrap">
                  {selectedWO.comments || 'No comments'}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}