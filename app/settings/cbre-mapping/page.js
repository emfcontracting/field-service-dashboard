// app/settings/cbre-mapping/page.js
// ─────────────────────────────────────────────────────────────────────────────
// CBRE Status Mapping Editor
// Lets admins override the default CBRE status code → FSM status mapping.
// Overrides are stored in cbre_status_mappings table.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import AppShell from '@/components/AppShell';
import { DEFAULT_CBRE_MAPPING, buildEffectiveMapping } from '@/lib/cbreStatusMapping';

const supabase = getSupabase();
const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const TARGET_TYPE_OPTIONS = [
  { value: 'invoice',         label: 'Invoice Status' },
  { value: 'wo',              label: 'Work Order Status' },
  { value: 'pending_invoice', label: 'WO Completed + Pending Invoice' },
  { value: 'ignore',          label: 'Ignore (do nothing)' },
];

const INVOICE_STATUSES = ['draft', 'approved', 'accepted', 'synced', 'paid', 'rejected'];
const WO_STATUSES      = ['pending', 'assigned', 'in_progress', 'completed', 'tech_review', 'return_trip'];

export default function CbreMappingPage() {
  return (
    <AppShell activeLink="/settings">
      <CbreMappingContent />
    </AppShell>
  );
}

function CbreMappingContent() {
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [editingCode, setEditingCode] = useState(null);
  const [editForm, setEditForm]   = useState({});
  const [showAddNew, setShowAddNew] = useState(false);
  const [newForm, setNewForm]     = useState({
    cbre_code: '', cbre_label: '', target_type: 'invoice', target_status: 'draft',
    set_cmp_date: false, notes: '',
  });

  useEffect(() => { loadOverrides(); }, []);

  const loadOverrides = async () => {
    setLoading(true);
    const { data } = await supabaseClient
      .from('cbre_status_mappings')
      .select('*')
      .order('cbre_code');
    setOverrides(data || []);
    setLoading(false);
  };

  const effective = buildEffectiveMapping(overrides);
  const allCodes = Object.keys(effective).sort();

  const startEdit = (code) => {
    const eff = effective[code];
    setEditingCode(code);
    setEditForm({
      cbre_label:   eff.label || '',
      target_type:  eff.target_type,
      target_status: eff.target_status || '',
      set_cmp_date: eff.set_cmp_date || false,
      notes:        eff.notes || '',
    });
  };

  const cancelEdit = () => {
    setEditingCode(null);
    setEditForm({});
  };

  const saveEdit = async (code) => {
    const existing = overrides.find(o => o.cbre_code === code);
    const payload = {
      cbre_code: code,
      cbre_label: editForm.cbre_label,
      target_type: editForm.target_type,
      target_status: editForm.target_status,
      set_cmp_date: editForm.set_cmp_date,
      notes: editForm.notes,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await supabaseClient.from('cbre_status_mappings').update(payload).eq('id', existing.id);
    } else {
      await supabaseClient.from('cbre_status_mappings').insert(payload);
    }
    await loadOverrides();
    cancelEdit();
  };

  const resetToDefault = async (code) => {
    if (!confirm(`Reset ${code} to default mapping?`)) return;
    const existing = overrides.find(o => o.cbre_code === code);
    if (existing) {
      await supabaseClient.from('cbre_status_mappings').delete().eq('id', existing.id);
      await loadOverrides();
    }
  };

  const saveNew = async () => {
    if (!newForm.cbre_code.trim()) { alert('Code is required'); return; }
    const code = newForm.cbre_code.trim().toUpperCase();
    if (effective[code]) { alert(`Code ${code} already exists`); return; }

    await supabaseClient.from('cbre_status_mappings').insert({
      cbre_code: code,
      cbre_label: newForm.cbre_label,
      target_type: newForm.target_type,
      target_status: newForm.target_status,
      set_cmp_date: newForm.set_cmp_date,
      notes: newForm.notes,
      is_active: true,
    });
    await loadOverrides();
    setShowAddNew(false);
    setNewForm({ cbre_code: '', cbre_label: '', target_type: 'invoice', target_status: 'draft', set_cmp_date: false, notes: '' });
  };

  const getStatusOptions = (targetType) => {
    if (targetType === 'invoice') return INVOICE_STATUSES;
    if (targetType === 'wo' || targetType === 'pending_invoice') return WO_STATUSES;
    return [];
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-200 p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <a href="/settings" className="text-slate-500 hover:text-slate-300 text-xs mb-1 inline-flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Back to Settings
          </a>
          <h1 className="text-xl font-bold text-slate-100">⚙️ CBRE Status Mapping</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Configure how CBRE status codes translate to FSM statuses
          </p>
        </div>
        <button onClick={() => setShowAddNew(true)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition">
          + Add Status Code
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-sm">
        <div className="text-blue-400 font-semibold mb-1">💡 How this works</div>
        <div className="text-slate-400 text-xs space-y-1">
          <div>• <strong className="text-slate-300">Default</strong> mappings are built-in based on confirmed CBRE workflow.</div>
          <div>• Any <strong className="text-yellow-400">Override</strong> you save here replaces the default for that code.</div>
          <div>• <strong className="text-emerald-400">"Set CMP date"</strong> toggles whether this code triggers the 75-day payout countdown.</div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-500 text-sm">
          <svg className="animate-spin w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          Loading...
        </div>
      ) : (
        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-[#1e1e2e] text-xs uppercase tracking-wider text-slate-500 font-semibold">
            <div className="col-span-1">Code</div>
            <div className="col-span-3">CBRE Label</div>
            <div className="col-span-2">Target Type</div>
            <div className="col-span-2">Target Status</div>
            <div className="col-span-1 text-center">CMP Date</div>
            <div className="col-span-2">Source</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          <div className="divide-y divide-[#1e1e2e]">
            {allCodes.map(code => {
              const eff = effective[code];
              const isEditing = editingCode === code;
              const isOverride = eff.source === 'override';

              return (
                <div key={code} className="grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm hover:bg-[#1e1e2e]/30 transition">
                  <div className="col-span-1">
                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 font-mono">
                      {code}
                    </span>
                  </div>

                  {isEditing ? (
                    <>
                      <div className="col-span-3">
                        <input value={editForm.cbre_label} onChange={e => setEditForm(f => ({ ...f, cbre_label: e.target.value }))}
                          className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded px-2 py-1 text-xs text-slate-200" />
                      </div>
                      <div className="col-span-2">
                        <select value={editForm.target_type} onChange={e => setEditForm(f => ({ ...f, target_type: e.target.value, target_status: '' }))}
                          className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded px-2 py-1 text-xs text-slate-200">
                          {TARGET_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <select value={editForm.target_status} onChange={e => setEditForm(f => ({ ...f, target_status: e.target.value }))}
                          className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded px-2 py-1 text-xs text-slate-200">
                          <option value="">—</option>
                          {getStatusOptions(editForm.target_type).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="col-span-1 text-center">
                        <input type="checkbox" checked={editForm.set_cmp_date}
                          onChange={e => setEditForm(f => ({ ...f, set_cmp_date: e.target.checked }))}
                          className="w-4 h-4 accent-blue-500" />
                      </div>
                      <div className="col-span-2 text-xs text-slate-500 italic">Editing...</div>
                      <div className="col-span-1 flex justify-end gap-1">
                        <button onClick={() => saveEdit(code)}
                          className="px-2 py-1 rounded text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white">Save</button>
                        <button onClick={cancelEdit}
                          className="px-2 py-1 rounded text-[11px] font-bold bg-[#1e1e2e] border border-[#2d2d44] text-slate-300">×</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="col-span-3 text-slate-300 text-xs">{eff.label}</div>
                      <div className="col-span-2 text-slate-400 text-xs">
                        {TARGET_TYPE_OPTIONS.find(o => o.value === eff.target_type)?.label || eff.target_type}
                      </div>
                      <div className="col-span-2 text-xs">
                        <span className="px-2 py-0.5 rounded bg-slate-700/30 text-slate-300 font-mono">{eff.target_status || '—'}</span>
                      </div>
                      <div className="col-span-1 text-center text-lg">
                        {eff.set_cmp_date ? '✅' : <span className="text-slate-600">—</span>}
                      </div>
                      <div className="col-span-2">
                        {isOverride ? (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
                            Override
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700/30 text-slate-500 border border-slate-700/50">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="col-span-1 flex justify-end gap-1">
                        <button onClick={() => startEdit(code)}
                          className="px-2 py-1 rounded text-[11px] bg-[#1e1e2e] border border-[#2d2d44] text-slate-400 hover:text-slate-200">Edit</button>
                        {isOverride && (
                          <button onClick={() => resetToDefault(code)} title="Reset to default"
                            className="px-2 py-1 rounded text-[11px] bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20">↺</button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Add New Modal ── */}
      {showAddNew && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-2xl max-w-lg w-full shadow-2xl">
            <div className="px-6 py-5 border-b border-[#1e1e2e] flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold text-slate-100">Add Status Code</h2>
                <p className="text-slate-500 text-xs mt-0.5">Map a new CBRE status code to your FSM workflow</p>
              </div>
              <button onClick={() => setShowAddNew(false)} className="text-slate-500 hover:text-slate-300 text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="block text-xs text-slate-500 mb-1 font-semibold">Code</label>
                  <input value={newForm.cbre_code} onChange={e => setNewForm(f => ({ ...f, cbre_code: e.target.value.toUpperCase() }))}
                    placeholder="e.g. NEW"
                    className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-lg px-3 py-2 text-sm text-slate-200 font-mono uppercase" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500 mb-1 font-semibold">Label</label>
                  <input value={newForm.cbre_label} onChange={e => setNewForm(f => ({ ...f, cbre_label: e.target.value }))}
                    placeholder="e.g. New Status Label"
                    className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-lg px-3 py-2 text-sm text-slate-200" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-semibold">Target Type</label>
                  <select value={newForm.target_type} onChange={e => setNewForm(f => ({ ...f, target_type: e.target.value, target_status: '' }))}
                    className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-lg px-3 py-2 text-sm text-slate-200">
                    {TARGET_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-semibold">Target Status</label>
                  <select value={newForm.target_status} onChange={e => setNewForm(f => ({ ...f, target_status: e.target.value }))}
                    className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-lg px-3 py-2 text-sm text-slate-200">
                    <option value="">—</option>
                    {getStatusOptions(newForm.target_type).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="set_cmp_new" checked={newForm.set_cmp_date}
                  onChange={e => setNewForm(f => ({ ...f, set_cmp_date: e.target.checked }))}
                  className="w-4 h-4 accent-blue-500" />
                <label htmlFor="set_cmp_new" className="text-sm text-slate-300">
                  Sets CMP date (triggers 75-day payout countdown)
                </label>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1 font-semibold">Notes (optional)</label>
                <textarea value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-lg px-3 py-2 text-sm text-slate-200" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#1e1e2e] flex justify-end gap-2">
              <button onClick={() => setShowAddNew(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#1e1e2e] border border-[#2d2d44] text-slate-300">Cancel</button>
              <button onClick={saveNew}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
