// app/api/aging/cron/route.js
// This endpoint is called daily by Vercel Cron at 8 AM EST (13:00 UTC)

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

export async function GET(request) {
  // Verify cron secret (optional but recommended for security)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // In production, you may want to enforce this
    console.log('Cron authorization header mismatch (continuing anyway for now)');
  }

  console.log('Running daily aging alert cron job...');

  try {
    // Get all work orders with lead tech assigned that are not completed
    const { data: workOrders, error } = await supabase
      .from('work_orders')
      .select(`
        *,
        lead_tech:users!lead_tech_id(user_id, first_name, last_name, email)
      `)
      .not('lead_tech_id', 'is', null)
      .neq('status', 'completed')
      .neq('status', 'needs_return')
      .eq('acknowledged', false)
      .eq('is_locked', false);

    if (error) throw error;

    const now = new Date();
    const agingWorkOrders = [];

    // Calculate aging for each work order
    for (const wo of workOrders || []) {
      const assignedDate = wo.lead_tech_assigned_at 
        ? new Date(wo.lead_tech_assigned_at)
        : wo.date_entered 
          ? new Date(wo.date_entered)
          : null;

      if (!assignedDate || isNaN(assignedDate.getTime())) continue;

      const diffTime = now - assignedDate;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      // Only include work orders 2+ days old
      if (diffDays >= 2) {
        let severity = 'stale';
        if (diffDays >= 5) severity = 'critical';
        else if (diffDays >= 3) severity = 'warning';

        agingWorkOrders.push({
          ...wo,
          aging: {
            days: diffDays,
            hours: diffHours,
            severity,
            assignedDate
          }
        });
      }
    }

    console.log(`Found ${agingWorkOrders.length} aging work orders`);

    if (agingWorkOrders.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'No aging work orders found',
        emailsSent: 0 
      });
    }

    // Group work orders by tech
    const woByTech = {};

    for (const wo of agingWorkOrders) {
      // Add to lead tech's list
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

      // Also get team members
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
            if (!woByTech[memberId].workOrders.find(w => w.wo_id === wo.wo_id)) {
              woByTech[memberId].workOrders.push(wo);
            }
          }
        }
      }
    }

    let emailsSent = 0;
    const emailResults = [];

    // Send emails to each tech
    for (const [techId, data] of Object.entries(woByTech)) {
      let { tech, workOrders: techWOs } = data;

      if (!tech?.email) {
        const { data: techData } = await supabase
          .from('users')
          .select('email, first_name, last_name')
          .eq('user_id', techId)
          .single();

        if (!techData?.email) continue;
        tech = techData;
      }

      const techEmail = tech.email;
      const techName = `${tech.first_name} ${tech.last_name}`;

      const criticalCount = techWOs.filter(wo => wo.aging?.severity === 'critical').length;
      const warningCount = techWOs.filter(wo => wo.aging?.severity === 'warning').length;
      const staleCount = techWOs.filter(wo => wo.aging?.severity === 'stale').length;

      const subject = criticalCount > 0 
        ? `🚨 CRITICAL: ${techWOs.length} Aging Work Orders Require Attention`
        : `⚠️ Daily Aging Alert: ${techWOs.length} Work Orders Open 2+ Days`;

      const workOrdersHtml = techWOs
        .sort((a, b) => b.aging.days - a.aging.days)
        .map(wo => {
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
            .header h1 { margin: 0; color: white; font-size: 20px; }
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
              <h1>⚠️ Daily Aging Work Order Alert</h1>
            </div>
            
            <div class="content">
              <p>Hi ${techName},</p>
              
              <p>You have <strong>${techWOs.length} work order(s)</strong> that have been open for 2 or more days:</p>
              
              <div style="display: flex; gap: 10px; margin: 20px 0;">
                ${criticalCount > 0 ? `
                  <div style="flex: 1; text-align: center; padding: 15px; background-color: #7f1d1d; border-radius: 8px;">
                    <div style="font-size: 24px; font-weight: bold; color: #ef4444;">${criticalCount}</div>
                    <div style="font-size: 11px; color: #fca5a5;">🔴 Critical (5+ days)</div>
                  </div>
                ` : ''}
                ${warningCount > 0 ? `
                  <div style="flex: 1; text-align: center; padding: 15px; background-color: #78350f; border-radius: 8px;">
                    <div style="font-size: 24px; font-weight: bold; color: #f97316;">${warningCount}</div>
                    <div style="font-size: 11px; color: #fdba74;">🟠 Warning (3-4 days)</div>
                  </div>
                ` : ''}
                ${staleCount > 0 ? `
                  <div style="flex: 1; text-align: center; padding: 15px; background-color: #713f12; border-radius: 8px;">
                    <div style="font-size: 24px; font-weight: bold; color: #eab308;">${staleCount}</div>
                    <div style="font-size: 11px; color: #fde047;">🟡 Stale (2-3 days)</div>
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
                You will receive this email daily until all work orders are resolved.
              </p>
            </div>
            
            <div class="footer">
              <p>EMF Contracting LLC - Field Service Management</p>
              <p>Sent: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST</p>
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
        emailResults.push({ tech: techName, email: techEmail, status: 'sent', woCount: techWOs.length });
        console.log(`Sent daily aging alert to ${techName} (${techEmail}) - ${techWOs.length} WOs`);
      } catch (emailError) {
        console.error(`Failed to send email to ${techEmail}:`, emailError);
        emailResults.push({ tech: techName, email: techEmail, status: 'failed', error: emailError.message });
      }
    }

    console.log(`Daily aging cron completed. Sent ${emailsSent} emails.`);

    return Response.json({ 
      success: true, 
      message: `Daily aging alerts sent`,
      totalAgingWOs: agingWorkOrders.length,
      emailsSent,
      results: emailResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in aging cron job:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
