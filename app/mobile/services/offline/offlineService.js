// offlineService.js - IndexedDB storage for offline functionality
// Stores work orders, daily logs, comments, and pending sync queue

const DB_NAME = 'emf_fsm_offline';
const DB_VERSION = 1;

// Store names
const STORES = {
  WORK_ORDERS: 'work_orders',
  COMPLETED_WORK_ORDERS: 'completed_work_orders',
  DAILY_LOGS: 'daily_logs',
  TEAM_MEMBERS: 'team_members',
  SYNC_QUEUE: 'sync_queue',
  USER_DATA: 'user_data',
  MATERIALS: 'materials',
  EQUIPMENT: 'equipment'
};

let db = null;

// Initialize IndexedDB
export async function initOfflineDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('IndexedDB not available');
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      console.log('✅ Offline database initialized');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Work Orders store - keyed by wo_id
      if (!database.objectStoreNames.contains(STORES.WORK_ORDERS)) {
        const woStore = database.createObjectStore(STORES.WORK_ORDERS, { keyPath: 'wo_id' });
        woStore.createIndex('status', 'status', { unique: false });
        woStore.createIndex('lead_tech_id', 'lead_tech_id', { unique: false });
        woStore.createIndex('updated_at', 'updated_at', { unique: false });
      }

      // Completed Work Orders store
      if (!database.objectStoreNames.contains(STORES.COMPLETED_WORK_ORDERS)) {
        const completedStore = database.createObjectStore(STORES.COMPLETED_WORK_ORDERS, { keyPath: 'wo_id' });
        completedStore.createIndex('date_completed', 'date_completed', { unique: false });
      }

      // Daily Logs store - keyed by log_id
      if (!database.objectStoreNames.contains(STORES.DAILY_LOGS)) {
        const logsStore = database.createObjectStore(STORES.DAILY_LOGS, { keyPath: 'log_id', autoIncrement: true });
        logsStore.createIndex('wo_id', 'wo_id', { unique: false });
        logsStore.createIndex('user_id', 'user_id', { unique: false });
        logsStore.createIndex('work_date', 'work_date', { unique: false });
        logsStore.createIndex('synced', 'synced', { unique: false });
      }

      // Team Members store
      if (!database.objectStoreNames.contains(STORES.TEAM_MEMBERS)) {
        const teamStore = database.createObjectStore(STORES.TEAM_MEMBERS, { keyPath: 'assignment_id' });
        teamStore.createIndex('wo_id', 'wo_id', { unique: false });
        teamStore.createIndex('user_id', 'user_id', { unique: false });
      }

      // Sync Queue store - for pending actions
      if (!database.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncStore = database.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
        syncStore.createIndex('action', 'action', { unique: false });
        syncStore.createIndex('created_at', 'created_at', { unique: false });
        syncStore.createIndex('status', 'status', { unique: false });
      }

      // User Data store - for current user info
      if (!database.objectStoreNames.contains(STORES.USER_DATA)) {
        database.createObjectStore(STORES.USER_DATA, { keyPath: 'key' });
      }

      // Materials store
      if (!database.objectStoreNames.contains(STORES.MATERIALS)) {
        const matStore = database.createObjectStore(STORES.MATERIALS, { keyPath: 'id', autoIncrement: true });
        matStore.createIndex('wo_id', 'wo_id', { unique: false });
      }

      // Equipment store
      if (!database.objectStoreNames.contains(STORES.EQUIPMENT)) {
        const eqStore = database.createObjectStore(STORES.EQUIPMENT, { keyPath: 'id', autoIncrement: true });
        eqStore.createIndex('wo_id', 'wo_id', { unique: false });
      }

      console.log('✅ Offline database schema created');
    };
  });
}

// Get database connection
function getDB() {
  if (!db) {
    throw new Error('Offline database not initialized. Call initOfflineDB() first.');
  }
  return db;
}

// ==================== WORK ORDERS ====================

export async function cacheWorkOrders(workOrders) {
  const database = getDB();
  const tx = database.transaction(STORES.WORK_ORDERS, 'readwrite');
  const store = tx.objectStore(STORES.WORK_ORDERS);

  // Clear existing and add new
  await new Promise((resolve, reject) => {
    const clearRequest = store.clear();
    clearRequest.onsuccess = resolve;
    clearRequest.onerror = () => reject(clearRequest.error);
  });

  for (const wo of workOrders) {
    store.put({
      ...wo,
      cached_at: new Date().toISOString()
    });
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      console.log(`✅ Cached ${workOrders.length} work orders`);
      resolve(true);
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedWorkOrders() {
  const database = getDB();
  const tx = database.transaction(STORES.WORK_ORDERS, 'readonly');
  const store = tx.objectStore(STORES.WORK_ORDERS);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedWorkOrder(woId) {
  const database = getDB();
  const tx = database.transaction(STORES.WORK_ORDERS, 'readonly');
  const store = tx.objectStore(STORES.WORK_ORDERS);

  return new Promise((resolve, reject) => {
    const request = store.get(woId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function updateCachedWorkOrder(woId, updates) {
  const database = getDB();
  const tx = database.transaction(STORES.WORK_ORDERS, 'readwrite');
  const store = tx.objectStore(STORES.WORK_ORDERS);

  return new Promise(async (resolve, reject) => {
    const getRequest = store.get(woId);
    
    getRequest.onsuccess = () => {
      const existing = getRequest.result;
      if (existing) {
        const updated = {
          ...existing,
          ...updates,
          cached_at: new Date().toISOString(),
          locally_modified: true
        };
        store.put(updated);
      }
    };

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// ==================== COMPLETED WORK ORDERS ====================

export async function cacheCompletedWorkOrders(workOrders) {
  const database = getDB();
  const tx = database.transaction(STORES.COMPLETED_WORK_ORDERS, 'readwrite');
  const store = tx.objectStore(STORES.COMPLETED_WORK_ORDERS);

  await new Promise((resolve, reject) => {
    const clearRequest = store.clear();
    clearRequest.onsuccess = resolve;
    clearRequest.onerror = () => reject(clearRequest.error);
  });

  for (const wo of workOrders) {
    store.put({
      ...wo,
      cached_at: new Date().toISOString()
    });
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      console.log(`✅ Cached ${workOrders.length} completed work orders`);
      resolve(true);
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedCompletedWorkOrders() {
  const database = getDB();
  const tx = database.transaction(STORES.COMPLETED_WORK_ORDERS, 'readonly');
  const store = tx.objectStore(STORES.COMPLETED_WORK_ORDERS);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// ==================== DAILY LOGS ====================

export async function cacheDailyLogs(logs, woId) {
  const database = getDB();
  const tx = database.transaction(STORES.DAILY_LOGS, 'readwrite');
  const store = tx.objectStore(STORES.DAILY_LOGS);
  const index = store.index('wo_id');

  // Delete existing logs for this WO (but keep unsynced local ones)
  const existingRequest = index.getAll(woId);
  
  return new Promise((resolve, reject) => {
    existingRequest.onsuccess = () => {
      const existing = existingRequest.result || [];
      
      // Delete synced logs for this WO
      existing.forEach(log => {
        if (log.synced !== false) {
          store.delete(log.log_id);
        }
      });

      // Add new logs from server
      for (const log of logs) {
        store.put({
          ...log,
          log_id: log.log_id || log.id,
          synced: true,
          cached_at: new Date().toISOString()
        });
      }
    };

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedDailyLogs(woId) {
  const database = getDB();
  const tx = database.transaction(STORES.DAILY_LOGS, 'readonly');
  const store = tx.objectStore(STORES.DAILY_LOGS);
  const index = store.index('wo_id');

  return new Promise((resolve, reject) => {
    const request = index.getAll(woId);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function addLocalDailyLog(logData) {
  const database = getDB();
  const tx = database.transaction(STORES.DAILY_LOGS, 'readwrite');
  const store = tx.objectStore(STORES.DAILY_LOGS);

  const localLog = {
    ...logData,
    log_id: `local_${Date.now()}`, // Temporary local ID
    synced: false,
    created_at: new Date().toISOString(),
    cached_at: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const request = store.add(localLog);
    request.onsuccess = () => resolve(localLog);
    request.onerror = () => reject(request.error);
  });
}

export async function getUnsyncedDailyLogs() {
  const database = getDB();
  const tx = database.transaction(STORES.DAILY_LOGS, 'readonly');
  const store = tx.objectStore(STORES.DAILY_LOGS);
  const index = store.index('synced');

  return new Promise((resolve, reject) => {
    const request = index.getAll(false);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function markLogAsSynced(localLogId, serverLogId) {
  const database = getDB();
  const tx = database.transaction(STORES.DAILY_LOGS, 'readwrite');
  const store = tx.objectStore(STORES.DAILY_LOGS);

  return new Promise((resolve, reject) => {
    const getRequest = store.get(localLogId);
    
    getRequest.onsuccess = () => {
      const log = getRequest.result;
      if (log) {
        // Delete local version
        store.delete(localLogId);
        // Add synced version with server ID
        store.put({
          ...log,
          log_id: serverLogId,
          synced: true,
          synced_at: new Date().toISOString()
        });
      }
    };

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// ==================== TEAM MEMBERS ====================

export async function cacheTeamMembers(members, woId) {
  const database = getDB();
  const tx = database.transaction(STORES.TEAM_MEMBERS, 'readwrite');
  const store = tx.objectStore(STORES.TEAM_MEMBERS);
  const index = store.index('wo_id');

  // Delete existing for this WO
  const existingRequest = index.getAll(woId);
  
  return new Promise((resolve, reject) => {
    existingRequest.onsuccess = () => {
      const existing = existingRequest.result || [];
      existing.forEach(member => {
        store.delete(member.assignment_id);
      });

      // Add new
      for (const member of members) {
        store.put({
          ...member,
          cached_at: new Date().toISOString()
        });
      }
    };

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedTeamMembers(woId) {
  const database = getDB();
  const tx = database.transaction(STORES.TEAM_MEMBERS, 'readonly');
  const store = tx.objectStore(STORES.TEAM_MEMBERS);
  const index = store.index('wo_id');

  return new Promise((resolve, reject) => {
    const request = index.getAll(woId);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// ==================== SYNC QUEUE ====================

export async function addToSyncQueue(action, data) {
  const database = getDB();
  const tx = database.transaction(STORES.SYNC_QUEUE, 'readwrite');
  const store = tx.objectStore(STORES.SYNC_QUEUE);

  const queueItem = {
    action, // 'check_in', 'check_out', 'add_comment', 'update_status', 'add_hours', etc.
    data,
    status: 'pending',
    created_at: new Date().toISOString(),
    attempts: 0
  };

  return new Promise((resolve, reject) => {
    const request = store.add(queueItem);
    request.onsuccess = () => {
      console.log(`📝 Added to sync queue: ${action}`);
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getSyncQueue() {
  const database = getDB();
  const tx = database.transaction(STORES.SYNC_QUEUE, 'readonly');
  const store = tx.objectStore(STORES.SYNC_QUEUE);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const items = request.result || [];
      // Sort by created_at to maintain order
      items.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingSyncCount() {
  const queue = await getSyncQueue();
  return queue.filter(item => item.status === 'pending').length;
}

export async function updateSyncQueueItem(id, updates) {
  const database = getDB();
  const tx = database.transaction(STORES.SYNC_QUEUE, 'readwrite');
  const store = tx.objectStore(STORES.SYNC_QUEUE);

  return new Promise((resolve, reject) => {
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      const item = getRequest.result;
      if (item) {
        store.put({
          ...item,
          ...updates,
          updated_at: new Date().toISOString()
        });
      }
    };

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeSyncQueueItem(id) {
  const database = getDB();
  const tx = database.transaction(STORES.SYNC_QUEUE, 'readwrite');
  const store = tx.objectStore(STORES.SYNC_QUEUE);

  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

export async function clearSyncedItems() {
  const database = getDB();
  const tx = database.transaction(STORES.SYNC_QUEUE, 'readwrite');
  const store = tx.objectStore(STORES.SYNC_QUEUE);

  return new Promise(async (resolve, reject) => {
    const getRequest = store.getAll();
    
    getRequest.onsuccess = () => {
      const items = getRequest.result || [];
      items.forEach(item => {
        if (item.status === 'synced') {
          store.delete(item.id);
        }
      });
    };

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// ==================== USER DATA ====================

export async function cacheUserData(key, data) {
  const database = getDB();
  const tx = database.transaction(STORES.USER_DATA, 'readwrite');
  const store = tx.objectStore(STORES.USER_DATA);

  return new Promise((resolve, reject) => {
    const request = store.put({
      key,
      data,
      cached_at: new Date().toISOString()
    });
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedUserData(key) {
  const database = getDB();
  const tx = database.transaction(STORES.USER_DATA, 'readonly');
  const store = tx.objectStore(STORES.USER_DATA);

  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result?.data);
    request.onerror = () => reject(request.error);
  });
}

// ==================== UTILITIES ====================

export async function clearAllOfflineData() {
  const database = getDB();
  const storeNames = Object.values(STORES);
  
  for (const storeName of storeNames) {
    const tx = database.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    await new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
  }
  
  console.log('🗑️ Cleared all offline data');
  return true;
}

export async function getOfflineStats() {
  const [workOrders, completed, syncQueue] = await Promise.all([
    getCachedWorkOrders(),
    getCachedCompletedWorkOrders(),
    getSyncQueue()
  ]);

  return {
    workOrdersCached: workOrders.length,
    completedCached: completed.length,
    pendingSync: syncQueue.filter(i => i.status === 'pending').length,
    failedSync: syncQueue.filter(i => i.status === 'failed').length,
    lastCached: workOrders[0]?.cached_at || null
  };
}

export function isOfflineDBReady() {
  return db !== null;
}

export { STORES };
