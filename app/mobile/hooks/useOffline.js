// useOffline.js - Hook for offline-first functionality
// Manages online/offline state, sync queue, and cached data

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  initOfflineDB,
  isOfflineDBReady,
  getCachedWorkOrders,
  getCachedCompletedWorkOrders,
  getCachedDailyLogs,
  getCachedTeamMembers,
  cacheWorkOrders,
  cacheCompletedWorkOrders,
  cacheDailyLogs,
  cacheTeamMembers,
  updateCachedWorkOrder,
  addToSyncQueue,
  addLocalDailyLog,
  getOfflineStats,
  clearAllOfflineData
} from '../services/offline/offlineService';
import {
  syncPendingChanges,
  refreshFromServer,
  addSyncListener,
  startBackgroundSync,
  getPendingSyncCount
} from '../services/offline/syncService';

export function useOffline(currentUser) {
  const [isOnline, setIsOnline] = useState(true);
  const [isDBReady, setIsDBReady] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle', 'syncing', 'success', 'error', 'downloading'
  const [syncError, setSyncError] = useState(null);
  const [cachedCount, setCachedCount] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const supabase = createClientComponentClient();
  const cleanupRef = useRef(null);
  const hasInitialDownload = useRef(false);

  // Initialize offline DB
  useEffect(() => {
    async function init() {
      try {
        await initOfflineDB();
        setIsDBReady(true);
        console.log('✅ Offline mode initialized');
      } catch (error) {
        console.error('❌ Failed to initialize offline DB:', error);
      }
    }
    init();
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Online');
      setIsOnline(true);
    };

    const handleOffline = () => {
      console.log('📴 Offline');
      setIsOnline(false);
    };

    // Set initial state
    setIsOnline(navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen for sync events
  useEffect(() => {
    const removeSyncListener = addSyncListener((event) => {
      switch (event.type) {
        case 'sync_started':
          setSyncStatus('syncing');
          break;
        case 'sync_completed':
          setSyncStatus(event.result.success ? 'success' : 'error');
          setLastSyncTime(new Date());
          updatePendingCount();
          if (!event.result.success) {
            setSyncError(`${event.result.failed} items failed to sync`);
          }
          setTimeout(() => setSyncStatus('idle'), 3000);
          break;
        case 'sync_failed':
          setSyncStatus('error');
          setSyncError(event.error);
          break;
        case 'item_synced':
          updatePendingCount();
          break;
        case 'refresh_completed':
          setLastSyncTime(new Date());
          break;
      }
    });

    return removeSyncListener;
  }, []);

  // ==================== AUTO-DOWNLOAD ON LOGIN ====================
  // Automatically download work orders when user logs in and is online
  useEffect(() => {
    if (!currentUser || !isDBReady || !isOnline || hasInitialDownload.current) return;

    async function autoDownload() {
      console.log('📥 Auto-downloading work orders for offline use...');
      hasInitialDownload.current = true;
      
      try {
        await downloadForOffline();
      } catch (error) {
        console.error('Auto-download failed:', error);
      }
    }

    // Small delay to let the app settle
    const timer = setTimeout(autoDownload, 2000);
    return () => clearTimeout(timer);
  }, [currentUser, isDBReady, isOnline]);

  // Start background sync when user is logged in
  useEffect(() => {
    if (!currentUser || !isDBReady) return;

    const cleanup = startBackgroundSync(supabase, currentUser, 30000);
    cleanupRef.current = cleanup;

    if (navigator.onLine) {
      syncPendingChanges(supabase, currentUser);
    }

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, [currentUser, isDBReady]);

  // Update pending sync count
  const updatePendingCount = useCallback(async () => {
    if (!isDBReady) return;
    const count = await getPendingSyncCount();
    setPendingSyncCount(count);
  }, [isDBReady]);

  // Update cached count
  const updateCachedCount = useCallback(async () => {
    if (!isDBReady) return;
    try {
      const cached = await getCachedWorkOrders();
      setCachedCount(cached.length);
    } catch (e) {
      setCachedCount(0);
    }
  }, [isDBReady]);

  useEffect(() => {
    if (isDBReady) {
      updatePendingCount();
      updateCachedCount();
      const interval = setInterval(() => {
        updatePendingCount();
        updateCachedCount();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isDBReady, updatePendingCount, updateCachedCount]);

  // ==================== MANUAL DOWNLOAD FOR OFFLINE ====================
  const downloadForOffline = useCallback(async () => {
    if (!isOnline) {
      return { success: false, reason: 'offline', message: 'Cannot download while offline' };
    }

    if (!currentUser) {
      return { success: false, reason: 'no_user', message: 'Not logged in' };
    }

    setIsDownloading(true);
    setSyncStatus('downloading');

    try {
      console.log('📥 Downloading work orders for offline use...');

      // 1. Fetch active work orders
      const { data: leadWOs, error: leadError } = await supabase
        .from('work_orders')
        .select(`
          *,
          lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)
        `)
        .eq('lead_tech_id', currentUser.user_id)
        .in('status', ['assigned', 'in_progress', 'pending', 'needs_return', 'return_trip'])
        .order('priority', { ascending: true });

      if (leadError) throw leadError;

      // 2. Fetch assignments where user is helper
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

      // Combine and dedupe
      const allWOs = [...(leadWOs || []), ...helperWOs];
      const uniqueWOs = Array.from(new Map(allWOs.map(wo => [wo.wo_id, wo])).values());

      // 3. Cache active work orders
      await cacheWorkOrders(uniqueWOs);
      console.log(`✅ Cached ${uniqueWOs.length} active work orders`);

      // 4. Fetch and cache completed work orders
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
      console.log(`✅ Cached ${uniqueCompletedWOs.length} completed work orders`);

      // 5. Cache daily logs for each active work order
      for (const wo of uniqueWOs) {
        const { data: logs } = await supabase
          .from('daily_hours_log')
          .select(`
            *,
            user:users(first_name, last_name)
          `)
          .eq('wo_id', wo.wo_id)
          .order('work_date', { ascending: false });

        if (logs && logs.length > 0) {
          await cacheDailyLogs(logs, wo.wo_id);
        }
      }

      // 6. Cache team members for each active work order
      for (const wo of uniqueWOs) {
        const { data: team } = await supabase
          .from('work_order_assignments')
          .select(`
            *,
            user:users(first_name, last_name, role)
          `)
          .eq('wo_id', wo.wo_id);

        if (team && team.length > 0) {
          await cacheTeamMembers(team, wo.wo_id);
        }
      }

      setLastSyncTime(new Date());
      setCachedCount(uniqueWOs.length);
      setSyncStatus('success');
      
      console.log('✅ Download complete!');
      
      setTimeout(() => setSyncStatus('idle'), 3000);

      return { 
        success: true, 
        activeCount: uniqueWOs.length,
        completedCount: uniqueCompletedWOs.length,
        message: `Downloaded ${uniqueWOs.length} work orders for offline use`
      };

    } catch (error) {
      console.error('❌ Download failed:', error);
      setSyncStatus('error');
      setSyncError(error.message);
      return { success: false, reason: 'error', message: error.message };
    } finally {
      setIsDownloading(false);
    }
  }, [isOnline, currentUser, supabase]);

  // ==================== GET WORK ORDERS (OFFLINE-FIRST) ====================
  const getWorkOrders = useCallback(async (forceRefresh = false) => {
    if (!isDBReady) return [];

    // If online and force refresh, download fresh data
    if (isOnline && forceRefresh) {
      await downloadForOffline();
    }

    // Return from cache
    try {
      return await getCachedWorkOrders();
    } catch (error) {
      console.error('Failed to get cached work orders:', error);
      return [];
    }
  }, [isDBReady, isOnline, downloadForOffline]);

  // Get completed work orders (from cache)
  const getCompletedWorkOrders = useCallback(async () => {
    if (!isDBReady) return [];

    try {
      return await getCachedCompletedWorkOrders();
    } catch (error) {
      console.error('Failed to get cached completed work orders:', error);
      return [];
    }
  }, [isDBReady]);

  // ==================== OFFLINE ACTIONS ====================

  // Check In (works offline)
  const offlineCheckIn = useCallback(async (woId, gpsLocation = null) => {
    const now = new Date();
    const timestamp = now.toLocaleString();
    const isoTime = now.toISOString();

    const checkInNote = `[${timestamp}] ${currentUser.first_name} ${currentUser.last_name} - ✓ CHECKED IN${!isOnline ? ' [PENDING SYNC]' : ''}`;
    
    const cachedWOs = await getCachedWorkOrders();
    const cachedWO = cachedWOs.find(w => w.wo_id === woId);
    
    if (cachedWO) {
      const existingComments = cachedWO.comments || '';
      await updateCachedWorkOrder(woId, {
        status: 'in_progress',
        time_in: cachedWO.time_in || isoTime,
        comments: existingComments ? `${existingComments}\n\n${checkInNote}` : checkInNote
      });
    }

    if (isOnline) {
      try {
        const { data: wo } = await supabase
          .from('work_orders')
          .select('comments, time_in')
          .eq('wo_id', woId)
          .single();

        await supabase
          .from('work_orders')
          .update({
            status: 'in_progress',
            time_in: wo?.time_in || isoTime,
            comments: wo?.comments ? `${wo.comments}\n\n${checkInNote}` : checkInNote
          })
          .eq('wo_id', woId);
        return { success: true, synced: true };
      } catch (error) {
        console.error('Online check-in failed, queuing:', error);
      }
    }

    await addToSyncQueue('check_in', { woId, timestamp, isoTime, gpsLocation });
    updatePendingCount();
    return { success: true, synced: false };
  }, [currentUser, isOnline, supabase, updatePendingCount]);

  // Check Out (works offline)
  const offlineCheckOut = useCallback(async (woId, gpsLocation = null) => {
    const now = new Date();
    const timestamp = now.toLocaleString();
    const isoTime = now.toISOString();

    const checkOutNote = `[${timestamp}] ${currentUser.first_name} ${currentUser.last_name} - ⏸ CHECKED OUT${!isOnline ? ' [PENDING SYNC]' : ''}`;
    
    const cachedWOs = await getCachedWorkOrders();
    const cachedWO = cachedWOs.find(w => w.wo_id === woId);
    
    if (cachedWO) {
      const existingComments = cachedWO.comments || '';
      await updateCachedWorkOrder(woId, {
        time_out: cachedWO.time_out || isoTime,
        comments: existingComments ? `${existingComments}\n\n${checkOutNote}` : checkOutNote
      });
    }

    if (isOnline) {
      try {
        const { data: wo } = await supabase
          .from('work_orders')
          .select('comments, time_out')
          .eq('wo_id', woId)
          .single();

        await supabase
          .from('work_orders')
          .update({
            time_out: wo?.time_out || isoTime,
            comments: wo?.comments ? `${wo.comments}\n\n${checkOutNote}` : checkOutNote
          })
          .eq('wo_id', woId);
        return { success: true, synced: true };
      } catch (error) {
        console.error('Online check-out failed, queuing:', error);
      }
    }

    await addToSyncQueue('check_out', { woId, timestamp, isoTime, gpsLocation });
    updatePendingCount();
    return { success: true, synced: false };
  }, [currentUser, isOnline, supabase, updatePendingCount]);

  // Add Comment (works offline)
  const offlineAddComment = useCallback(async (woId, commentText) => {
    const timestamp = new Date().toLocaleString();
    const formattedComment = `[${timestamp}] ${currentUser.first_name}: ${commentText}${!isOnline ? ' [PENDING SYNC]' : ''}`;

    const cachedWOs = await getCachedWorkOrders();
    const cachedWO = cachedWOs.find(w => w.wo_id === woId);
    
    if (cachedWO) {
      const existingComments = cachedWO.comments || '';
      await updateCachedWorkOrder(woId, {
        comments: existingComments ? `${existingComments}\n\n${formattedComment}` : formattedComment
      });
    }

    if (isOnline) {
      try {
        const { data: wo } = await supabase
          .from('work_orders')
          .select('comments')
          .eq('wo_id', woId)
          .single();
        
        await supabase
          .from('work_orders')
          .update({
            comments: wo?.comments ? `${wo.comments}\n\n${formattedComment}` : formattedComment
          })
          .eq('wo_id', woId);
        return { success: true, synced: true };
      } catch (error) {
        console.error('Online comment failed, queuing:', error);
      }
    }

    await addToSyncQueue('add_comment', { woId, commentText, timestamp });
    updatePendingCount();
    return { success: true, synced: false };
  }, [currentUser, isOnline, supabase, updatePendingCount]);

  // Update Status (works offline)
  const offlineUpdateStatus = useCallback(async (woId, status) => {
    await updateCachedWorkOrder(woId, { status });

    if (isOnline) {
      try {
        await supabase
          .from('work_orders')
          .update({ status })
          .eq('wo_id', woId);
        return { success: true, synced: true };
      } catch (error) {
        console.error('Online status update failed, queuing:', error);
      }
    }

    await addToSyncQueue('update_status', { woId, status });
    updatePendingCount();
    return { success: true, synced: false };
  }, [isOnline, supabase, updatePendingCount]);

  // Add Daily Hours (works offline)
  const offlineAddDailyHours = useCallback(async (hoursData) => {
    const localLog = await addLocalDailyLog(hoursData);

    if (isOnline) {
      try {
        const { data, error } = await supabase
          .from('daily_hours_log')
          .insert({
            wo_id: hoursData.wo_id,
            user_id: hoursData.user_id,
            assignment_id: hoursData.assignment_id || null,
            work_date: hoursData.work_date,
            hours_regular: hoursData.hours_regular || 0,
            hours_overtime: hoursData.hours_overtime || 0,
            miles: hoursData.miles || 0,
            notes: hoursData.notes || null,
            created_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (!error && data) {
          return { success: true, synced: true, logId: data.id };
        }
      } catch (error) {
        console.error('Online hours failed, queuing:', error);
      }
    }

    await addToSyncQueue('add_daily_hours', hoursData);
    updatePendingCount();
    return { success: true, synced: false, logId: localLog.log_id };
  }, [isOnline, supabase, updatePendingCount]);

  // Complete Work Order (works offline)
  const offlineCompleteWorkOrder = useCallback(async (woId) => {
    const now = new Date();
    const timestamp = now.toLocaleString();
    const isoTime = now.toISOString();

    const completionNote = `[${timestamp}] ${currentUser.first_name} ${currentUser.last_name} - ✅ WORK ORDER COMPLETED${!isOnline ? ' [PENDING SYNC]' : ''}`;

    const cachedWOs = await getCachedWorkOrders();
    const cachedWO = cachedWOs.find(w => w.wo_id === woId);
    
    if (cachedWO) {
      const existingComments = cachedWO.comments || '';
      await updateCachedWorkOrder(woId, {
        status: 'completed',
        date_completed: isoTime,
        comments: existingComments ? `${existingComments}\n\n${completionNote}` : completionNote
      });
    }

    if (isOnline) {
      try {
        const { data: wo } = await supabase
          .from('work_orders')
          .select('comments')
          .eq('wo_id', woId)
          .single();

        await supabase
          .from('work_orders')
          .update({
            status: 'completed',
            date_completed: isoTime,
            comments: wo?.comments ? `${wo.comments}\n\n${completionNote}` : completionNote
          })
          .eq('wo_id', woId);
        return { success: true, synced: true };
      } catch (error) {
        console.error('Online completion failed, queuing:', error);
      }
    }

    await addToSyncQueue('complete_work_order', { woId, timestamp, isoTime });
    updatePendingCount();
    return { success: true, synced: false };
  }, [currentUser, isOnline, supabase, updatePendingCount]);

  // ==================== SYNC CONTROLS ====================

  const forceSync = useCallback(async () => {
    if (!isOnline) {
      return { success: false, reason: 'offline' };
    }
    
    setSyncStatus('syncing');
    const result = await syncPendingChanges(supabase, currentUser);
    
    if (result.success) {
      await downloadForOffline(); // Re-download fresh data
    }
    
    return result;
  }, [isOnline, supabase, currentUser, downloadForOffline]);

  // Get offline stats
  const getStats = useCallback(async () => {
    if (!isDBReady) return null;
    return await getOfflineStats();
  }, [isDBReady]);

  // Clear all offline data
  const clearOfflineData = useCallback(async () => {
    if (!isDBReady) return false;
    const result = await clearAllOfflineData();
    setCachedCount(0);
    return result;
  }, [isDBReady]);

  return {
    // Connection status
    isOnline,
    isOfflineReady: isDBReady,
    
    // Sync status
    pendingSyncCount,
    lastSyncTime,
    syncStatus,
    syncError,
    cachedCount,
    isDownloading,
    
    // Work order operations (offline-capable)
    getWorkOrders,
    getCompletedWorkOrders,
    offlineCheckIn,
    offlineCheckOut,
    offlineAddComment,
    offlineUpdateStatus,
    offlineAddDailyHours,
    offlineCompleteWorkOrder,
    
    // Sync controls
    forceSync,
    downloadForOffline,  // <-- MANUAL DOWNLOAD BUTTON
    
    // Utilities
    getStats,
    clearOfflineData
  };
}
