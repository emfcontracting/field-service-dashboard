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
  
  // Mock auth for demo
  auth = {
    getUser: async () => ({ data: { user: { id: 'demo-user', email: 'demo@pcsfield.demo' } }, error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    signOut: async () => ({ error: null })
  };
}

const NOOP_BUILDER_METHODS = new Set([
  'textSearch', 'overlaps', 'containedBy', 'rangeGt', 'rangeGte', 'rangeLt', 'rangeLte',
  'rangeAdjacent', 'likeAllOf', 'likeAnyOf', 'ilikeAllOf', 'ilikeAnyOf', 'csv', 'geojson',
  'explain', 'returns', 'throwOnError', 'abortSignal', 'rollback', 'setHeader',
]);

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
    this.postFilters = [];
    this.maybeSingleResult = false;
    this.rangeFrom = null;
    this.rangeTo = null;

    // The demo renders the real dashboard components. When they start using a
    // query-builder method this mock does not implement yet, chain it as a
    // no-op instead of crashing the whole page.
    // Only names that are real PostgREST builder methods get stubbed — plain
    // state fields (singleResult, limitCount…) must stay undefined.
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (prop in target) return Reflect.get(target, prop, receiver);
        if (typeof prop === 'string' && NOOP_BUILDER_METHODS.has(prop)) return () => receiver;
        return undefined;
      },
    });
  }

  // ── Extra PostgREST filters (applied generically after the table handler) ──
  neq(field, value)   { this.postFilters.push({ op: 'neq', field, value }); return this; }
  gt(field, value)    { this.postFilters.push({ op: 'gt',  field, value }); return this; }
  gte(field, value)   { this.postFilters.push({ op: 'gte', field, value }); return this; }
  lt(field, value)    { this.postFilters.push({ op: 'lt',  field, value }); return this; }
  lte(field, value)   { this.postFilters.push({ op: 'lte', field, value }); return this; }
  is(field, value)    { this.postFilters.push({ op: 'is',  field, value }); return this; }
  ilike(field, pattern) { this.postFilters.push({ op: 'ilike', field, value: pattern }); return this; }
  not(field, operator, value) { this.postFilters.push({ op: 'not', field, operator, value }); return this; }
  filter(field, operator, value) { this.postFilters.push({ op: operator, field, value }); return this; }
  match(obj = {}) { Object.entries(obj).forEach(([f, v]) => this.eq(f, v)); return this; }
  or() { return this; }        // complex OR strings: ignored in demo
  contains() { return this; }
  range(from, to) { this.rangeFrom = from; this.rangeTo = to; return this; }
  maybeSingle() { this.maybeSingleResult = true; return this; }
  upsert(data) { return this.insert(data); }

  _passes(row, f) {
    const v = row?.[f.field];
    const cmp = f.value;
    switch (f.op) {
      case 'neq': return v !== cmp;
      case 'gt':  return v > cmp;
      case 'gte': return v >= cmp;
      case 'lt':  return v < cmp;
      case 'lte': return v <= cmp;
      case 'is':  return cmp === null ? v == null : v === cmp;
      case 'ilike': {
        const re = new RegExp('^' + String(cmp).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i');
        return re.test(String(v ?? ''));
      }
      case 'not': {
        if (f.operator === 'is') return cmp === null ? v != null : v !== cmp;
        if (f.operator === 'eq') return v !== cmp;
        return true;
      }
      default: return true;
    }
  }

  _postProcess(result) {
    if (!result || result.error) return result;
    let data = result.data;
    if (Array.isArray(data)) {
      if (this.postFilters.length) data = data.filter(r => this.postFilters.every(f => this._passes(r, f)));
      if (this.rangeFrom != null) data = data.slice(this.rangeFrom, (this.rangeTo ?? data.length - 1) + 1);
      if (this.maybeSingleResult || this.singleResult) data = data[0] ?? null;
    } else if (data == null && (this.maybeSingleResult || this.singleResult)) {
      data = null;
    }
    return { ...result, data, count: Array.isArray(result.data) ? result.data.length : (result.data ? 1 : 0) };
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
        case 'work_order_quotes':
          result = this.handleWorkOrderQuotes();
          break;
        default:
          result = { data: [], error: null };
      }
    } catch (error) {
      result = { data: null, error };
    }

    resolve(this._postProcess(result));
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
      const woIdInFilter = this.filters.find(f => f.field === 'wo_id' && f.type === 'in');
      
      if (woIdInFilter) {
        this.client.workOrders = this.client.workOrders.filter(wo => !woIdInFilter.values.includes(wo.wo_id));
        this.client.notifyListeners();
      } else if (woIdFilter) {
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
      if (filter.type === 'in') {
        data = data.filter(wo => filter.values.includes(wo[filter.field]));
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
    
    if (this.singleResult) {
      return { data: data[0] || null, error: data.length === 0 ? { message: 'No rows found' } : null };
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
    const woIdFilter = this.filters.find(f => f.field === 'wo_id' && f.type === 'eq');
    const woIdInFilter = this.filters.find(f => f.field === 'wo_id' && f.type === 'in');
    
    if (woIdInFilter) {
      // Handle .in('wo_id', [...])
      let allAssignments = [];
      woIdInFilter.values.forEach(woId => {
        const assignments = this.client.assignments[woId] || [];
        allAssignments = [...allAssignments, ...assignments];
      });
      return { data: allAssignments, error: null };
    }
    
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
    // Handle insert
    if (this.insertData) {
      const woId = this.insertData.wo_id;
      if (!this.client.dailyHoursLog[woId]) {
        this.client.dailyHoursLog[woId] = [];
      }
      const user = this.client.users.find(u => u.user_id === this.insertData.user_id);
      this.client.dailyHoursLog[woId].push({
        log_id: `demo-log-${Date.now()}`,
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

    // Handle select with .in('wo_id', [...])
    const woIdInFilter = this.filters.find(f => f.field === 'wo_id' && f.type === 'in');
    if (woIdInFilter) {
      let allLogs = [];
      woIdInFilter.values.forEach(woId => {
        const logs = this.client.dailyHoursLog[woId] || [];
        allLogs = [...allLogs, ...logs];
      });
      return { data: allLogs, error: null };
    }

    // Handle select with .eq('wo_id', ...)
    const woIdFilter = this.filters.find(f => f.field === 'wo_id' && f.type === 'eq');
    if (woIdFilter) {
      let logs = this.client.dailyHoursLog[woIdFilter.value] || [];
      
      // Apply ordering
      if (this.orderByField) {
        logs = [...logs].sort((a, b) => {
          const aVal = a[this.orderByField];
          const bVal = b[this.orderByField];
          if (aVal < bVal) return this.orderAscending ? -1 : 1;
          if (aVal > bVal) return this.orderAscending ? 1 : -1;
          return 0;
        });
      }
      
      return { data: logs, error: null };
    }

    return { data: [], error: null };
  }

  handleWorkOrderQuotes() {
    const woIdFilter = this.filters.find(f => f.field === 'wo_id');
    if (woIdFilter) {
      const wo = this.client.workOrders.find(w => w.wo_id === woIdFilter.value);
      return { data: wo?.nte_quotes || [], error: null };
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

// The real components call our /api routes (flags, CBRE submission checks,
// notifications…). Demo work orders do not exist server-side, so on /demo
// pages answer those calls locally with an empty, successful payload.
function installDemoFetchShim() {
  if (typeof window === 'undefined' || window.__pcsDemoFetchShim) return;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    const path = url.startsWith('http') ? new URL(url).pathname : url;
    if (window.location.pathname.startsWith('/demo') && path.startsWith('/api/')) {
      const body = { success: true, demo: true, flags: [], data: [], items: [], results: [] };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return realFetch(input, init);
  };
  window.__pcsDemoFetchShim = true;
}

export function getMockSupabase() {
  installDemoFetchShim();
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
