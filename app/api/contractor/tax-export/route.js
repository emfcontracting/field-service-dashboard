// app/api/contractor/tax-export/route.js
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/contractor/tax-export
//   body: { user_id, year, format: 'xlsx' | 'master-xlsx' }
//
// Generates either:
//   - 'xlsx': Personal expense tracker mirroring TaxRecord_Template.xlsx
//             (color-coded, grouped, totals row)
//   - 'master-xlsx': Combined master report with TWO sheets:
//             "Personal Expenses" (this feature) + "EMF Income" (from invoices)
//
// PDF generation lives in the print page (/contractor/tax-records/print)
// which is rendered to PDF client-side via window.print().
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { isOvertimeItem } from '@/lib/invoiceItemKind';
import { irsRateOn, irsRatesForYear } from '@/lib/irsMileage';
import * as XLSX from 'xlsx';
import { DEFAULT_TAX_CATEGORIES, TAX_CATEGORY_GROUPS, scheduleCLine, NOT_SCHEDULE_C } from '@/lib/taxRecordCategories';
import { requireContractorOrStaff, ownsUser, denyNotOwner, serviceClient } from '@/lib/serverAuth';

// Service role: these tables are RLS-locked (staff_all only); the route
// itself checks who may see which row.
const supabase = serviceClient();

// Convert hex color to ARGB format expected by xlsx
function hexToARGB(hex) {
  const clean = (hex || '#9CA3AF').replace('#', '').toUpperCase();
  return `FF${clean}`;
}

// Build the ordered list of category names for column headers
// (defaults in template order, then custom categories appended)
function buildCategoryColumns(customCategories) {
  const defaultNames = DEFAULT_TAX_CATEGORIES.map(c => c.name);
  const customNames = (customCategories || []).map(c => c.category_name);
  return [...defaultNames, ...customNames];
}

function getCategoryColor(name, customCategories) {
  const def = DEFAULT_TAX_CATEGORIES.find(c => c.name === name);
  if (def) return def.color;
  const custom = (customCategories || []).find(c => c.category_name === name);
  if (custom) return custom.color_hex || '#9CA3AF';
  return '#9CA3AF';
}

// Build the personal expenses sheet (mirror of TaxRecord_Template.xlsx)
function buildPersonalSheet(records, customCategories, year) {
  const categoryColumns = buildCategoryColumns(customCategories);
  const headers = ['INV #', ...categoryColumns];

  // Group records by invoice_ref (or by record_id for ones without ref)
  const groupedByRef = new Map();
  for (const rec of records) {
    const key = rec.invoice_ref || `__no_ref__${rec.record_id}`;
    if (!groupedByRef.has(key)) {
      groupedByRef.set(key, { invoice_ref: rec.invoice_ref || '', entries: {} });
    }
    const group = groupedByRef.get(key);
    group.entries[rec.category_name] = (group.entries[rec.category_name] || 0) + parseFloat(rec.amount);
  }

  // Build data rows
  const dataRows = [];
  for (const group of groupedByRef.values()) {
    const row = [group.invoice_ref];
    for (const cat of categoryColumns) {
      row.push(group.entries[cat] != null ? group.entries[cat] : '');
    }
    dataRows.push(row);
  }

  // Totals row
  const totals = ['Total:'];
  for (const cat of categoryColumns) {
    const sum = records
      .filter(r => r.category_name === cat)
      .reduce((s, r) => s + parseFloat(r.amount), 0);
    totals.push(sum > 0 ? sum : '');
  }

  // Assemble as AOA
  const aoa = [headers, ...dataRows, totals];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Column widths
  ws['!cols'] = headers.map((h, i) => ({
    wch: i === 0 ? 12 : Math.max(h.length + 2, 14),
  }));

  // Style the header row with category colors
  for (let i = 0; i < headers.length; i++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
    const color = i === 0 ? '#9CA3AF' : getCategoryColor(headers[i], customCategories);
    if (!ws[cellRef]) ws[cellRef] = { v: headers[i], t: 's' };
    ws[cellRef].s = {
      fill: { fgColor: { rgb: hexToARGB(color).slice(2) } },
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top:    { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left:   { style: 'thin', color: { rgb: '000000' } },
        right:  { style: 'thin', color: { rgb: '000000' } },
      },
    };
  }

  // Style data cells: format numbers as currency, add borders
  for (let r = 1; r < aoa.length; r++) {
    for (let c = 0; c < headers.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (!ws[cellRef]) continue;
      const isTotalRow = r === aoa.length - 1;
      ws[cellRef].s = {
        font: isTotalRow ? { bold: true } : {},
        alignment: { horizontal: c === 0 ? 'left' : 'right' },
        numFmt: c > 0 ? '"$"#,##0.00' : undefined,
        border: {
          top:    { style: 'thin', color: { rgb: 'CCCCCC' } },
          bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
          left:   { style: 'thin', color: { rgb: 'CCCCCC' } },
          right:  { style: 'thin', color: { rgb: 'CCCCCC' } },
        },
      };
      if (isTotalRow) {
        ws[cellRef].s.fill = { fgColor: { rgb: 'F3F4F6' } };
      }
    }
  }

  // Freeze top row + first column
  ws['!freeze'] = { xSplit: 1, ySplit: 1 };

  return ws;
}

// Totals per suggested Schedule C line (lib/taxRecordCategories). Clearly a
// suggestion for the tax preparer; personal categories listed separately.
function buildScheduleCSheet(records, year) {
  const byLine = {};
  for (const r of records || []) {
    const line = scheduleCLine(r.category_name);
    byLine[line] ||= { total: 0, cats: {} };
    const amt = parseFloat(r.amount) || 0;
    byLine[line].total += amt;
    byLine[line].cats[r.category_name] = (byLine[line].cats[r.category_name] || 0) + amt;
  }
  const lines = Object.keys(byLine).sort((a, b) => (a === NOT_SCHEDULE_C) - (b === NOT_SCHEDULE_C) || a.localeCompare(b, 'en', { numeric: true }));
  const aoa = [
    [`Schedule C Summary (suggested) — Tax Year ${year}`],
    ['Suggestion only, not tax advice — confirm every line with your tax preparer. Vehicle: standard mileage OR actual expenses, not both.'],
    [],
    ['Schedule C line', 'Categories', 'Amount'],
  ];
  let business = 0;
  for (const line of lines) {
    const cats = Object.entries(byLine[line].cats).map(([c, v]) => `${c} $${v.toFixed(2)}`).join(', ');
    aoa.push([line, cats, byLine[line].total.toFixed(2)]);
    if (line !== NOT_SCHEDULE_C) business += byLine[line].total;
  }
  aoa.push([], ['Business expenses (all lines except personal)', '', business.toFixed(2)]);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 52 }, { wch: 60 }, { wch: 14 }];
  return ws;
}

// Mileage: EMF work-order miles (daily_hours_log) + the sub's own trips,
// each at the IRS business rate of its date (lib/irsMileage).
async function buildMileageSheet(userId, year) {
  const [logs, trips] = await Promise.all([
    supabase.from('daily_hours_log').select('work_date, miles, work_order:work_orders(wo_number, building)')
      .eq('user_id', userId).gte('work_date', `${year}-01-01`).lte('work_date', `${year}-12-31`).gt('miles', 0).order('work_date'),
    supabase.from('contractor_trips').select('*')
      .eq('user_id', userId).gte('trip_date', `${year}-01-01`).lte('trip_date', `${year}-12-31`).order('trip_date'),
  ]);
  const rows = [
    ...(logs.data || []).map((l) => [l.work_date, 'EMF work order', `${l.work_order?.wo_number || ''} ${l.work_order?.building || ''}`.trim(), parseFloat(l.miles) || 0]),
    ...(trips.data || []).map((t) => [t.trip_date, 'Own trip', [t.purpose, t.from_place || t.to_place ? `${t.from_place || '?'} → ${t.to_place || '?'}` : ''].filter(Boolean).join(' — '), parseFloat(t.miles) || 0]),
  ].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  let miles = 0, value = 0;
  const body = rows.map(([d, kind, what, m]) => {
    const rate = irsRateOn(d);
    miles += m; value += m * (rate || 0);
    return [d, kind, what, m.toFixed(1), rate != null ? rate.toFixed(3) : 'n/a', (m * (rate || 0)).toFixed(2)];
  });
  const rates = irsRatesForYear(year).map((r) => `${(r.rate * 100).toFixed(1)}c from ${r.from}`).join(', ') || 'not on file';
  const aoa = [
    [`Mileage Log — Tax Year ${year}`],
    [`IRS business rate: ${rates}. EMF work-order miles were reimbursed on EMF invoices. Commuting is not deductible.`],
    [],
    ['Date', 'Type', 'Work order / purpose', 'Miles', 'IRS rate', 'Value at IRS rate'],
    ...body,
    [],
    ['TOTAL', '', '', miles.toFixed(1), '', value.toFixed(2)],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 50 }, { wch: 10 }, { wch: 10 }, { wch: 16 }];
  return ws;
}

// Build the EMF income sheet from subcontractor invoices
async function buildEMFIncomeSheet(userId, year) {
  const startDate = `${year}-01-01`;
  const endDate   = `${year}-12-31`;

  const { data: invoices } = await supabase
    .from('subcontractor_invoices')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'paid')
    .gte('period_start', startDate)
    .lte('period_end', endDate)
    .order('period_start', { ascending: true });

  if (!invoices || invoices.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Invoice Income — No paid invoices for ' + year],
    ]);
    return ws;
  }

  const invoiceIds = invoices.map(i => i.invoice_id);
  const { data: items } = await supabase
    .from('subcontractor_invoice_items')
    .select('*')
    .in('invoice_id', invoiceIds);

  // Summary breakdown
  const summary = {
    regularHours: 0, regularAmount: 0,
    otHours: 0,     otAmount: 0,
    mileage: 0,     mileageAmount: 0,
    materials: 0,
    hotels: 0,
    food: 0,
    otherCustom: 0,
  };

  for (const item of items || []) {
    const amt = parseFloat(item.amount || 0);
    const qty = parseFloat(item.quantity || 0);
    if (item.item_type === 'hours') {
      const desc = (item.description || '').toLowerCase();
      if (isOvertimeItem(item)) {
        summary.otHours += qty;
        summary.otAmount += amt;
      } else {
        summary.regularHours += qty;
        summary.regularAmount += amt;
      }
    } else if (item.item_type === 'mileage') {
      summary.mileage += qty;
      summary.mileageAmount += amt;
    } else if (item.item_type === 'material') {
      summary.materials += amt;
    } else if (item.item_type === 'custom') {
      const desc = (item.description || '').toLowerCase();
      if (desc.includes('hotel') || desc.includes('lodging')) summary.hotels += amt;
      else if (desc.includes('food') || desc.includes('meal') || desc.includes('per diem')) summary.food += amt;
      else summary.otherCustom += amt;
    }
  }

  const grandTotal =
    summary.regularAmount + summary.otAmount + summary.mileageAmount +
    summary.materials + summary.hotels + summary.food + summary.otherCustom;

  const aoa = [
    [`Invoice Income (EMF + other clients) — Tax Year ${year}`],
    [],
    ['Category', 'Quantity', 'Amount'],
    ['Regular Hours (RT)',  summary.regularHours.toFixed(2), summary.regularAmount.toFixed(2)],
    ['Overtime Hours (OT)', summary.otHours.toFixed(2),     summary.otAmount.toFixed(2)],
    ['Mileage',             summary.mileage.toFixed(0),     summary.mileageAmount.toFixed(2)],
    ['Materials',           '',                              summary.materials.toFixed(2)],
    ['Hotels / Lodging',    '',                              summary.hotels.toFixed(2)],
    ['Food / Per Diem',     '',                              summary.food.toFixed(2)],
    ['Other Reimbursements','',                              summary.otherCustom.toFixed(2)],
    [],
    ['GRAND TOTAL (Paid)',  '',                              grandTotal.toFixed(2)],
    [],
    [`Total Invoices Paid: ${invoices.length}`],
    [],
    ['Invoice #', 'Client', 'Period Start', 'Period End', 'Grand Total', 'Paid At'],
    ...invoices.map(inv => [
      inv.invoice_number,
      inv.client_type === 'other' ? (inv.client_name || 'Other client') : 'EMF Contracting LLC',
      inv.period_start,
      inv.period_end,
      parseFloat(inv.grand_total || 0).toFixed(2),
      inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : '',
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 28 }, { wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];

  // Style the title and headers
  const titleRef = XLSX.utils.encode_cell({ r: 0, c: 0 });
  ws[titleRef].s = {
    font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '1F2937' } },
    alignment: { horizontal: 'left' },
  };

  // Header row at index 2
  for (let c = 0; c < 3; c++) {
    const ref = XLSX.utils.encode_cell({ r: 2, c });
    if (ws[ref]) {
      ws[ref].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '3B82F6' } },
        alignment: { horizontal: 'center' },
      };
    }
  }

  // Grand total row
  const grandTotalRowIdx = 11;
  for (let c = 0; c < 3; c++) {
    const ref = XLSX.utils.encode_cell({ r: grandTotalRowIdx, c });
    if (ws[ref]) {
      ws[ref].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '10B981' } },
        alignment: { horizontal: c === 0 ? 'left' : 'right' },
      };
    }
  }

  return ws;
}

export async function POST(request) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  try {
    const { user_id, year, format } = await request.json();

    if (!user_id || !year) {
      return NextResponse.json({ error: 'user_id and year are required' }, { status: 400 });
    }
    if (!ownsUser(auth, user_id)) return denyNotOwner().response;

    // Fetch records and custom categories
    const [recordsRes, categoriesRes, userRes] = await Promise.all([
      supabase
        .from('contractor_tax_records')
        .select('*')
        .eq('user_id', user_id)
        .eq('tax_year', parseInt(year, 10))
        .eq('dismissed', false)
        .order('entry_date', { ascending: true }),
      supabase
        .from('contractor_tax_categories')
        .select('*')
        .eq('user_id', user_id)
        .order('display_order'),
      supabase
        .from('users')
        .select('first_name, last_name, email')
        .eq('user_id', user_id)
        .single(),
    ]);

    if (recordsRes.error)    return NextResponse.json({ error: recordsRes.error.message },    { status: 500 });
    if (categoriesRes.error) return NextResponse.json({ error: categoriesRes.error.message }, { status: 500 });

    const records = recordsRes.data || [];
    const customCategories = categoriesRes.data || [];
    const user = userRes.data || {};

    // Build workbook
    const wb = XLSX.utils.book_new();

    const personalSheet = buildPersonalSheet(records, customCategories, year);
    XLSX.utils.book_append_sheet(wb, personalSheet, 'Personal Expenses');
    XLSX.utils.book_append_sheet(wb, buildScheduleCSheet(records, year), 'Schedule C Summary');

    if (format === 'master-xlsx') {
      const incomeSheet = await buildEMFIncomeSheet(user_id, year);
      XLSX.utils.book_append_sheet(wb, incomeSheet, 'Invoice Income');
      XLSX.utils.book_append_sheet(wb, await buildMileageSheet(user_id, year), 'Mileage');
    }

    // Generate buffer
    const buffer = XLSX.write(wb, {
      type: 'buffer',
      bookType: 'xlsx',
      cellStyles: true,
    });

    const namePart = (user.last_name || user.first_name || 'Contractor')
      .replace(/[^A-Za-z0-9]/g, '_');
    const filename = format === 'master-xlsx'
      ? `TaxReport_Master_${namePart}_${year}.xlsx`
      : `TaxRecords_${namePart}_${year}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('POST tax-export exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
