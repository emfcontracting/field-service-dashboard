// lib/upsEscalationExport.js
// ─────────────────────────────────────────────────────────────────────────────
// Generates Excel (.xlsx) and PDF reports of disputed WOs for UPS escalation.
// Uses xlsx (SheetJS) and pdf-lib, both already installed.
// ─────────────────────────────────────────────────────────────────────────────
import * as XLSX from 'xlsx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { DISPUTE_STATUS, DISPUTE_REASONS } from '@/lib/disputeStatus';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const fmtMoney  = (n) => `$${(parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate   = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const fmtDateShort = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }) : '';

const daysSince = (date) => {
  if (!date) return null;
  return Math.round((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
};

const reportFilename = (ext) => {
  const today = new Date().toISOString().split('T')[0];
  return `EMF_UPS_Escalation_Report_${today}.${ext}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Build row data shared between Excel and PDF
// ─────────────────────────────────────────────────────────────────────────────
function buildRowData(disputes) {
  return disputes.map(d => {
    const lead = d.lead_tech ? `${d.lead_tech.first_name} ${d.lead_tech.last_name}` : '';
    const days = daysSince(d.date_completed) ?? daysSince(d.dispute_opened_at);
    return {
      wo_number: d.wo_number || '',
      building:  d.building  || '',
      completed: fmtDateShort(d.date_completed),
      description: (d.work_order_description || '').replace(/\s+/g, ' ').trim().slice(0, 300),
      lead_tech: lead,
      amount: parseFloat(d.dispute_amount) || 0,
      status: DISPUTE_STATUS[d.dispute_status]?.label || d.dispute_status,
      reason: DISPUTE_REASONS[d.dispute_reason]?.label || d.dispute_reason || '',
      days_old: days != null ? `${days}d` : '',
      notes: (d.dispute_notes || '').replace(/\s+/g, ' ').trim().slice(0, 500),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export function exportToExcel(disputes) {
  const rows = buildRowData(disputes);
  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);

  // Build worksheet data as array-of-arrays for full control
  const aoa = [
    // Header rows
    ['EMF Contracting LLC — UPS Escalation Report'],
    [`Generated: ${new Date().toLocaleString('en-US')}`],
    [`Total at Risk: ${fmtMoney(totalAmount)}  |  WO Count: ${rows.length}`],
    [],
    // Column headers
    ['WO #', 'Building', 'Date Completed', 'Lead Tech', 'Description of Work',
     'Amount at Risk', 'Status', 'Reason', 'Age', 'Notes / UPS Communication Log'],
  ];

  // Data rows
  rows.forEach(r => {
    aoa.push([
      r.wo_number,
      r.building,
      r.completed,
      r.lead_tech,
      r.description,
      r.amount,
      r.status,
      r.reason,
      r.days_old,
      r.notes,
    ]);
  });

  // Totals footer
  aoa.push([]);
  aoa.push(['', '', '', '', 'TOTAL AT RISK:', totalAmount, '', '', '', '']);

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Column widths
  ws['!cols'] = [
    { wch: 12 },  // WO #
    { wch: 28 },  // Building
    { wch: 13 },  // Date
    { wch: 18 },  // Lead Tech
    { wch: 45 },  // Description
    { wch: 14 },  // Amount
    { wch: 18 },  // Status
    { wch: 22 },  // Reason
    { wch: 8 },   // Age
    { wch: 50 },  // Notes
  ];

  // Merge title row across all columns
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } },
  ];

  // Format amount column as currency (column F = index 5)
  const totalRowIdx = aoa.length - 1;
  for (let r = 5; r <= totalRowIdx; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: 5 })];
    if (cell && typeof cell.v === 'number') {
      cell.z = '"$"#,##0.00';
    }
  }

  // Style hints — note that xlsx free version doesn't write rich styles,
  // but cell formatting (number format) does survive. Bold styling won't
  // appear in the basic build, but the structure stays clean.

  // Build workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'UPS Escalation');

  // Trigger download
  XLSX.writeFile(wb, reportFilename('xlsx'));
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export async function exportToPDF(disputes) {
  const rows = buildRowData(disputes);
  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);

  const pdfDoc = await PDFDocument.create();
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Landscape Letter: 792 x 612
  const pageW = 792;
  const pageH = 612;
  const margin = 36;
  const usableW = pageW - 2 * margin;

  // Column definitions (sum of widths must equal usableW)
  const cols = [
    { key: 'wo_number',   label: 'WO #',         w: 60  },
    { key: 'building',    label: 'Building',     w: 110 },
    { key: 'completed',   label: 'Completed',    w: 60  },
    { key: 'lead_tech',   label: 'Lead Tech',    w: 70  },
    { key: 'description', label: 'Description',  w: 150 },
    { key: 'amount',      label: 'At Risk',      w: 60, align: 'right' },
    { key: 'status',      label: 'Status',       w: 70  },
    { key: 'days_old',    label: 'Age',          w: 35, align: 'right' },
    { key: 'notes',       label: 'Notes',        w: 105 },
  ];
  // Pad to usable width
  const totalW = cols.reduce((s, c) => s + c.w, 0);
  const scale = usableW / totalW;
  cols.forEach(c => { c.w = c.w * scale; });

  const colors = {
    text:      rgb(0.12, 0.12, 0.15),
    muted:     rgb(0.4, 0.4, 0.45),
    border:    rgb(0.85, 0.85, 0.88),
    headerBg:  rgb(0.93, 0.93, 0.95),
    altRow:    rgb(0.97, 0.97, 0.98),
    accent:    rgb(0.85, 0.20, 0.20),
    title:     rgb(0.10, 0.10, 0.15),
  };

  const drawText = (page, text, x, y, opts = {}) => {
    const size = opts.size || 8;
    const f = opts.bold ? fontBold : font;
    const color = opts.color || colors.text;
    // Truncate to width if needed
    let str = String(text ?? '');
    if (opts.maxWidth) {
      while (str.length > 0 && f.widthOfTextAtSize(str, size) > opts.maxWidth) {
        str = str.slice(0, -1);
      }
      if (str !== String(text ?? '') && str.length > 1) {
        str = str.slice(0, -1) + '…';
      }
    }
    page.drawText(str, { x, y, size, font: f, color });
  };

  // Word-wrap helper — splits text into lines that fit within maxWidth
  const wrapText = (text, size, maxWidth) => {
    if (!text) return [''];
    const words = String(text).split(/\s+/);
    const lines = [];
    let current = '';
    for (const w of words) {
      const test = current ? current + ' ' + w : w;
      if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
        lines.push(current);
        current = w;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  // Compute row height based on wrapped content (description & notes)
  const rowHeightFor = (row) => {
    const descLines = wrapText(row.description, 7, cols.find(c => c.key === 'description').w - 4).slice(0, 5);
    const notesLines = wrapText(row.notes, 7, cols.find(c => c.key === 'notes').w - 4).slice(0, 5);
    const lines = Math.max(1, descLines.length, notesLines.length);
    return Math.max(18, lines * 9 + 6);
  };

  let page = pdfDoc.addPage([pageW, pageH]);
  let y = pageH - margin;

  // ── Header ──────────────────────────────────────────────────────────────
  const drawHeader = (p) => {
    let yy = pageH - margin;
    drawText(p, 'EMF Contracting LLC', margin, yy, { size: 16, bold: true, color: colors.title });
    yy -= 16;
    drawText(p, 'UPS Escalation Report', margin, yy, { size: 12, bold: true, color: colors.accent });
    yy -= 12;
    drawText(p, `Generated: ${new Date().toLocaleString('en-US')}`, margin, yy, { size: 8, color: colors.muted });

    // Right-aligned summary
    const summaryText  = `Total at Risk: ${fmtMoney(totalAmount)}`;
    const countText    = `${rows.length} Work Order${rows.length !== 1 ? 's' : ''}`;
    const summaryW = fontBold.widthOfTextAtSize(summaryText, 11);
    const countW   = font.widthOfTextAtSize(countText, 9);
    drawText(p, summaryText, pageW - margin - summaryW, pageH - margin, { size: 11, bold: true, color: colors.accent });
    drawText(p, countText,   pageW - margin - countW,   pageH - margin - 14, { size: 9, color: colors.muted });

    return yy - 14; // y after header
  };

  // ── Table header ────────────────────────────────────────────────────────
  const drawTableHeader = (p, yy) => {
    // Header background
    p.drawRectangle({ x: margin, y: yy - 14, width: usableW, height: 14, color: colors.headerBg });
    let x = margin;
    cols.forEach(c => {
      const tx = c.align === 'right' ? x + c.w - 4 - fontBold.widthOfTextAtSize(c.label, 8) : x + 4;
      drawText(p, c.label, tx, yy - 10, { size: 8, bold: true });
      x += c.w;
    });
    // Bottom border
    p.drawLine({ start: { x: margin, y: yy - 14 }, end: { x: margin + usableW, y: yy - 14 }, thickness: 0.7, color: colors.border });
    return yy - 16;
  };

  y = drawHeader(page);
  y -= 8;
  y = drawTableHeader(page, y);

  // ── Data rows ────────────────────────────────────────────────────────────
  let isAlt = false;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowH = rowHeightFor(row);

    // Page break?
    if (y - rowH < margin + 30) {
      // Footer page number on this page
      const pageCount = pdfDoc.getPageCount();
      drawText(page, `Page ${pageCount}`, pageW - margin - 40, margin / 2, { size: 7, color: colors.muted });

      page = pdfDoc.addPage([pageW, pageH]);
      y = drawHeader(page);
      y -= 8;
      y = drawTableHeader(page, y);
      isAlt = false;
    }

    // Alt row background
    if (isAlt) {
      page.drawRectangle({ x: margin, y: y - rowH, width: usableW, height: rowH, color: colors.altRow });
    }
    isAlt = !isAlt;

    // Draw cells
    let x = margin;
    cols.forEach(c => {
      const cellY = y - 10;
      let value = row[c.key];
      if (c.key === 'amount') value = fmtMoney(value);

      if (c.key === 'description' || c.key === 'notes') {
        const lines = wrapText(value, 7, c.w - 4).slice(0, 5);
        lines.forEach((line, li) => {
          drawText(page, line, x + 4, cellY - li * 9, { size: 7 });
        });
      } else {
        const tx = c.align === 'right'
          ? x + c.w - 4 - font.widthOfTextAtSize(String(value || ''), 7)
          : x + 4;
        drawText(page, value, tx, cellY, { size: 7, maxWidth: c.w - 6 });
      }
      x += c.w;
    });

    // Row separator
    page.drawLine({ start: { x: margin, y: y - rowH }, end: { x: margin + usableW, y: y - rowH }, thickness: 0.3, color: colors.border });
    y -= rowH;
  }

  // ── Footer summary ──────────────────────────────────────────────────────
  if (y - 30 < margin) {
    page = pdfDoc.addPage([pageW, pageH]);
    y = drawHeader(page);
    y -= 12;
  }
  y -= 10;
  page.drawLine({ start: { x: margin, y: y }, end: { x: margin + usableW, y: y }, thickness: 1.2, color: colors.accent });
  y -= 14;
  drawText(page, `TOTAL AT RISK:`, margin + usableW - 200, y, { size: 11, bold: true });
  drawText(page, fmtMoney(totalAmount), margin + usableW - 90, y, { size: 11, bold: true, color: colors.accent });

  // Page number on last page
  const pageCount = pdfDoc.getPageCount();
  drawText(page, `Page ${pageCount}`, pageW - margin - 40, margin / 2, { size: 7, color: colors.muted });

  // ── Save & trigger download ─────────────────────────────────────────────
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = reportFilename('pdf');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
