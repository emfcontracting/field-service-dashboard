// app/dashboard/components/CbreConfirmations.js
// Green "✓ CBRE: <Action>" badges for every Vendor App submission on this work
// order that CBRE/Smartsheet has confirmed (approval_requests.confirmed_at set
// by app/api/cbre/sync-vendor-confirmations). Renders nothing if none.
'use client';

import { useState, useEffect } from 'react';
import { ACTIONS } from '@/lib/cbreVendorForm';

export default function CbreConfirmations({ workOrder, supabase }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let alive = true;
    if (!workOrder?.wo_id || !supabase) return;
    supabase
      .from('approval_requests')
      .select('kind, confirmed_at')
      .eq('wo_id', workOrder.wo_id)
      .not('confirmed_at', 'is', null)
      .order('confirmed_at', { ascending: false })
      .then(({ data }) => { if (alive) setRows(data || []); });
    return () => { alive = false; };
  }, [workOrder?.wo_id, supabase]);

  if (!rows.length) return null;

  return (
    <>
      {rows.map((r, i) => (
        <div
          key={i}
          title={`CBRE confirmed${r.confirmed_at ? ' ' + new Date(r.confirmed_at).toLocaleString() : ''}`}
          className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-sm inline-block"
        >
          ✓ CBRE: {ACTIONS[r.kind]?.value || r.kind}
        </div>
      ))}
    </>
  );
}
