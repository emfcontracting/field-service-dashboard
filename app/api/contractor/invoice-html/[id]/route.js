import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Helper function to format date without timezone shift
function formatDateLocal(dateString) {
  if (!dateString) return '-';
  const [year, month, day] = dateString.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[month - 1]} ${day}, ${year}`;
}

export async function GET(request, { params }) {
  const { id } = params;

  try {
    // Get invoice data
    const { data: invoice, error: invoiceError } = await supabase
      .from('subcontractor_invoices')
      .select('*')
      .eq('invoice_id', id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Get user data
    const { data: userData } = await supabase
      .from('users')
      .select('first_name, last_name, email')
      .eq('user_id', invoice.user_id)
      .single();

    // Get subcontractor profile
    const { data: profile } = await supabase
      .from('subcontractor_profiles')
      .select('business_name, business_address')
      .eq('user_id', invoice.user_id)
      .single();

    // Get line items
    const { data: lineItems } = await supabase
      .from('subcontractor_invoice_items')
      .select('*')
      .eq('invoice_id', id)
      .order('work_date', { ascending: true });

    const businessName = profile?.business_name || `${userData?.first_name || ''} ${userData?.last_name || ''}`.trim() || 'Unknown';
    const businessAddress = profile?.business_address || '';
    const userEmail = userData?.email || '';

    const hoursItems = (lineItems || []).filter(i => i.item_type === 'hours');
    const mileageItems = (lineItems || []).filter(i => i.item_type === 'mileage');
    const materialItems = (lineItems || []).filter(i => i.item_type === 'material');
    const customItems = (lineItems || []).filter(i => i.item_type === 'custom');

    // Generate HTML for PDF
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Invoice ${invoice.invoice_number}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; padding: 20px; background: #fff; color: #333; font-size: 12px; }
    .toolbar { background: #1f2937; padding: 16px; margin: -20px -20px 20px -20px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
    .toolbar button, .toolbar a { background: #3b82f6; color: white; padding: 14px 28px; border-radius: 8px; font-weight: bold; border: none; font-size: 16px; cursor: pointer; text-decoration: none; display: inline-block; }
    .toolbar button:active, .toolbar a:active { background: #1d4ed8; }
    .invoice { max-width: 700px; margin: 0 auto; }
    .header { background: #1f2937; color: white; padding: 20px; margin-bottom: 20px; }
    .header h1 { font-size: 24px; margin-bottom: 4px; }
    .header .number { color: #9ca3af; font-size: 14px; }
    .header-flex { display: flex; justify-content: space-between; align-items: flex-start; }
    .period { text-align: right; }
    .period-label { font-size: 11px; color: #9ca3af; }
    .period-value { font-size: 13px; margin-top: 4px; }
    .addresses { display: flex; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 16px; }
    .address-block { flex: 1; min-width: 180px; }
    .address-block.right { text-align: right; }
    .label { font-size: 10px; color: #666; text-transform: uppercase; font-weight: bold; margin-bottom: 8px; }
    .name { font-weight: bold; font-size: 14px; }
    .detail { color: #4b5563; font-size: 12px; margin-top: 2px; }
    .rates { background: #f3f4f6; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; font-size: 11px; color: #4b5563; }
    .section { margin-bottom: 16px; }
    .section h3 { font-size: 13px; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 10px; font-weight: bold; }
    .section h3.orange { color: #ea580c; border-color: #fed7aa; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { text-align: left; color: #6b7280; padding: 6px 4px; border-bottom: 1px solid #e5e7eb; font-weight: normal; }
    th.right, td.right { text-align: right; }
    td { padding: 6px 4px; border-bottom: 1px solid #f3f4f6; }
    td.bold { font-weight: bold; }
    td.orange { color: #ea580c; font-weight: bold; }
    .totals { background: #f9fafb; padding: 16px; border-radius: 6px; margin-top: 20px; }
    .total-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px; }
    .total-row .lbl { color: #4b5563; }
    .total-row .lbl.orange { color: #ea580c; }
    .total-row .val.orange { color: #ea580c; }
    .grand-total { border-top: 2px solid #d1d5db; padding-top: 12px; margin-top: 12px; }
    .grand-total .total-row { font-size: 18px; font-weight: bold; }
    .grand-total .val { color: #059669; }
    .sent-info { text-align: center; margin-top: 16px; font-size: 11px; color: #6b7280; }
    @media print {
      .toolbar { display: none !important; }
      body { padding: 0; }
    }
    @media (max-width: 500px) {
      .header-flex { flex-direction: column; gap: 12px; }
      .period { text-align: left; }
      .address-block.right { text-align: left; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">🖨️ Print / Save PDF</button>
    <a href="mailto:emfcontractingsc2@gmail.com?subject=Invoice ${invoice.invoice_number}&body=Please find attached invoice ${invoice.invoice_number} for the period ${formatDateLocal(invoice.period_start)} - ${formatDateLocal(invoice.period_end)}.%0A%0ATotal: $${parseFloat(invoice.grand_total || 0).toFixed(2)}%0A%0AThank you,%0A${businessName}">📧 Email to EMF</a>
  </div>

  <div class="invoice">
    <div class="header">
      <div class="header-flex">
        <div>
          <h1>INVOICE</h1>
          <div class="number">${invoice.invoice_number}</div>
        </div>
        <div class="period">
          <div class="period-label">Period</div>
          <div class="period-value">${formatDateLocal(invoice.period_start)} - ${formatDateLocal(invoice.period_end)}</div>
        </div>
      </div>
    </div>

    <div class="addresses">
      <div class="address-block">
        <div class="label">From</div>
        <div class="name">${businessName}</div>
        ${businessAddress ? `<div class="detail">${businessAddress.replace(/\n/g, '<br>')}</div>` : ''}
        <div class="detail">${userEmail}</div>
      </div>
      <div class="address-block right">
        <div class="label">To</div>
        <div class="name">EMF Contracting LLC</div>
        <div class="detail">565 Pine Plain Rd</div>
        <div class="detail">Gaston, SC 29075</div>
        <div class="detail">emfcontractingsc2@gmail.com</div>
      </div>
    </div>

    <div class="rates">
      <strong>Rates:</strong> $${parseFloat(invoice.hourly_rate_used || 0).toFixed(2)}/hr regular | $${parseFloat(invoice.ot_rate_used || 0).toFixed(2)}/hr OT | $${parseFloat(invoice.mileage_rate_used || 0).toFixed(4)}/mile
    </div>

    ${hoursItems.length > 0 ? `
    <div class="section">
      <h3>Labor</h3>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th class="right">Hours</th>
            <th class="right">Rate</th>
            <th class="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${hoursItems.map(item => `
          <tr>
            <td>${item.work_date ? formatDateLocal(item.work_date) : '-'}</td>
            <td>${item.description || ''}</td>
            <td class="right">${parseFloat(item.quantity || 0).toFixed(1)}</td>
            <td class="right">$${parseFloat(item.rate || 0).toFixed(2)}</td>
            <td class="right bold">$${parseFloat(item.amount || 0).toFixed(2)}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${mileageItems.length > 0 ? `
    <div class="section">
      <h3>Mileage</h3>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th class="right">Miles</th>
            <th class="right">Rate</th>
            <th class="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${mileageItems.map(item => `
          <tr>
            <td>${item.work_date ? formatDateLocal(item.work_date) : '-'}</td>
            <td>${item.description || 'Mileage'}</td>
            <td class="right">${parseFloat(item.quantity || 0).toFixed(0)}</td>
            <td class="right">$${parseFloat(item.rate || 0).toFixed(4)}</td>
            <td class="right bold">$${parseFloat(item.amount || 0).toFixed(2)}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${materialItems.length > 0 ? `
    <div class="section">
      <h3 class="orange">Material Reimbursement</h3>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th class="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${materialItems.map(item => `
          <tr>
            <td>${item.work_date ? formatDateLocal(item.work_date) : '-'}</td>
            <td>${item.description || ''}</td>
            <td class="right orange">$${parseFloat(item.amount || 0).toFixed(2)}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${customItems.length > 0 ? `
    <div class="section">
      <h3>Additional Items</h3>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="right">Qty</th>
            <th class="right">Rate</th>
            <th class="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${customItems.map(item => `
          <tr>
            <td>${item.description || ''}</td>
            <td class="right">${parseFloat(item.quantity || 0).toFixed(1)}</td>
            <td class="right">$${parseFloat(item.rate || 0).toFixed(2)}</td>
            <td class="right bold">$${parseFloat(item.amount || 0).toFixed(2)}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <div class="totals">
      <div class="total-row">
        <span class="lbl">Labor (${parseFloat(invoice.total_regular_hours || 0).toFixed(1)}h reg + ${parseFloat(invoice.total_ot_hours || 0).toFixed(1)}h OT)</span>
        <span>$${parseFloat(invoice.total_hours_amount || 0).toFixed(2)}</span>
      </div>
      <div class="total-row">
        <span class="lbl">Mileage (${parseFloat(invoice.total_miles || 0).toFixed(0)} miles)</span>
        <span>$${parseFloat(invoice.total_mileage_amount || 0).toFixed(2)}</span>
      </div>
      ${parseFloat(invoice.total_tech_material || 0) > 0 ? `
      <div class="total-row">
        <span class="lbl orange">Material Reimbursement</span>
        <span class="val orange">$${parseFloat(invoice.total_tech_material || 0).toFixed(2)}</span>
      </div>
      ` : ''}
      ${parseFloat(invoice.total_line_items_amount || 0) > 0 ? `
      <div class="total-row">
        <span class="lbl">Additional Items</span>
        <span>$${parseFloat(invoice.total_line_items_amount || 0).toFixed(2)}</span>
      </div>
      ` : ''}
      <div class="grand-total">
        <div class="total-row">
          <span>TOTAL DUE</span>
          <span class="val">$${parseFloat(invoice.grand_total || 0).toFixed(2)}</span>
        </div>
      </div>
    </div>

    ${invoice.sent_at ? `
    <div class="sent-info">
      Sent to ${invoice.sent_to_email} on ${new Date(invoice.sent_at).toLocaleString()}
    </div>
    ` : ''}
  </div>
</body>
</html>
    `;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });

  } catch (error) {
    console.error('Error generating invoice:', error);
    return NextResponse.json({ error: 'Failed to generate invoice' }, { status: 500 });
  }
}
