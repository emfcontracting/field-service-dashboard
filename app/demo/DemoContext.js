'use client';

import { createContext, useContext, useState, useCallback } from 'react';

// ============================================================
// DEMO DATA - Realistic sample data for Summit Mechanical Services
// ============================================================

// Helper to generate dates relative to now
const daysAgo = (days, hours = 0) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(date.getHours() - hours);
  return date.toISOString();
};

const daysFromNow = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

const today = () => new Date().toISOString().split('T')[0];

const hoursAgo = (hours) => {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date.toISOString();
};

const minutesAgo = (minutes) => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - minutes);
  return date.toISOString();
};

// Demo Users
const INITIAL_USERS = [
  { id: 'demo-user-001', name: 'Jennifer Martinez', email: 'jennifer@summitmech.demo', role: 'admin', phone: '555-100-0001', is_active: true },
  { id: 'demo-user-002', name: 'Michael Chen', email: 'michael@summitmech.demo', role: 'office', phone: '555-100-0002', is_active: true },
  { id: 'demo-user-003', name: 'Robert Johnson', email: 'robert@summitmech.demo', role: 'lead', phone: '555-200-0001', is_active: true },
  { id: 'demo-user-004', name: 'Carlos Rodriguez', email: 'carlos@summitmech.demo', role: 'lead', phone: '555-200-0002', is_active: true },
  { id: 'demo-user-005', name: 'David Williams', email: 'david@summitmech.demo', role: 'lead', phone: '555-200-0003', is_active: true },
  { id: 'demo-user-006', name: 'James Wilson', email: 'james@summitmech.demo', role: 'tech', phone: '555-300-0001', is_active: true },
  { id: 'demo-user-007', name: 'Anthony Brown', email: 'anthony@summitmech.demo', role: 'tech', phone: '555-300-0002', is_active: true },
  { id: 'demo-user-008', name: 'Marcus Davis', email: 'marcus@summitmech.demo', role: 'tech', phone: '555-300-0003', is_active: true },
  { id: 'demo-user-009', name: 'Tyler Anderson', email: 'tyler@summitmech.demo', role: 'helper', phone: '555-400-0001', is_active: true },
  { id: 'demo-user-010', name: 'Kevin Thompson', email: 'kevin@summitmech.demo', role: 'helper', phone: '555-400-0002', is_active: true },
];

// Demo Work Orders
const createInitialWorkOrders = () => [
  {
    id: 'demo-wo-001',
    wo_number: 'WO-2024-0847',
    client_name: 'CBRE',
    location: '1250 Corporate Drive, Phoenix, AZ 85034',
    building_name: 'Corporate Tower West',
    description: 'RTU-3 not cooling properly. Tenant complaints about temperature on 4th floor.',
    priority: 'high',
    status: 'invoiced',
    billing_status: null,
    nte_amount: 850.00,
    assigned_tech: 'demo-user-003',
    scheduled_date: daysAgo(12).split('T')[0],
    created_at: daysAgo(14),
    updated_at: daysAgo(10),
    check_in_time: daysAgo(12, 8),
    check_out_time: daysAgo(12, 2),
    legacy_labor_total: 384.00,
    legacy_material_total: 245.50,
    legacy_equipment_total: 0,
    legacy_mileage_total: 45.00
  },
  {
    id: 'demo-wo-002',
    wo_number: 'WO-2024-0851',
    client_name: 'CBRE',
    location: '890 Industrial Parkway, Phoenix, AZ 85043',
    building_name: 'Distribution Center A',
    description: 'Water leak in main restroom. Flooding reported. Emergency response required.',
    priority: 'emergency',
    status: 'invoiced',
    billing_status: null,
    nte_amount: 1200.00,
    assigned_tech: 'demo-user-004',
    scheduled_date: daysAgo(10).split('T')[0],
    created_at: daysAgo(11),
    updated_at: daysAgo(8),
    check_in_time: daysAgo(10, 6),
    check_out_time: daysAgo(10, 0),
    legacy_labor_total: 576.00,
    legacy_material_total: 423.75,
    legacy_equipment_total: 85.00,
    legacy_mileage_total: 62.00
  },
  {
    id: 'demo-wo-005',
    wo_number: 'WO-2024-0891',
    client_name: 'CBRE',
    location: '3300 Gateway Boulevard, Phoenix, AZ 85034',
    building_name: 'Gateway Office Complex',
    description: 'Quarterly HVAC preventive maintenance. 12 RTUs scheduled for inspection.',
    priority: 'medium',
    status: 'in_progress',
    billing_status: null,
    nte_amount: 1800.00,
    assigned_tech: 'demo-user-003',
    scheduled_date: today(),
    created_at: daysAgo(2),
    updated_at: new Date().toISOString(),
    check_in_time: hoursAgo(2),
    check_out_time: null,
    legacy_labor_total: 0,
    legacy_material_total: 0,
    legacy_equipment_total: 0,
    legacy_mileage_total: 0
  },
  {
    id: 'demo-wo-006',
    wo_number: 'WO-2024-0888',
    client_name: 'CBRE',
    location: '1800 Innovation Way, Chandler, AZ 85224',
    building_name: 'Innovation Campus - Bldg C',
    description: 'Chiller repair - compressor bearing replacement. 2-day job estimated.',
    priority: 'high',
    status: 'in_progress',
    billing_status: null,
    nte_amount: 4500.00,
    assigned_tech: 'demo-user-004',
    scheduled_date: daysAgo(1).split('T')[0],
    created_at: daysAgo(3),
    updated_at: new Date().toISOString(),
    check_in_time: hoursAgo(3),
    check_out_time: null,
    legacy_labor_total: 512.00,
    legacy_material_total: 0,
    legacy_equipment_total: 0,
    legacy_mileage_total: 55.00
  },
  {
    id: 'demo-wo-007',
    wo_number: 'WO-2024-0893',
    client_name: 'CBRE',
    location: '500 Republic Street, Phoenix, AZ 85004',
    building_name: 'Republic Tower',
    description: 'Investigate water damage in ceiling tiles, 6th floor.',
    priority: 'high',
    status: 'in_progress',
    billing_status: 'pending_cbre_quote',
    nte_amount: 800.00,
    assigned_tech: 'demo-user-005',
    scheduled_date: today(),
    created_at: daysAgo(1),
    updated_at: new Date().toISOString(),
    check_in_time: hoursAgo(3),
    check_out_time: null,
    legacy_labor_total: 192.00,
    legacy_material_total: 0,
    legacy_equipment_total: 0,
    legacy_mileage_total: 28.00
  },
  {
    id: 'demo-wo-008',
    wo_number: 'WO-2024-0895',
    client_name: 'CBRE',
    location: '2250 Camelback Road, Phoenix, AZ 85016',
    building_name: 'Camelback Medical Center',
    description: 'Replace exhaust fan in laboratory area.',
    priority: 'medium',
    status: 'assigned',
    billing_status: null,
    nte_amount: 950.00,
    assigned_tech: 'demo-user-003',
    scheduled_date: daysFromNow(1),
    created_at: daysAgo(2),
    updated_at: daysAgo(2),
    check_in_time: null,
    check_out_time: null,
    legacy_labor_total: 0,
    legacy_material_total: 0,
    legacy_equipment_total: 0,
    legacy_mileage_total: 0
  },
  {
    id: 'demo-wo-011',
    wo_number: 'WO-2024-0898',
    client_name: 'CBRE',
    location: '4400 N 32nd Street, Phoenix, AZ 85018',
    building_name: 'Paradise Valley Office Park',
    description: 'Tenant complaint - strange noise from rooftop unit.',
    priority: 'medium',
    status: 'new',
    billing_status: null,
    nte_amount: 500.00,
    assigned_tech: null,
    scheduled_date: null,
    created_at: hoursAgo(4),
    updated_at: hoursAgo(4),
    check_in_time: null,
    check_out_time: null,
    legacy_labor_total: 0,
    legacy_material_total: 0,
    legacy_equipment_total: 0,
    legacy_mileage_total: 0
  },
  {
    id: 'demo-wo-013',
    wo_number: 'WO-2024-0899',
    client_name: 'CBRE',
    location: '100 W Clarendon Avenue, Phoenix, AZ 85013',
    building_name: 'Midtown Financial Center',
    description: 'EMERGENCY: AC completely down on 3rd floor. VIP client area.',
    priority: 'emergency',
    status: 'new',
    billing_status: null,
    nte_amount: 2000.00,
    assigned_tech: null,
    scheduled_date: null,
    created_at: minutesAgo(30),
    updated_at: minutesAgo(30),
    check_in_time: null,
    check_out_time: null,
    legacy_labor_total: 0,
    legacy_material_total: 0,
    legacy_equipment_total: 0,
    legacy_mileage_total: 0
  },
];

// Demo Comments
const createInitialComments = () => [
  { id: 'demo-cmt-001', work_order_id: 'demo-wo-001', user_id: 'demo-user-003', comment: 'On site. RTU-3 showing high head pressure.', created_at: daysAgo(12, 8) },
  { id: 'demo-cmt-002', work_order_id: 'demo-wo-001', user_id: 'demo-user-003', comment: 'Low refrigerant confirmed. Recharged with 4lbs R-410A.', created_at: daysAgo(12, 4) },
  { id: 'demo-cmt-003', work_order_id: 'demo-wo-005', user_id: 'demo-user-003', comment: 'Starting PM on RTU-1. Filter replacement needed.', created_at: hoursAgo(2) },
  { id: 'demo-cmt-004', work_order_id: 'demo-wo-006', user_id: 'demo-user-004', comment: 'Day 2 - Installing new bearing assembly.', created_at: hoursAgo(3) },
  { id: 'demo-cmt-005', work_order_id: 'demo-wo-007', user_id: 'demo-user-005', comment: 'Found extensive duct corrosion. Submitting NTE increase.', created_at: hoursAgo(2) },
];

// Demo Team Assignments
const createInitialTeamAssignments = () => [
  { id: 'demo-team-001', work_order_id: 'demo-wo-001', user_id: 'demo-user-003', role: 'lead' },
  { id: 'demo-team-002', work_order_id: 'demo-wo-005', user_id: 'demo-user-003', role: 'lead' },
  { id: 'demo-team-003', work_order_id: 'demo-wo-005', user_id: 'demo-user-008', role: 'tech' },
  { id: 'demo-team-004', work_order_id: 'demo-wo-006', user_id: 'demo-user-004', role: 'lead' },
  { id: 'demo-team-005', work_order_id: 'demo-wo-006', user_id: 'demo-user-006', role: 'tech' },
  { id: 'demo-team-006', work_order_id: 'demo-wo-007', user_id: 'demo-user-005', role: 'lead' },
  { id: 'demo-team-007', work_order_id: 'demo-wo-008', user_id: 'demo-user-003', role: 'lead' },
];

// Demo Daily Hours
const createInitialDailyHours = () => [
  { id: 'demo-hours-001', work_order_id: 'demo-wo-001', user_id: 'demo-user-003', log_date: daysAgo(12).split('T')[0], regular_hours: 5, overtime_hours: 1, mileage: 45, notes: 'Refrigerant recharge' },
  { id: 'demo-hours-002', work_order_id: 'demo-wo-006', user_id: 'demo-user-004', log_date: daysAgo(1).split('T')[0], regular_hours: 8, overtime_hours: 0, mileage: 55, notes: 'Day 1 - Compressor teardown' },
];

// Demo Quotes
const createInitialQuotes = () => [
  {
    id: 'demo-quote-001',
    work_order_id: 'demo-wo-007',
    labor_hours: 24,
    labor_cost: 1536.00,
    material_cost: 2800.00,
    material_description: '40ft galvanized duct section',
    equipment_cost: 250.00,
    mileage: 56,
    mileage_cost: 56.00,
    total_cost: 4642.00,
    notes: 'Duct replacement required due to corrosion.',
    status: 'pending',
    created_at: hoursAgo(1)
  },
];

// ============================================================
// DEMO CONTEXT
// ============================================================

const DemoContext = createContext(null);

export function DemoProvider({ children }) {
  const [users] = useState(INITIAL_USERS);
  const [workOrders, setWorkOrders] = useState(createInitialWorkOrders);
  const [comments, setComments] = useState(createInitialComments);
  const [teamAssignments, setTeamAssignments] = useState(createInitialTeamAssignments);
  const [dailyHours, setDailyHours] = useState(createInitialDailyHours);
  const [quotes, setQuotes] = useState(createInitialQuotes);
  
  const [notifications, setNotifications] = useState([]);
  const [showDemoBanner, setShowDemoBanner] = useState(true);
  const [currentDemoUser, setCurrentDemoUser] = useState(INITIAL_USERS.find(u => u.role === 'lead'));

  const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const addNotification = useCallback((message, type = 'info') => {
    const id = generateId('notif');
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  }, []);

  const updateWorkOrder = useCallback((workOrderId, updates) => {
    setWorkOrders(prev => prev.map(wo => 
      wo.id === workOrderId ? { ...wo, ...updates, updated_at: new Date().toISOString() } : wo
    ));
    addNotification('Work order updated', 'success');
  }, [addNotification]);

  const assignTech = useCallback((workOrderId, techId, scheduledDate) => {
    const tech = users.find(u => u.id === techId);
    setWorkOrders(prev => prev.map(wo => 
      wo.id === workOrderId ? { ...wo, assigned_tech: techId, scheduled_date: scheduledDate, status: 'assigned', updated_at: new Date().toISOString() } : wo
    ));
    addNotification(`Assigned to ${tech?.name}`, 'success');
  }, [users, addNotification]);

  const checkIn = useCallback((workOrderId) => {
    setWorkOrders(prev => prev.map(wo => 
      wo.id === workOrderId ? { ...wo, status: 'in_progress', check_in_time: new Date().toISOString(), updated_at: new Date().toISOString() } : wo
    ));
    addNotification('Checked in successfully', 'success');
  }, [addNotification]);

  const checkOut = useCallback((workOrderId) => {
    setWorkOrders(prev => prev.map(wo => 
      wo.id === workOrderId ? { ...wo, check_out_time: new Date().toISOString(), updated_at: new Date().toISOString() } : wo
    ));
    addNotification('Checked out successfully', 'success');
  }, [addNotification]);

  const completeWorkOrder = useCallback((workOrderId) => {
    setWorkOrders(prev => prev.map(wo => 
      wo.id === workOrderId ? { ...wo, status: 'completed', check_out_time: wo.check_out_time || new Date().toISOString(), updated_at: new Date().toISOString() } : wo
    ));
    addNotification('Work order completed', 'success');
  }, [addNotification]);

  const updateStatus = useCallback((workOrderId, newStatus) => {
    setWorkOrders(prev => prev.map(wo => 
      wo.id === workOrderId ? { ...wo, status: newStatus, updated_at: new Date().toISOString() } : wo
    ));
    addNotification(`Status changed to ${newStatus}`, 'success');
  }, [addNotification]);

  const addComment = useCallback((workOrderId, userId, commentText) => {
    const newComment = {
      id: generateId('demo-cmt'),
      work_order_id: workOrderId,
      user_id: userId,
      comment: commentText,
      created_at: new Date().toISOString()
    };
    setComments(prev => [...prev, newComment]);
    addNotification('Comment added', 'success');
    return newComment;
  }, [addNotification]);

  const logHours = useCallback((workOrderId, userId, logDate, regularHours, overtimeHours, mileage, notes) => {
    const newEntry = {
      id: generateId('demo-hours'),
      work_order_id: workOrderId,
      user_id: userId,
      log_date: logDate,
      regular_hours: regularHours,
      overtime_hours: overtimeHours,
      mileage: mileage,
      notes: notes
    };
    setDailyHours(prev => [...prev, newEntry]);
    addNotification('Hours logged', 'success');
  }, [addNotification]);

  const getUserById = useCallback((userId) => users.find(u => u.id === userId), [users]);
  const getWorkOrderById = useCallback((workOrderId) => workOrders.find(wo => wo.id === workOrderId), [workOrders]);
  const getCommentsForWorkOrder = useCallback((workOrderId) => comments.filter(c => c.work_order_id === workOrderId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)), [comments]);
  const getTeamForWorkOrder = useCallback((workOrderId) => teamAssignments.filter(ta => ta.work_order_id === workOrderId).map(ta => ({ ...ta, user: users.find(u => u.id === ta.user_id) })), [teamAssignments, users]);
  const getDailyHoursForWorkOrder = useCallback((workOrderId) => dailyHours.filter(dh => dh.work_order_id === workOrderId).map(dh => ({ ...dh, user: users.find(u => u.id === dh.user_id) })), [dailyHours, users]);
  const getQuotesForWorkOrder = useCallback((workOrderId) => quotes.filter(q => q.work_order_id === workOrderId), [quotes]);
  const getWorkOrdersForTech = useCallback((techId) => workOrders.filter(wo => wo.assigned_tech === techId || teamAssignments.some(ta => ta.work_order_id === wo.id && ta.user_id === techId)), [workOrders, teamAssignments]);

  const getStats = useCallback(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return {
      total: workOrders.length,
      new: workOrders.filter(wo => wo.status === 'new').length,
      assigned: workOrders.filter(wo => wo.status === 'assigned').length,
      inProgress: workOrders.filter(wo => wo.status === 'in_progress').length,
      completed: workOrders.filter(wo => wo.status === 'completed').length,
      emergency: workOrders.filter(wo => wo.priority === 'emergency' && !['completed', 'invoiced'].includes(wo.status)).length,
      pendingCbreQuote: workOrders.filter(wo => wo.billing_status === 'pending_cbre_quote').length,
      scheduledToday: workOrders.filter(wo => wo.scheduled_date === todayStr).length,
      techsOnField: workOrders.filter(wo => wo.status === 'in_progress' && wo.check_in_time && !wo.check_out_time).length
    };
  }, [workOrders]);

  const resetDemo = useCallback(() => {
    setWorkOrders(createInitialWorkOrders());
    setComments(createInitialComments());
    setTeamAssignments(createInitialTeamAssignments());
    setDailyHours(createInitialDailyHours());
    setQuotes(createInitialQuotes());
    addNotification('Demo data reset', 'info');
  }, [addNotification]);

  const value = {
    users, workOrders, comments, teamAssignments, dailyHours, quotes, notifications, showDemoBanner, currentDemoUser,
    setShowDemoBanner, setCurrentDemoUser,
    updateWorkOrder, assignTech, checkIn, checkOut, completeWorkOrder, updateStatus, addComment, logHours,
    getUserById, getWorkOrderById, getCommentsForWorkOrder, getTeamForWorkOrder, getDailyHoursForWorkOrder, getQuotesForWorkOrder, getWorkOrdersForTech, getStats,
    resetDemo, addNotification,
    isDemo: true
  };

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error('useDemo must be used within a DemoProvider');
  return context;
}

export default DemoContext;
