// app/api/contractor/send-invoice/route.js
// Sends subcontractor invoice via email
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'emfcbre@gmail.com',
    pass: process.env.EMAIL_PASS
  }
});

export async function POST(request) {
  try {
    const { invoice, user, hoursData, lineItems, rates, totals, sendToEmail } = await request.json();

    const toEmail = sendToEmail || 'emfcontractingsc2@gmail.com';
    const businessName = user.profile?.business_name || `${user.first_name} ${user.last_name}`;
    const businessAddress = user.profile?.business_address || '';

    // Build hours rows HTML
    const hoursRowsHtml = hoursData.map(entry => {
      const regAmount = parseFloat(entry.hours_regular || 0) * rates.hourly;
      const otAmount = parseFloat(entry.hours_overtime || 0) * rates.ot;
      const mileAmount = parseFloat(entry.miles || 0) * rates.mileage;
      const rowTotal = regAmount + otAmount + mileAmount;

      return `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px;">${new Date(entry.work_date).toLocaleDateString()}</td>
          <td style="padding: 8px;">
            <strong>${entry.work_order?.wo_number || 'N/A'}</strong><br/>
            <span style="color: #6b7280; font-size: 11px;">${entry.work_order?.building || ''}</span>
          </td>
          <td style="padding: 8px; text-align: right;">${parseFloat(entry.hours_regular || 0).toFixed(1)}</td>
          <td style="padding: 8px; text-align: right;">${parseFloat(entry.hours_overtime || 0).toFixed(1)}</td>
          <td style="padding: 8px; text-align: right;">${parseFloat(entry.miles || 0).toFixed(0)}</td>
          <td style="padding: 8px; text-align: right; font-weight: bold;">$${rowTotal.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    // Build line items HTML
    const lineItemsHtml = (lineItems || []).filter(item => item.description && item.amount > 0).map(item => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 8px;" colspan="4">${item.description}</td>
        <td style="padding: 8px; text-align: right;">${parseFloat(item.quantity || 1).toFixed(1)}</td>
        <td style="padding: 8px; text-align: right; font-weight: bold;">$${parseFloat(item.amount || 0).toFixed(2)}</td>
      </tr>
    `).join('');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head></head>
      <body style="font-family: Arial, sans-serif; background-color: #f3f4f6; padding: 20px; margin: 0;">
        <div style="max-width: 700px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background-color: #1f2937; padding: 30px; color: white;">
            <h1 style="margin: 0; font-size: 28px;">INVOICE</h1>
            <p style="margin: 5px 0 0; opacity: 0.8;">${invoice.invoice_number}</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 30px;">
            
            <!-- From/To -->
            <table style="width: 100%; margin-bottom: 30px;">
              <tr>
                <td style="vertical-align: top; width: 50%;">
                  <p style="margin: 0 0 10px; color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: bold;">From</p>
                  <p style="margin: 0; font-weight: bold; font-size: 16px;">${businessName}</p>
                  ${businessAddress ? `<p style="margin: 5px 0 0; color: #6b7280; font-size: 13px;">${businessAddress.replace(/\n/g, '<br/>')}</p>` : ''}
                  <p style="margin: 5px 0 0; color: #6b7280; font-size: 13px;">${user.email}</p>
                </td>
                <td style="vertical-align: top; width: 50%; text-align: right;">
                  <p style="margin: 0 0 10px; color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: bold;">To</p>
                  <p style="margin: 0; font-weight: bold; font-size: 16px;">EMF Contracting LLC</p>
                  <p style="margin: 5px 0 0; color: #6b7280; font-size: 13px;">${toEmail}</p>
                </td>
              </tr>
            </table>

            <!-- Invoice Details -->
            <div style="margin-bottom: 20px; padding: 15px; background-color: #f9fafb; border-radius: 8px;">
              <p style="margin: 0; font-size: 13px;">
                <strong>Period:</strong> ${new Date(invoice.period_start).toLocaleDateString()} - ${new Date(invoice.period_end).toLocaleDateString()}
              </p>
              <p style="margin: 5px 0 0; font-size: 13px;">
                <strong>Rates:</strong> $${rates.hourly}/hr regular | $${rates.ot}/hr OT | $${rates.mileage}/mile
              </p>
            </div>

            <!-- Labor & Mileage Table -->
            <h3 style="margin: 0 0 10px; font-size: 14px; color: #374151;">Labor & Mileage</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
              <thead>
                <tr style="background-color: #f3f4f6;">
                  <th style="padding: 10px 8px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280;">Date</th>
                  <th style="padding: 10px 8px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280;">Work Order</th>
                  <th style="padding: 10px 8px; text-align: right; font-size: 11px; text-transform: uppercase; color: #6b7280;">Reg</th>
                  <th style="padding: 10px 8px; text-align: right; font-size: 11px; text-transform: uppercase; color: #6b7280;">OT</th>
                  <th style="padding: 10px 8px; text-align: right; font-size: 11px; text-transform: uppercase; color: #6b7280;">Miles</th>
                  <th style="padding: 10px 8px; text-align: right; font-size: 11px; text-transform: uppercase; color: #6b7280;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${hoursRowsHtml}
              </tbody>
            </table>

            ${lineItemsHtml ? `
              <h3 style="margin: 20px 0 10px; font-size: 14px; color: #374151;">Additional Items</h3>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
                <thead>
                  <tr style="background-color: #f3f4f6;">
                    <th style="padding: 10px 8px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280;" colspan="4">Description</th>
                    <th style="padding: 10px 8px; text-align: right; font-size: 11px; text-transform: uppercase; color: #6b7280;">Qty</th>
                    <th style="padding: 10px 8px; text-align: right; font-size: 11px; text-transform: uppercase; color: #6b7280;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${lineItemsHtml}
                </tbody>
              </table>
            ` : ''}

            <!-- Totals -->
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-top: 20px;">
              <table style="width: 100%; font-size: 14px;">
                <tr>
                  <td style="padding: 5px 0; color: #6b7280;">Regular Hours (${totals.totalRegularHours.toFixed(1)}h × $${rates.hourly})</td>
                  <td style="padding: 5px 0; text-align: right;">$${(totals.totalRegularHours * rates.hourly).toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #6b7280;">OT Hours (${totals.totalOTHours.toFixed(1)}h × $${rates.ot})</td>
                  <td style="padding: 5px 0; text-align: right;">$${(totals.totalOTHours * rates.ot).toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #6b7280;">Mileage (${totals.totalMiles.toFixed(0)} mi × $${rates.mileage})</td>
                  <td style="padding: 5px 0; text-align: right;">$${totals.mileageAmount.toFixed(2)}</td>
                </tr>
                ${totals.lineItemsAmount > 0 ? `
                <tr>
                  <td style="padding: 5px 0; color: #6b7280;">Additional Items</td>
                  <td style="padding: 5px 0; text-align: right;">$${totals.lineItemsAmount.toFixed(2)}</td>
                </tr>
                ` : ''}
                <tr style="border-top: 2px solid #d1d5db;">
                  <td style="padding: 15px 0 0; font-size: 20px; font-weight: bold;">TOTAL DUE</td>
                  <td style="padding: 15px 0 0; text-align: right; font-size: 24px; font-weight: bold; color: #059669;">$${totals.grandTotal.toFixed(2)}</td>
                </tr>
              </table>
            </div>

          </div>

          <!-- Footer -->
          <div style="padding: 20px; text-align: center; background-color: #f3f4f6; font-size: 12px; color: #6b7280;">
            <p style="margin: 0;">Invoice generated via EMF Subcontractor Portal</p>
            <p style="margin: 5px 0 0;">Sent: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST</p>
          </div>

        </div>
      </body>
      </html>
    `;

    // Send email
    await transporter.sendMail({
      from: `"${businessName}" <${process.env.EMAIL_USER || 'emfcbre@gmail.com'}>`,
      to: toEmail,
      replyTo: user.email,
      subject: `Subcontractor Invoice ${invoice.invoice_number} - ${businessName} - $${totals.grandTotal.toFixed(2)}`,
      html: emailHtml
    });

    return Response.json({ success: true });

  } catch (error) {
    console.error('Send invoice error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
