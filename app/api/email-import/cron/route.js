// app/api/email-import/cron/route.js
// Automatic email import cron job - runs every 10 minutes
// Fetches unread dispatch emails via IMAP, imports them automatically, and notifies office via email

import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { fetchMessages, addFlags, sinceDays } from '@/lib/imap';
import { parseCBREEmail } from '@/lib/cbreEmailParser';
import { requireCronOrStaff } from '@/lib/serverAuth';
import { withCronRun } from '@/lib/cronRun';
import { WO_REF_PATTERN } from '@/lib/cbreEmailParser';

// 50 dispatch e-mails with attachments can take a while; the default 10 s
// (hobby) / 60 s cut runs mid-loop. Vercel Pro allows up to 300.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Email transporter for notifications
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'emfcbre@gmail.com',
    pass: process.env.EMAIL_PASS
  }
});

// Connect to Gmail via IMAP
// IMAP + parsing live in lib/imap.js / lib/cbreEmailParser.js (shared with the
// manual import, backfill, e-mail sync …). Same search as before: unread mails
// of the last 7 days whose subject mentions "Work Order" or "Dispatch".
async function fetchEmails() {
  const { messages } = await fetchMessages({
    account: 'import',
    box: 'INBOX',
    criteria: ['UNSEEN', sinceDays(7), ['OR', ['SUBJECT', 'Work Order'], ['SUBJECT', 'Dispatch']]],
  });
  return messages;
}

// Mark e-mails as read in INBOX — ONE connection for the whole batch.
const markAsRead = (uids) => addFlags({ account: 'import', box: 'INBOX', uids });

// Send email notification to subscribed users.
// Uses notification_subscriptions table (managed in Messages > Notifications tab)
// rather than a hardcoded role list — so adding new subscribers in the UI
// automatically affects auto-import notifications.
async function sendOfficeNotification(importedWOs) {
  try {
    // Pull all users subscribed to 'work_orders_imported'
    const { data: subscriptionRows, error } = await supabase
      .from('notification_subscriptions')
      .select(`
        user_id,
        enabled,
        user:users!notification_subscriptions_user_id_fkey(
          user_id, first_name, last_name, email, is_active
        )
      `)
      .eq('notification_type', 'work_orders_imported')
      .eq('enabled', true);

    if (error) {
      console.error('Failed to query notification_subscriptions:', error);
      return { sent: 0, error: error.message };
    }

    const officeUsers = (subscriptionRows || [])
      .map(row => row.user)
      .filter(u => u && u.is_active && u.email);

    if (officeUsers.length === 0) {
      console.log('No subscribers found for work_orders_imported notification');
      return { sent: 0 };
    }

    const count = importedWOs.length;
    const emergencyCount = importedWOs.filter(wo => (wo.priority === 'P1' || wo.priority === 'emergency')).length;
    
    // Build work order list
    const woList = importedWOs.map(wo => {
      const priorityEmoji = wo.priority === 'P1' ? '🔴' : 
                           wo.priority === 'P2' ? '🟠' : 
                           (wo.priority === 'P3' || wo.priority === 'P4') ? '🟡' : '🟢';
      return `${priorityEmoji} <strong>${wo.wo_number}</strong> - ${wo.building} (${wo.priority.toUpperCase()})`;
    }).join('<br>');

    const subject = emergencyCount > 0 
      ? `🚨 EMERGENCY: ${count} New Work Order${count > 1 ? 's' : ''} Auto-Imported`
      : `📧 ${count} New Work Order${count > 1 ? 's' : ''} Auto-Imported`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${emergencyCount > 0 ? '#dc2626' : '#2563eb'}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .wo-list { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .footer { background: #1f2937; color: #9ca3af; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0;">${emergencyCount > 0 ? '🚨 EMERGENCY ALERT' : '📧 New Work Orders'}</h2>
          </div>
          <div class="content">
            <p><strong>${count} work order${count > 1 ? 's have' : ' has'} been automatically imported from email.</strong></p>
            ${emergencyCount > 0 ? '<p style="color: #dc2626; font-weight: bold;">⚠️ ' + emergencyCount + ' EMERGENCY work order' + (emergencyCount > 1 ? 's' : '') + ' require immediate attention!</p>' : ''}
            <div class="wo-list">
              ${woList}
            </div>
            <p>Please log in to the dashboard to review and assign these work orders.</p>
            <a href="https://field-service-dashboard.vercel.app/dashboard" class="button">Open Dashboard</a>
          </div>
          <div class="footer">
            EMF Contracting LLC - PCS FieldService<br>
            Automated notification - Do not reply
          </div>
        </div>
      </body>
      </html>
    `;

    let sent = 0;
    for (const user of officeUsers) {
      if (!user.email) continue;
      
      try {
        await transporter.sendMail({
          from: `"EMF FieldService" <${process.env.EMAIL_USER || 'emfcbre@gmail.com'}>`,
          to: user.email,
          subject: subject,
          html: htmlBody
        });
        sent++;
        console.log(`Email sent to ${user.first_name} ${user.last_name} (${user.email})`);
      } catch (e) {
        console.error(`Failed to send email to ${user.first_name}:`, e.message);
      }
    }

    return { sent };
  } catch (e) {
    console.error('Error sending office notifications:', e);
    return { sent: 0, error: e.message };
  }
}

// Log import activity
async function logImportActivity(results) {
  try {
    await supabase
      .from('system_logs')
      .insert({
        log_type: 'email_import',
        message: results.message || 'Email import completed',
        status: results.success ? 'success' : 'failed',
        metadata: results
      });
  } catch (e) {
    console.log('Could not log activity:', e.message);
  }
}

// Main cron handler
// ─────────────────────────────────────────────────────────────────────────────
// Sub work order linking (Escalations).
// If the new WO's text mentions another WO number that is currently disputed
// (open / escalated / sub_wo_requested) and has no sub-WO yet, record this WO
// as its sub work order and leave a note on both sides. Returns the original
// WO number when a link was made, otherwise null.
// ─────────────────────────────────────────────────────────────────────────────

async function linkSubWorkOrder(insertedWO, workOrder) {
  const haystack = `${workOrder.work_order_description || ''}\n${workOrder.comments || ''}`;
  const own = String(workOrder.wo_number || '').toUpperCase();
  const refs = [...new Set((haystack.match(WO_REF_PATTERN) || []).map(x => x.toUpperCase()))].filter(x => x !== own);
  if (!refs.length) return null;

  const { data: originals, error } = await supabase
    .from('work_orders')
    .select('wo_id, wo_number, dispute_status, dispute_sub_wo, dispute_notes')
    .in('wo_number', refs)
    .in('dispute_status', ['open', 'escalated', 'sub_wo_requested'])
    .is('dispute_sub_wo', null)
    .limit(1);
  if (error || !originals?.length) return null;

  const orig = originals[0];
  const stamp = new Date().toLocaleDateString('en-US');
  const note = `${stamp} — Sub-WO ${own} received from CBRE (auto-linked by e-mail import)`;
  await supabase
    .from('work_orders')
    .update({
      dispute_sub_wo: own,
      dispute_notes: orig.dispute_notes ? `${orig.dispute_notes}\n${note}` : note,
    })
    .eq('wo_id', orig.wo_id);
  await supabase
    .from('work_orders')
    .update({ comments: `${workOrder.comments || ''}\n[Sub-WO for disputed ${orig.wo_number} — see Escalations]`.trim() })
    .eq('wo_id', insertedWO.wo_id);
  return orig.wo_number;
}

async function GET_impl(request) {
  const startTime = Date.now();
  console.log('=== Auto Email Import Cron Started (IMAP) ===');
  console.log('Timestamp:', new Date().toISOString());
  
  // Scheduled run (CRON_SECRET) or a signed-in office/admin user pressing
  // the import button. No more ?manual=true bypass.
  const auth = await requireCronOrStaff(request);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const isManual = auth.principal.kind !== 'cron' || searchParams.get('manual') === 'true';
  if (isManual) console.log('Manual trigger by', auth.principal.user?.email || 'cron');

  const results = {
    success: true,
    timestamp: new Date().toISOString(),
    imported: 0,
    skipped: 0,
    duplicates: 0,
    errors: [],
    workOrders: [],
    notifications: { sent: 0 }
  };

  // UIDs to flag \Seen — flushed in one IMAP session after the loop (P6).
  const seenUids = [];
  try {
    // Check if IMAP is configured
    const email = process.env.EMAIL_IMPORT_USER;
    const password = process.env.EMAIL_IMPORT_PASSWORD;

    if (!email || !password) {
      results.success = false;
      results.errors.push('IMAP not configured');
      return Response.json(results, { status: 400 });
    }

    // Check if auto-import is disabled
    if (process.env.AUTO_EMAIL_IMPORT_DISABLED === 'true') {
      results.message = 'Auto-import is disabled';
      return Response.json(results);
    }

    console.log('Fetching emails via IMAP...');
    const rawEmails = await fetchEmails();
    
    console.log(`Found ${rawEmails.length} unread dispatch email(s)`);
    
    // Safety check: if manual trigger, allow large imports. If auto-cron, limit to 50 emails
    const maxAutoImport = 50;
    if (!isManual && rawEmails.length > maxAutoImport) {
      results.message = `Found ${rawEmails.length} emails - too many for automatic import. Please use manual import or mark old emails as read in Gmail.`;
      results.skipped = rawEmails.length;
      results.success = false;
      console.log(`⚠️ Skipping automatic import: ${rawEmails.length} emails exceeds safety limit of ${maxAutoImport}`);
      
      // Log this warning
      await logImportActivity(results);
      
      return Response.json(results);
    }
    
    if (rawEmails.length === 0) {
      results.message = 'No new dispatch emails found';
      await logImportActivity(results);
      return Response.json(results);
    }

    // Get existing WO numbers
    const { data: existingWOs } = await supabase
      .from('work_orders')
      .select('wo_number');
    const existingWONumbers = new Set((existingWOs || []).map(wo => wo.wo_number));

    // Process each email
    const importedWOs = [];
    
    for (const email of rawEmails) {
      try {
        // Parse CBRE format
        const workOrder = parseCBREEmail(email.subject, email.body);

        // Skip if no WO number found
        if (!workOrder.wo_number) {
          console.log('Could not extract WO number, skipping');
          results.skipped++;
          seenUids.push(email.uid);
          continue;
        }

        // Check if duplicate. A re-dispatch of an EXISTING WO is how CBRE
        // communicates priority/target changes — capture those instead of
        // skipping blindly, so the KPI clock follows the LATEST target.
        if (existingWONumbers.has(workOrder.wo_number)) {
          try {
            if (workOrder.target_completion_at || workOrder.target_response_at) {
              const { data: existing } = await supabase
                .from('work_orders')
                .select('wo_id, priority, target_response_at, target_completion_at, comments')
                .eq('wo_number', workOrder.wo_number)
                .single();
              const diffs = (a, b) => {
                if (!a && !b) return false;
                if (!a || !b) return true;
                return Math.abs(new Date(a) - new Date(b)) > 60000;
              };
              if (existing && (
                    diffs(existing.target_completion_at, workOrder.target_completion_at) ||
                    diffs(existing.target_response_at, workOrder.target_response_at))) {
                const ts = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
                const note = `[CBRE RE-DISPATCH — targets updated] ${ts}\n` +
                  `Priority: ${workOrder.priority_code || '—'} · Target Completion: ${workOrder.target_completion_at || '—'}`;
                await supabase
                  .from('work_orders')
                  .update({
                    target_response_at: workOrder.target_response_at,
                    target_completion_at: workOrder.target_completion_at,
                    comments: existing.comments ? `${existing.comments}\n\n${note}` : note,
                  })
                  .eq('wo_id', existing.wo_id);
                await supabase.from('work_order_target_history').insert({
                  wo_id: existing.wo_id,
                  priority: workOrder.priority_code || null,
                  target_response_at: workOrder.target_response_at,
                  target_completion_at: workOrder.target_completion_at,
                  source: 'redispatch_email',
                  note: email.subject?.substring(0, 200) || null,
                  effective_at: email.date ? new Date(email.date).toISOString() : new Date().toISOString(),
                });
                results.targetUpdates = (results.targetUpdates || 0) + 1;
                console.log(`↻ WO ${workOrder.wo_number}: targets updated from re-dispatch`);
              }
            }
          } catch (tErr) {
            console.error(`Target update failed for ${workOrder.wo_number}:`, tErr.message);
          }
          results.duplicates++;
          seenUids.push(email.uid);
          continue;
        }

        // Insert work order (race-safe: ON CONFLICT DO NOTHING via upsert).
        // Requires UNIQUE constraint uq_work_orders_wo_number on work_orders.wo_number.
        const { data: insertedRows, error: insertError } = await supabase
          .from('work_orders')
          .upsert({
            wo_number: workOrder.wo_number,
            building: workOrder.building,
            priority: workOrder.priority,
            date_entered: workOrder.date_entered,
            work_order_description: workOrder.work_order_description,
            requestor: workOrder.requestor,
            requestor_phone: workOrder.requestor_phone || null,
            status: 'pending',
            comments: workOrder.comments,
            nte: workOrder.nte || 0,
            target_response_at: workOrder.target_response_at || null,
            target_completion_at: workOrder.target_completion_at || null
          }, { onConflict: 'wo_number', ignoreDuplicates: true })
          .select();

        if (insertError) {
          console.error(`Error inserting WO ${workOrder.wo_number}:`, insertError);
          results.errors.push(`${workOrder.wo_number}: ${insertError.message}`);
          continue;
        }

        // No row returned = conflict = the WO already existed (caught a race).
        if (!insertedRows || insertedRows.length === 0) {
          console.log(`WO ${workOrder.wo_number} already existed (caught at insert), skipping`);
          results.duplicates++;
          existingWONumbers.add(workOrder.wo_number);
          seenUids.push(email.uid);
          continue;
        }

        const insertedWO = insertedRows[0];

        // First target-history entry (the dispatch baseline).
        if (workOrder.target_completion_at || workOrder.target_response_at) {
          await supabase.from('work_order_target_history').insert({
            wo_id: insertedWO.wo_id,
            priority: workOrder.priority_code || null,
            target_response_at: workOrder.target_response_at,
            target_completion_at: workOrder.target_completion_at,
            source: 'dispatch_email',
            note: email.subject?.substring(0, 200) || null,
            effective_at: email.date ? new Date(email.date).toISOString() : new Date().toISOString(),
          }).then(({ error }) => { if (error) console.error('target_history insert:', error.message); });
        }

        // Sub work order for a disputed WO? CBRE usually names the original
        // ("sub WO for C2756337", "replaces C2756337") in the description.
        // Link it so the Escalations tracker shows the money is on its way.
        try {
          const linked = await linkSubWorkOrder(insertedWO, workOrder);
          if (linked) {
            results.subWoLinks = results.subWoLinks || [];
            results.subWoLinks.push(`${workOrder.wo_number} → ${linked}`);
            console.log(`🔗 ${workOrder.wo_number} linked as sub-WO of disputed ${linked}`);
          }
        } catch (linkErr) {
          console.error('sub-WO link check failed:', linkErr.message);
        }

        console.log(`✓ Imported WO ${workOrder.wo_number}`);
        results.imported++;
        results.workOrders.push({
          wo_number: workOrder.wo_number,
          building: workOrder.building,
          priority: workOrder.priority
        });
        importedWOs.push(workOrder);
        existingWONumbers.add(workOrder.wo_number);

        // Mark as read
        seenUids.push(email.uid);

      } catch (msgErr) {
        console.error('Error processing message:', msgErr);
        results.errors.push(`Message processing error: ${msgErr.message}`);
      }
    }

    // Send notifications if any WOs imported
    if (importedWOs.length > 0) {
      results.notifications = await sendOfficeNotification(importedWOs);
    }

    // ============================================================
    // ALSO RUN: CBRE Label Sync (email-sync)
    // Checks Gmail labels for status updates: escalation, quote-approval,
    // quote-rejected, quote-submitted, reassignment, invoice-rejected, cancellation
    // ============================================================
    // CBRE label sync now runs on its own schedule (see vercel.json).
    // It used to be chained here as a self-fetch, which inherited whatever was
    // left of this function's timeout and was killed part-way through. Worse,
    // the early return above (no new dispatch emails) skipped it entirely on
    // nearly every one of the 144 daily cycles.
    let syncResults = null;

    // Log activity
    // One IMAP session marks everything this run handled as read.
    try { await markAsRead(seenUids); results.markedRead = seenUids.length; }
    catch (flagErr) { console.error('markAsRead batch failed:', flagErr.message); results.errors.push(`markAsRead: ${flagErr.message}`); }

    await logImportActivity(results);

    results.message = results.imported > 0
      ? `Auto-imported ${results.imported} work order(s)`
      : 'No new work orders to import';
    
    if (syncResults) {
      results.cbreSync = {
        processed: syncResults.processed || 0,
        updated: syncResults.updated || 0,
        updates: syncResults.updates || []
      };
    }
    
    results.duration = `${Date.now() - startTime}ms`;
    
    console.log('=== Auto Email Import + CBRE Sync Cron Complete ===');
    console.log(JSON.stringify(results, null, 2));

    return Response.json(results);

  } catch (error) {
    // Do not leave already-imported dispatches unread: they would be imported
    // again next run (harmless thanks to the upsert, but noisy).
    try { if (seenUids.length) await markAsRead(seenUids); } catch {}
    console.error('Cron error:', error);
    results.success = false;
    results.errors.push(error.message);
    results.duration = `${Date.now() - startTime}ms`;
    
    return Response.json(results, { status: 500 });
  }
}

// POST handler for manual trigger
async function POST_impl(request) {
  const url = new URL(request.url);
  url.searchParams.set('manual', 'true');
  
  return GET(new Request(url, {
    headers: request.headers
  }));
}

// Run log (cron_runs) — see lib/cronRun.js. Response is passed through unchanged.
export const GET = (request) => withCronRun('email-import/cron', request, () => GET_impl(request));
export const POST = (request) => withCronRun('email-import/cron', request, () => POST_impl(request));
