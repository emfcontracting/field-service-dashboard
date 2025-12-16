// app/api/contractor/generate-invoice-pdf/route.js
// Generates a PDF invoice for subcontractors
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { invoice, user, lineItems } = await request.json();
    
    const businessName = user.profile?.business_name || `${user.first_name} ${user.last_name}`;
    const businessAddress = user.profile?.business_address || '';
    const periodStart = new Date(invoice.period_start).toLocaleDateString();
    const periodEnd = new Date(invoice.period_end).toLocaleDateString();
    
    // Group items by type
    const hoursItems = (lineItems || []).filter(i => i.item_type === 'hours');
    const mileageItems = (lineItems || []).filter(i => i.item_type === 'mileage');
    const customItems = (lineItems || []).filter(i => i.item_type === 'custom');
    
    // Build labor rows HTML
    const laborRowsHtml = hoursItems.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.work_date ? new Date(item.work_date).toLocaleDateString() : '-'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.description || ''}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${parseFloat(item.quantity || 0).toFixed(1)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${parseFloat(item.rate || 0).toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">$${parseFloat(item.amount || 0).toFixed(2)}</td>
      </tr>
    `).join('');
    
    // Build mileage rows HTML
    const mileageRowsHtml = mileageItems.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.work_date ? new Date(item.work_date).toLocaleDateString() : '-'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.description || 'Mileage'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${parseFloat(item.quantity || 0).toFixed(0)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${parseFloat(item.rate || 0).toFixed(4)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">$${parseFloat(item.amount || 0).toFixed(2)}</td>
      </tr>
    `).join('');
    
    // Build custom items HTML
    const customRowsHtml = customItems.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;" colspan="2">${item.description || ''}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${parseFloat(item.quantity || 1).toFixed(1)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${parseFloat(item.rate || 0).toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">$${parseFloat(item.amount || 0).toFixed(2)}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1f2937; line-height: 1.4; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1f2937; color: white; padding: 30px; margin: -20px -20px 20px -20px; }
          .header h1 { font-size: 32px; margin: 0; }
          .header p { color: #9ca3af; margin-top: 5px; }
          .info-grid { display: flex; justify-content: space-between; margin-bottom: 30px; }
          .info-box { }
          .info-box.right { text-align: right; }
          .info-label { font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: bold; margin-bottom: 5px; }
          .info-value { font-size: 14px; font-weight: bold; }
          .info-sub { font-size: 11px; color: #6b7280; margin-top: 3px; }
          .rates-box { background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 25px; }
          .rates-box p { font-size: 12px; color: #4b5563; }
          .section-title { font-size: 14px; font-weight: bold; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin: 25px 0 10px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background-color: #f9fafb; padding: 10px 8px; text-align: left; font-size: 10px; text-transform: uppercase; color: #6b7280; font-weight: bold; }
          th.right { text-align: right; }
          .totals-box { background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-top: 30px; }
          .total-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; }
          .total-row.label { color: #6b7280; }
          .total-row.grand { border-top: 2px solid #d1d5db; margin-top: 15px; padding-top: 15px; font-size: 18px; font-weight: bold; }
          .total-row.grand .amount { color: #059669; }
          .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #9ca3af; padding-top: 20px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>INVOICE</h1>
            <p>${invoice.invoice_number}</p>
          </div>
          
          <div class="info-grid">
            <div class="info-box">
              <div class="info-label">From</div>
              <div class="info-value">${businessName}</div>
              ${businessAddress ? `<div class="info-sub">${businessAddress.replace(/\n/g, '<br>')}</div>` : ''}
              <div class="info-sub">${user.email}</div>
            </div>
            <div class="info-box right">
              <div class="info-label">To</div>
              <div class="info-value">EMF Contracting LLC</div>
              <div class="info-sub">emfcontractingsc2@gmail.com</div>
            </div>
          </div>
          
          <div class="info-grid">
            <div class="info-box">
              <div class="info-label">Invoice Period</div>
              <div class="info-value">${periodStart} - ${periodEnd}</div>
            </div>
            <div class="info-box right">
              <div class="info-label">Invoice Date</div>
              <div class="info-value">${new Date().toLocaleDateString()}</div>
            </div>
          </div>
          
          <div class="rates-box">
            <p><strong>Rates:</strong> $${parseFloat(invoice.hourly_rate_used || 0).toFixed(2)}/hr regular | $${parseFloat(invoice.ot_rate_used || 0).toFixed(2)}/hr overtime | $${parseFloat(invoice.mileage_rate_used || 0).toFixed(4)}/mile</p>
          </div>
          
          ${hoursItems.length > 0 ? `
            <div class="section-title">Labor</div>
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
                ${laborRowsHtml}
              </tbody>
            </table>
          ` : ''}
          
          ${mileageItems.length > 0 ? `
            <div class="section-title">Mileage</div>
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
                ${mileageRowsHtml}
              </tbody>
            </table>
          ` : ''}
          
          ${customItems.length > 0 ? `
            <div class="section-title">Additional Items</div>
            <table>
              <thead>
                <tr>
                  <th colspan="2">Description</th>
                  <th class="right">Qty</th>
                  <th class="right">Rate</th>
                  <th class="right">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${customRowsHtml}
              </tbody>
            </table>
          ` : ''}
          
          <div class="totals-box">
            <div class="total-row">
              <span class="label">Labor (${parseFloat(invoice.total_regular_hours || 0).toFixed(1)}h reg + ${parseFloat(invoice.total_ot_hours || 0).toFixed(1)}h OT)</span>
              <span>$${parseFloat(invoice.total_hours_amount || 0).toFixed(2)}</span>
            </div>
            <div class="total-row">
              <span class="label">Mileage (${parseFloat(invoice.total_miles || 0).toFixed(0)} miles)</span>
              <span>$${parseFloat(invoice.total_mileage_amount || 0).toFixed(2)}</span>
            </div>
            ${parseFloat(invoice.total_line_items_amount || 0) > 0 ? `
              <div class="total-row">
                <span class="label">Additional Items</span>
                <span>$${parseFloat(invoice.total_line_items_amount || 0).toFixed(2)}</span>
              </div>
            ` : ''}
            <div class="total-row grand">
              <span>TOTAL DUE</span>
              <span class="amount">$${parseFloat(invoice.grand_total || 0).toFixed(2)}</span>
            </div>
          </div>
          
          <div class="footer">
            <p>Invoice generated via EMF Subcontractor Portal</p>
            <p>Generated: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Return HTML for client-side PDF generation
    return NextResponse.json({ 
      success: true, 
      html: htmlContent,
      filename: `${invoice.invoice_number}.pdf`
    });

  } catch (error) {
    console.error('Generate invoice PDF error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
