'use client';
// Edit a draft invoice: the sub's own lines (admin hours, hotel, extra
// material, …) can be added, changed and removed; EMF lines (hours, mileage,
// tech material from the hours log) can be reloaded if the log was corrected.
// Totals are recomputed on the server (lib/subInvoiceCreate.updateDraftInvoice).
import { useState } from 'react';
import { contractorApi } from '@/lib/contractorClient';

const box = { backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '12px', padding: '16px', marginBottom: '24px' };
const inp = { backgroundColor: '#374151', border: '1px solid #4b5563', borderRadius: '8px', padding: '8px 10px', color: 'white', fontSize: '14px', width: '100%' };
const btn = (bg) => ({ padding: '8px 14px', backgroundColor: bg, borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', color: 'white', border: 'none', cursor: 'pointer' });

let seq = 0;
const row = (l) => ({ key: `r${++seq}`, description: l.description || '', quantity: String(l.quantity ?? 1), rate: String(l.rate ?? '') });

export default function DraftEditor({ invoice, items, suggestions = [], onSaved }) {
  const isEmf = invoice.client_type !== 'other';
  const [rows, setRows] = useState(() => (items || []).filter(i => i.item_type === 'custom').map(row));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const amount = (r) => (parseFloat(r.quantity) || 0) * (parseFloat(r.rate) || 0);
  const linesTotal = rows.reduce((s, r) => s + amount(r), 0);
  const set = (key, field, value) => setRows(rows.map(r => (r.key === key ? { ...r, [field]: value } : r)));
  const unused = suggestions.filter(sg => !rows.some(r => r.description.trim().toLowerCase() === sg.description.trim().toLowerCase()));

  async function save(refreshHours = false) {
    setSaving(true);
    setError('');
    try {
      await contractorApi.editInvoice(invoice.invoice_id, {
        line_items: rows
          .filter(r => r.description.trim() && amount(r) > 0)
          .map(r => ({ description: r.description.trim(), quantity: parseFloat(r.quantity) || 1, rate: parseFloat(r.rate) || 0 })),
        refresh_hours: refreshHours,
      });
      await onSaved?.();
      setOpen(false);
    } catch (e) {
      setError(e.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div className="no-print" style={{ ...box, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontWeight: 'bold', margin: 0 }}>✏️ Edit draft</p>
          <p style={{ color: '#9ca3af', fontSize: '13px', margin: '4px 0 0' }}>
            Add admin hours, hotel, extra material{isEmf ? ', or reload hours from the log' : ''}.
          </p>
        </div>
        <button onClick={() => setOpen(true)} style={btn('#2563eb')}>Edit</button>
      </div>
    );
  }

  return (
    <div className="no-print" style={box}>
      <p style={{ fontWeight: 'bold', margin: '0 0 12px' }}>✏️ Your own line items</p>

      {unused.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {unused.map(sg => (
            <button key={sg.description} onClick={() => setRows([...rows, row(sg)])}
              style={{ ...btn('#374151'), fontWeight: 'normal', fontSize: '13px' }}
              title={`From your recent invoices: ${sg.quantity} × $${sg.rate.toFixed(2)}`}>
              + {sg.description} (${sg.rate.toFixed(2)})
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 && <p style={{ color: '#9ca3af', fontSize: '13px' }}>No own line items yet.</p>}
      {rows.map(r => (
        <div key={r.key} style={{ borderBottom: '1px solid #374151', paddingBottom: '10px', marginBottom: '10px' }}>
          <input style={{ ...inp, marginBottom: '6px' }} placeholder="Description (e.g. Admin Hours)" value={r.description} onChange={e => set(r.key, 'description', e.target.value)} />
          <div style={{ display: 'grid', gridTemplateColumns: '80px 100px minmax(0,1fr) 40px', gap: '8px', alignItems: 'center' }}>
            <input style={inp} inputMode="decimal" placeholder="Qty" aria-label="Quantity" value={r.quantity} onChange={e => set(r.key, 'quantity', e.target.value)} />
            <input style={inp} inputMode="decimal" placeholder="Rate $" aria-label="Rate" value={r.rate} onChange={e => set(r.key, 'rate', e.target.value)} />
            <span style={{ textAlign: 'right', fontSize: '14px' }}>${amount(r).toFixed(2)}</span>
            <button onClick={() => setRows(rows.filter(x => x.key !== r.key))} style={{ ...btn('#7f1d1d'), padding: '8px' }} title="Remove">✕</button>
          </div>
        </div>
      ))}
      <button onClick={() => setRows([...rows, row({ quantity: 1 })])} style={{ ...btn('#374151'), marginTop: '4px' }}>+ Add line</button>

      <p style={{ marginTop: '12px', fontSize: '14px', color: '#d1d5db' }}>Own items: <strong>${linesTotal.toFixed(2)}</strong></p>
      {error && <p style={{ color: '#f87171', fontSize: '14px' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
        <button disabled={saving} onClick={() => save(false)} style={btn('#16a34a')}>{saving ? 'Saving…' : 'Save'}</button>
        {isEmf && (
          <button disabled={saving} onClick={() => save(true)} style={btn('#2563eb')}
            title="Rebuild hours, mileage and material from the hours log and your current rates">
            Save + reload hours
          </button>
        )}
        <button disabled={saving} onClick={() => setOpen(false)} style={btn('#374151')}>Cancel</button>
      </div>
    </div>
  );
}
