// lib/activityLogExport.js
// ─────────────────────────────────────────────────────────────────────────────
// Exports activity logs to Excel (.xlsx) and PDF.
//   - Single WO  → one workbook / one PDF
//   - Bulk       → one workbook with Summary sheet + one sheet per WO
//                  one PDF with cover page + sections per WO
// Both formats use the same buildActivityLog output, so the row content stays
// in lockstep.
// ─────────────────────────────────────────────────────────────────────────────
import * as XLSX from 'xlsx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { buildActivityLog, filterEvents } from '@/lib/activityLog';

// ── Formatting helpers ─────────────────────────────────────────────────────
const fmtTimestamp = (d) => d
  ? new Date(d).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
  : '';

// Strip emoji + non-ASCII chars from text destined for the PDF font (Helvetica
// can't encode characters outside WinAnsi). Excel handles unicode fine.
const stripForPdf = (s) =>
  String(s || '').replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();

const todayStr = () => new Date().toISOString().split('T')[0];

// ─────────────────────────────────────────────────────────────────────────────
// Build a flat row array from an events list. Excel + summary sheets use this.
// ─────────────────────────────────────────────────────────────────────────────
function toRows(events) {
  return events.map(e => [
    fmtTimestamp(e.ts),
    e.event || '',
    e.actor || '',
    (e.detail || '').replace(/\s+/g, ' ').trim(),
  ]);
}

const COLUMN_HEADERS = ['Timestamp', 'Event', 'Actor', 'Detail'];
const COLUMN_WIDTHS  = [{ wch: 20 }, { wch: 32 }, { wch: 22 }, { wch: 60 }];

// Sheet names have to be ≤31 chars and can't contain : \ / ? * [ ]
function safeSheetName(woNumber, idx) {
  const base = String(woNumber || `WO_${idx + 1}`).replace(/[:\\/?*[\]]/g, '_');
  return base.slice(0, 31);
}

// ─────────────────────────────────────────────────────────────────────────────
// Build one WO's activity sheet (header rows + table)
// ─────────────────────────────────────────────────────────────────────────────
function buildSheet({ workOrder, events }) {
  const aoa = [
    [`Activity Log — ${workOrder.wo_number || ''}`],
    [`Building: ${workOrder.building || '—'}`],
    [`Status: ${workOrder.status || '—'}  |  CBRE Status: ${workOrder.cbre_status || '—'}`],
    [`Total events: ${events.length}`],
    [],
    COLUMN_HEADERS,
    ...toRows(events),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = COLUMN_WIDTHS;
  // Merge title across columns
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 3 } },
  ];
  return ws;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Excel export
//   logs: array of { workOrder, events } from buildActivityLog
//   options.bulk: if true, include a Summary sheet
// ─────────────────────────────────────────────────────────────────────────────
export function exportActivityLogsToExcel(logs, { bulk = false } = {}) {
  if (!logs?.length) throw new Error('No activity logs to export');
  const wb = XLSX.utils.book_new();

  if (bulk) {
    // Summary sheet: one row per WO with event counts
    const summaryAoa = [
      ['EMF Contracting LLC — Activity Log Bulk Export'],
      [`Generated: ${new Date().toLocaleString('en-US')}`],
      [`Work Orders included: ${logs.length}`],
      [],
      ['WO #', 'Building', 'Status', 'CBRE Status', 'Event Count', 'First Event', 'Last Event'],
      ...logs.map(({ workOrder, events }) => [
        workOrder.wo_number || '',
        workOrder.building  || '',
        workOrder.status    || '',
        workOrder.cbre_status || '',
        events.length,
        events.length ? fmtTimestamp(events[0].ts) : '',
        events.length ? fmtTimestamp(events[events.length - 1].ts) : '',
      ]),
    ];
    const summary = XLSX.utils.aoa_to_sheet(summaryAoa);
    summary['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 20 }];
    summary['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } },
    ];
    XLSX.utils.book_append_sheet(wb, summary, 'Summary');
  }

  logs.forEach((log, idx) => {
    const ws = buildSheet(log);
    const name = safeSheetName(log.workOrder.wo_number, idx);
    // Avoid duplicate sheet names (xlsx rejects duplicates)
    let finalName = name;
    let n = 2;
    while (wb.SheetNames.includes(finalName)) {
      finalName = `${name.slice(0, 28)}_${n++}`;
    }
    XLSX.utils.book_append_sheet(wb, ws, finalName);
  });

  const filename = logs.length === 1
    ? `Activity_${logs[0].workOrder.wo_number}_${todayStr()}.xlsx`
    : `Activity_Bulk_${todayStr()}.xlsx`;

  XLSX.writeFile(wb, filename);
  return filename;
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF export — one PDF, multiple WOs become multiple sections.
// ─────────────────────────────────────────────────────────────────────────────
export async function exportActivityLogsToPDF(logs, { bulk = false } = {}) {
  if (!logs?.length) throw new Error('No activity logs to export');

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 612, PAGE_H = 792;   // US Letter
  const MARGIN = 40;
  const LINE_H = 13;

  // Column layout for the activity table
  const COLS = [
    { x: MARGIN,        w: 110, header: 'Timestamp' },
    { x: MARGIN + 115,  w: 130, header: 'Event' },
    { x: MARGIN + 250,  w: 110, header: 'Actor' },
    { x: MARGIN + 365,  w: PAGE_W - MARGIN - (MARGIN + 365), header: 'Detail' },
  ];

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };

  // Estimate how many lines a string will wrap to in a given column width
  const wrapLines = (text, width, size = 8.5) => {
    if (!text) return [''];
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      const trial = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(trial, size) > width) {
        if (line) lines.push(line);
        line = w;
      } else {
        line = trial;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  };

  const drawTableHeader = () => {
    page.drawRectangle({ x: MARGIN - 2, y: y - 4, width: PAGE_W - 2*MARGIN + 4, height: 16, color: rgb(0.12, 0.18, 0.32) });
    COLS.forEach(c => {
      page.drawText(c.header, { x: c.x, y: y + 2, size: 9, font: bold, color: rgb(1, 1, 1) });
    });
    y -= 18;
  };

  const drawRow = (row) => {
    // row is [timestamp, event, actor, detail], already stripped for PDF
    const wrapped = COLS.map((c, i) => wrapLines(row[i], c.w));
    const rowH = Math.max(...wrapped.map(w => w.length)) * LINE_H;
    if (y - rowH < MARGIN + 20) {
      newPage();
      drawTableHeader();
    }
    COLS.forEach((c, i) => {
      wrapped[i].forEach((ln, li) => {
        page.drawText(ln, {
          x: c.x, y: y - (li * LINE_H) - 8,
          size: 8.5, font, color: rgb(0.1, 0.1, 0.1),
        });
      });
    });
    y -= rowH + 4;
    // Faint separator
    page.drawLine({
      start: { x: MARGIN, y: y + 1 }, end: { x: PAGE_W - MARGIN, y: y + 1 },
      thickness: 0.3, color: rgb(0.85, 0.85, 0.9),
    });
  };

  const drawWoHeader = (wo, eventCount) => {
    if (y < MARGIN + 100) newPage();
    page.drawText(`Activity Log — ${stripForPdf(wo.wo_number)}`, {
      x: MARGIN, y: y - 4, size: 16, font: bold, color: rgb(0.12, 0.25, 0.5),
    });
    y -= 22;
    page.drawText(`Building: ${stripForPdf(wo.building) || '-'}`, {
      x: MARGIN, y, size: 10, font, color: rgb(0.25, 0.25, 0.25),
    });
    y -= 14;
    page.drawText(
      `Status: ${stripForPdf(wo.status) || '-'}   |   CBRE Status: ${stripForPdf(wo.cbre_status) || '-'}   |   Events: ${eventCount}`,
      { x: MARGIN, y, size: 10, font, color: rgb(0.25, 0.25, 0.25) }
    );
    y -= 20;
    drawTableHeader();
  };

  // Optional cover page for bulk
  if (bulk) {
    page.drawText('EMF Contracting LLC', { x: MARGIN, y: y - 10, size: 18, font: bold, color: rgb(0.12, 0.25, 0.5) });
    y -= 28;
    page.drawText('Activity Log — Bulk Export', { x: MARGIN, y, size: 14, font: bold, color: rgb(0.2, 0.2, 0.2) });
    y -= 18;
    page.drawText(`Generated: ${new Date().toLocaleString('en-US')}`, { x: MARGIN, y, size: 10, font });
    y -= 14;
    page.drawText(`Work orders included: ${logs.length}`, { x: MARGIN, y, size: 10, font });
    y -= 24;
    page.drawText('Contents:', { x: MARGIN, y, size: 11, font: bold });
    y -= 16;
    logs.forEach(({ workOrder, events }) => {
      if (y < MARGIN + 40) newPage();
      page.drawText(
        `  ${stripForPdf(workOrder.wo_number)} - ${stripForPdf(workOrder.building) || '-'}  (${events.length} events)`,
        { x: MARGIN, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) },
      );
      y -= 13;
    });
  }

  // Each WO gets its own header + table
  logs.forEach((log, idx) => {
    if (idx > 0 || bulk) newPage();
    drawWoHeader(log.workOrder, log.events.length);
    if (log.events.length === 0) {
      page.drawText('(no events recorded for this work order)', {
        x: MARGIN, y: y - 12, size: 9, font, color: rgb(0.5, 0.5, 0.5),
      });
      return;
    }
    toRows(log.events).forEach(row => drawRow(row.map(stripForPdf)));
  });

  // Save & download
  const bytes = await pdf.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url  = URL.createObjectURL(blob);
  const filename = logs.length === 1
    ? `Activity_${logs[0].workOrder.wo_number}_${todayStr()}.pdf`
    : `Activity_Bulk_${todayStr()}.pdf`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return filename;
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience: build → filter → export pipeline for a list of wo_ids
// ─────────────────────────────────────────────────────────────────────────────
export async function exportActivityForWorkOrders(supabase, woIds, {
  enabledCategories,           // Set<string> of category ids
  format = 'excel',            // 'excel' | 'pdf'
} = {}) {
  if (!woIds?.length) throw new Error('No work orders selected');

  // Build all logs in parallel
  const logs = await Promise.all(
    woIds.map(id => buildActivityLog(supabase, id))
  );

  // Apply category filter
  if (enabledCategories) {
    logs.forEach(l => { l.events = filterEvents(l.events, enabledCategories); });
  }

  const bulk = logs.length > 1;
  if (format === 'pdf')   return exportActivityLogsToPDF(logs,   { bulk });
  return exportActivityLogsToExcel(logs, { bulk });
}
