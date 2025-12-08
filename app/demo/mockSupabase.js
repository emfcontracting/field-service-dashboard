// app/demo/mockSupabase.js
// A mock Supabase client that uses local state instead of real database

import { generateDemoWorkOrders, generateTeamAssignments, generateComments, generateDailyAvailability, generateDailyHoursLog, generateDemoInvoices, generateInvoiceLineItems, DEMO_USERS } from './mockData';

class MockSupabaseClient {
  constructor() {
    this.workOrders = generateDemoWorkOrders();
    this.users = DEMO_USERS;
    this.assignments = {};
    this.comments = {};
    this.availability = {};
    this.dailyHoursLog = {};
    this.invoices = [];
    this.invoiceLineItems = {};
    this.listeners = [];
    
    // Pre-generate some assignments, comments, and daily hours
    this.workOrders.forEach(wo => {
      if (wo.lead_tech_id) {
        this.assignments[wo.wo_id] = generateTeamAssignments(wo.wo_id, wo.lead_tech_id);
        this.dailyHoursLog[wo.wo_id] = generateDailyHoursLog(wo.wo_id, wo.status, wo.lead_tech_id);
      }
      this.comments[wo.wo_id] = generateComments(wo.wo_id, wo.status);
    });
    
    // Generate invoices
    this.invoices = generateDemoInvoices(this.workOrders);
    this.invoices.forEach(inv => {
      const wo = this.workOrders.find(w => w.wo_id === inv.wo_id);
      if (wo) {
        this.invoiceLineItems[inv.invoice_id] = generateInvoiceLineItems(inv, wo);
      }
    });
  }

  // Reset all data
  reset() {
    this.workOrders = generateDemoWorkOrders();
    this.assignments = {};
    this.comments = {};
    this.dailyHoursLog = {};
    this.invoices = [];
    this.invoiceLineItems = {};
    
    this.workOrders.forEach(wo => {
      if (wo.lead_tech_id) {
        this.assignments[wo.wo_id] = generateTeamAssignments(wo.wo_id, wo.lead_tech_id);
        this.dailyHoursLog[wo.wo_id] = generateDailyHoursLog(wo.wo_id, wo.status, wo.lead_tech_id);
      }
      this.comments[wo.wo_id] = generateComments(wo.wo_id, wo.status);
    });
    
    // Generate invoices
    this.invoices = generateDemoInvoices(this.workOrders);
    this.invoices.forEach(inv => {
      const wo = this.workOrders.find(w => w.wo_id === inv.wo_id);
      if (wo) {
        this.invoiceLineItems[inv.invoice_id] = generateInvoiceLineItems(inv, wo);
      }
    });
    
    this.notifyListeners();
  }

  notifyListeners() {
    this.listeners.forEach(cb => cb());
  }

  onDataChange(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  // Mock Supabase query builder
  from(table) {
    return new MockQueryBuilder(this, table);
  }

  // Mock channel for real-time (no-op in demo)
  channel(name) {
    return {
      on: () => ({ subscribe: () => {} }),
      subscribe: () => {}
    };
  }

  removeChannel() {}
}

class MockQueryBuilder {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.filters = [];
    this.selectFields = '*';
    this.orderByField = null;
    this.orderAscending = true;
    this.updateData = null;
    this.insertData = null;
    this.deleteMode = false;
  }

  select(fields = '*') {
    this.selectFields = fields;
    return this;
  }

  eq(field, value) {
    this.filters.push({ type: 'eq', field, value });
    return this;
  }

  in(field, values) {
    this.filters.push({ type: 'in', field, values });
    return this;
  }

  order(field, options = {}) {
    this.orderByField = field;
    this.orderAscending = options.ascending !== false;
    return this;
  }

  limit(n) {
    this.limitCount = n;
    return this;
  }

  single() {
    this.singleResult = true;
    return this;
  }

  like(field, pattern) {
    this.filters.push({ type: 'like', field, pattern });
    return this;
  }

  update(data) {
    this.updateData = data;
    return this;
  }

  insert(data) {
    this.insertData = data;
    return this;
  }

  delete() {
    this.deleteMode = true;
    return this;
  }

  // Execute the query
  async then(resolve) {
    let result = { data: null, error: null };

    try {
      switch (this.table) {
        case 'work_orders':
          result = this.handleWorkOrders();
          break;
        case 'users':
          result = this.handleUsers();
          break;
        case 'work_order_assignments':
          result = this.handleAssignments();
          break;
        case 'work_order_comments':
          result = this.handleComments();
          break;
        case 'daily_availability':
          result = this.handleAvailability();
          break;
        case 'daily_hours_log':
          result = this.handleDailyHoursLog();
          break;
        case 'invoices':
          result = this.handleInvoices();
          break;
        case 'invoice_line_items':
          result = this.handleInvoiceLineItems();
          break;
        default:
          result = { data: [], error: null };
      }
    } catch (error) {
      result = { data: null, error };
    }

    resolve(result);
  }

  handleWorkOrders() {
    if (this.updateData) {
      // Update work order
      const woIdFilter = this.filters.find(f => f.field === 'wo_id');
      if (woIdFilter) {
        const index = this.client.workOrders.findIndex(wo => wo.wo_id === woIdFilter.value);
        if (index !== -1) {
          this.client.workOrders[index] = { ...this.client.workOrders[index], ...this.updateData };
          this.client.notifyListeners();
        }
      }
      return { data: null, error: null };
    }

    if (this.deleteMode) {
      const woIdFilter = this.filters.find(f => f.field === 'wo_id');
      if (woIdFilter) {
        this.client.workOrders = this.client.workOrders.filter(wo => wo.wo_id !== woIdFilter.value);
        this.client.notifyListeners();
      }
      return { data: null, error: null };
    }

    // Select work orders
    let data = [...this.client.workOrders];

    // Apply filters
    this.filters.forEach(filter => {
      if (filter.type === 'eq') {
        data = data.filter(wo => wo[filter.field] === filter.value);
      }
    });

    // Filter out acknowledged and locked (like real dashboard)
    data = data.filter(wo => !wo.acknowledged && !wo.is_locked);

    // Apply ordering
    if (this.orderByField) {
      data.sort((a, b) => {
        const aVal = a[this.orderByField];
        const bVal = b[this.orderByField];
        if (aVal < bVal) return this.orderAscending ? -1 : 1;
        if (aVal > bVal) return this.orderAscending ? 1 : -1;
        return 0;
      });
    }

    return { data, error: null };
  }

  handleUsers() {
    let data = [...this.client.users];

    // Apply filters
    this.filters.forEach(filter => {
      if (filter.type === 'eq') {
        data = data.filter(u => u[filter.field] === filter.value);
      }
      if (filter.type === 'in') {
        data = data.filter(u => filter.values.includes(u[filter.field]));
      }
    });

    // Apply ordering
    if (this.orderByField) {
      data.sort((a, b) => {
        const aVal = a[this.orderByField];
        const bVal = b[this.orderByField];
        if (aVal < bVal) return this.orderAscending ? -1 : 1;
        if (aVal > bVal) return this.orderAscending ? 1 : -1;
        return 0;
      });
    }

    return { data, error: null };
  }

  handleAssignments() {
    if (this.insertData) {
      const woId = this.insertData.wo_id;
      if (!this.client.assignments[woId]) {
        this.client.assignments[woId] = [];
      }
      const user = this.client.users.find(u => u.user_id === this.insertData.user_id);
      this.client.assignments[woId].push({
        assignment_id: `demo-assign-${Date.now()}`,
        ...this.insertData,
        user: user ? {
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          role: user.role
        } : null
      });
      this.client.notifyListeners();
      return { data: null, error: null };
    }

    if (this.deleteMode) {
      const assignIdFilter = this.filters.find(f => f.field === 'assignment_id');
      if (assignIdFilter) {
        Object.keys(this.client.assignments).forEach(woId => {
          this.client.assignments[woId] = this.client.assignments[woId].filter(
            a => a.assignment_id !== assignIdFilter.value
          );
        });
        this.client.notifyListeners();
      }
      return { data: null, error: null };
    }

    if (this.updateData) {
      const assignIdFilter = this.filters.find(f => f.field === 'assignment_id');
      if (assignIdFilter) {
        Object.keys(this.client.assignments).forEach(woId => {
          this.client.assignments[woId] = this.client.assignments[woId].map(a =>
            a.assignment_id === assignIdFilter.value ? { ...a, ...this.updateData } : a
          );
        });
        this.client.notifyListeners();
      }
      return { data: null, error: null };
    }

    // Select assignments
    const woIdFilter = this.filters.find(f => f.field === 'wo_id');
    if (woIdFilter) {
      return { data: this.client.assignments[woIdFilter.value] || [], error: null };
    }

    return { data: [], error: null };
  }

  handleComments() {
    if (this.insertData) {
      const woId = this.insertData.wo_id;
      if (!this.client.comments[woId]) {
        this.client.comments[woId] = [];
      }
      const user = this.client.users.find(u => u.user_id === this.insertData.user_id);
      this.client.comments[woId].unshift({
        comment_id: `demo-comment-${Date.now()}`,
        ...this.insertData,
        created_at: new Date().toISOString(),
        user: user ? {
          first_name: user.first_name,
          last_name: user.last_name
        } : null
      });
      this.client.notifyListeners();
      return { data: null, error: null };
    }

    const woIdFilter = this.filters.find(f => f.field === 'wo_id');
    if (woIdFilter) {
      return { data: this.client.comments[woIdFilter.value] || [], error: null };
    }

    return { data: [], error: null };
  }

  handleAvailability() {
    const dateFilter = this.filters.find(f => f.field === 'availability_date');
    if (dateFilter) {
      if (!this.client.availability[dateFilter.value]) {
        this.client.availability[dateFilter.value] = generateDailyAvailability(dateFilter.value);
      }
      return { data: this.client.availability[dateFilter.value], error: null };
    }
    return { data: [], error: null };
  }

  handleDailyHoursLog() {
    const woIdFilter = this.filters.find(f => f.field === 'wo_id');
    if (woIdFilter) {
      return { data: this.client.dailyHoursLog[woIdFilter.value] || [], error: null };
    }
    return { data: [], error: null };
  }

  handleInvoices() {
    if (this.updateData) {
      const invIdFilter = this.filters.find(f => f.field === 'invoice_id');
      if (invIdFilter) {
        const index = this.client.invoices.findIndex(inv => inv.invoice_id === invIdFilter.value);
        if (index !== -1) {
          this.client.invoices[index] = { ...this.client.invoices[index], ...this.updateData };
          this.client.notifyListeners();
        }
      }
      return { data: null, error: null };
    }

    if (this.deleteMode) {
      const invIdFilter = this.filters.find(f => f.field === 'invoice_id');
      if (invIdFilter) {
        this.client.invoices = this.client.invoices.filter(inv => inv.invoice_id !== invIdFilter.value);
        delete this.client.invoiceLineItems[invIdFilter.value];
        this.client.notifyListeners();
      }
      return { data: null, error: null };
    }

    if (this.insertData) {
      const newInvoice = {
        invoice_id: `demo-inv-${Date.now()}`,
        ...this.insertData,
        created_at: new Date().toISOString()
      };
      this.client.invoices.unshift(newInvoice);
      this.client.notifyListeners();
      return { data: newInvoice, error: null };
    }

    // Select invoices
    let data = [...this.client.invoices];
    
    // Apply filters
    this.filters.forEach(filter => {
      if (filter.type === 'like') {
        const regex = new RegExp(filter.pattern.replace(/%/g, '.*'));
        data = data.filter(inv => regex.test(inv[filter.field] || ''));
      }
    });
    
    // Apply ordering
    if (this.orderByField) {
      data.sort((a, b) => {
        const aVal = a[this.orderByField];
        const bVal = b[this.orderByField];
        if (aVal < bVal) return this.orderAscending ? -1 : 1;
        if (aVal > bVal) return this.orderAscending ? 1 : -1;
        return 0;
      });
    }
    
    // Apply limit
    if (this.limitCount) {
      data = data.slice(0, this.limitCount);
    }
    
    // Return single result if requested
    if (this.singleResult) {
      return { data: data[0] || null, error: data.length === 0 ? { message: 'No rows found' } : null };
    }

    return { data, error: null };
  }

  handleInvoiceLineItems() {
    if (this.insertData) {
      const items = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
      items.forEach(item => {
        if (!this.client.invoiceLineItems[item.invoice_id]) {
          this.client.invoiceLineItems[item.invoice_id] = [];
        }
        this.client.invoiceLineItems[item.invoice_id].push({
          line_item_id: `demo-li-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ...item
        });
      });
      this.client.notifyListeners();
      return { data: null, error: null };
    }

    if (this.deleteMode) {
      const invIdFilter = this.filters.find(f => f.field === 'invoice_id');
      if (invIdFilter) {
        delete this.client.invoiceLineItems[invIdFilter.value];
        this.client.notifyListeners();
      }
      return { data: null, error: null };
    }

    const invIdFilter = this.filters.find(f => f.field === 'invoice_id');
    if (invIdFilter) {
      let items = this.client.invoiceLineItems[invIdFilter.value] || [];
      
      // Apply ordering
      if (this.orderByField) {
        items = [...items].sort((a, b) => {
          const aVal = a[this.orderByField];
          const bVal = b[this.orderByField];
          if (aVal < bVal) return this.orderAscending ? -1 : 1;
          if (aVal > bVal) return this.orderAscending ? 1 : -1;
          return 0;
        });
      }
      
      return { data: items, error: null };
    }

    return { data: [], error: null };
  }
}

// Create singleton instance
let mockSupabaseInstance = null;

export function getMockSupabase() {
  if (!mockSupabaseInstance) {
    mockSupabaseInstance = new MockSupabaseClient();
  }
  return mockSupabaseInstance;
}

export function resetMockSupabase() {
  if (mockSupabaseInstance) {
    mockSupabaseInstance.reset();
  }
}
