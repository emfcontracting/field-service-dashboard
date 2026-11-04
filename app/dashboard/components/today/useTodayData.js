// app/dashboard/components/today/useTodayData.js
// ─────────────────────────────────────────────────────────────────────────────
// Loads what the Today theme needs on top of the open work-order list the
// dashboard already holds, and hands back the finished model (todayModel.js).
//
//   invoices   every invoice that is not paid, with its work order — these are
//              the Invoice / Invoiced columns and the money strip's right half
//   approvals  approval_requests still pending/approved: CBRE forms in the
//              office's hands
//   disputes   work orders waiting on a sub work order (dataFetchers keeps
//              them out of the open list, so they are fetched here)
//   timeLog    today's check-ins/outs → who is in the field right now
//   doneToday  what got finished today, for the right rail
//
// Re-fetched whenever the open list changes (every save in the detail modal
// triggers refreshWorkOrders, and this follows), and every 2 minutes while a
// Today view is on screen, so the crew rail stays live.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchAll } from '@/lib/fetchAll';
import { INVOICE_WO_SELECT } from '@/lib/invoiceReadiness';
import { startOfDayET } from '@/lib/dates';
import { buildTodayModel } from './todayModel';

const INVOICE_SELECT = `invoice_id, invoice_number, wo_id, status, total, created_at, invoice_date, paid_at,
  qb_invoice_number, qb_invoice_id, quickbooks_invoice_id,
  work_order:work_orders!inner(building, priority, date_entered, cbre_posting_status, archived_at,
    lead_tech:users!lead_tech_id(first_name, last_name), ${INVOICE_WO_SELECT})`;

const EMPTY = { invoices: [], approvals: [], disputes: [], timeLog: [], doneToday: { completed: 0, invoicesCreated: 0, invoicesPaid: 0, confirmed: 0, checkIns: 0 } };

export function useTodayData(supabase, workOrders, users, { enabled = true } = {}) {
  const [extra, setExtra] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => { if (!document.hidden) setTick((t) => t + 1); }, 120000);
    return () => clearInterval(id);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !supabase) return;
    if (inFlight.current) return;
    let cancelled = false;
    inFlight.current = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const dayStart = startOfDayET(new Date()).toISOString();
        const [invoices, approvals, disputes, timeLog, doneWos, invToday, paidToday, confirmedToday] = await Promise.all([
          fetchAll(() => supabase.from('invoices').select(INVOICE_SELECT)
            .in('status', ['draft', 'approved', 'accepted', 'synced', 'rejected'])
            .is('paid_at', null)
            .neq('work_order.status', 'cancelled')
            .is('work_order.archived_at', null)
            .order('created_at', { ascending: false }).order('invoice_id')),
          fetchAll(() => supabase.from('approval_requests').select('approval_id, kind, wo_id, wo_number, status, created_at')
            .in('status', ['pending', 'approved']).order('created_at', { ascending: true }).order('approval_id')),
          fetchAll(() => supabase.from('work_orders').select('wo_id, wo_number, building, nte, dispute_status, dispute_requested_at, dispute_sub_wo, date_entered, priority')
            .eq('dispute_status', 'sub_wo_requested').is('dispute_sub_wo', null).is('archived_at', null).order('dispute_requested_at').order('wo_id')),
          // 36 h, not just today: a check-in from last evening with no
          // check-out is still "in the field" at 07:00, and a week-old one is
          // noise we do not want.
          fetchAll(() => supabase.from('work_order_time_log').select('wo_id, user_id, event_type, created_at')
            .gte('created_at', new Date(Date.now() - 36 * 3600 * 1000).toISOString()).order('created_at', { ascending: true }).order('log_id')),
          supabase.from('work_orders').select('wo_id', { count: 'exact', head: true }).eq('status', 'completed').gte('date_completed', dayStart.slice(0, 10)),
          supabase.from('invoices').select('invoice_id', { count: 'exact', head: true }).gte('created_at', dayStart),
          supabase.from('invoices').select('invoice_id', { count: 'exact', head: true }).gte('paid_at', dayStart),
          supabase.from('approval_requests').select('approval_id', { count: 'exact', head: true }).gte('confirmed_at', dayStart),
        ]);
        if (cancelled) return;
        const checkIns = new Set((timeLog || []).filter((e) => e.event_type === 'check_in' && e.created_at >= dayStart).map((e) => e.user_id)).size;
        setExtra({
          invoices: invoices || [], approvals: approvals || [], disputes: disputes || [], timeLog: timeLog || [],
          doneToday: {
            completed: doneWos.count || 0, invoicesCreated: invToday.count || 0, invoicesPaid: paidToday.count || 0,
            confirmed: confirmedToday.count || 0, checkIns,
          },
        });
      } catch (e) {
        if (!cancelled) { console.error('useTodayData:', e); setError(e.message || String(e)); }
      } finally {
        inFlight.current = false;
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; inFlight.current = false; };
  }, [enabled, supabase, workOrders, tick]);

  const model = useMemo(
    () => buildTodayModel({ workOrders: workOrders || [], users: users || [], ...extra }),
    [workOrders, users, extra],
  );

  return { ...model, loading, error, refresh: () => setTick((t) => t + 1) };
}

export default useTodayData;
