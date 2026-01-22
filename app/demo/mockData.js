// app/demo/mockData.js
// Mock data for PCS FieldService Demo - Summit Mechanical Services

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

// Generate random 7-digit number
const random7Digits = () => String(randomBetween(1000000, 9999999));

// Generate WO number in format: P, ST, PJ, or C followed by 7 random numbers
const generateWONumber = () => {
  const prefixes = ['C', 'C', 'C', 'P', 'ST', 'PJ']; // C is most common
  const prefix = randomFrom(prefixes);
  return `${prefix}${random7Digits()}`;
};

// CBRE Status options (from Gmail labels)
const CBRE_STATUSES = [
  null,                // No CBRE status
  null,                // No CBRE status (more common)
  null,                // No CBRE status (more common)
  'pending_quote',     // 📋 PENDING QUOTE
  'quote_submitted',   // 📤 QUOTE SUBMITTED
  'quote_approved',    // ✅ QUOTE APPROVED
  'quote_rejected',    // ❌ QUOTE REJECTED
  'escalation',        // 🚨 ESCALATION
  'reassigned',        // 🔄 REASSIGNED
  'invoice_rejected',  // ❌ INVOICE REJECTED
  'cancelled',         // 🚫 CANCELLED
];

// Building locations (generic commercial buildings)
const BUILDINGS = [
  { name: 'Columbia Distribution Center', address: '2523 Commerce Drive, Columbia, SC 29205' },
  { name: 'Lexington Business Park', address: '5500 Sunset Blvd, Lexington, SC 29072' },
  { name: 'Irmo Corporate Campus', address: '7501 St Andrews Rd, Irmo, SC 29063' },
  { name: 'West Columbia Warehouse', address: '1200 Augusta Rd, West Columbia, SC 29169' },
  { name: 'Cayce Industrial Complex', address: '900 Knox Abbott Dr, Cayce, SC 29033' },
  { name: 'Blythewood Logistics Hub', address: '201 Blythewood Rd, Blythewood, SC 29016' },
  { name: 'Northeast Medical Plaza', address: '7620 Two Notch Rd, Columbia, SC 29223' },
  { name: 'Forest Acres Office Tower', address: '4600 Forest Dr, Columbia, SC 29206' },
  { name: 'Chapin Retail Center', address: '120 Columbia Ave, Chapin, SC 29036' },
  { name: 'Newberry Manufacturing', address: '2800 Main St, Newberry, SC 29108' },
];

// Work descriptions (electrical/mechanical/HVAC)
const WORK_DESCRIPTIONS = [
  'Replace faulty ballast in warehouse lighting section B',
  'Install new 20A circuit for sorting equipment',
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
  'Troubleshoot battery backup system',
  'Quarterly fire alarm inspection and testing',
  'Replace water heater in maintenance room',
];

// Demo Users - Summit Mechanical Services
export const DEMO_USERS = [
  { user_id: 'demo-001', first_name: 'John', last_name: 'Mitchell', email: 'john@summit-mech.demo', role: 'admin', phone: '803-555-0101', is_active: true },
  { user_id: 'demo-002', first_name: 'Sarah', last_name: 'Chen', email: 'sarah@summit-mech.demo', role: 'office', phone: '803-555-0102', is_active: true },
  { user_id: 'demo-003', first_name: 'Marcus', last_name: 'Williams', email: 'marcus@summit-mech.demo', role: 'lead_tech', phone: '803-555-0201', is_active: true },
  { user_id: 'demo-004', first_name: 'Roberto', last_name: 'Garcia', email: 'roberto@summit-mech.demo', role: 'lead_tech', phone: '803-555-0202', is_active: true },
  { user_id: 'demo-005', first_name: 'David', last_name: 'Thompson', email: 'david@summit-mech.demo', role: 'lead_tech', phone: '803-555-0203', is_active: true },
  { user_id: 'demo-006', first_name: 'James', last_name: 'Wilson', email: 'james@summit-mech.demo', role: 'tech', phone: '803-555-0301', is_active: true },
  { user_id: 'demo-007', first_name: 'Anthony', last_name: 'Brown', email: 'anthony@summit-mech.demo', role: 'tech', phone: '803-555-0302', is_active: true },
  { user_id: 'demo-008', first_name: 'Michael', last_name: 'Davis', email: 'michael@summit-mech.demo', role: 'tech', phone: '803-555-0303', is_active: true },
  { user_id: 'demo-009', first_name: 'Tyler', last_name: 'Anderson', email: 'tyler@summit-mech.demo', role: 'helper', phone: '803-555-0401', is_active: true },
  { user_id: 'demo-010', first_name: 'Kevin', last_name: 'Martinez', email: 'kevin@summit-mech.demo', role: 'helper', phone: '803-555-0402', is_active: true },
];

// CBRE Status badge helper (exported for use in components)
export const getCBREStatusBadge = (cbreStatus) => {
  switch (cbreStatus) {
    case 'escalation':
      return {
        text: '🚨 ESCALATION',
        color: 'bg-red-600 text-red-100',
        shortText: '🚨 ESC'
      };
    case 'quote_approved':
      return {
        text: '✅ QUOTE APPROVED',
        color: 'bg-green-600 text-green-100',
        shortText: '✅ Approved'
      };
    case 'quote_rejected':
      return {
        text: '❌ QUOTE REJECTED',
        color: 'bg-red-700 text-red-100',
        shortText: '❌ Rejected'
      };
    case 'quote_submitted':
      return {
        text: '📤 QUOTE SUBMITTED',
        color: 'bg-blue-600 text-blue-100',
        shortText: '📤 Submitted'
      };
    case 'reassigned':
      return {
        text: '🔄 REASSIGNED',
        color: 'bg-purple-600 text-purple-100',
        shortText: '🔄 Reassign'
      };
    case 'pending_quote':
      return {
        text: '📋 PENDING QUOTE',
        color: 'bg-orange-600 text-orange-100',
        shortText: '📋 Pending'
      };
    case 'invoice_rejected':
      return {
        text: '❌ INVOICE REJECTED',
        color: 'bg-red-800 text-red-100',
        shortText: '❌ Inv Rej'
      };
    case 'cancelled':
      return {
        text: '🚫 CANCELLED',
        color: 'bg-gray-600 text-gray-100',
        shortText: '🚫 Cancel'
      };
    default:
      return null;
  }
};

// Generate a random work order
const generateWorkOrder = (index, status, cbreStatus = null) => {
  const building = randomFrom(BUILDINGS);
  const description = randomFrom(WORK_DESCRIPTIONS);
  const priority = randomFrom(['normal', 'normal', 'normal', 'high', 'emergency']);
  const leadTech = status !== 'pending' ? randomFrom(DEMO_USERS.filter(u => u.role === 'lead_tech')) : null;
  const nte = randomFrom([500, 750, 1000, 1500, 2000, 2500, 3000, 5000]);
  
  // Assign random CBRE status if not provided
  const finalCbreStatus = cbreStatus !== undefined ? cbreStatus : randomFrom(CBRE_STATUSES);
  
  const daysOld = status === 'pending' ? randomBetween(0, 5) : 
                  status === 'assigned' ? randomBetween(1, 10) :
                  status === 'in_progress' ? randomBetween(2, 15) :
                  status === 'completed' ? randomBetween(5, 30) :
                  randomBetween(0, 20);

  const hoursRegular = ['in_progress', 'completed', 'tech_review', 'return_trip'].includes(status) ? randomBetween(2, 8) : 0;
  const hoursOvertime = ['in_progress', 'completed'].includes(status) && Math.random() > 0.7 ? randomBetween(1, 4) : 0;
  const materialCost = ['in_progress', 'completed'].includes(status) && Math.random() > 0.5 ? randomBetween(50, 500) : 0;
  const miles = ['in_progress', 'completed', 'tech_review', 'return_trip'].includes(status) ? randomBetween(15, 60) : 0;

  return {
    wo_id: `demo-wo-${String(index).padStart(3, '0')}`,
    wo_number: generateWONumber(),
    building: building.name,
    address: building.address,
    work_order_description: description,
    priority: priority,
    status: status,
    cbre_status: finalCbreStatus,
    nte: nte,
    date_entered: daysAgo(daysOld),
    date_needed: status === 'pending' ? daysFromNow(randomBetween(1, 7)) : null,
    scheduled_date: ['assigned', 'in_progress'].includes(status) ? (Math.random() > 0.5 ? today() : daysFromNow(randomBetween(1, 5))) : null,
    lead_tech_id: leadTech?.user_id || null,
    lead_tech: leadTech ? { first_name: leadTech.first_name, last_name: leadTech.last_name, email: leadTech.email } : null,
    hours_regular: hoursRegular,
    hours_overtime: hoursOvertime,
    material_cost: materialCost,
    equipment_cost: Math.random() > 0.8 ? randomBetween(25, 150) : 0,
    trailer_cost: Math.random() > 0.9 ? 75 : 0,
    rental_cost: Math.random() > 0.95 ? randomBetween(100, 300) : 0,
    miles: miles,
    requestor: randomFrom(['John Smith', 'Maria Garcia', 'Robert Johnson', 'Linda Williams', 'Facility Portal']),
    requestor_phone: '803-555-' + String(randomBetween(1000, 9999)),
    client: 'CBRE',
    assigned_to_field: ['assigned', 'in_progress', 'completed', 'tech_review', 'return_trip'].includes(status),
    assigned_to_field_at: ['assigned', 'in_progress', 'completed', 'tech_review', 'return_trip'].includes(status) ? daysAgo(daysOld - 1) : null,
    acknowledged: false,
    is_locked: false,
    created_at: daysAgo(daysOld),
    updated_at: daysAgo(Math.max(0, daysOld - randomBetween(0, 3))),
    vwas_wo_number: `VWAS-${randomBetween(100000, 999999)}`,
    cbre_nte: nte,
  };
};

// Generate demo work orders with variety of CBRE statuses
export const generateDemoWorkOrders = () => {
  const workOrders = [];
  let index = 1;

  // Pending (new, unassigned) - 4 work orders
  for (let i = 0; i < 4; i++) {
    workOrders.push(generateWorkOrder(index++, 'pending', null));
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
    workOrders.push(generateWorkOrder(index++, 'completed', null));
  }

  // Tech Review - 2 work orders
  for (let i = 0; i < 2; i++) {
    workOrders.push(generateWorkOrder(index++, 'tech_review'));
  }

  // Return Trip - 2 work orders
  for (let i = 0; i < 2; i++) {
    workOrders.push(generateWorkOrder(index++, 'return_trip'));
  }

  // === CBRE Status Specific Work Orders ===
  
  // Escalation - urgent! - 2 work orders
  for (let i = 0; i < 2; i++) {
    workOrders.push(generateWorkOrder(index++, 'in_progress', 'escalation'));
  }

  // Pending Quote - 3 work orders
  for (let i = 0; i < 3; i++) {
    workOrders.push(generateWorkOrder(index++, 'in_progress', 'pending_quote'));
  }

  // Quote Submitted - 2 work orders
  for (let i = 0; i < 2; i++) {
    workOrders.push(generateWorkOrder(index++, 'assigned', 'quote_submitted'));
  }

  // Quote Approved - 2 work orders
  for (let i = 0; i < 2; i++) {
    workOrders.push(generateWorkOrder(index++, 'in_progress', 'quote_approved'));
  }

  // Quote Rejected - 1 work order
  workOrders.push(generateWorkOrder(index++, 'assigned', 'quote_rejected'));

  // Reassigned - 1 work order
  workOrders.push(generateWorkOrder(index++, 'assigned', 'reassigned'));

  // Invoice Rejected - 1 work order
  workOrders.push(generateWorkOrder(index++, 'tech_review', 'invoice_rejected'));

  // Cancelled - 1 work order
  workOrders.push(generateWorkOrder(index++, 'pending', 'cancelled'));

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

// Generate daily hours log entries for a work order
export const generateDailyHoursLog = (woId, status, leadTechId) => {
  if (!['in_progress', 'completed', 'tech_review', 'return_trip'].includes(status)) return [];
  
  const logs = [];
  const numDays = randomBetween(1, 3);
  
  for (let i = 0; i < numDays; i++) {
    // Lead tech hours
    if (leadTechId) {
      logs.push({
        log_id: `demo-log-${woId}-lead-${i}`,
        wo_id: woId,
        user_id: leadTechId,
        log_date: daysAgo(i).split('T')[0],
        hours_regular: randomBetween(2, 8),
        hours_overtime: Math.random() > 0.7 ? randomBetween(1, 3) : 0,
        miles: randomBetween(15, 50),
        notes: randomFrom(['Work in progress', 'Completed section A', 'Waiting for parts', 'Testing complete']),
        created_at: daysAgo(i)
      });
    }
    
    // Sometimes add helper hours
    if (Math.random() > 0.5) {
      const helper = randomFrom(DEMO_USERS.filter(u => u.role === 'helper'));
      logs.push({
        log_id: `demo-log-${woId}-helper-${i}`,
        wo_id: woId,
        user_id: helper.user_id,
        log_date: daysAgo(i).split('T')[0],
        hours_regular: randomBetween(2, 6),
        hours_overtime: 0,
        miles: 0,
        notes: 'Assisted lead tech',
        created_at: daysAgo(i)
      });
    }
  }
  
  return logs;
};

// Generate invoices for completed/acknowledged work orders
export const generateDemoInvoices = (workOrders) => {
  const invoices = [];
  let invoiceNum = 1;
  
  // Only create invoices for some completed work orders
  const completedWOs = workOrders.filter(wo => wo.status === 'completed');
  const numInvoices = Math.min(completedWOs.length, randomBetween(3, 6));
  
  for (let i = 0; i < numInvoices; i++) {
    const wo = completedWOs[i];
    if (!wo) continue;
    
    // Calculate invoice totals based on work order data
    const laborRT = (wo.hours_regular || randomBetween(4, 12)) * 50;
    const laborOT = (wo.hours_overtime || randomBetween(0, 4)) * 75;
    const adminHours = 100; // Always 2 hours @ $50
    const mileage = (wo.miles || randomBetween(20, 60)) * 1.00;
    const materials = (wo.material_cost || randomBetween(0, 300)) * 1.15;
    const equipment = (wo.equipment_cost || 0) * 1.15;
    
    const subtotal = laborRT + laborOT + adminHours + mileage + materials + equipment;
    const status = randomFrom(['draft', 'draft', 'approved', 'synced']);
    
    const invoice = {
      invoice_id: `demo-inv-${String(invoiceNum).padStart(3, '0')}`,
      invoice_number: `INV-2024-${String(invoiceNum).padStart(5, '0')}`,
      wo_id: wo.wo_id,
      invoice_date: daysAgo(randomBetween(1, 15)),
      due_date: daysFromNow(30),
      subtotal: subtotal,
      tax: 0,
      total: subtotal,
      status: status,
      notes: 'Invoice generated from work order',
      created_at: daysAgo(randomBetween(1, 15)),
      work_order: {
        wo_number: wo.wo_number,
        building: wo.building,
        work_order_description: wo.work_order_description,
        comments: wo.comments || 'Work completed as requested.',
        lead_tech: wo.lead_tech
      }
    };
    
    invoices.push(invoice);
    invoiceNum++;
  }
  
  return invoices;
};

// Generate invoice line items
export const generateInvoiceLineItems = (invoice, wo) => {
  const items = [];
  let itemNum = 1;
  
  // Labor - Regular
  const rtHours = wo.hours_regular || randomBetween(4, 10);
  if (rtHours > 0) {
    items.push({
      line_item_id: `demo-li-${invoice.invoice_id}-${itemNum++}`,
      invoice_id: invoice.invoice_id,
      description: `Labor - Regular Time (${rtHours} hrs @ $50/hr)`,
      quantity: rtHours,
      unit_price: 50,
      amount: rtHours * 50,
      line_type: 'labor'
    });
  }
  
  // Labor - Overtime
  const otHours = wo.hours_overtime || (Math.random() > 0.6 ? randomBetween(1, 4) : 0);
  if (otHours > 0) {
    items.push({
      line_item_id: `demo-li-${invoice.invoice_id}-${itemNum++}`,
      invoice_id: invoice.invoice_id,
      description: `Labor - Overtime (${otHours} hrs @ $75/hr)`,
      quantity: otHours,
      unit_price: 75,
      amount: otHours * 75,
      line_type: 'labor'
    });
  }
  
  // Admin Hours - Always
  items.push({
    line_item_id: `demo-li-${invoice.invoice_id}-${itemNum++}`,
    invoice_id: invoice.invoice_id,
    description: 'Administrative Hours (2 hrs @ $50/hr)',
    quantity: 2,
    unit_price: 50,
    amount: 100,
    line_type: 'labor'
  });
  
  // Mileage
  const miles = wo.miles || randomBetween(20, 50);
  if (miles > 0) {
    items.push({
      line_item_id: `demo-li-${invoice.invoice_id}-${itemNum++}`,
      invoice_id: invoice.invoice_id,
      description: `Mileage (${miles} miles @ $1.00/mile)`,
      quantity: miles,
      unit_price: 1.00,
      amount: miles * 1.00,
      line_type: 'mileage'
    });
  }
  
  // Materials (with 15% markup)
  const materialBase = wo.material_cost || (Math.random() > 0.4 ? randomBetween(50, 400) : 0);
  if (materialBase > 0) {
    const materialMarkup = materialBase * 1.15;
    items.push({
      line_item_id: `demo-li-${invoice.invoice_id}-${itemNum++}`,
      invoice_id: invoice.invoice_id,
      description: 'Materials',
      quantity: 1,
      unit_price: materialMarkup,
      amount: materialMarkup,
      line_type: 'material'
    });
  }
  
  // Equipment (with 15% markup)
  const equipmentBase = wo.equipment_cost || (Math.random() > 0.8 ? randomBetween(50, 150) : 0);
  if (equipmentBase > 0) {
    const equipmentMarkup = equipmentBase * 1.15;
    items.push({
      line_item_id: `demo-li-${invoice.invoice_id}-${itemNum++}`,
      invoice_id: invoice.invoice_id,
      description: 'Equipment',
      quantity: 1,
      unit_price: equipmentMarkup,
      amount: equipmentMarkup,
      line_type: 'equipment'
    });
  }
  
  // Work Performed description
  items.push({
    line_item_id: `demo-li-${invoice.invoice_id}-${itemNum++}`,
    invoice_id: invoice.invoice_id,
    description: wo.comments || wo.work_order_description || 'Work completed as requested. All systems tested and operational.',
    quantity: 1,
    unit_price: 0,
    amount: 0,
    line_type: 'description'
  });
  
  return items;
};
