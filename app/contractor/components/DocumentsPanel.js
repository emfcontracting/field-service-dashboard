'use client';
// Profile → Documents: W-9, insurance certificate (COI) with expiry, license,
// contract. Files are private; "View" opens a 5-minute signed link.
import { useEffect, useState } from 'react';
import { contractorApi } from '@/lib/contractorClient';
import { DOC_TYPES, docLabel, docReminders } from '@/lib/contractorDocs';
import { fmtDate, dateKeyET } from '@/lib/dates';
import { downscaleImage } from '@/lib/imageDownscale';

const input = 'w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2';

export default function DocumentsPanel() {
  const [docs, setDocs] = useState([]);
  const [form, setForm] = useState({ doc_type: 'coi', title: '', expires_on: '' });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try { setDocs(await contractorApi.documents()); } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  const def = DOC_TYPES.find(t => t.key === form.doc_type);
  const reminders = docReminders(docs, dateKeyET());

  async function upload(e) {
    e.preventDefault();
    if (!file) { setError('Choose a file'); return; }
    setBusy(true); setError('');
    try {
      await contractorApi.uploadDocument(await downscaleImage(file), form);
      setFile(null); setForm({ ...form, title: '', expires_on: '' });
      e.target.reset?.();
      await load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function view(id) {
    const w = window.open('', '_blank');
    try { const url = await contractorApi.documentLink(id); if (w) w.location.href = url; else window.location.href = url; }
    catch (err) { if (w) w.close(); setError(err.message); }
  }

  async function remove(id) {
    if (!confirm('Delete this document?')) return;
    try { await contractorApi.deleteDocument(id); await load(); } catch (err) { setError(err.message); }
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
      <h2 className="font-bold mb-1">📁 Documents</h2>
      <p className="text-sm text-gray-400 mb-3">W-9 and insurance certificate for EMF. Private — only you and the EMF office can open them.</p>

      {reminders.map(r => (
        <p key={r.key} className={`text-sm mb-2 ${r.tone === 'red' ? 'text-red-300' : 'text-yellow-200'}`}>⚠️ {r.text}</p>
      ))}

      {docs.length > 0 && (
        <ul className="divide-y divide-gray-700 mb-4">
          {docs.map(d => {
            const expired = d.expires_on && d.expires_on < dateKeyET();
            return (
              <li key={d.doc_id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{docLabel(d.doc_type)}{d.title ? ` — ${d.title}` : ''}</p>
                  <p className={`text-xs ${expired ? 'text-red-300' : 'text-gray-500'}`}>
                    Uploaded {fmtDate(d.uploaded_at)}{d.expires_on ? ` · ${expired ? 'expired' : 'expires'} ${fmtDate(d.expires_on)}` : ''}
                  </p>
                </div>
                <div className="flex gap-3 text-sm flex-shrink-0">
                  <button onClick={() => view(d.doc_id)} className="text-blue-400 hover:text-blue-300">View</button>
                  <button onClick={() => remove(d.doc_id)} className="text-red-400 hover:text-red-300">Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={upload} className="space-y-3">
        <select className={input} value={form.doc_type} onChange={e => setForm({ ...form, doc_type: e.target.value })}>
          {DOC_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <input className={input} placeholder="Title (optional, e.g. insurer name)" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        <div>
          <label className="block text-xs text-gray-400 mb-1">Expires on{def?.needsExpiry ? ' (required)' : ' (optional)'}</label>
          <input type="date" className={input} value={form.expires_on} onChange={e => setForm({ ...form, expires_on: e.target.value })} />
        </div>
        <input type="file" accept="application/pdf,image/*" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-sm text-gray-400" />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={busy} className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-medium disabled:opacity-50">{busy ? 'Uploading…' : 'Upload document'}</button>
      </form>
    </div>
  );
}
