-- ============================================================
-- PCS FieldService - Demo Data Seed Script
-- Company: Summit Mechanical Services (Fictional Demo Company)
-- ============================================================

-- This script creates demo data for prospects to explore.
-- Run this against a SEPARATE Supabase project for the demo environment.

-- ============================================================
-- STEP 1: Create Demo Company Profile (if you add multi-tenant later)
-- ============================================================

-- For now, we'll just insert demo data directly.
-- In a full multi-tenant setup, you'd have a companies table.

-- ============================================================
-- STEP 2: Demo Users (Technicians & Office Staff)
-- ============================================================

-- Clear existing demo data (if re-seeding)
-- BE CAREFUL: Only run this on demo database!
-- DELETE FROM daily_hours_log;
-- DELETE FROM work_order_team;
-- DELETE FROM work_order_photos;
-- DELETE FROM work_order_comments;
-- DELETE FROM work_order_quotes;
-- DELETE FROM work_orders;
-- DELETE FROM users;

-- Demo Users for Summit Mechanical Services
INSERT INTO users (id, name, email, role, phone, carrier, is_active, created_at) VALUES
-- Office Staff
('demo-user-001', 'Jennifer Martinez', 'jennifer@summitmech.demo', 'admin', '555-100-0001', 'vtext.com', true, NOW() - INTERVAL '6 months'),
('demo-user-002', 'Michael Chen', 'michael@summitmech.demo', 'office', '555-100-0002', 'txt.att.net', true, NOW() - INTERVAL '5 months'),

-- Lead Technicians
('demo-user-003', 'Robert Johnson', 'robert@summitmech.demo', 'lead', '555-200-0001', 'vtext.com', true, NOW() - INTERVAL '8 months'),
('demo-user-004', 'Carlos Rodriguez', 'carlos@summitmech.demo', 'lead', '555-200-0002', 'tmomail.net', true, NOW() - INTERVAL '7 months'),
('demo-user-005', 'David Williams', 'david@summitmech.demo', 'lead', '555-200-0003', 'vtext.com', true, NOW() - INTERVAL '4 months'),

-- Technicians
('demo-user-006', 'James Wilson', 'james@summitmech.demo', 'tech', '555-300-0001', 'txt.att.net', true, NOW() - INTERVAL '6 months'),
('demo-user-007', 'Anthony Brown', 'anthony@summitmech.demo', 'tech', '555-300-0002', 'vtext.com', true, NOW() - INTERVAL '5 months'),
('demo-user-008', 'Marcus Davis', 'marcus@summitmech.demo', 'tech', '555-300-0003', 'tmomail.net', true, NOW() - INTERVAL '3 months'),

-- Helpers
('demo-user-009', 'Tyler Anderson', 'tyler@summitmech.demo', 'helper', '555-400-0001', 'vtext.com', true, NOW() - INTERVAL '2 months'),
('demo-user-010', 'Kevin Thompson', 'kevin@summitmech.demo', 'helper', '555-400-0002', 'txt.att.net', true, NOW() - INTERVAL '1 month')

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  role = EXCLUDED.role;

-- ============================================================
-- STEP 3: Demo Work Orders - Various Statuses
-- ============================================================

INSERT INTO work_orders (
  id, wo_number, client_name, location, building_name, description, 
  priority, status, billing_status, nte_amount,
  assigned_tech, scheduled_date, created_at, updated_at,
  check_in_time, check_out_time,
  legacy_labor_total, legacy_material_total, legacy_equipment_total, legacy_mileage_total
) VALUES

-- ============================================================
-- COMPLETED WORK ORDERS (Showcase full workflow)
-- ============================================================

-- Completed #1 - Simple HVAC repair, invoiced
('demo-wo-001', 'WO-2024-0847', 'CBRE', 
 '1250 Corporate Drive, Phoenix, AZ 85034', 'Corporate Tower West',
 'RTU-3 not cooling properly. Tenant complaints about temperature on 4th floor. Check refrigerant levels and compressor operation.',
 'high', 'invoiced', null,
 850.00,
 'demo-user-003', -- Robert Johnson (Lead)
 (NOW() - INTERVAL '12 days')::date,
 NOW() - INTERVAL '14 days', NOW() - INTERVAL '10 days',
 NOW() - INTERVAL '12 days' + INTERVAL '8 hours',
 NOW() - INTERVAL '12 days' + INTERVAL '14 hours',
 384.00, 245.50, 0, 45.00),

-- Completed #2 - Plumbing emergency, invoiced  
('demo-wo-002', 'WO-2024-0851', 'CBRE',
 '890 Industrial Parkway, Phoenix, AZ 85043', 'Distribution Center A',
 'Water leak in main restroom. Flooding reported. Emergency response required.',
 'emergency', 'invoiced', null,
 1200.00,
 'demo-user-004', -- Carlos Rodriguez (Lead)
 (NOW() - INTERVAL '10 days')::date,
 NOW() - INTERVAL '11 days', NOW() - INTERVAL '8 days',
 NOW() - INTERVAL '10 days' + INTERVAL '6 hours',
 NOW() - INTERVAL '10 days' + INTERVAL '12 hours',
 576.00, 423.75, 85.00, 62.00),

-- Completed #3 - Electrical panel upgrade, invoiced
('demo-wo-003', 'WO-2024-0839', 'CBRE',
 '445 Commerce Street, Tempe, AZ 85281', 'Tech Hub Building',
 'Upgrade electrical panel in server room. Coordinate with building management for power shutdown window.',
 'medium', 'invoiced', null,
 2500.00,
 'demo-user-003', -- Robert Johnson (Lead)
 (NOW() - INTERVAL '18 days')::date,
 NOW() - INTERVAL '21 days', NOW() - INTERVAL '15 days',
 NOW() - INTERVAL '18 days' + INTERVAL '7 hours',
 NOW() - INTERVAL '18 days' + INTERVAL '16 hours',
 896.00, 1245.00, 150.00, 38.00),

-- Completed #4 - Required NTE increase, approved
('demo-wo-004', 'WO-2024-0862', 'CBRE',
 '2100 Financial Plaza, Scottsdale, AZ 85251', 'Financial Services Tower',
 'VAV box replacement on 8th floor. Original scope expanded - found 3 additional units failing.',
 'high', 'completed', null,
 3500.00, -- Increased from original 1500
 'demo-user-005', -- David Williams (Lead)
 (NOW() - INTERVAL '5 days')::date,
 NOW() - INTERVAL '7 days', NOW() - INTERVAL '3 days',
 NOW() - INTERVAL '5 days' + INTERVAL '7 hours',
 NOW() - INTERVAL '5 days' + INTERVAL '17 hours',
 768.00, 1856.00, 0, 52.00),

-- ============================================================
-- IN PROGRESS WORK ORDERS (Show active work)
-- ============================================================

-- In Progress #1 - Currently on site
('demo-wo-005', 'WO-2024-0891', 'CBRE',
 '3300 Gateway Boulevard, Phoenix, AZ 85034', 'Gateway Office Complex',
 'Quarterly HVAC preventive maintenance. 12 RTUs scheduled for inspection and filter replacement.',
 'medium', 'in_progress', null,
 1800.00,
 'demo-user-003', -- Robert Johnson (Lead)
 CURRENT_DATE,
 NOW() - INTERVAL '2 days', NOW(),
 NOW() - INTERVAL '2 hours', -- Checked in 2 hours ago
 null,
 0, 0, 0, 0),

-- In Progress #2 - Started yesterday, multi-day job
('demo-wo-006', 'WO-2024-0888', 'CBRE',
 '1800 Innovation Way, Chandler, AZ 85224', 'Innovation Campus - Bldg C',
 'Chiller repair - compressor bearing replacement. 2-day job estimated. Parts on site.',
 'high', 'in_progress', null,
 4500.00,
 'demo-user-004', -- Carlos Rodriguez (Lead)
 (NOW() - INTERVAL '1 day')::date,
 NOW() - INTERVAL '3 days', NOW(),
 NOW() - INTERVAL '1 day' + INTERVAL '7 hours',
 null,
 512.00, 0, 0, 55.00), -- Day 1 logged

-- In Progress #3 - Needs NTE increase (pending approval)
('demo-wo-007', 'WO-2024-0893', 'CBRE',
 '500 Republic Street, Phoenix, AZ 85004', 'Republic Tower',
 'Investigate water damage in ceiling tiles, 6th floor. Found extensive ductwork corrosion requiring replacement.',
 'high', 'in_progress', 'pending_cbre_quote',
 800.00, -- Original NTE, needs increase
 'demo-user-005', -- David Williams (Lead)
 CURRENT_DATE,
 NOW() - INTERVAL '1 day', NOW(),
 NOW() - INTERVAL '3 hours',
 null,
 192.00, 0, 0, 28.00),

-- ============================================================
-- ASSIGNED (Scheduled for upcoming work)
-- ============================================================

-- Assigned #1 - Tomorrow
('demo-wo-008', 'WO-2024-0895', 'CBRE',
 '2250 Camelback Road, Phoenix, AZ 85016', 'Camelback Medical Center',
 'Replace exhaust fan in laboratory area. Must coordinate with lab manager for access.',
 'medium', 'assigned', null,
 950.00,
 'demo-user-003', -- Robert Johnson (Lead)
 (CURRENT_DATE + INTERVAL '1 day')::date,
 NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days',
 null, null,
 0, 0, 0, 0),

-- Assigned #2 - Day after tomorrow
('demo-wo-009', 'WO-2024-0896', 'CBRE',
 '675 Mill Avenue, Tempe, AZ 85281', 'University Business Center',
 'Install new programmable thermostat in suite 450. Tenant upgrade request.',
 'low', 'assigned', null,
 450.00,
 'demo-user-004', -- Carlos Rodriguez (Lead)
 (CURRENT_DATE + INTERVAL '2 days')::date,
 NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day',
 null, null,
 0, 0, 0, 0),

-- Assigned #3 - Next week
('demo-wo-010', 'WO-2024-0897', 'CBRE',
 '1100 E Washington Street, Phoenix, AZ 85034', 'Washington Executive Plaza',
 'Annual backflow preventer testing and certification. 4 units total.',
 'medium', 'assigned', null,
 680.00,
 'demo-user-005', -- David Williams (Lead)
 (CURRENT_DATE + INTERVAL '5 days')::date,
 NOW(), NOW(),
 null, null,
 0, 0, 0, 0),

-- ============================================================
-- NEW / UNASSIGNED (Ready for scheduling)
-- ============================================================

-- New #1 - Just received
('demo-wo-011', 'WO-2024-0898', 'CBRE',
 '4400 N 32nd Street, Phoenix, AZ 85018', 'Paradise Valley Office Park',
 'Tenant complaint - strange noise from rooftop unit. Please diagnose and quote repair.',
 'medium', 'new', null,
 500.00, -- Diagnostic NTE
 null,
 null,
 NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours',
 null, null,
 0, 0, 0, 0),

-- New #2 - Received yesterday
('demo-wo-012', 'WO-2024-0894', 'CBRE',
 '7878 E Princess Boulevard, Scottsdale, AZ 85255', 'Princess Corporate Center',
 'Hot water heater replacement in break room. 50 gallon commercial unit.',
 'medium', 'new', null,
 1800.00,
 null,
 null,
 NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day',
 null, null,
 0, 0, 0, 0),

-- New #3 - Emergency just came in
('demo-wo-013', 'WO-2024-0899', 'CBRE',
 '100 W Clarendon Avenue, Phoenix, AZ 85013', 'Midtown Financial Center',
 'EMERGENCY: AC completely down on 3rd floor. Multiple tenant complaints. VIP client area.',
 'emergency', 'new', null,
 2000.00,
 null,
 null,
 NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes',
 null, null,
 0, 0, 0, 0),

-- ============================================================
-- QUOTE WORKFLOW EXAMPLES
-- ============================================================

-- Pending CBRE Quote
('demo-wo-014', 'WO-2024-0885', 'CBRE',
 '2700 N Central Avenue, Phoenix, AZ 85004', 'Central Tower',
 'Complete VAV system overhaul - 15th floor. Major renovation scope.',
 'medium', 'assigned', 'pending_cbre_quote',
 1500.00, -- Original NTE, needs major increase
 'demo-user-003',
 (CURRENT_DATE + INTERVAL '7 days')::date,
 NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 days',
 null, null,
 0, 0, 0, 0),

-- Quote Submitted
('demo-wo-015', 'WO-2024-0879', 'CBRE',
 '3800 N Central Avenue, Phoenix, AZ 85012', 'Uptown Plaza',
 'Roof drain cleaning and repair. Scope expanded after inspection.',
 'medium', 'assigned', 'quote_submitted',
 750.00,
 'demo-user-004',
 (CURRENT_DATE + INTERVAL '4 days')::date,
 NOW() - INTERVAL '8 days', NOW() - INTERVAL '3 days',
 null, null,
 0, 0, 0, 0)

ON CONFLICT (id) DO UPDATE SET
  wo_number = EXCLUDED.wo_number,
  status = EXCLUDED.status,
  billing_status = EXCLUDED.billing_status;

-- ============================================================
-- STEP 4: Work Order Team Assignments
-- ============================================================

INSERT INTO work_order_team (work_order_id, user_id, role, created_at) VALUES
-- WO-001 team
('demo-wo-001', 'demo-user-003', 'lead', NOW() - INTERVAL '14 days'),
('demo-wo-001', 'demo-user-006', 'tech', NOW() - INTERVAL '14 days'),

-- WO-002 team (emergency, bigger crew)
('demo-wo-002', 'demo-user-004', 'lead', NOW() - INTERVAL '11 days'),
('demo-wo-002', 'demo-user-007', 'tech', NOW() - INTERVAL '11 days'),
('demo-wo-002', 'demo-user-009', 'helper', NOW() - INTERVAL '11 days'),

-- WO-003 team (electrical upgrade)
('demo-wo-003', 'demo-user-003', 'lead', NOW() - INTERVAL '21 days'),
('demo-wo-003', 'demo-user-008', 'tech', NOW() - INTERVAL '21 days'),

-- WO-004 team (expanded VAV job)
('demo-wo-004', 'demo-user-005', 'lead', NOW() - INTERVAL '7 days'),
('demo-wo-004', 'demo-user-006', 'tech', NOW() - INTERVAL '7 days'),
('demo-wo-004', 'demo-user-007', 'tech', NOW() - INTERVAL '7 days'),
('demo-wo-004', 'demo-user-010', 'helper', NOW() - INTERVAL '7 days'),

-- WO-005 team (in progress - PM)
('demo-wo-005', 'demo-user-003', 'lead', NOW() - INTERVAL '2 days'),
('demo-wo-005', 'demo-user-008', 'tech', NOW() - INTERVAL '2 days'),

-- WO-006 team (in progress - chiller)
('demo-wo-006', 'demo-user-004', 'lead', NOW() - INTERVAL '3 days'),
('demo-wo-006', 'demo-user-006', 'tech', NOW() - INTERVAL '3 days'),
('demo-wo-006', 'demo-user-009', 'helper', NOW() - INTERVAL '3 days'),

-- WO-007 team (needs NTE increase)
('demo-wo-007', 'demo-user-005', 'lead', NOW() - INTERVAL '1 day'),
('demo-wo-007', 'demo-user-007', 'tech', NOW() - INTERVAL '1 day'),

-- Assigned work orders
('demo-wo-008', 'demo-user-003', 'lead', NOW() - INTERVAL '2 days'),
('demo-wo-009', 'demo-user-004', 'lead', NOW() - INTERVAL '1 day'),
('demo-wo-010', 'demo-user-005', 'lead', NOW()),

-- Quote workflow examples
('demo-wo-014', 'demo-user-003', 'lead', NOW() - INTERVAL '5 days'),
('demo-wo-015', 'demo-user-004', 'lead', NOW() - INTERVAL '8 days')

ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 5: Daily Hours Logs (for completed/in-progress work)
-- ============================================================

INSERT INTO daily_hours_log (
  id, work_order_id, user_id, log_date,
  regular_hours, overtime_hours, mileage,
  notes, created_at
) VALUES
-- WO-001 hours (completed HVAC)
('demo-log-001', 'demo-wo-001', 'demo-user-003', (NOW() - INTERVAL '12 days')::date, 5.0, 1.0, 45, 'Found low refrigerant, recharged system. Replaced contactor.', NOW() - INTERVAL '12 days'),
('demo-log-002', 'demo-wo-001', 'demo-user-006', (NOW() - INTERVAL '12 days')::date, 5.0, 1.0, 0, 'Assisted with diagnosis and refrigerant recovery.', NOW() - INTERVAL '12 days'),

-- WO-002 hours (emergency plumbing)
('demo-log-003', 'demo-wo-002', 'demo-user-004', (NOW() - INTERVAL '10 days')::date, 4.0, 2.0, 62, 'Emergency response. Shut off main, replaced burst fitting.', NOW() - INTERVAL '10 days'),
('demo-log-004', 'demo-wo-002', 'demo-user-007', (NOW() - INTERVAL '10 days')::date, 4.0, 2.0, 0, 'Water extraction and cleanup.', NOW() - INTERVAL '10 days'),
('demo-log-005', 'demo-wo-002', 'demo-user-009', (NOW() - INTERVAL '10 days')::date, 4.0, 2.0, 0, 'Assisted with cleanup and drywall removal.', NOW() - INTERVAL '10 days'),

-- WO-003 hours (electrical - 2 days)
('demo-log-006', 'demo-wo-003', 'demo-user-003', (NOW() - INTERVAL '18 days')::date, 8.0, 0, 38, 'Day 1: Panel prep, ran new conduit.', NOW() - INTERVAL '18 days'),
('demo-log-007', 'demo-wo-003', 'demo-user-008', (NOW() - INTERVAL '18 days')::date, 8.0, 0, 0, 'Day 1: Assisted with conduit and wire pulling.', NOW() - INTERVAL '18 days'),
('demo-log-008', 'demo-wo-003', 'demo-user-003', (NOW() - INTERVAL '17 days')::date, 6.0, 0, 0, 'Day 2: Panel swap during shutdown window.', NOW() - INTERVAL '17 days'),
('demo-log-009', 'demo-wo-003', 'demo-user-008', (NOW() - INTERVAL '17 days')::date, 6.0, 0, 0, 'Day 2: Testing and labeling.', NOW() - INTERVAL '17 days'),

-- WO-004 hours (VAV replacement)
('demo-log-010', 'demo-wo-004', 'demo-user-005', (NOW() - INTERVAL '5 days')::date, 8.0, 4.0, 52, 'Removed 3 failing VAV boxes, installed replacements.', NOW() - INTERVAL '5 days'),
('demo-log-011', 'demo-wo-004', 'demo-user-006', (NOW() - INTERVAL '5 days')::date, 8.0, 4.0, 0, 'Assisted with removal and install.', NOW() - INTERVAL '5 days'),
('demo-log-012', 'demo-wo-004', 'demo-user-007', (NOW() - INTERVAL '5 days')::date, 8.0, 4.0, 0, 'Ductwork modifications and sealing.', NOW() - INTERVAL '5 days'),
('demo-log-013', 'demo-wo-004', 'demo-user-010', (NOW() - INTERVAL '5 days')::date, 8.0, 4.0, 0, 'Material handling and cleanup.', NOW() - INTERVAL '5 days'),

-- WO-006 hours (in progress chiller - day 1)
('demo-log-014', 'demo-wo-006', 'demo-user-004', (NOW() - INTERVAL '1 day')::date, 8.0, 0, 55, 'Drained oil, removed old bearing. Prepped for install.', NOW() - INTERVAL '1 day'),
('demo-log-015', 'demo-wo-006', 'demo-user-006', (NOW() - INTERVAL '1 day')::date, 8.0, 0, 0, 'Assisted with compressor disassembly.', NOW() - INTERVAL '1 day'),
('demo-log-016', 'demo-wo-006', 'demo-user-009', (NOW() - INTERVAL '1 day')::date, 8.0, 0, 0, 'Parts organization and cleaning.', NOW() - INTERVAL '1 day'),

-- WO-007 hours (needs NTE increase)
('demo-log-017', 'demo-wo-007', 'demo-user-005', CURRENT_DATE, 3.0, 0, 28, 'Investigation revealed major duct corrosion. NTE increase needed.', NOW() - INTERVAL '3 hours'),
('demo-log-018', 'demo-wo-007', 'demo-user-007', CURRENT_DATE, 3.0, 0, 0, 'Documented damage, took photos.', NOW() - INTERVAL '3 hours')

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 6: Work Order Comments
-- ============================================================

INSERT INTO work_order_comments (id, work_order_id, user_id, comment, created_at) VALUES
-- WO-001 comments
('demo-cmt-001', 'demo-wo-001', 'demo-user-003', 'On site. RTU-3 showing high head pressure.', NOW() - INTERVAL '12 days' + INTERVAL '8 hours'),
('demo-cmt-002', 'demo-wo-001', 'demo-user-003', 'Low refrigerant confirmed. Recharged with 4lbs R-410A. Also found failed contactor - replaced.', NOW() - INTERVAL '12 days' + INTERVAL '12 hours'),
('demo-cmt-003', 'demo-wo-001', 'demo-user-003', 'System running normally. Tenant confirmed cooling restored.', NOW() - INTERVAL '12 days' + INTERVAL '14 hours'),

-- WO-002 comments
('demo-cmt-004', 'demo-wo-002', 'demo-user-004', 'EMERGENCY RESPONSE - En route', NOW() - INTERVAL '10 days' + INTERVAL '6 hours'),
('demo-cmt-005', 'demo-wo-002', 'demo-user-004', 'On site. Significant flooding in mens restroom. Shut off water main.', NOW() - INTERVAL '10 days' + INTERVAL '6 hours' + INTERVAL '30 minutes'),
('demo-cmt-006', 'demo-wo-002', 'demo-user-004', 'Found burst fitting under sink. Water extracted. Drywall removal needed around affected area.', NOW() - INTERVAL '10 days' + INTERVAL '9 hours'),
('demo-cmt-007', 'demo-wo-002', 'demo-user-004', 'Repairs complete. Water restored. Recommend drywall contractor for finishing.', NOW() - INTERVAL '10 days' + INTERVAL '12 hours'),

-- WO-004 comments (NTE increase story)
('demo-cmt-008', 'demo-wo-004', 'demo-user-005', 'Started on original VAV box. During inspection found 2 additional units with failed actuators.', NOW() - INTERVAL '5 days' + INTERVAL '9 hours'),
('demo-cmt-009', 'demo-wo-004', 'demo-user-002', 'NTE increase approved by CBRE. Proceed with all 3 units.', NOW() - INTERVAL '5 days' + INTERVAL '11 hours'),
('demo-cmt-010', 'demo-wo-004', 'demo-user-005', 'All VAV boxes replaced and calibrated. Zone temps stabilizing.', NOW() - INTERVAL '5 days' + INTERVAL '17 hours'),

-- WO-006 comments (in progress)
('demo-cmt-011', 'demo-wo-006', 'demo-user-004', 'On site. Beginning compressor teardown. Confirmed bearing failure from oil analysis.', NOW() - INTERVAL '1 day' + INTERVAL '8 hours'),
('demo-cmt-012', 'demo-wo-006', 'demo-user-004', 'Day 1 complete. Bearing removed, shaft cleaned and inspected. Ready for new bearing install tomorrow.', NOW() - INTERVAL '1 day' + INTERVAL '16 hours'),

-- WO-007 comments (needs NTE)
('demo-cmt-013', 'demo-wo-007', 'demo-user-005', 'Arrived on site. Opening ceiling for inspection.', NOW() - INTERVAL '3 hours'),
('demo-cmt-014', 'demo-wo-007', 'demo-user-005', 'ISSUE: Found significant corrosion in supply duct. Approximately 40ft section needs replacement. Submitting NTE increase request.', NOW() - INTERVAL '2 hours'),

-- WO-013 comments (new emergency)
('demo-cmt-015', 'demo-wo-013', 'demo-user-002', 'Dispatching nearest available tech. High priority client.', NOW() - INTERVAL '20 minutes')

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 7: NTE Increase Requests (Quotes)
-- ============================================================

INSERT INTO work_order_quotes (
  id, work_order_id, 
  labor_hours, labor_cost, 
  material_cost, material_description,
  equipment_cost, equipment_description,
  mileage, mileage_cost,
  total_cost, notes,
  status, nte_status,
  created_by, created_at
) VALUES
-- Approved NTE increase for WO-004
('demo-quote-001', 'demo-wo-004',
 16, 1024.00,
 1856.00, '3x VAV boxes, actuators, dampers, controls',
 0, null,
 52, 52.00,
 2932.00, 'Additional 2 VAV boxes found failing during original repair. Replacement of all 3 units recommended.',
 'approved', 'approved',
 'demo-user-005', NOW() - INTERVAL '5 days' + INTERVAL '10 hours'),

-- Pending NTE increase for WO-007
('demo-quote-002', 'demo-wo-007',
 24, 1536.00,
 2800.00, '40ft galvanized duct section, fittings, hangers, sealant',
 250.00, 'Scissor lift rental (2 days)',
 56, 56.00,
 4642.00, 'Extensive duct corrosion discovered. Full section replacement required for proper repair.',
 'pending', 'pending',
 'demo-user-005', NOW() - INTERVAL '1 hour'),

-- Submitted quote for WO-014
('demo-quote-003', 'demo-wo-014',
 40, 2560.00,
 4500.00, '15x VAV boxes, BACnet controllers, sensors, ductwork modifications',
 800.00, 'Controls programming and commissioning',
 85, 85.00,
 7945.00, 'Complete VAV system overhaul for 15th floor renovation. Coordinated with tenant buildout schedule.',
 'submitted', 'submitted',
 'demo-user-003', NOW() - INTERVAL '3 days'),

-- Verbal approval for WO-015
('demo-quote-004', 'demo-wo-015',
 8, 512.00,
 450.00, 'Roof drain parts, sealant, membrane repair kit',
 0, null,
 42, 42.00,
 1004.00, 'Additional drain repairs identified during cleaning. Verbal approval received from property manager.',
 'verbal_approved', 'verbal_approved',
 'demo-user-004', NOW() - INTERVAL '4 days')

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 8: Sample Photo References
-- (Note: Actual photo uploads would need to be done separately)
-- ============================================================

INSERT INTO work_order_photos (id, work_order_id, photo_url, description, photo_type, uploaded_by, created_at) VALUES
-- WO-001 photos
('demo-photo-001', 'demo-wo-001', 'https://placeholder.demo/hvac-before.jpg', 'RTU-3 before repair - corroded contactor', 'before', 'demo-user-003', NOW() - INTERVAL '12 days' + INTERVAL '9 hours'),
('demo-photo-002', 'demo-wo-001', 'https://placeholder.demo/hvac-after.jpg', 'RTU-3 after repair - new contactor installed', 'after', 'demo-user-003', NOW() - INTERVAL '12 days' + INTERVAL '13 hours'),

-- WO-002 photos
('demo-photo-003', 'demo-wo-002', 'https://placeholder.demo/flood-damage.jpg', 'Flooding in restroom - initial response', 'before', 'demo-user-004', NOW() - INTERVAL '10 days' + INTERVAL '7 hours'),
('demo-photo-004', 'demo-wo-002', 'https://placeholder.demo/burst-pipe.jpg', 'Burst fitting under sink - cause of leak', 'during', 'demo-user-004', NOW() - INTERVAL '10 days' + INTERVAL '8 hours'),
('demo-photo-005', 'demo-wo-002', 'https://placeholder.demo/repair-complete.jpg', 'Repair completed - new fitting installed', 'after', 'demo-user-004', NOW() - INTERVAL '10 days' + INTERVAL '11 hours'),

-- WO-007 photos (documentation for NTE)
('demo-photo-006', 'demo-wo-007', 'https://placeholder.demo/duct-corrosion-1.jpg', 'Duct corrosion - view 1', 'before', 'demo-user-005', NOW() - INTERVAL '2 hours'),
('demo-photo-007', 'demo-wo-007', 'https://placeholder.demo/duct-corrosion-2.jpg', 'Duct corrosion - full section view', 'before', 'demo-user-007', NOW() - INTERVAL '2 hours')

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Uncomment to verify data:
-- SELECT COUNT(*) as user_count FROM users WHERE id LIKE 'demo-%';
-- SELECT COUNT(*) as wo_count FROM work_orders WHERE id LIKE 'demo-%';
-- SELECT status, COUNT(*) FROM work_orders WHERE id LIKE 'demo-%' GROUP BY status;
-- SELECT billing_status, COUNT(*) FROM work_orders WHERE id LIKE 'demo-%' AND billing_status IS NOT NULL GROUP BY billing_status;

-- ============================================================
-- END OF DEMO SEED SCRIPT
-- ============================================================
