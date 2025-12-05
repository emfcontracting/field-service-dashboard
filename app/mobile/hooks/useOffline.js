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
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle', 'syncing', 'success', 'error'
  const [syncError, setSyncError] = useState(null);
  
  const supabase = createClientComponentClient();
  const cleanupRef = useRef(null);

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
          // Reset status after 3 seconds
          setTimeout(() => setSyncStatus('idle'), 3000);
          break;
        case 'sync_failed':
          setSyncStatus('error');
          setSyncError(event.error);
          break;
        case 'item_synced':
          updatePendingCount();
          break;
        case 'refresh_started':
          // Optionally show refresh status
          break;
        case 'refresh_completed':
          setLastSyncTime(new Date());
          break;
      }
    });

    return removeSyncListener;
  }, []);

  // Start background sync when user is logged in
  useEffect(() => {
    if (!currentUser || !isDBReady) return;

    // Start background sync
    const cleanup = startBackgroundSync(supabase, currentUser, 30000);
    cleanupRef.current = cleanup;

    // Initial sync if online
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

  useEffect(() => {
    if (isDBReady) {
      updatePendingCount();
      const interval = setInterval(updatePendingCount, 5000);
      return () => clearInterval(interval);
    }
  }, [isDBReady, updatePendingCount]);

  // ==================== WORK ORDER OPERATIONS ====================

  // Get work orders (from cache if offline)
  const getWorkOrders = useCallback(async (forceRefresh = false) => {
    if (!isDBReady) return [];

    // If online and force refresh, get from server first
    if (isOnline && forceRefresh) {
      try {
        const { data: leadWOs } = await supabase
          .from('work_orders')
          .select(`*, lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)`)
          .eq('lead_tech_id', currentUser?.user_id)
          .in('status', ['assigned', 'in_progress', 'pending', 'needs_return', 'return_trip'])
          .order('priority', { ascending: true });

        const { data: assignments } = await supabase
          .from('work_order_assignments')
          .select('wo_id')
          .eq('user_id', currentUser?.user_id);

        let helperWOs = [];
        if (assignments?.length > 0) {
          const { data } = await supabase
            .from('work_orders')
            .select(`*, lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)`)
            .in('wo_id', assignments.map(a => a.wo_id))
            .in('status', ['assigned', 'in_progress', 'pending', 'needs_return', 'return_trip']);
          helperWOs = data || [];
        }

        const allWOs = [...(leadWOs || []), ...helperWOs];
        const uniqueWOs = Array.from(new Map(allWOs.map(wo => [wo.wo_id, wo])).values());
        
        await cacheWorkOrders(uniqueWOs);
        return uniqueWOs;
      } catch (error) {
        console.error('Failed to fetch from server, using cache:', error);
      }
    }

    // Return from cache
    return await getCachedWorkOrders();
  }, [isDBReady, isOnline, currentUser, supabase]);

  // Get completed work orders (from cache if offline)
  const getCompletedWorkOrders = useCallback(async (forceRefresh = false) => {
    if (!isDBReady) return [];

    if (isOnline && forceRefresh) {
      try {
        const { data: leadWOs } = await supabase
          .from('work_orders')
          .select(`*, lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)`)
          .eq('lead_tech_id', currentUser?.user_id)
          .eq('status', 'completed')
          .order('date_completed', { ascending: false })
          .limit(50);

        await cacheCompletedWorkOrders(leadWOs || []);
        return leadWOs || [];
      } catch (error) {
        console.error('Failed to fetch completed WOs, using cache:', error);
      }
    }

    return await getCachedCompletedWorkOrders();
  }, [isDBReady, isOnline, currentUser, supabase]);

  // ==================== OFFLINE ACTIONS ====================

  // Check In (works offline)
  const offlineCheckIn = useCallback(async (woId, gpsLocation = null) => {
    const now = new Date();
    const timestamp = now.toLocaleString();
    const isoTime = now.toISOString();

    // Update local cache immediately
    const checkInNote = `[${timestamp}] ${currentUser.first_name} ${currentUser.last_name} - ✓ CHECKED IN${!isOnline ? ' [PENDING SYNC]' : ''}`;
    
    const cachedWO = await getCachedWorkOrders().then(wos => wos.find(w => w.wo_id === woId));
    if (cachedWO) {
      const existingComments = cachedWO.comments || '';
      await updateCachedWorkOrder(woId, {
        status: 'in_progress',
        time_in: cachedWO.time_in || isoTime,
        comments: existingComments ? `${existingComments}\n\n${checkInNote}` : checkInNote
      });
    }

    if (isOnline) {
      // Try to sync immediately
      try {
        await supabase
          .from('work_orders')
          .update({
            status: 'in_progress',
            time_in: isoTime,
            comments: cachedWO ? `${cachedWO.comments || ''}\n\n${checkInNote}` : checkInNote
          })
          .eq('wo_id', woId);
        return { success: true, synced: true };
      } catch (error) {
        console.error('Online check-in failed, queuing:', error);
      }
    }

    // Queue for later sync
    await addToSyncQueue('check_in', {
      woId,
      timestamp,
      isoTime,
      gpsLocation
    });
    
    updatePendingCount();
    return { success: true, synced: false };
  }, [currentUser, isOnline, supabase, updatePendingCount]);

  // Check Out (works offline)
  const offlineCheckOut = useCallback(async (woId, gpsLocation = null) => {
    const now = new Date();
    const timestamp = now.toLocaleString();
    const isoTime = now.toISOString();

    const checkOutNote = `[${timestamp}] ${currentUser.first_name} ${currentUser.last_name} - ⏸ CHECKED OUT${!isOnline ? ' [PENDING SYNC]' : ''}`;
    
    const cachedWO = await getCachedWorkOrders().then(wos => wos.find(w => w.wo_id === woId));
    if (cachedWO) {
      const existingComments = cachedWO.comments || '';
      await updateCachedWorkOrder(woId, {
        time_out: cachedWO.time_out || isoTime,
        comments: existingComments ? `${existingComments}\n\n${checkOutNote}` : checkOutNote
      });
    }

    if (isOnline) {
      try {
        await supabase
          .from('work_orders')
          .update({
            time_out: isoTime,
            comments: cachedWO ? `${cachedWO.comments || ''}\n\n${checkOutNote}` : checkOutNote
          })
          .eq('wo_id', woId);
        return { success: true, synced: true };
      } catch (error) {
        console.error('Online check-out failed, queuing:', error);
      }
    }

    await addToSyncQueue('check_out', {
      woId,
      timestamp,
      isoTime,
      gpsLocation
    });
    
    updatePendingCount();
    return { success: true, synced: false };
  }, [currentUser, isOnline, supabase, updatePendingCount]);

  // Add Comment (works offline)
  const offlineAddComment = useCallback(async (woId, commentText) => {
    const timestamp = new Date().toLocaleString();
    const formattedComment = `[${timestamp}] ${currentUser.first_name}: ${commentText}${!isOnline ? ' [PENDING SYNC]' : ''}`;

    const cachedWO = await getCachedWorkOrders().then(wos => wos.find(w => w.wo_id === woId));
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

    await addToSyncQueue('add_comment', {
      woId,
      commentText,
      timestamp
    });
    
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

    const cachedWO = await getCachedWorkOrders().then(wos => wos.find(w => w.wo_id === woId));
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
        await supabase
          .from('work_orders')
          .update({
            status: 'completed',
            date_completed: isoTime,
            comments: cachedWO ? `${cachedWO.comments || ''}\n\n${completionNote}` : completionNote
          })
          .eq('wo_id', woId);
        return { success: true, synced: true };
      } catch (error) {
        console.error('Online completion failed, queuing:', error);
      }
    }

    await addToSyncQueue('complete_work_order', {
      woId,
      timestamp,
      isoTime
    });
    
    updatePendingCount();
    return { success: true, synced: false };
  }, [currentUser, isOnline, supabase, updatePendingCount]);

  // ==================== SYNC CONTROLS ====================

  // Force sync now
  const forceSync = useCallback(async () => {
    if (!isOnline) {
      return { success: false, reason: 'offline' };
    }
    
    setSyncStatus('syncing');
    const result = await syncPendingChanges(supabase, currentUser);
    
    if (result.success) {
      await refreshFromServer(supabase, currentUser);
    }
    
    return result;
  }, [isOnline, supabase, currentUser]);

  // Refresh data from server
  const refresh = useCallback(async () => {
    if (!isOnline) {
      return false;
    }
    return await refreshFromServer(supabase, currentUser);
  }, [isOnline, supabase, currentUser]);

  // Get offline stats
  const getStats = useCallback(async () => {
    if (!isDBReady) return null;
    return await getOfflineStats();
  }, [isDBReady]);

  // Clear all offline data (use with caution!)
  const clearOfflineData = useCallback(async () => {
    if (!isDBReady) return false;
    return await clearAllOfflineData();
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
    refresh,
    
    // Utilities
    getStats,
    clearOfflineData
  };
}
