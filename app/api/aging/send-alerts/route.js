// app/api/aging/send-alerts/route.js
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Email transporter configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'emfcbre@gmail.com',
    pass: process.env.EMAIL_PASS
  }
});

export async function POST(request) {
  try {
    const { workOrders } = await request.json();

    if (!workOrders || workOrders.length === 0) {
      return Response.json({ success: true, emailsSent: 0, message: 'No aging work orders' });
    }

    // Group work orders by tech for digest emails
    const woByTech = {};

    for (const wo of workOrders) {
      // Get lead tech info
      if (wo.lead_tech_id) {
        const techId = wo.lead_tech_id;
        if (!woByTech[techId]) {
          woByTech[techId] = {
            tech: wo.lead_tech,
            workOrders: []
          };
        }
        woByTech[techId].workOrders.push(wo);
      }

      // Also get team members for each work order and add to their digest
      const { data: assignments } = await supabase
        .from('work_order_assignments')
        .select(`
          user_id,
          user:users(user_id, first_name, last_name, email)
        `)
        .eq('wo_id', wo.wo_id);

      if (assignments) {
        for (const assignment of assignments) {
          if (assignment.user?.user_id && assignment.user?.email) {
            const memberId = assignment.user.user_id;
            if (!woByTech[memberId]) {
              woByTech[memberId] = {
                tech: assignment.user,
                workOrders: []
              };
            }
            // Avoid duplicates
            if (!woByTech[memberId].workOrders.find(w => w.wo_id === wo.wo_id)) {
              woByTech[memberId].workOrders.push(wo);
            }
          }
        }
      }
    }

    let emailsSent = 0;
    const emailResults = [];

    // Send individual digest emails to each tech
    for (const [techId, data] of Object.entries(woByTech)) {
      let { tech, workOrders: techWOs } = data;
      
      if (!tech?.email) {
        // Try to get tech email from database
        const { data: techData } = await supabase
          .from('users')
          .select('email, first_name, last_name')
          .eq('user_id', techId)
          .single();

        if (!techData?.email) {
          console.log(`No email found for tech ${techId}`);
          continue;
        }
        
        tech = techData;
      }

      const techEmail = tech.email;
      const techName = `${tech.first_name} ${tech.last_name}`;

      // Build email content
      const criticalCount = techWOs.filter(wo => wo.aging?.severity === 'critical').length;
      const warningCount = techWOs.filter(wo => wo.aging?.severity === 'warning').length;
      const staleCount = techWOs.filter(wo => wo.aging?.severity === 'stale').length;

      const subject = criticalCount > 0 
        ? `🚨 CRITICAL: ${techWOs.length} Aging Work Orders Require Attention`
        : `⚠️ Aging Alert: ${techWOs.length} Work Orders Open 2+ Days`;

      const workOrdersHtml = techWOs.map(wo => {
        const severityColor = wo.aging?.severity === 'critical' ? '#ef4444' 
          : wo.aging?.severity === 'warning' ? '#f97316' 
          : '#eab308';
        const severityLabel = wo.aging?.severity?.toUpperCase() || 'STALE';
        
        return `
          <tr style="border-bottom: 1px solid #374151;">
            <td style="padding: 12px; background-color: ${severityColor}20;">
              <span style="color: ${severityColor}; font-weight: bold;">${severityLabel}</span>
            </td>
            <td style="padding: 12px;">
              <strong>${wo.wo_number}</strong><br/>
              <span style="color: #9ca3af; font-size: 12px;">${wo.building}</span>
            </td>
            <td style="padding: 12px; color: #9ca3af; font-size: 13px;">
              ${wo.work_order_description?.substring(0, 80)}${wo.work_order_description?.length > 80 ? '...' : ''}
            </td>
            <td style="padding: 12px; text-align: center;">
              <span style="color: ${severityColor}; font-size: 18px; font-weight: bold;">
                ${wo.aging?.days || '?'} days
              </span>
            </td>
          </tr>
        `;
      }).join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background-color: #1f2937; color: #ffffff; padding: 20px; }
            .container { max-width: 700px; margin: 0 auto; background-color: #111827; border-radius: 8px; overflow: hidden; }
            .header { background-color: #dc2626; padding: 20px; text-align: center; }
            .header h1 { margin: 0; color: white; }
            .content { padding: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th { background-color: #374151; padding: 12px; text-align: left; font-size: 12px; color: #9ca3af; text-transform: uppercase; }
            .footer { padding: 20px; text-align: center; background-color: #1f2937; font-size: 12px; color: #6b7280; }
            .btn { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Aging Work Order Alert</h1>
            </div>
            
            <div class="content">
              <p>Hi ${techName},</p>
              
              <p>You have <strong>${techWOs.length} work order(s)</strong> that have been open for 2 or more days since assignment:</p>
              
              <div style="display: flex; gap: 10px; margin: 20px 0;">
                ${criticalCount > 0 ? `
                  <div style="flex: 1; text-align: center; padding: 15px; background-color: #7f1d1d; border-radius: 8px;">
                    <div style="font-size: 28px; font-weight: bold; color: #ef4444;">${criticalCount}</div>
                    <div style="font-size: 12px; color: #fca5a5;">🔴 Critical (5+ days)</div>
                  </div>
                ` : ''}
                ${warningCount > 0 ? `
                  <div style="flex: 1; text-align: center; padding: 15px; background-color: #78350f; border-radius: 8px;">
                    <div style="font-size: 28px; font-weight: bold; color: #f97316;">${warningCount}</div>
                    <div style="font-size: 12px; color: #fdba74;">🟠 Warning (3-4 days)</div>
                  </div>
                ` : ''}
                ${staleCount > 0 ? `
                  <div style="flex: 1; text-align: center; padding: 15px; background-color: #713f12; border-radius: 8px;">
                    <div style="font-size: 28px; font-weight: bold; color: #eab308;">${staleCount}</div>
                    <div style="font-size: 12px; color: #fde047;">🟡 Stale (2-3 days)</div>
                  </div>
                ` : ''}
              </div>
              
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Work Order</th>
                    <th>Description</th>
                    <th>Age</th>
                  </tr>
                </thead>
                <tbody>
                  ${workOrdersHtml}
                </tbody>
              </table>
              
              <div style="text-align: center; margin-top: 30px;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://field-service-dashboard.vercel.app'}/mobile" class="btn">
                  📱 Open Mobile App
                </a>
              </div>
              
              <p style="margin-top: 30px; color: #9ca3af; font-size: 13px;">
                Please update the status or complete these work orders as soon as possible.
                This email will be sent daily until all work orders are resolved.
              </p>
            </div>
            
            <div class="footer">
              <p>EMF Contracting LLC - Field Service Management</p>
              <p>This is an automated message. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        await transporter.sendMail({
          from: `"EMF Contracting Alerts" <${process.env.EMAIL_USER || 'emfcbre@gmail.com'}>`,
          to: techEmail,
          subject: subject,
          html: htmlContent
        });

        emailsSent++;
        emailResults.push({ tech: techName, email: techEmail, status: 'sent' });
        console.log(`Sent aging alert to ${techName} (${techEmail})`);
      } catch (emailError) {
        console.error(`Failed to send email to ${techEmail}:`, emailError);
        emailResults.push({ tech: techName, email: techEmail, status: 'failed', error: emailError.message });
      }
    }

    return Response.json({ 
      success: true, 
      emailsSent, 
      results: emailResults,
      message: `Sent ${emailsSent} aging alert emails`
    });

  } catch (error) {
    console.error('Error sending aging alerts:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// GET endpoint to check aging status (can be called by cron)
export async function GET(request) {
  try {
    // Get all work orders with lead tech assigned that are not completed
    const { data: workOrders, error } = await supabase
      .from('work_orders')
      .select(`
        *,
        lead_tech:users!lead_tech_id(user_id, first_name, last_name, email)
      `)
      .not('lead_tech_id', 'is', null)
      .not('status', 'in', '("completed","needs_return")')
      .eq('acknowledged', false);

    if (error) throw error;

    const now = new Date();
    const agingWorkOrders = [];

    for (const wo of workOrders || []) {
      const assignedDate = wo.lead_tech_assigned_at 
        ? new Date(wo.lead_tech_assigned_at)
        : wo.date_entered 
          ? new Date(wo.date_entered)
          : null;

      if (!assignedDate) continue;

      const diffTime = now - assignedDate;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= 2) {
        let severity = 'stale';
        if (diffDays >= 5) severity = 'critical';
        else if (diffDays >= 3) severity = 'warning';

        agingWorkOrders.push({
          ...wo,
          aging: {
            days: diffDays,
            severity,
            assignedDate
          }
        });
      }
    }

    return Response.json({
      success: true,
      total: agingWorkOrders.length,
      critical: agingWorkOrders.filter(wo => wo.aging.severity === 'critical').length,
      warning: agingWorkOrders.filter(wo => wo.aging.severity === 'warning').length,
      stale: agingWorkOrders.filter(wo => wo.aging.severity === 'stale').length,
      workOrders: agingWorkOrders
    });

  } catch (error) {
    console.error('Error checking aging:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
