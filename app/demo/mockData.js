// app/demo/mockData.js
// Mock data that mirrors your real EMF FSM database schema

// Helper functions for generating dates
const daysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

const daysFromNow = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

const today = () => new Date().toISOString().split('T')[0];

// Random selection helper
const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// UPS Building locations (realistic for SC area)
const BUILDINGS = [
  { name: 'UPS Columbia Hub', address: '2523 Commerce Drive, Columbia, SC 29205' },
  { name: 'UPS Lexington Center', address: '5500 Sunset Blvd, Lexington, SC 29072' },
  { name: 'UPS Irmo Distribution', address: '7501 St Andrews Rd, Irmo, SC 29063' },
  { name: 'UPS West Columbia', address: '1200 Augusta Rd, West Columbia, SC 29169' },
  { name: 'UPS Cayce Facility', address: '900 Knox Abbott Dr, Cayce, SC 29033' },
  { name: 'UPS Blythewood Hub', address: '201 Blythewood Rd, Blythewood, SC 29016' },
  { name: 'UPS Northeast Columbia', address: '7620 Two Notch Rd, Columbia, SC 29223' },
  { name: 'UPS Forest Acres', address: '4600 Forest Dr, Columbia, SC 29206' },
  { name: 'UPS Chapin Station', address: '120 Columbia Ave, Chapin, SC 29036' },
  { name: 'UPS Newberry Depot', address: '2800 Main St, Newberry, SC 29108' },
];

// Work descriptions (electrical/mechanical)
const WORK_DESCRIPTIONS = [
  'Replace faulty ballast in warehouse lighting section B',
  'Install new 20A circuit for package sorting equipment',
  'Repair dock door motor - not closing properly',
  'Replace HVAC thermostat in break room',
  'Emergency - main panel breaker tripping repeatedly',
  'Install additional outlets in office area',
  'Troubleshoot conveyor belt motor starter',
  'Replace emergency exit lighting - battery backup failed',
  'Quarterly PM on RTU-1 and RTU-2',
  'Repair parking lot light pole - knocked down by truck',
  'Install new security camera power feeds',
  'Replace warehouse exhaust fan motor',
  'Troubleshoot dock leveler hydraulic system',
  'Install LED retrofit in loading dock area',
  'Repair automatic door opener - sensor issue',
  'Replace damaged conduit run from recent forklift incident',
  'Install new EV charging station',
  'Troubleshoot UPS battery backup system',
  'Quarterly fire alarm inspection and testing',
  'Replace water heater in maintenance room',
];

// Demo Users (matching your schema)
export const DEMO_USERS = [
  { user_id: 'demo-001', first_name: 'John', last_name: 'Mitchell', email: 'john@demo.com', role: 'admin', phone: '803-555-0101', is_active: true },
  { user_id: 'demo-002', first_name: 'Sarah', last_name: 'Chen', email: 'sarah@demo.com', role: 'office', phone: '803-555-0102', is_active: true },
  { user_id: 'demo-003', first_name: 'Marcus', last_name: 'Williams', email: 'marcus@demo.com', role: 'lead_tech', phone: '803-555-0201', is_active: true },
  { user_id: 'demo-004', first_name: 'Roberto', last_name: 'Garcia', email: 'roberto@demo.com', role: 'lead_tech', phone: '803-555-0202', is_active: true },
  { user_id: 'demo-005', first_name: 'David', last_name: 'Thompson', email: 'david@demo.com', role: 'lead_tech', phone: '803-555-0203', is_active: true },
  { user_id: 'demo-006', first_name: 'James', last_name: 'Wilson', email: 'james@demo.com', role: 'tech', phone: '803-555-0301', is_active: true },
  { user_id: 'demo-007', first_name: 'Anthony', last_name: 'Brown', email: 'anthony@demo.com', role: 'tech', phone: '803-555-0302', is_active: true },
  { user_id: 'demo-008', first_name: 'Michael', last_name: 'Davis', email: 'michael@demo.com', role: 'tech', phone: '803-555-0303', is_active: true },
  { user_id: 'demo-009', first_name: 'Tyler', last_name: 'Anderson', email: 'tyler@demo.com', role: 'helper', phone: '803-555-0401', is_active: true },
  { user_id: 'demo-010', first_name: 'Kevin', last_name: 'Martinez', email: 'kevin@demo.com', role: 'helper', phone: '803-555-0402', is_active: true },
];

// Generate a random work order
const generateWorkOrder = (index, status, billingStatus = null) => {
  const building = randomFrom(BUILDINGS);
  const description = randomFrom(WORK_DESCRIPTIONS);
  const priority = randomFrom(['normal', 'normal', 'normal', 'high', 'emergency']);
  const leadTech = status !== 'pending' ? randomFrom(DEMO_USERS.filter(u => u.role === 'lead_tech')) : null;
  const nte = randomFrom([500, 750, 1000, 1500, 2000, 2500, 3000, 5000]);
  
  const daysOld = status === 'pending' ? randomBetween(0, 5) : 
                  status === 'assigned' ? randomBetween(1, 10) :
                  status === 'in_progress' ? randomBetween(2, 15) :
                  status === 'completed' ? randomBetween(5, 30) :
                  randomBetween(0, 20);

  const hoursRegular = ['in_progress', 'completed', 'needs_return'].includes(status) ? randomBetween(2, 8) : 0;
  const hoursOvertime = ['in_progress', 'completed'].includes(status) && Math.random() > 0.7 ? randomBetween(1, 4) : 0;
  const materialCost = ['in_progress', 'completed'].includes(status) && Math.random() > 0.5 ? randomBetween(50, 500) : 0;
  const miles = ['in_progress', 'completed', 'needs_return'].includes(status) ? randomBetween(15, 60) : 0;

  return {
    wo_id: `demo-wo-${String(index).padStart(3, '0')}`,
    wo_number: `WO-${2024}-${String(1000 + index).padStart(4, '0')}`,
    building: building.name,
    address: building.address,
    work_order_description: description,
    priority: priority,
    status: status,
    billing_status: billingStatus,
    nte: nte,
    date_entered: daysAgo(daysOld),
    date_needed: status === 'pending' ? daysFromNow(randomBetween(1, 7)) : null,
    scheduled_date: ['assigned', 'in_progress'].includes(status) ? (Math.random() > 0.5 ? today() : daysFromNow(randomBetween(1, 5))) : null,
    lead_tech_id: leadTech?.user_id || null,
    lead_tech: leadTech ? { first_name: leadTech.first_name, last_name: leadTech.last_name, email: leadTech.email } : null,
    hours_regular: hoursRegular,
    hours_overtime: hoursOvertime,
    material_cost: materialCost,
    emf_equipment_cost: Math.random() > 0.8 ? randomBetween(25, 150) : 0,
    trailer_cost: Math.random() > 0.9 ? 75 : 0,
    rental_cost: Math.random() > 0.95 ? randomBetween(100, 300) : 0,
    miles: miles,
    requestor: randomFrom(['John Smith', 'Maria Garcia', 'Robert Johnson', 'Linda Williams', 'CBRE Portal']),
    requestor_phone: '803-555-' + String(randomBetween(1000, 9999)),
    client: 'CBRE',
    assigned_to_field: ['assigned', 'in_progress', 'completed', 'needs_return'].includes(status),
    assigned_to_field_at: ['assigned', 'in_progress', 'completed', 'needs_return'].includes(status) ? daysAgo(daysOld - 1) : null,
    acknowledged: false,
    is_locked: false,
    created_at: daysAgo(daysOld),
    updated_at: daysAgo(Math.max(0, daysOld - randomBetween(0, 3))),
    nte_quotes: billingStatus ? [{
      quote_id: `demo-quote-${index}`,
      is_verbal_nte: billingStatus === 'quoted' && Math.random() > 0.5,
      nte_status: billingStatus === 'quote_approved' ? 'approved' : billingStatus === 'quoted' ? 'submitted' : 'pending',
      created_at: daysAgo(daysOld - 1)
    }] : [],
    vwas_wo_number: `VWAS-${randomBetween(100000, 999999)}`,
    cbre_nte: nte,
  };
};

// Generate demo work orders
export const generateDemoWorkOrders = () => {
  const workOrders = [];
  let index = 1;

  // Pending (new, unassigned) - 4 work orders
  for (let i = 0; i < 4; i++) {
    workOrders.push(generateWorkOrder(index++, 'pending'));
  }

  // Assigned (has lead tech, ready to work) - 5 work orders
  for (let i = 0; i < 5; i++) {
    workOrders.push(generateWorkOrder(index++, 'assigned'));
  }

  // In Progress - 6 work orders
  for (let i = 0; i < 6; i++) {
    workOrders.push(generateWorkOrder(index++, 'in_progress'));
  }

  // Completed - 4 work orders
  for (let i = 0; i < 4; i++) {
    workOrders.push(generateWorkOrder(index++, 'completed'));
  }

  // Needs Return - 2 work orders
  for (let i = 0; i < 2; i++) {
    workOrders.push(generateWorkOrder(index++, 'needs_return'));
  }

  // With billing statuses
  // Pending CBRE Quote - 3 work orders
  for (let i = 0; i < 3; i++) {
    workOrders.push(generateWorkOrder(index++, 'in_progress', 'pending_cbre_quote'));
  }

  // Quoted (submitted) - 2 work orders
  for (let i = 0; i < 2; i++) {
    workOrders.push(generateWorkOrder(index++, 'assigned', 'quoted'));
  }

  // Quote Approved - 2 work orders
  for (let i = 0; i < 2; i++) {
    workOrders.push(generateWorkOrder(index++, 'in_progress', 'quote_approved'));
  }

  return workOrders;
};

// Generate team assignments for a work order
export const generateTeamAssignments = (woId, leadTechId) => {
  const assignments = [];
  
  // Add 0-2 additional team members
  const numTeamMembers = randomBetween(0, 2);
  const availableTechs = DEMO_USERS.filter(u => ['tech', 'helper'].includes(u.role) && u.user_id !== leadTechId);
  
  for (let i = 0; i < numTeamMembers && i < availableTechs.length; i++) {
    const tech = availableTechs[i];
    assignments.push({
      assignment_id: `demo-assign-${woId}-${i}`,
      wo_id: woId,
      user_id: tech.user_id,
      role: tech.role,
      hours_regular: randomBetween(0, 6),
      hours_overtime: Math.random() > 0.8 ? randomBetween(1, 3) : 0,
      miles: randomBetween(0, 40),
      user: {
        first_name: tech.first_name,
        last_name: tech.last_name,
        email: tech.email,
        role: tech.role
      }
    });
  }
  
  return assignments;
};

// Generate comments for a work order
export const generateComments = (woId, status) => {
  if (status === 'pending') return [];
  
  const comments = [];
  const numComments = randomBetween(1, 4);
  
  const sampleComments = [
    'On site, starting work.',
    'Parts ordered, waiting for delivery.',
    'Completed initial assessment.',
    'Need to return with lift equipment.',
    'Work completed, cleaning up.',
    'Spoke with facility manager about scope.',
    'Additional work identified - may need NTE increase.',
    'Waiting for building to clear area.',
    'Test successful, system operational.',
    'Left message with requestor.',
  ];
  
  for (let i = 0; i < numComments; i++) {
    const user = randomFrom(DEMO_USERS.filter(u => ['lead_tech', 'tech', 'office'].includes(u.role)));
    comments.push({
      comment_id: `demo-comment-${woId}-${i}`,
      wo_id: woId,
      user_id: user.user_id,
      comment: randomFrom(sampleComments),
      created_at: daysAgo(randomBetween(0, 10)),
      user: {
        first_name: user.first_name,
        last_name: user.last_name
      }
    });
  }
  
  return comments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
};

// Daily availability mock data
export const generateDailyAvailability = (dateStr) => {
  const fieldWorkers = DEMO_USERS.filter(u => ['lead_tech', 'tech', 'helper'].includes(u.role));
  
  return fieldWorkers.map(user => {
    const submitted = Math.random() > 0.2; // 80% submission rate
    const notAvailable = submitted && Math.random() > 0.85; // 15% not available
    
    return {
      availability_id: `demo-avail-${user.user_id}-${dateStr}`,
      user_id: user.user_id,
      availability_date: dateStr,
      scheduled_work: submitted && !notAvailable,
      emergency_work: submitted && !notAvailable && Math.random() > 0.3,
      not_available: notAvailable,
      submitted_at: submitted ? new Date().toISOString() : null,
    };
  });
};
