// lib/ntePrintTemplate.js
// ─────────────────────────────────────────────────────────────────────────────
// SHARED print template for NTE Increase Requests (mobile + dashboard).
// Replaces the previously duplicated inline HTML in the mobile ticket view
// and WorkOrderDetailModal — one layout, maintained once.
//
// Layout (what CBRE scrutinizes first sits high and large):
//   EMF header → client marker bar (CBRE green / UPS brown-gold)
//   → title + status/on-site badges
//   → WO Information
//   → FINDINGS & SCOPE OF WORK  (prominent: findings / work required /
//     parts & materials / material line items / site photo)
//   → Cost Breakdown (additional work — final figures only, markup is
//     baked in and NEVER labeled on client-facing documents)
//   → NTE Summary (highlighted "NEW NTE REQUIRED")
//   → footer
//
// Chain awareness matches the dashboard card logic: a follow-up increase
// (sequence_number > 1 or supersedes_quote_id set) baselines off the
// previous ceiling (original_nte), a first increase off accrued costs.
// ─────────────────────────────────────────────────────────────────────────────

import { getClientType, CLIENT_STYLES } from './clientType';

const money = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n)
    ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';
};

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const nl2br = (s) => esc(s).replace(/\r?\n/g, '<br>');

const fmtEastern = (iso) => {
  if (!iso) return 'N/A';
  try {
    return new Date(iso).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }) + ' ET';
  } catch {
    return 'N/A';
  }
};

export function buildNtePrintHTML({ workOrder, quote, materials = [] }) {
  const wo = workOrder || {};
  const q = quote || {};

  const clientType = getClientType(wo);
  const style = clientType ? CLIENT_STYLES[clientType] : null;
  const bandBg = style ? style.bgHex : '#374151';
  const bandText = style ? style.textHex : '#FFFFFF';
  const accent = style ? style.bgHex : '#1f2937';

  const isFollowUp = (q.sequence_number || 1) > 1 || !!q.supersedes_quote_id;
  const isVerbal = !!q.is_verbal_nte;
  const status = q.nte_status || (isVerbal ? 'verbal_approved' : 'pending');

  const creatorName = q.creator
    ? `${q.creator.first_name || ''} ${q.creator.last_name || ''}`.trim()
    : '';

  const hasStructured =
    (q.troubleshooting_findings && q.troubleshooting_findings.trim()) ||
    (q.work_required && q.work_required.trim()) ||
    (q.parts_materials && q.parts_materials.trim());

  // ── badges ────────────────────────────────────────────────────────────────
  const typeBadge = isVerbal
    ? `<span class="badge badge-verbal">VERBAL NTE — Approved by: ${esc(q.verbal_approved_by || 'N/A')}</span>`
    : `<span class="badge badge-written">WRITTEN NTE REQUEST</span>`;

  const statusLabels = {
    pending: 'PENDING',
    submitted: 'SUBMITTED TO CBRE',
    approved: 'APPROVED',
    verbal_approved: 'VERBALLY APPROVED',
    rejected: 'REJECTED'
  };
  const statusBadge = `<span class="badge badge-status">${statusLabels[status] || esc(status)}</span>`;

  let onSiteBadge = '';
  if (q.is_on_site === true) {
    onSiteBadge = `<span class="badge badge-onsite">● TECHNICIAN ON SITE</span>`;
  } else if (q.is_on_site === false) {
    onSiteBadge = `<span class="badge badge-offsite">○ OFF SITE — ESTIMATE / RETURN VISIT</span>`;
  }

  // ── findings & scope block ────────────────────────────────────────────────
  let scopeHTML = '';
  if (hasStructured) {
    scopeHTML = `
      ${q.troubleshooting_findings ? `
        <div class="scope-block">
          <div class="scope-label">Troubleshooting Findings — What Was Found On Site</div>
          <div class="scope-text">${nl2br(q.troubleshooting_findings)}</div>
        </div>` : ''}
      ${q.work_required ? `
        <div class="scope-block">
          <div class="scope-label">Work Required / Next Steps</div>
          <div class="scope-text">${nl2br(q.work_required)}</div>
        </div>` : ''}
      ${q.parts_materials ? `
        <div class="scope-block">
          <div class="scope-label">Parts &amp; Materials Needed</div>
          <div class="scope-text">${nl2br(q.parts_materials)}</div>
        </div>` : ''}
    `;
  } else if (q.description) {
    scopeHTML = `
      <div class="scope-block">
        <div class="scope-label">Description of Additional Work</div>
        <div class="scope-text">${nl2br(q.description)}</div>
      </div>
    `;
  } else {
    scopeHTML = `<div class="scope-block"><div class="scope-text muted">No description provided.</div></div>`;
  }

  // Material line items: descriptions and quantities only — unit costs are
  // internal and never shown on client-facing documents.
  const materialsRows = (materials || [])
    .filter(m => m && m.description)
    .map(m => `
      <tr>
        <td>${esc(m.description)}</td>
        <td class="num">${esc(m.quantity != null ? m.quantity : 1)}</td>
      </tr>`)
    .join('');

  const materialsTable = materialsRows
    ? `
      <div class="scope-block">
        <div class="scope-label">Material Line Items</div>
        <table class="mat-table">
          <thead><tr><th>Description</th><th class="num">Qty</th></tr></thead>
          <tbody>${materialsRows}</tbody>
        </table>
      </div>`
    : '';

  const photoBlock = q.photo_url
    ? `
      <div class="scope-block">
        <div class="scope-label">Site Photo — Attached at Submission${q.is_on_site === true ? ' (Technician On Site)' : ''}</div>
        <img class="site-photo" src="${esc(q.photo_url)}" alt="Site photo">
        ${q.photo_uploaded_at ? `<div class="photo-meta">Uploaded: ${esc(fmtEastern(q.photo_uploaded_at))}</div>` : ''}
      </div>`
    : '';

  // ── cost breakdown (additional work, final figures) ───────────────────────
  const techs = parseInt(q.estimated_techs) || 1;
  const rtHrs = parseFloat(q.estimated_rt_hours) || 0;
  const otHrs = parseFloat(q.estimated_ot_hours) || 0;
  const miles = parseFloat(q.estimated_miles) || 0;

  const costRows = [];
  costRows.push(`
    <tr>
      <td>Labor — ${techs} technician${techs === 1 ? '' : 's'}, ${rtHrs.toFixed(2)} RT hrs / ${otHrs.toFixed(2)} OT hrs per tech</td>
      <td class="num">$${money(q.labor_total)}</td>
    </tr>`);
  if ((parseFloat(q.materials_with_markup) || 0) > 0) {
    costRows.push(`<tr><td>Materials</td><td class="num">$${money(q.materials_with_markup)}</td></tr>`);
  }
  if ((parseFloat(q.equipment_with_markup) || 0) > 0) {
    costRows.push(`<tr><td>Equipment</td><td class="num">$${money(q.equipment_with_markup)}</td></tr>`);
  }
  if ((parseFloat(q.rental_with_markup) || 0) > 0) {
    costRows.push(`<tr><td>Rental</td><td class="num">$${money(q.rental_with_markup)}</td></tr>`);
  }
  if ((parseFloat(q.trailer_with_markup) || 0) > 0) {
    costRows.push(`<tr><td>Trailer</td><td class="num">$${money(q.trailer_with_markup)}</td></tr>`);
  }
  if ((parseFloat(q.mileage_total) || 0) > 0) {
    costRows.push(`<tr><td>Mileage — ${miles.toFixed(1)} mi round trip</td><td class="num">$${money(q.mileage_total)}</td></tr>`);
  }

  // ── NTE summary ───────────────────────────────────────────────────────────
  const summaryRows = isFollowUp
    ? `
      <tr><td>Previous NTE Ceiling</td><td class="num">$${money(q.original_nte)}</td></tr>
      <tr><td>This Request — Additional Work</td><td class="num">+ $${money(q.grand_total)}</td></tr>`
    : `
      <tr><td>Original NTE</td><td class="num">$${money(q.original_nte)}</td></tr>
      <tr><td>Costs Accrued at Submission</td><td class="num">$${money(q.current_costs_snapshot)}</td></tr>
      <tr><td>Additional Work — This Request</td><td class="num">+ $${money(q.grand_total)}</td></tr>`;

  const seqLine = isFollowUp
    ? `<div class="seq-note">Follow-up NTE Increase #${esc(q.sequence_number)} — builds on the previously requested ceiling.</div>`
    : '';

  const cbreNote = clientType === 'CBRE'
    ? `<div class="cbre-note">All CBRE communication for this work order is handled by the EMF Contracting admin office.</div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>NTE Increase Request — WO ${esc(wo.wo_number || '')}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    color: #1f2430;
    margin: 0;
    padding: 28px 34px;
    max-width: 820px;
    margin-left: auto;
    margin-right: auto;
    font-size: 12.5px;
    line-height: 1.5;
    background: #fff;
  }
  .emf-header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 10px; }
  .emf-name { font-size: 20px; font-weight: 800; letter-spacing: 0.5px; color: #111; }
  .emf-sub { font-size: 10.5px; color: #666; margin-top: 2px; }
  .emf-contact { text-align: right; font-size: 10.5px; color: #555; line-height: 1.45; }

  .client-band {
    background: ${bandBg};
    color: ${bandText};
    text-align: center;
    font-size: 26px;
    font-weight: 900;
    letter-spacing: 14px;
    padding: 10px 0 10px 14px;
    border-radius: 6px;
    margin: 10px 0 16px 0;
  }

  h1.doc-title {
    text-align: center;
    font-size: 19px;
    letter-spacing: 1.5px;
    margin: 0 0 8px 0;
    color: #111;
  }
  .badges { text-align: center; margin-bottom: 18px; }
  .badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
    padding: 4px 10px;
    border-radius: 999px;
    margin: 0 4px 4px 4px;
    border: 1px solid transparent;
  }
  .badge-written { background: #e8eefc; color: #1d4ed8; border-color: #93b4f5; }
  .badge-verbal { background: #fff1e0; color: #b45309; border-color: #f0b26b; }
  .badge-status { background: #eef2f7; color: #374151; border-color: #cbd5e1; }
  .badge-onsite { background: #e6f6ec; color: #15803d; border-color: #86d3a4; font-size: 11px; }
  .badge-offsite { background: #eef2f7; color: #475569; border-color: #cbd5e1; font-size: 11px; }

  .section { margin-bottom: 22px; }
  .section-title {
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: ${accent};
    border-left: 4px solid ${accent};
    padding-left: 8px;
    margin-bottom: 10px;
  }

  .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px 18px; }
  .info-item { border: 1px solid #e5e7eb; border-radius: 6px; padding: 7px 10px; background: #fafbfc; }
  .info-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; color: #6b7280; }
  .info-value { font-size: 12.5px; font-weight: 700; color: #111; margin-top: 1px; word-break: break-word; }

  .scope-wrap { border: 1.5px solid ${accent}; border-radius: 8px; padding: 14px 16px; background: #fcfdfc; }
  .scope-block { margin-bottom: 14px; }
  .scope-block:last-child { margin-bottom: 0; }
  .scope-label { font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #374151; margin-bottom: 4px; }
  .scope-text { font-size: 13.5px; line-height: 1.65; color: #111; }
  .muted { color: #9ca3af; font-style: italic; }
  .seq-note { font-size: 11px; color: #6b7280; margin-top: 6px; font-style: italic; }

  table { width: 100%; border-collapse: collapse; }
  .cost-table td, .cost-table th, .mat-table td, .mat-table th, .sum-table td {
    padding: 8px 10px;
    border-bottom: 1px solid #e5e7eb;
    text-align: left;
    font-size: 12px;
  }
  .mat-table { margin-top: 4px; }
  .mat-table th { background: #f3f4f6; font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: #6b7280; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .cost-total td {
    border-top: 2px solid ${accent};
    border-bottom: none;
    font-weight: 800;
    font-size: 13px;
    padding-top: 10px;
  }

  .sum-table td { font-size: 12.5px; }
  .new-nte {
    margin-top: 12px;
    background: ${bandBg};
    color: ${bandText};
    border-radius: 8px;
    padding: 12px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .new-nte .label { font-size: 13px; font-weight: 800; letter-spacing: 1px; }
  .new-nte .amount { font-size: 21px; font-weight: 900; font-variant-numeric: tabular-nums; }

  .site-photo { max-width: 100%; max-height: 330px; border: 1px solid #d1d5db; border-radius: 6px; display: block; }
  .photo-meta { font-size: 10px; color: #6b7280; margin-top: 3px; }

  .cbre-note {
    margin-top: 14px;
    font-size: 10.5px;
    color: #374151;
    background: #f3f7f5;
    border: 1px dashed ${accent};
    border-radius: 6px;
    padding: 7px 10px;
  }

  .footer {
    margin-top: 26px;
    border-top: 1px solid #d1d5db;
    padding-top: 8px;
    display: flex;
    justify-content: space-between;
    font-size: 9.5px;
    color: #6b7280;
  }

  @media print {
    body { padding: 12px 8px; }
    .no-print { display: none; }
    .scope-wrap, .info-item, .new-nte { break-inside: avoid; }
  }
</style>
</head>
<body>

  <div class="emf-header">
    <div>
      <div class="emf-name">EMF CONTRACTING LLC</div>
      <div class="emf-sub">Electrical &middot; Mechanical &middot; Fabrication</div>
    </div>
    <div class="emf-contact">
      595 Pine Plain Rd, Gaston SC 29053<br>
      (888) 752-3431 &middot; emfcontractingsc@gmail.com
    </div>
  </div>

  <div class="client-band">${esc(clientType || 'CLIENT')}</div>

  <h1 class="doc-title">NTE INCREASE REQUEST</h1>
  <div class="badges">
    ${onSiteBadge}
    ${typeBadge}
    ${statusBadge}
  </div>

  <div class="section">
    <div class="section-title">Work Order Information</div>
    <div class="info-grid">
      <div class="info-item"><div class="info-label">Work Order #</div><div class="info-value">${esc(wo.wo_number || 'N/A')}</div></div>
      <div class="info-item"><div class="info-label">Building</div><div class="info-value">${esc(wo.building || 'N/A')}</div></div>
      <div class="info-item"><div class="info-label">Client</div><div class="info-value">${esc(clientType || 'N/A')}</div></div>
      <div class="info-item"><div class="info-label">Date Submitted</div><div class="info-value">${esc(fmtEastern(q.created_at))}</div></div>
      <div class="info-item"><div class="info-label">Submitted By</div><div class="info-value">${esc(creatorName || 'N/A')}</div></div>
      <div class="info-item"><div class="info-label">${isFollowUp ? 'Previous NTE Ceiling' : 'Original NTE'}</div><div class="info-value">$${money(q.original_nte)}</div></div>
      <div class="info-item"><div class="info-label">Crew Size</div><div class="info-value">${techs} technician${techs === 1 ? '' : 's'}</div></div>
      <div class="info-item"><div class="info-label">Round-Trip Mileage</div><div class="info-value">${miles.toFixed(1)} mi</div></div>
      <div class="info-item"><div class="info-label">Billing</div><div class="info-value">${q.billing_mode === 'fixed' ? 'Fixed Quote' : 'T&amp;M / Estimate'}</div></div>
    </div>
    ${seqLine}
  </div>

  <div class="section">
    <div class="section-title">Findings &amp; Scope of Work</div>
    <div class="scope-wrap">
      ${scopeHTML}
      ${materialsTable}
      ${photoBlock}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Cost Breakdown — Additional Work</div>
    <table class="cost-table">
      <tbody>
        ${costRows.join('')}
        <tr class="cost-total">
          <td>ADDITIONAL WORK TOTAL</td>
          <td class="num">$${money(q.grand_total)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">NTE Summary</div>
    <table class="sum-table">
      <tbody>${summaryRows}</tbody>
    </table>
    <div class="new-nte">
      <span class="label">NEW NTE REQUIRED</span>
      <span class="amount">$${money(q.new_nte_amount)}</span>
    </div>
    ${cbreNote}
  </div>

  <div class="footer">
    <span>EMF Contracting LLC &middot; Field Service Management</span>
    <span>Generated ${esc(fmtEastern(new Date().toISOString()))}</span>
  </div>

</body>
</html>`;
}

// Opens the print window, writes the template and triggers print once
// images (site photo) have had a moment to load.
export function openNtePrintWindow({ workOrder, quote, materials = [] }) {
  const html = buildNtePrintHTML({ workOrder, quote, materials });
  const w = window.open('', '_blank', 'width=920,height=1100');
  if (!w) {
    alert('Popup blocked — please allow popups to print the NTE request.');
    return;
  }
  w.document.write(html);
  w.document.close();
  w.onload = () => setTimeout(() => w.print(), quote && quote.photo_url ? 700 : 250);
}
