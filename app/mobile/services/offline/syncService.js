// syncService.js - Handles syncing offline data with Supabase
// Processes the sync queue when connection is restored

import {
  getSyncQueue,
  updateSyncQueueItem,
  removeSyncQueueItem,
  clearSyncedItems,
  getUnsyncedDailyLogs,
  markLogAsSynced,
  getCachedWorkOrder,
  cacheWorkOrders,
  cacheCompletedWorkOrders,
  cacheDailyLogs,
  getPendingSyncCount
} from './offlineService';

// Sync status events
const syncListeners = new Set();

export function addSyncListener(callback) {
  syncListeners.add(callback);
  return () => syncListeners.delete(callback);
}

function notifySyncListeners(event) {
  syncListeners.forEach(callback => callback(event));
}

// ==================== MAIN SYNC FUNCTION ====================

export async function syncPendingChanges(supabase, currentUser) {
  if (!navigator.onLine) {
    console.log('❌ Cannot sync - offline');
    return { success: false, reason: 'offline' };
  }

  const queue = await getSyncQueue();
  const pendingItems = queue.filter(item => item.status === 'pending');

  if (pendingItems.length === 0) {
    console.log('✅ Nothing to sync');
    return { success: true, synced: 0 };
  }

  console.log(`🔄 Syncing ${pendingItems.length} pending changes...`);
  notifySyncListeners({ type: 'sync_started', count: pendingItems.length });

  let syncedCount = 0;
  let failedCount = 0;
  const errors = [];

  for (const item of pendingItems) {
    try {
      await processQueueItem(supabase, item, currentUser);
      await updateSyncQueueItem(item.id, { status: 'synced' });
      syncedCount++;
      notifySyncListeners({ type: 'item_synced', item, remaining: pendingItems.length - syncedCount });
    } catch (error) {
      console.error(`❌ Failed to sync item ${item.id}:`, error);
      
      const attempts = (item.attempts || 0) + 1;
      if (attempts >= 3) {
        await updateSyncQueueItem(item.id, { 
          status: 'failed', 
          attempts,
          error: error.message 
        });
        failedCount++;
        errors.push({ item, error: error.message });
      } else {
        await updateSyncQueueItem(item.id, { attempts });
      }
    }
  }

  // Also sync unsynced daily logs
  const unsyncedLogs = await getUnsyncedDailyLogs();
  for (const log of unsyncedLogs) {
    try {
      const serverLogId = await syncDailyLog(supabase, log);
      await markLogAsSynced(log.log_id, serverLogId);
      syncedCount++;
    } catch (error) {
      console.error('❌ Failed to sync daily log:', error);
      failedCount++;
    }
  }

  // Clean up synced items
  await clearSyncedItems();

  const result = {
    success: failedCount === 0,
    synced: syncedCount,
    failed: failedCount,
    errors
  };

  console.log(`✅ Sync complete: ${syncedCount} synced, ${failedCount} failed`);
  notifySyncListeners({ type: 'sync_completed', result });

  return result;
}

// ==================== PROCESS INDIVIDUAL QUEUE ITEMS ====================

async function processQueueItem(supabase, item, currentUser) {
  const { action, data } = item;

  switch (action) {
    case 'check_in':
      return await syncCheckIn(supabase, data, currentUser);

    case 'check_out':
      return await syncCheckOut(supabase, data, currentUser);

    case 'add_comment':
      return await syncComment(supabase, data, currentUser);

    case 'update_status':
      return await syncStatusUpdate(supabase, data);

    case 'complete_work_order':
      return await syncCompleteWorkOrder(supabase, data, currentUser);

    case 'add_daily_hours':
      return await syncDailyLog(supabase, data);

    case 'update_field':
      return await syncFieldUpdate(supabase, data);

    default:
      throw new Error(`Unknown sync action: ${action}`);
  }
}

// ==================== SYNC HANDLERS ====================

async function syncCheckIn(supabase, data, currentUser) {
  const { woId, timestamp, isoTime, gpsLocation } = data;

  // Get current work order from server
  const { data: wo, error: getError } = await supabase
    .from('work_orders')
    .select('comments, time_in')
    .eq('wo_id', woId)
    .single();

  if (getError) throw getError;

  const existingComments = wo.comments || '';
  const checkInNote = `[${timestamp}] ${currentUser.first_name} ${currentUser.last_name} - ✓ CHECKED IN${gpsLocation ? ` (GPS: ${gpsLocation.latitude.toFixed(6)}, ${gpsLocation.longitude.toFixed(6)})` : ''} [SYNCED]`;
  const updatedComments = existingComments 
    ? `${existingComments}\n\n${checkInNote}`
    : checkInNote;

  const updateData = {
    comments: updatedComments,
    status: 'in_progress'
  };

  if (!wo.time_in) {
    updateData.time_in = isoTime;
  }

  const { error } = await supabase
    .from('work_orders')
    .update(updateData)
    .eq('wo_id', woId);

  if (error) throw error;
  return true;
}

async function syncCheckOut(supabase, data, currentUser) {
  const { woId, timestamp, isoTime, gpsLocation } = data;

  const { data: wo, error: getError } = await supabase
    .from('work_orders')
    .select('comments, time_out')
    .eq('wo_id', woId)
    .single();

  if (getError) throw getError;

  const existingComments = wo.comments || '';
  const checkOutNote = `[${timestamp}] ${currentUser.first_name} ${currentUser.last_name} - ⏸ CHECKED OUT${gpsLocation ? ` (GPS: ${gpsLocation.latitude.toFixed(6)}, ${gpsLocation.longitude.toFixed(6)})` : ''} [SYNCED]`;
  const updatedComments = existingComments 
    ? `${existingComments}\n\n${checkOutNote}`
    : checkOutNote;

  const updateData = {
    comments: updatedComments
  };

  if (!wo.time_out) {
    updateData.time_out = isoTime;
  }

  const { error } = await supabase
    .from('work_orders')
    .update(updateData)
    .eq('wo_id', woId);

  if (error) throw error;
  return true;
}

async function syncComment(supabase, data, currentUser) {
  const { woId, commentText, timestamp } = data;

  const { data: wo, error: getError } = await supabase
    .from('work_orders')
    .select('comments')
    .eq('wo_id', woId)
    .single();

  if (getError) throw getError;

  const existingComments = wo.comments || '';
  const updatedComments = existingComments 
    ? `${existingComments}\n\n[${timestamp}] ${currentUser.first_name}: ${commentText}`
    : `[${timestamp}] ${currentUser.first_name}: ${commentText}`;

  const { error } = await supabase
    .from('work_orders')
    .update({ comments: updatedComments })
    .eq('wo_id', woId);

  if (error) throw error;
  return true;
}

async function syncStatusUpdate(supabase, data) {
  const { woId, status } = data;

  const { error } = await supabase
    .from('work_orders')
    .update({ status })
    .eq('wo_id', woId);

  if (error) throw error;
  return true;
}

async function syncCompleteWorkOrder(supabase, data, currentUser) {
  const { woId, timestamp, isoTime } = data;

  const { data: wo, error: getError } = await supabase
    .from('work_orders')
    .select('comments')
    .eq('wo_id', woId)
    .single();

  if (getError) throw getError;

  const existingComments = wo.comments || '';
  const completionNote = `[${timestamp}] ${currentUser.first_name} ${currentUser.last_name} - ✅ WORK ORDER COMPLETED [SYNCED]`;
  const updatedComments = existingComments 
    ? `${existingComments}\n\n${completionNote}`
    : completionNote;

  const { error } = await supabase
    .from('work_orders')
    .update({
      status: 'completed',
      date_completed: isoTime,
      comments: updatedComments
    })
    .eq('wo_id', woId);

  if (error) throw error;
  return true;
}

async function syncDailyLog(supabase, data) {
  const { wo_id, user_id, assignment_id, work_date, hours_regular, hours_overtime, miles, notes } = data;

  // Check for existing entry
  const { data: existing } = await supabase
    .from('daily_hours_log')
    .select('id')
    .eq('wo_id', wo_id)
    .eq('user_id', user_id)
    .eq('work_date', work_date)
    .single();

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from('daily_hours_log')
      .update({
        hours_regular: hours_regular || 0,
        hours_overtime: hours_overtime || 0,
        miles: miles || 0,
        notes: notes || null
      })
      .eq('id', existing.id);

    if (error) throw error;
    return existing.id;
  } else {
    // Insert new
    const { data: inserted, error } = await supabase
      .from('daily_hours_log')
      .insert({
        wo_id,
        user_id,
        assignment_id: assignment_id || null,
        work_date,
        hours_regular: hours_regular || 0,
        hours_overtime: hours_overtime || 0,
        miles: miles || 0,
        notes: notes || null,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) throw error;
    return inserted.id;
  }
}

async function syncFieldUpdate(supabase, data) {
  const { woId, field, value } = data;

  const { error } = await supabase
    .from('work_orders')
    .update({ [field]: value })
    .eq('wo_id', woId);

  if (error) throw error;
  return true;
}

// ==================== REFRESH FROM SERVER ====================

export async function refreshFromServer(supabase, currentUser) {
  if (!navigator.onLine) {
    console.log('❌ Cannot refresh - offline');
    return false;
  }

  try {
    console.log('🔄 Refreshing data from server...');
    notifySyncListeners({ type: 'refresh_started' });

    // Load active work orders
    const { data: leadWOs } = await supabase
      .from('work_orders')
      .select(`
        *,
        lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)
      `)
      .eq('lead_tech_id', currentUser.user_id)
      .in('status', ['assigned', 'in_progress', 'pending', 'needs_return', 'return_trip'])
      .order('priority', { ascending: true });

    const { data: assignments } = await supabase
      .from('work_order_assignments')
      .select('wo_id')
      .eq('user_id', currentUser.user_id);

    let helperWOs = [];
    if (assignments && assignments.length > 0) {
      const woIds = assignments.map(a => a.wo_id);
      const { data: helperWOData } = await supabase
        .from('work_orders')
        .select(`
          *,
          lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)
        `)
        .in('wo_id', woIds)
        .in('status', ['assigned', 'in_progress', 'pending', 'needs_return', 'return_trip']);
      helperWOs = helperWOData || [];
    }

    const allWOs = [...(leadWOs || []), ...helperWOs];
    const uniqueWOs = Array.from(new Map(allWOs.map(wo => [wo.wo_id, wo])).values());
    await cacheWorkOrders(uniqueWOs);

    // Load completed work orders
    const { data: completedLeadWOs } = await supabase
      .from('work_orders')
      .select(`
        *,
        lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)
      `)
      .eq('lead_tech_id', currentUser.user_id)
      .eq('status', 'completed')
      .order('date_completed', { ascending: false })
      .limit(50);

    let completedHelperWOs = [];
    if (assignments && assignments.length > 0) {
      const woIds = assignments.map(a => a.wo_id);
      const { data } = await supabase
        .from('work_orders')
        .select(`
          *,
          lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)
        `)
        .in('wo_id', woIds)
        .eq('status', 'completed')
        .limit(50);
      completedHelperWOs = data || [];
    }

    const allCompletedWOs = [...(completedLeadWOs || []), ...completedHelperWOs];
    const uniqueCompletedWOs = Array.from(new Map(allCompletedWOs.map(wo => [wo.wo_id, wo])).values());
    await cacheCompletedWorkOrders(uniqueCompletedWOs);

    // Cache daily logs for each work order
    for (const wo of uniqueWOs) {
      const { data: logs } = await supabase
        .from('daily_hours_log')
        .select(`
          *,
          user:users(first_name, last_name)
        `)
        .eq('wo_id', wo.wo_id)
        .order('work_date', { ascending: false });

      if (logs) {
        await cacheDailyLogs(logs, wo.wo_id);
      }
    }

    console.log('✅ Data refreshed from server');
    notifySyncListeners({ type: 'refresh_completed' });
    return true;

  } catch (error) {
    console.error('❌ Failed to refresh from server:', error);
    notifySyncListeners({ type: 'refresh_failed', error: error.message });
    return false;
  }
}

// ==================== CONFLICT DETECTION ====================

export async function checkForConflicts(supabase, woId) {
  const cachedWO = await getCachedWorkOrder(woId);
  if (!cachedWO || !cachedWO.locally_modified) {
    return null; // No conflict possible
  }

  const { data: serverWO, error } = await supabase
    .from('work_orders')
    .select('*')
    .eq('wo_id', woId)
    .single();

  if (error) {
    throw error;
  }

  // Check if server version is newer than cached
  const serverTime = new Date(serverWO.updated_at || serverWO.time_out || serverWO.time_in);
  const cachedTime = new Date(cachedWO.cached_at);

  if (serverTime > cachedTime) {
    return {
      type: 'server_newer',
      cachedWO,
      serverWO,
      message: 'This work order was modified on another device'
    };
  }

  return null;
}

// ==================== AUTO-SYNC ON RECONNECT ====================

let autoSyncEnabled = true;
let syncInProgress = false;

export function enableAutoSync() {
  autoSyncEnabled = true;
}

export function disableAutoSync() {
  autoSyncEnabled = false;
}

export function isAutoSyncEnabled() {
  return autoSyncEnabled;
}

export async function startBackgroundSync(supabase, currentUser, intervalMs = 30000) {
  // Initial sync when connection is restored
  const handleOnline = async () => {
    if (!autoSyncEnabled || syncInProgress) return;
    
    console.log('🌐 Connection restored - starting sync...');
    syncInProgress = true;
    
    try {
      await syncPendingChanges(supabase, currentUser);
      await refreshFromServer(supabase, currentUser);
    } finally {
      syncInProgress = false;
    }
  };

  window.addEventListener('online', handleOnline);

  // Periodic sync while online
  const intervalId = setInterval(async () => {
    if (!autoSyncEnabled || syncInProgress || !navigator.onLine) return;
    
    const pendingCount = await getPendingSyncCount();
    if (pendingCount > 0) {
      console.log(`🔄 Background sync: ${pendingCount} pending changes`);
      syncInProgress = true;
      try {
        await syncPendingChanges(supabase, currentUser);
      } finally {
        syncInProgress = false;
      }
    }
  }, intervalMs);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    clearInterval(intervalId);
  };
}

export { getPendingSyncCount };
