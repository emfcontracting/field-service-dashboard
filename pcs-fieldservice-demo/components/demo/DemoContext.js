'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

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
  { id: 'demo-user-001', name: 'Jennifer Martinez', email: 'jennifer@summitmech.demo', role: 'admin', phone: '555-100-0001', carrier: 'vtext.com', is_active: true },
  { id: 'demo-user-002', name: 'Michael Chen', email: 'michael@summitmech.demo', role: 'office', phone: '555-100-0002', carrier: 'txt.att.net', is_active: true },
  { id: 'demo-user-003', name: 'Robert Johnson', email: 'robert@summitmech.demo', role: 'lead', phone: '555-200-0001', carrier: 'vtext.com', is_active: true },
  { id: 'demo-user-004', name: 'Carlos Rodriguez', email: 'carlos@summitmech.demo', role: 'lead', phone: '555-200-0002', carrier: 'tmomail.net', is_active: true },
  { id: 'demo-user-005', name: 'David Williams', email: 'david@summitmech.demo', role: 'lead', phone: '555-200-0003', carrier: 'vtext.com', is_active: true },
  { id: 'demo-user-006', name: 'James Wilson', email: 'james@summitmech.demo', role: 'tech', phone: '555-300-0001', carrier: 'txt.att.net', is_active: true },
  { id: 'demo-user-007', name: 'Anthony Brown', email: 'anthony@summitmech.demo', role: 'tech', phone: '555-300-0002', carrier: 'vtext.com', is_active: true },
  { id: 'demo-user-008', name: 'Marcus Davis', email: 'marcus@summitmech.demo', role: 'tech', phone: '555-300-0003', carrier: 'tmomail.net', is_active: true },
  { id: 'demo-user-009', name: 'Tyler Anderson', email: 'tyler@summitmech.demo', role: 'helper', phone: '555-400-0001', carrier: 'vtext.com', is_active: true },
  { id: 'demo-user-010', name: 'Kevin Thompson', email: 'kevin@summitmech.demo', role: 'helper', phone: '555-400-0002', carrier: 'txt.att.net', is_active: true },
];

// Demo Work Orders
const createInitialWorkOrders = () => [
  // COMPLETED/INVOICED
  {
    id: 'demo-wo-001',
    wo_number: 'WO-2024-0847',
    client_name: 'CBRE',
    location: '1250 Corporate Drive, Phoenix, AZ 85034',
    building_name: 'Corporate Tower West',
    description: 'RTU-3 not cooling properly. Tenant complaints about temperature on 4th floor. Check refrigerant levels and compressor operation.',
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
    has_before_photos: true,
    has_after_photos: true,
    pmi_writeup_sent: false,
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
    has_before_photos: true,
    has_after_photos: true,
    pmi_writeup_sent: false,
    legacy_labor_total: 576.00,
    legacy_material_total: 423.75,
    legacy_equipment_total: 85.00,
    legacy_mileage_total: 62.00
  },
  // PM Work Order - Completed
  {
    id: 'demo-wo-003',
    wo_number: 'P2024-0839',
    client_name: 'CBRE',
    location: '445 Commerce Street, Tempe, AZ 85281',
    building_name: 'Tech Hub Building',
    description: 'Quarterly PM inspection - HVAC systems. Check filters, belts, refrigerant levels, and controls.',
    priority: 'medium',
    status: 'invoiced',
    billing_status: null,
    nte_amount: 2500.00,
    assigned_tech: 'demo-user-003',
    scheduled_date: daysAgo(18).split('T')[0],
    created_at: daysAgo(21),
    updated_at: daysAgo(15),
    check_in_time: daysAgo(18, 9),
    check_out_time: daysAgo(17, 0),
    has_before_photos: true,
    has_after_photos: true,
    pmi_writeup_sent: true,
    legacy_labor_total: 896.00,
    legacy_material_total: 1245.00,
    legacy_equipment_total: 150.00,
    legacy_mileage_total: 38.00
  },
  {
    id: 'demo-wo-004',
    wo_number: 'WO-2024-0862',
    client_name: 'CBRE',
    location: '2100 Financial Plaza, Scottsdale, AZ 85251',
    building_name: 'Financial Services Tower',
    description: 'VAV box replacement on 8th floor. Original scope expanded - found 3 additional units failing.',
    priority: 'high',
    status: 'completed',
    billing_status: null,
    nte_amount: 3500.00,
    assigned_tech: 'demo-user-005',
    scheduled_date: daysAgo(5).split('T')[0],
    created_at: daysAgo(7),
    updated_at: daysAgo(3),
    check_in_time: daysAgo(5, 9),
    check_out_time: daysAgo(5, 0),
    has_before_photos: true,
    has_after_photos: true,
    pmi_writeup_sent: false,
    legacy_labor_total: 768.00,
    legacy_material_total: 1856.00,
    legacy_equipment_total: 0,
    legacy_mileage_total: 52.00
  },

  // IN PROGRESS
  {
    id: 'demo-wo-005',
    wo_number: 'P2024-0891',
    client_name: 'CBRE',
    location: '3300 Gateway Boulevard, Phoenix, AZ 85034',
    building_name: 'Gateway Office Complex',
    description: 'Quarterly HVAC preventive maintenance. 12 RTUs scheduled for inspection and filter replacement.',
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
    has_before_photos: true,
    has_after_photos: false,
    pmi_writeup_sent: false,
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
    description: 'Chiller repair - compressor bearing replacement. 2-day job estimated. Parts on site.',
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
    has_before_photos: true,
    has_after_photos: false,
    pmi_writeup_sent: false,
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
    description: 'Investigate water damage in ceiling tiles, 6th floor. Found extensive ductwork corrosion requiring replacement.',
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
    has_before_photos: false,
    has_after_photos: false,
    pmi_writeup_sent: false,
    legacy_labor_total: 192.00,
    legacy_material_total: 0,
    legacy_equipment_total: 0,
    legacy_mileage_total: 28.00
  },

  // ASSIGNED
  {
    id: 'demo-wo-008',
    wo_number: 'WO-2024-0895',
    client_name: 'CBRE',
    location: '2250 Camelback Road, Phoenix, AZ 85016',
    building_name: 'Camelback Medical Center',
    description: 'Replace exhaust fan in laboratory area. Must coordinate with lab manager for access.',
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
    has_before_photos: false,
    has_after_photos: false,
    pmi_writeup_sent: false,
    legacy_labor_total: 0,
    legacy_material_total: 0,
    legacy_equipment_total: 0,
    legacy_mileage_total: 0
  },
  {
    id: 'demo-wo-009',
    wo_number: 'P2024-0896',
    client_name: 'CBRE',
    location: '675 Mill Avenue, Tempe, AZ 85281',
    building_name: 'University Business Center',
    description: 'PM Inspection - Fire suppression system quarterly check. Test all valves and sensors.',
    priority: 'low',
    status: 'assigned',
    billing_status: null,
    nte_amount: 450.00,
    assigned_tech: 'demo-user-004',
    scheduled_date: daysFromNow(2),
    created_at: daysAgo(1),
    updated_at: daysAgo(1),
    check_in_time: null,
    check_out_time: null,
    has_before_photos: false,
    has_after_photos: false,
    pmi_writeup_sent: false,
    legacy_labor_total: 0,
    legacy_material_total: 0,
    legacy_equipment_total: 0,
    legacy_mileage_total: 0
  },
  {
    id: 'demo-wo-010',
    wo_number: 'WO-2024-0897',
    client_name: 'CBRE',
    location: '1100 E Washington Street, Phoenix, AZ 85034',
    building_name: 'Washington Executive Plaza',
    description: 'Annual backflow preventer testing and certification. 4 units total.',
    priority: 'medium',
    status: 'assigned',
    billing_status: null,
    nte_amount: 680.00,
    assigned_tech: 'demo-user-005',
    scheduled_date: daysFromNow(5),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    check_in_time: null,
    check_out_time: null,
    has_before_photos: false,
    has_after_photos: false,
    pmi_writeup_sent: false,
    legacy_labor_total: 0,
    legacy_material_total: 0,
    legacy_equipment_total: 0,
    legacy_mileage_total: 0
  },

  // NEW/UNASSIGNED
  {
    id: 'demo-wo-011',
    wo_number: 'WO-2024-0898',
    client_name: 'CBRE',
    location: '4400 N 32nd Street, Phoenix, AZ 85018',
    building_name: 'Paradise Valley Office Park',
    description: 'Tenant complaint - strange noise from rooftop unit. Please diagnose and quote repair.',
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
    has_before_photos: false,
    has_after_photos: false,
    pmi_writeup_sent: false,
    legacy_labor_total: 0,
    legacy_material_total: 0,
    legacy_equipment_total: 0,
    legacy_mileage_total: 0
  },
  {
    id: 'demo-wo-012',
    wo_number: 'WO-2024-0894',
    client_name: 'CBRE',
    location: '7878 E Princess Boulevard, Scottsdale, AZ 85255',
    building_name: 'Princess Corporate Center',
    description: 'Hot water heater replacement in break room. 50 gallon commercial unit.',
    priority: 'medium',
    status: 'new',
    billing_status: null,
    nte_amount: 1800.00,
    assigned_tech: null,
    scheduled_date: null,
    created_at: daysAgo(1),
    updated_at: daysAgo(1),
    check_in_time: null,
    check_out_time: null,
    has_before_photos: false,
    has_after_photos: false,
    pmi_writeup_sent: false,
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
    description: 'EMERGENCY: AC completely down on 3rd floor. Multiple tenant complaints. VIP client area.',
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
    has_before_photos: false,
    has_after_photos: false,
    pmi_writeup_sent: false,
    legacy_labor_total: 0,
    legacy_material_total: 0,
    legacy_equipment_total: 0,
    legacy_mileage_total: 0
  },

  // QUOTE WORKFLOW EXAMPLES
  {
    id: 'demo-wo-014',
    wo_number: 'WO-2024-0885',
    client_name: 'CBRE',
    location: '2700 N Central Avenue, Phoenix, AZ 85004',
    building_name: 'Central Tower',
    description: 'Complete VAV system overhaul - 15th floor. Major renovation scope.',
    priority: 'medium',
    status: 'assigned',
    billing_status: 'pending_cbre_quote',
    nte_amount: 1500.00,
    assigned_tech: 'demo-user-003',
    scheduled_date: daysFromNow(7),
    created_at: daysAgo(5),
    updated_at: daysAgo(2),
    check_in_time: null,
    check_out_time: null,
    has_before_photos: false,
    has_after_photos: false,
    pmi_writeup_sent: false,
    legacy_labor_total: 0,
    legacy_material_total: 0,
    legacy_equipment_total: 0,
    legacy_mileage_total: 0
  },
  {
    id: 'demo-wo-015',
    wo_number: 'WO-2024-0879',
    client_name: 'CBRE',
    location: '3800 N Central Avenue, Phoenix, AZ 85012',
    building_name: 'Uptown Plaza',
    description: 'Roof drain cleaning and repair. Scope expanded after inspection.',
    priority: 'medium',
    status: 'assigned',
    billing_status: 'quote_submitted',
    nte_amount: 750.00,
    assigned_tech: 'demo-user-004',
    scheduled_date: daysFromNow(4),
    created_at: daysAgo(8),
    updated_at: daysAgo(3),
    check_in_time: null,
    check_out_time: null,
    has_before_photos: false,
    has_after_photos: false,
    pmi_writeup_sent: false,
    legacy_labor_total: 0,
    legacy_material_total: 0,
    legacy_equipment_total: 0,
    legacy_mileage_total: 0
  }
];

// Demo Comments
const createInitialComments = () => [
  { id: 'demo-cmt-001', work_order_id: 'demo-wo-001', user_id: 'demo-user-003', comment: 'On site. RTU-3 showing high head pressure.', created_at: daysAgo(12, 8) },
  { id: 'demo-cmt-002', work_order_id: 'demo-wo-001', user_id: 'demo-user-003', comment: 'Low refrigerant confirmed. Recharged with 4lbs R-410A. Also found failed contactor - replaced.', created_at: daysAgo(12, 4) },
  { id: 'demo-cmt-003', work_order_id: 'demo-wo-001', user_id: 'demo-user-003', comment: 'System running normally. Tenant confirmed cooling restored.', created_at: daysAgo(12, 2) },
  
  { id: 'demo-cmt-004', work_order_id: 'demo-wo-002', user_id: 'demo-user-004', comment: 'EMERGENCY RESPONSE - En route', created_at: daysAgo(10, 6) },
  { id: 'demo-cmt-005', work_order_id: 'demo-wo-002', user_id: 'demo-user-004', comment: 'On site. Significant flooding in mens restroom. Shut off water main.', created_at: daysAgo(10, 5.5) },
  { id: 'demo-cmt-006', work_order_id: 'demo-wo-002', user_id: 'demo-user-004', comment: 'Found burst fitting under sink. Water extracted. Drywall removal needed around affected area.', created_at: daysAgo(10, 3) },
  { id: 'demo-cmt-007', work_order_id: 'demo-wo-002', user_id: 'demo-user-004', comment: 'Repairs complete. Water restored. Recommend drywall contractor for finishing.', created_at: daysAgo(10, 0) },
  
  { id: 'demo-cmt-008', work_order_id: 'demo-wo-004', user_id: 'demo-user-005', comment: 'Started on original VAV box. During inspection found 2 additional units with failed actuators.', created_at: daysAgo(5, 7) },
  { id: 'demo-cmt-009', work_order_id: 'demo-wo-004', user_id: 'demo-user-002', comment: 'NTE increase approved by CBRE. Proceed with all 3 units.', created_at: daysAgo(5, 5) },
  { id: 'demo-cmt-010', work_order_id: 'demo-wo-004', user_id: 'demo-user-005', comment: 'All VAV boxes replaced and calibrated. Zone temps stabilizing.', created_at: daysAgo(5, 0) },
  
  { id: 'demo-cmt-011', work_order_id: 'demo-wo-006', user_id: 'demo-user-004', comment: 'On site. Beginning compressor teardown. Confirmed bearing failure from oil analysis.', created_at: daysAgo(1, 8) },
  { id: 'demo-cmt-012', work_order_id: 'demo-wo-006', user_id: 'demo-user-004', comment: 'Day 1 complete. Bearing removed, shaft cleaned and inspected. Ready for new bearing install today.', created_at: daysAgo(1, 0) },
  
  { id: 'demo-cmt-013', work_order_id: 'demo-wo-007', user_id: 'demo-user-005', comment: 'Arrived on site. Opening ceiling for inspection.', created_at: hoursAgo(3) },
  { id: 'demo-cmt-014', work_order_id: 'demo-wo-007', user_id: 'demo-user-005', comment: 'ISSUE: Found significant corrosion in supply duct. Approximately 40ft section needs replacement. Submitting NTE increase request.', created_at: hoursAgo(2) },
  
  { id: 'demo-cmt-015', work_order_id: 'demo-wo-013', user_id: 'demo-user-002', comment: 'Dispatching nearest available tech. High priority client.', created_at: minutesAgo(20) },
];

// Demo Team Assignments
const createInitialTeamAssignments = () => [
  { id: 'demo-team-001', work_order_id: 'demo-wo-001', user_id: 'demo-user-003', role: 'lead' },
  { id: 'demo-team-002', work_order_id: 'demo-wo-001', user_id: 'demo-user-006', role: 'tech' },
  { id: 'demo-team-003', work_order_id: 'demo-wo-002', user_id: 'demo-user-004', role: 'lead' },
  { id: 'demo-team-004', work_order_id: 'demo-wo-002', user_id: 'demo-user-007', role: 'tech' },
  { id: 'demo-team-005', work_order_id: 'demo-wo-002', user_id: 'demo-user-009', role: 'helper' },
  { id: 'demo-team-006', work_order_id: 'demo-wo-003', user_id: 'demo-user-003', role: 'lead' },
  { id: 'demo-team-007', work_order_id: 'demo-wo-003', user_id: 'demo-user-008', role: 'tech' },
  { id: 'demo-team-008', work_order_id: 'demo-wo-004', user_id: 'demo-user-005', role: 'lead' },
  { id: 'demo-team-009', work_order_id: 'demo-wo-004', user_id: 'demo-user-006', role: 'tech' },
  { id: 'demo-team-010', work_order_id: 'demo-wo-004', user_id: 'demo-user-007', role: 'tech' },
  { id: 'demo-team-011', work_order_id: 'demo-wo-004', user_id: 'demo-user-010', role: 'helper' },
  { id: 'demo-team-012', work_order_id: 'demo-wo-005', user_id: 'demo-user-003', role: 'lead' },
  { id: 'demo-team-013', work_order_id: 'demo-wo-005', user_id: 'demo-user-008', role: 'tech' },
  { id: 'demo-team-014', work_order_id: 'demo-wo-006', user_id: 'demo-user-004', role: 'lead' },
  { id: 'demo-team-015', work_order_id: 'demo-wo-006', user_id: 'demo-user-006', role: 'tech' },
  { id: 'demo-team-016', work_order_id: 'demo-wo-006', user_id: 'demo-user-009', role: 'helper' },
  { id: 'demo-team-017', work_order_id: 'demo-wo-007', user_id: 'demo-user-005', role: 'lead' },
  { id: 'demo-team-018', work_order_id: 'demo-wo-007', user_id: 'demo-user-007', role: 'tech' },
  { id: 'demo-team-019', work_order_id: 'demo-wo-008', user_id: 'demo-user-003', role: 'lead' },
  { id: 'demo-team-020', work_order_id: 'demo-wo-009', user_id: 'demo-user-004', role: 'lead' },
  { id: 'demo-team-021', work_order_id: 'demo-wo-010', user_id: 'demo-user-005', role: 'lead' },
  { id: 'demo-team-022', work_order_id: 'demo-wo-014', user_id: 'demo-user-003', role: 'lead' },
  { id: 'demo-team-023', work_order_id: 'demo-wo-015', user_id: 'demo-user-004', role: 'lead' },
];

// Demo Daily Hours - with tech_material_cost field
const createInitialDailyHours = () => [
  { id: 'demo-hours-001', work_order_id: 'demo-wo-001', user_id: 'demo-user-003', log_date: daysAgo(12).split('T')[0], regular_hours: 5, overtime_hours: 1, mileage: 45, tech_material_cost: 0, notes: 'Refrigerant recharge and contactor replacement' },
  { id: 'demo-hours-002', work_order_id: 'demo-wo-001', user_id: 'demo-user-006', log_date: daysAgo(12).split('T')[0], regular_hours: 5, overtime_hours: 1, mileage: 0, tech_material_cost: 0, notes: 'Assisted with diagnosis' },
  { id: 'demo-hours-003', work_order_id: 'demo-wo-002', user_id: 'demo-user-004', log_date: daysAgo(10).split('T')[0], regular_hours: 4, overtime_hours: 2, mileage: 62, tech_material_cost: 45.50, notes: 'Emergency plumbing repair - bought fittings at Home Depot' },
  { id: 'demo-hours-004', work_order_id: 'demo-wo-002', user_id: 'demo-user-007', log_date: daysAgo(10).split('T')[0], regular_hours: 4, overtime_hours: 2, mileage: 0, tech_material_cost: 0, notes: 'Water extraction' },
  { id: 'demo-hours-005', work_order_id: 'demo-wo-002', user_id: 'demo-user-009', log_date: daysAgo(10).split('T')[0], regular_hours: 4, overtime_hours: 2, mileage: 0, tech_material_cost: 0, notes: 'Cleanup assistance' },
  { id: 'demo-hours-006', work_order_id: 'demo-wo-006', user_id: 'demo-user-004', log_date: daysAgo(1).split('T')[0], regular_hours: 8, overtime_hours: 0, mileage: 55, tech_material_cost: 125.00, notes: 'Day 1 - Compressor teardown - purchased specialty gaskets' },
  { id: 'demo-hours-007', work_order_id: 'demo-wo-006', user_id: 'demo-user-006', log_date: daysAgo(1).split('T')[0], regular_hours: 8, overtime_hours: 0, mileage: 0, tech_material_cost: 0, notes: 'Assisted with disassembly' },
];

// Demo Quotes/NTE Requests
const createInitialQuotes = () => [
  {
    id: 'demo-quote-001',
    work_order_id: 'demo-wo-004',
    labor_hours: 16,
    labor_cost: 1024.00,
    material_cost: 1856.00,
    material_description: '3x VAV boxes, actuators, dampers, controls',
    equipment_cost: 0,
    equipment_description: null,
    mileage: 52,
    mileage_cost: 52.00,
    total_cost: 2932.00,
    notes: 'Additional 2 VAV boxes found failing during original repair.',
    status: 'approved',
    nte_status: 'approved',
    created_by: 'demo-user-005',
    created_at: daysAgo(5, 6)
  },
  {
    id: 'demo-quote-002',
    work_order_id: 'demo-wo-007',
    labor_hours: 24,
    labor_cost: 1536.00,
    material_cost: 2800.00,
    material_description: '40ft galvanized duct section, fittings, hangers, sealant',
    equipment_cost: 250.00,
    equipment_description: 'Scissor lift rental (2 days)',
    mileage: 56,
    mileage_cost: 56.00,
    total_cost: 4642.00,
    notes: 'Extensive duct corrosion discovered. Full section replacement required.',
    status: 'pending',
    nte_status: 'pending',
    created_by: 'demo-user-005',
    created_at: hoursAgo(1)
  },
  {
    id: 'demo-quote-003',
    work_order_id: 'demo-wo-014',
    labor_hours: 40,
    labor_cost: 2560.00,
    material_cost: 4500.00,
    material_description: '15x VAV boxes, BACnet controllers, sensors',
    equipment_cost: 800.00,
    equipment_description: 'Controls programming',
    mileage: 85,
    mileage_cost: 85.00,
    total_cost: 7945.00,
    notes: 'Complete VAV system overhaul for 15th floor.',
    status: 'submitted',
    nte_status: 'submitted',
    created_by: 'demo-user-003',
    created_at: daysAgo(3)
  },
  {
    id: 'demo-quote-004',
    work_order_id: 'demo-wo-015',
    labor_hours: 8,
    labor_cost: 512.00,
    material_cost: 450.00,
    material_description: 'Roof drain parts, sealant',
    equipment_cost: 0,
    equipment_description: null,
    mileage: 42,
    mileage_cost: 42.00,
    total_cost: 1004.00,
    notes: 'Additional drain repairs. Verbal approval from PM.',
    status: 'verbal_approved',
    nte_status: 'verbal_approved',
    created_by: 'demo-user-004',
    created_at: daysAgo(4)
  }
];

// ============================================================
// DEMO CONTEXT
// ============================================================

const DemoContext = createContext(null);

export function DemoProvider({ children }) {
  // State
  const [users, setUsers] = useState(INITIAL_USERS);
  const [workOrders, setWorkOrders] = useState(createInitialWorkOrders);
  const [comments, setComments] = useState(createInitialComments);
  const [teamAssignments, setTeamAssignments] = useState(createInitialTeamAssignments);
  const [dailyHours, setDailyHours] = useState(createInitialDailyHours);
  const [quotes, setQuotes] = useState(createInitialQuotes);
  const [photos, setPhotos] = useState([]);
  
  // Demo notification state
  const [notifications, setNotifications] = useState([]);
  const [showDemoBanner, setShowDemoBanner] = useState(true);

  // Current demo user (for mobile app simulation)
  const [currentDemoUser, setCurrentDemoUser] = useState(INITIAL_USERS.find(u => u.role === 'lead'));

  // Generate unique IDs
  const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // ============================================================
  // HELPER FUNCTIONS
  // ============================================================

  // Check if work order is a PM (Preventive Maintenance) order
  const isPMWorkOrder = useCallback((woNumber) => {
    return woNumber && /^P\d+/.test(woNumber);
  }, []);

  // ============================================================
  // WORK ORDER ACTIONS
  // ============================================================

  const updateWorkOrder = useCallback((workOrderId, updates) => {
    setWorkOrders(prev => prev.map(wo => 
      wo.id === workOrderId 
        ? { ...wo, ...updates, updated_at: new Date().toISOString() }
        : wo
    ));
    addNotification(`Work order updated`, 'success');
  }, []);

  const assignTech = useCallback((workOrderId, techId, scheduledDate) => {
    const tech = users.find(u => u.id === techId);
    setWorkOrders(prev => prev.map(wo => 
      wo.id === workOrderId 
        ? { 
            ...wo, 
            assigned_tech: techId, 
            scheduled_date: scheduledDate,
            status: 'assigned',
            updated_at: new Date().toISOString() 
          }
        : wo
    ));
    
    // Add team assignment if not exists
    const existingAssignment = teamAssignments.find(
      ta => ta.work_order_id === workOrderId && ta.user_id === techId
    );
    if (!existingAssignment) {
      setTeamAssignments(prev => [...prev, {
        id: generateId('demo-team'),
        work_order_id: workOrderId,
        user_id: techId,
        role: tech?.role || 'tech'
      }]);
    }
    
    addNotification(`Assigned to ${tech?.name || 'technician'}`, 'success');
  }, [users, teamAssignments]);

  const checkIn = useCallback((workOrderId) => {
    setWorkOrders(prev => prev.map(wo => 
      wo.id === workOrderId 
        ? { 
            ...wo, 
            status: 'in_progress',
            check_in_time: new Date().toISOString(),
            updated_at: new Date().toISOString() 
          }
        : wo
    ));
    addNotification('Checked in successfully', 'success');
  }, []);

  const checkOut = useCallback((workOrderId) => {
    setWorkOrders(prev => prev.map(wo => 
      wo.id === workOrderId 
        ? { 
            ...wo, 
            check_out_time: new Date().toISOString(),
            updated_at: new Date().toISOString() 
          }
        : wo
    ));
    addNotification('Checked out successfully', 'success');
  }, []);

  const completeWorkOrder = useCallback((workOrderId) => {
    const wo = workOrders.find(w => w.id === workOrderId);
    if (!wo) return { success: false, error: 'Work order not found' };
    
    // Check photo requirements
    if (!wo.has_before_photos || !wo.has_after_photos) {
      addNotification('❌ Photos required: Before and After photos must be emailed before completing', 'error');
      return { success: false, error: 'Photos required' };
    }
    
    // Check PMI writeup requirement for PM orders
    if (isPMWorkOrder(wo.wo_number) && !wo.pmi_writeup_sent) {
      addNotification('❌ PMI Write-up required: PM work orders require inspection write-up before completing', 'error');
      return { success: false, error: 'PMI writeup required' };
    }
    
    setWorkOrders(prev => prev.map(w => 
      w.id === workOrderId 
        ? { 
            ...w, 
            status: 'completed',
            check_out_time: w.check_out_time || new Date().toISOString(),
            updated_at: new Date().toISOString() 
          }
        : w
    ));
    addNotification('✅ Work order completed!', 'success');
    return { success: true };
  }, [workOrders, isPMWorkOrder]);

  const updateStatus = useCallback((workOrderId, newStatus) => {
    setWorkOrders(prev => prev.map(wo => 
      wo.id === workOrderId 
        ? { ...wo, status: newStatus, updated_at: new Date().toISOString() }
        : wo
    ));
    addNotification(`Status changed to ${newStatus}`, 'success');
  }, []);

  const updateBillingStatus = useCallback((workOrderId, billingStatus) => {
    setWorkOrders(prev => prev.map(wo => 
      wo.id === workOrderId 
        ? { ...wo, billing_status: billingStatus, updated_at: new Date().toISOString() }
        : wo
    ));
    addNotification(`Billing status updated`, 'success');
  }, []);

  // Photo status updates
  const markPhotosReceived = useCallback((workOrderId, photoType) => {
    setWorkOrders(prev => prev.map(wo => 
      wo.id === workOrderId 
        ? { 
            ...wo, 
            [photoType === 'before' ? 'has_before_photos' : 'has_after_photos']: true,
            updated_at: new Date().toISOString() 
          }
        : wo
    ));
    addNotification(`✅ ${photoType === 'before' ? 'Before' : 'After'} photos received`, 'success');
  }, []);

  // PMI Writeup status
  const markPMIWriteupSent = useCallback((workOrderId) => {
    setWorkOrders(prev => prev.map(wo => 
      wo.id === workOrderId 
        ? { 
            ...wo, 
            pmi_writeup_sent: true,
            updated_at: new Date().toISOString() 
          }
        : wo
    ));
    addNotification('✅ PMI Write-up sent to office', 'success');
  }, []);

  // ============================================================
  // COMMENT ACTIONS
  // ============================================================

  const addComment = useCallback((workOrderId, userId, commentText) => {
    const user = users.find(u => u.id === userId);
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
  }, [users]);

  // ============================================================
  // TEAM ACTIONS
  // ============================================================

  const addTeamMember = useCallback((workOrderId, userId, role) => {
    const existing = teamAssignments.find(
      ta => ta.work_order_id === workOrderId && ta.user_id === userId
    );
    if (existing) {
      addNotification('Team member already assigned', 'warning');
      return;
    }
    
    const newAssignment = {
      id: generateId('demo-team'),
      work_order_id: workOrderId,
      user_id: userId,
      role: role
    };
    setTeamAssignments(prev => [...prev, newAssignment]);
    
    const user = users.find(u => u.id === userId);
    addNotification(`${user?.name || 'Team member'} added`, 'success');
    return newAssignment;
  }, [teamAssignments, users]);

  const removeTeamMember = useCallback((workOrderId, userId) => {
    setTeamAssignments(prev => prev.filter(
      ta => !(ta.work_order_id === workOrderId && ta.user_id === userId)
    ));
    addNotification('Team member removed', 'success');
  }, []);

  // ============================================================
  // DAILY HOURS ACTIONS - Updated with tech_material_cost
  // ============================================================

  const logHours = useCallback((workOrderId, userId, logDate, regularHours, overtimeHours, mileage, notes, techMaterialCost = 0) => {
    // Check if entry exists for this date
    const existingIndex = dailyHours.findIndex(
      dh => dh.work_order_id === workOrderId && dh.user_id === userId && dh.log_date === logDate
    );
    
    if (existingIndex >= 0) {
      // Update existing
      setDailyHours(prev => prev.map((dh, idx) => 
        idx === existingIndex
          ? { ...dh, regular_hours: regularHours, overtime_hours: overtimeHours, mileage, notes, tech_material_cost: techMaterialCost }
          : dh
      ));
    } else {
      // Create new
      const newEntry = {
        id: generateId('demo-hours'),
        work_order_id: workOrderId,
        user_id: userId,
        log_date: logDate,
        regular_hours: regularHours,
        overtime_hours: overtimeHours,
        mileage: mileage,
        tech_material_cost: techMaterialCost,
        notes: notes
      };
      setDailyHours(prev => [...prev, newEntry]);
    }
    addNotification('Hours logged', 'success');
  }, [dailyHours]);

  // ============================================================
  // QUOTE/NTE ACTIONS
  // ============================================================

  const createQuote = useCallback((workOrderId, quoteData) => {
    const newQuote = {
      id: generateId('demo-quote'),
      work_order_id: workOrderId,
      ...quoteData,
      status: 'pending',
      nte_status: 'pending',
      created_at: new Date().toISOString()
    };
    setQuotes(prev => [...prev, newQuote]);
    
    // Update work order billing status
    setWorkOrders(prev => prev.map(wo => 
      wo.id === workOrderId 
        ? { ...wo, billing_status: 'pending_cbre_quote', updated_at: new Date().toISOString() }
        : wo
    ));
    
    addNotification('NTE increase request submitted', 'success');
    return newQuote;
  }, []);

  const updateQuoteStatus = useCallback((quoteId, newStatus) => {
    setQuotes(prev => prev.map(q => 
      q.id === quoteId 
        ? { ...q, status: newStatus, nte_status: newStatus }
        : q
    ));
    addNotification(`Quote status updated to ${newStatus}`, 'success');
  }, []);

  // ============================================================
  // PHOTO ACTIONS
  // ============================================================

  const addPhoto = useCallback((workOrderId, photoData) => {
    const newPhoto = {
      id: generateId('demo-photo'),
      work_order_id: workOrderId,
      ...photoData,
      created_at: new Date().toISOString()
    };
    setPhotos(prev => [...prev, newPhoto]);
    addNotification('Photo uploaded', 'success');
    return newPhoto;
  }, []);

  // ============================================================
  // NOTIFICATION SYSTEM
  // ============================================================

  const addNotification = useCallback((message, type = 'info') => {
    const id = generateId('notif');
    setNotifications(prev => [...prev, { id, message, type, timestamp: Date.now() }]);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  }, []);

  // ============================================================
  // HELPER FUNCTIONS
  // ============================================================

  const getUserById = useCallback((userId) => {
    return users.find(u => u.id === userId);
  }, [users]);

  const getWorkOrderById = useCallback((workOrderId) => {
    return workOrders.find(wo => wo.id === workOrderId);
  }, [workOrders]);

  const getCommentsForWorkOrder = useCallback((workOrderId) => {
    return comments
      .filter(c => c.work_order_id === workOrderId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [comments]);

  const getTeamForWorkOrder = useCallback((workOrderId) => {
    return teamAssignments
      .filter(ta => ta.work_order_id === workOrderId)
      .map(ta => ({
        ...ta,
        user: users.find(u => u.id === ta.user_id)
      }));
  }, [teamAssignments, users]);

  const getDailyHoursForWorkOrder = useCallback((workOrderId) => {
    return dailyHours
      .filter(dh => dh.work_order_id === workOrderId)
      .map(dh => ({
        ...dh,
        user: users.find(u => u.id === dh.user_id)
      }));
  }, [dailyHours, users]);

  const getQuotesForWorkOrder = useCallback((workOrderId) => {
    return quotes
      .filter(q => q.work_order_id === workOrderId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [quotes]);

  const getPhotosForWorkOrder = useCallback((workOrderId) => {
    return photos.filter(p => p.work_order_id === workOrderId);
  }, [photos]);

  const getWorkOrdersForTech = useCallback((techId) => {
    return workOrders.filter(wo => {
      if (wo.assigned_tech === techId) return true;
      const teamMember = teamAssignments.find(
        ta => ta.work_order_id === wo.id && ta.user_id === techId
      );
      return !!teamMember;
    });
  }, [workOrders, teamAssignments]);

  // Reset demo data
  const resetDemo = useCallback(() => {
    setWorkOrders(createInitialWorkOrders());
    setComments(createInitialComments());
    setTeamAssignments(createInitialTeamAssignments());
    setDailyHours(createInitialDailyHours());
    setQuotes(createInitialQuotes());
    setPhotos([]);
    addNotification('Demo data reset', 'info');
  }, []);

  // ============================================================
  // STATS CALCULATIONS
  // ============================================================

  const getStats = useCallback(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    return {
      total: workOrders.length,
      new: workOrders.filter(wo => wo.status === 'new').length,
      assigned: workOrders.filter(wo => wo.status === 'assigned').length,
      inProgress: workOrders.filter(wo => wo.status === 'in_progress').length,
      completed: workOrders.filter(wo => wo.status === 'completed').length,
      invoiced: workOrders.filter(wo => wo.status === 'invoiced').length,
      emergency: workOrders.filter(wo => wo.priority === 'emergency' && !['completed', 'invoiced'].includes(wo.status)).length,
      pendingCbreQuote: workOrders.filter(wo => wo.billing_status === 'pending_cbre_quote').length,
      quoteSubmitted: workOrders.filter(wo => wo.billing_status === 'quote_submitted').length,
      scheduledToday: workOrders.filter(wo => wo.scheduled_date === todayStr).length,
      techsOnField: workOrders.filter(wo => wo.status === 'in_progress' && wo.check_in_time && !wo.check_out_time).length
    };
  }, [workOrders]);

  // ============================================================
  // CONTEXT VALUE
  // ============================================================

  const value = {
    // Data
    users,
    workOrders,
    comments,
    teamAssignments,
    dailyHours,
    quotes,
    photos,
    notifications,
    showDemoBanner,
    currentDemoUser,
    
    // Setters
    setShowDemoBanner,
    setCurrentDemoUser,
    
    // Work Order Actions
    updateWorkOrder,
    assignTech,
    checkIn,
    checkOut,
    completeWorkOrder,
    updateStatus,
    updateBillingStatus,
    markPhotosReceived,
    markPMIWriteupSent,
    
    // Other Actions
    addComment,
    addTeamMember,
    removeTeamMember,
    logHours,
    createQuote,
    updateQuoteStatus,
    addPhoto,
    
    // Helpers
    getUserById,
    getWorkOrderById,
    getCommentsForWorkOrder,
    getTeamForWorkOrder,
    getDailyHoursForWorkOrder,
    getQuotesForWorkOrder,
    getPhotosForWorkOrder,
    getWorkOrdersForTech,
    getStats,
    isPMWorkOrder,
    
    // Demo Controls
    resetDemo,
    addNotification,
    
    // Flag
    isDemo: true
  };

  return (
    <DemoContext.Provider value={value}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return context;
}

export default DemoContext;
