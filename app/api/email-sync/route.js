// app/api/email-sync/route.js
// Syncs CBRE status updates from Gmail labels via IMAP (Escalation, Quote Approval, Quote Rejected, Quote Submitted, Reassignment)
import { createClient } from '@supabase/supabase-js';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { applyQuoteApproval } from '@/lib/quoteApproval';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Gmail label to CBRE status mapping.
// NOTE: 'escalation' is a FLAG (type:'flag'), not a lifecycle status. It is
// applied to its own work_orders.escalation column and NEVER competes for or
// overwrites cbre_status. Every other entry is a lifecycle status.
const LABEL_STATUS_MAP = {
  'escalation': { type: 'flag', flag: 'escalation', notify: true, notifyRoles: ['admin', 'office'] },
  'quote-approval': { cbre_status: 'quote_approved', billing_status: 'quote_approved', notify: false, extractNTE: true },
  'quote-rejected': { cbre_status: 'quote_rejected', notify: true, notifyRoles: ['admin', 'office'] },
  'quote-submitted': { cbre_status: 'quote_submitted', billing_status: 'quoted', notify: false, extractQuoteAmount: true },
  'reassignment-of': { cbre_status: 'reassigned', notify: true, notifyRoles: ['admin', 'office'] },
  'invoice-rejected': { cbre_status: 'invoice_rejected', invoice_status: 'rejected', notify: true, notifyRoles: ['admin', 'office'] },
  'cancellation': { cbre_status: 'cancelled', notify: true, notifyRoles: ['admin', 'office'] },
};

// Lifecycle status ranking for the "sticky" protection below.
// A newly-arriving status with a LOWER rank will not overwrite a PROTECTED
// milestone the WO has already reached (it is logged as a comment instead).
const STATUS_RANK = {
  reassigned: 1,
  pending_quote: 1,
  quote_submitted: 2,
  quote_rejected: 2,
  quote_approved: 3,
  invoice_rejected: 4,
  cancelled: 5,
};

// Once a WO reaches one of these, a lower-ranked status email can't clobber it.
const PROTECTED_STATUSES = new Set(['quote_approved']);

// Connect to Gmail via IMAP
function connectIMAP() {
  const email = process.env.EMAIL_IMPORT_USER;
  const password = process.env.EMAIL_IMPORT_PASSWORD;

  if (!email || !password) {
    throw new Error('IMAP credentials not configured');
  }

  return new Imap({
    user: email,
    password: password,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
  });
}

// Fetch emails from a specific IMAP folder (Gmail label)
// searchDays: how many days back to search (default 30, use higher for rescan)
async function fetchEmailsFromLabel(labelName, searchDays = 30) {
  return new Promise((resolve, reject) => {
    const imap = connectIMAP();
    const emails = [];

    // Use label name exactly as it appears in Gmail
    const folderName = labelName;

    imap.once('ready', () => {
      imap.openBox(folderName, false, (err, box) => {
        if (err) {
          imap.end();
          return reject(new Error(`Could not open ${folderName} folder: ${err.message}`));
        }

        // Search emails from last N days (read or unread)
        // Office staff often reads emails before sync runs, so we can't rely on UNSEEN
        // Duplicate prevention: we skip WOs that already have the matching status
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - searchDays);
        const formatIMAPDate = (date) => {
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          return `${date.getDate().toString().padStart(2, '0')}-${months[date.getMonth()]}-${date.getFullYear()}`;
        };
        
        console.log(`[${labelName}] Searching emails since ${formatIMAPDate(sinceDate)} (${searchDays} days)`);
        
        imap.search([['SINCE', formatIMAPDate(sinceDate)]], (err, results) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          if (!results || results.length === 0) {
            imap.end();
            return resolve([]);
          }

          const fetch = imap.fetch(results, {
            bodies: '',
            markSeen: false
          });

          const parsePromises = []; // Track all parse operations

          fetch.on('message', (msg, seqno) => {
            let buffer = '';
            let uid;

            msg.on('body', (stream) => {
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });
            });

            msg.once('attributes', (attrs) => {
              uid = attrs.uid;
            });

            msg.once('end', () => {
              // Create a promise for each parse operation
              const parsePromise = new Promise((resolveParser) => {
                simpleParser(buffer, (err, parsed) => {
                  if (err) {
                    console.error('Parse error:', err);
                    resolveParser(); // Resolve even on error
                    return;
                  }

                  emails.push({
                    uid,
                    subject: parsed.subject || '',
                    from: parsed.from?.text || '',
                    date: parsed.date || new Date(),
                    body: parsed.html || parsed.textAsHtml || parsed.text || ''
                  });
                  resolveParser();
                });
              });
              parsePromises.push(parsePromise);
            });
          });

          fetch.once('error', (err) => {
            imap.end();
            reject(err);
          });

          fetch.once('end', async () => {
            // Wait for all parse operations to complete
            await Promise.all(parsePromises);
            imap.end();
            resolve(emails);
          });
        });
      });
    });

    imap.once('error', (err) => {
      reject(err);
    });

    imap.connect();
  });
}

// Mark email as read in specific folder
async function markAsRead(labelName, uid) {
  return new Promise((resolve, reject) => {
    const imap = connectIMAP();
    
    // Use label name exactly as it appears in Gmail
    const folderName = labelName;

    imap.once('ready', () => {
      imap.openBox(folderName, false, (err) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        imap.addFlags(uid, ['\\Seen'], (err) => {
          imap.end();
          if (err) return reject(err);
          resolve();
        });
      });
    });

    imap.once('error', (err) => {
      reject(err);
    });

    imap.connect();
  });
}

// Extract WO number from email subject or body
function extractWONumber(subject, body) {
  const patterns = [
    /Work Order\s+([A-Z]{0,2}\d{6,})/i,
    /WO#?\s*([A-Z]{0,2}\d{6,})/i,
    /\b([A-Z]{1,2}\d{6,})\b/,
    /\b(\d{7,})\b/,
  ];

  for (const pattern of patterns) {
    const match = (subject || '').match(pattern);
    if (match) return match[1];
  }

  const cleanBody = (body || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');

  for (const pattern of patterns) {
    const match = cleanBody.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// Extract approved NTE amount from quote approval email
function extractApprovedNTE(subject, body) {
  const cleanBody = (body || '')
    .replace(/=\r?\n/g, '')
    .replace(/=3D/g, '=')
    .replace(/=20/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const patterns = [
    /approved\s+(?:for|amount[:\s]*)?[\s:]*\$?([\d,]+\.?\d*)/i,
    /new\s+NTE[:\s]+(?:of\s+)?\$?([\d,]+\.?\d*)/i,
    /NTE[:\s]+\$?([\d,]+\.?\d*)/i,
    /increased\s+to\s+\$?([\d,]+\.?\d*)/i,
    /total\s+(?:NTE|amount)[:\s]+\$?([\d,]+\.?\d*)/i,
    /not\s+to\s+exceed\s+\$?([\d,]+\.?\d*)/i,
    /NTE\s+has\s+been\s+(?:increased|approved|set)\s+to\s+\$?([\d,]+\.?\d*)/i,
    /\$?([\d,]+\.?\d*)\s*USD\s*(?:approved|NTE)/i,
    /approved[^$]*\$\s*([\d,]+\.?\d*)/i,
    /quote\s+(?:of|for)\s+\$?([\d,]+\.?\d*)\s+(?:has\s+been\s+)?approved/i,
  ];

  for (const pattern of patterns) {
    const match = cleanBody.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount >= 100 && amount <= 1000000) {
        return amount;
      }
    }
  }

  for (const pattern of patterns) {
    const match = (subject || '').match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount >= 100 && amount <= 1000000) {
        return amount;
      }
    }
  }

  return null;
}

// Extract submitted quote amount from quote submitted email
function extractSubmittedQuoteAmount(subject, body) {
  const cleanBody = (body || '')
    .replace(/=\r?\n/g, '')
    .replace(/=3D/g, '=')
    .replace(/=20/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const patterns = [
    /quote\s+(?:for|of|amount)?[:\s]*\$?([\d,]+\.?\d*)/i,
    /submitted\s+(?:quote|for)?[:\s]*\$?([\d,]+\.?\d*)/i,
    /requesting\s+\$?([\d,]+\.?\d*)/i,
    /NTE\s+(?:increase|request)?\s+(?:to|of|for)?[:\s]*\$?([\d,]+\.?\d*)/i,
    /total[:\s]+\$?([\d,]+\.?\d*)/i,
    /amount[:\s]+\$?([\d,]+\.?\d*)/i,
    /\$([\d,]+\.?\d*)\s*(?:quote|NTE|total)/i,
  ];

  for (const pattern of patterns) {
    const match = cleanBody.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount >= 100 && amount <= 1000000) {
        return amount;
      }
    }
  }

  for (const pattern of patterns) {
    const match = (subject || '').match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount >= 100 && amount <= 1000000) {
        return amount;
      }
    }
  }

  return null;
}

// Send notification to EMF primary email only
async function sendNotification(type, workOrder, emailSubject, newNTE = null) {
  try {
    // Only notify emfcontractingsc@gmail.com
    const { data: users } = await supabase
      .from('users')
      .select('user_id, first_name, last_name, phone, sms_carrier, email')
      .eq('email', 'emfcontractingsc@gmail.com');

    const recipients = (users || []).filter(u => u.phone && u.sms_carrier);
    
    if (recipients.length === 0) {
      console.log('No office/admin users configured for SMS notifications');
      return;
    }

    let message = '';
    switch (type) {
      case 'escalation':
        message = `🚨 ESCALATION: WO ${workOrder.wo_number} - ${workOrder.building} requires immediate attention!`;
        break;
      case 'quote_rejected':
        message = `❌ QUOTE REJECTED: WO ${workOrder.wo_number} - ${workOrder.building}. Review needed.`;
        break;
      case 'reassigned':
        message = `🔄 REASSIGNED: WO ${workOrder.wo_number} - ${workOrder.building} has been reassigned by CBRE.`;
        break;
      case 'quote_approved':
        message = `✅ QUOTE APPROVED: WO ${workOrder.wo_number} - ${workOrder.building}${newNTE ? `. New NTE: $${newNTE.toFixed(2)}` : ''}`;
        break;
      case 'invoice_rejected':
        message = `❌ INVOICE REJECTED: WO ${workOrder.wo_number} - ${workOrder.building}. Review and resubmit needed.`;
        break;
      case 'cancelled':
        message = `🚫 CANCELLED: WO ${workOrder.wo_number} - ${workOrder.building} has been cancelled by CBRE.`;
        break;
      default:
        message = `📋 CBRE Update: WO ${workOrder.wo_number} - Status: ${type}`;
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'cbre_status_update',
        recipients,
        message,
        workOrder: {
          wo_number: workOrder.wo_number,
          building: workOrder.building,
          cbre_status: type
        }
      })
    });

    const result = await response.json();
    console.log('Notification result:', result);
    
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

// GET: Fetch and process status update emails from all CBRE labels
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const labelFilter = searchParams.get('label');
    const dryRun = searchParams.get('dryRun') === 'true';
    const searchDays = parseInt(searchParams.get('days')) || 30; // Default 30 days, use ?days=90 for deeper rescan
    const skipNotify = searchParams.get('skipNotify') === 'true'; // Skip all notifications for this run
    
    // Check IMAP credentials
    const email = process.env.EMAIL_IMPORT_USER;
    const password = process.env.EMAIL_IMPORT_PASSWORD;

    if (!email || !password) {
      return Response.json({ success: false, error: 'IMAP not configured' }, { status: 400 });
    }

    const labelsToCheck = labelFilter 
      ? [labelFilter.toLowerCase()]
      : Object.keys(LABEL_STATUS_MAP);
    
    const results = {
      processed: 0,
      updated: 0,
      skipped: 0,
      notFound: 0,
      errors: [],
      updates: []
    };

    // ========== PHASE 1: Collect ALL emails from ALL labels ==========
    // Lifecycle-status labels compete for cbre_status (newest wins).
    // Flag labels (escalation) are collected separately and NEVER touch cbre_status.
    const woEmailMap = {};   // woNumber -> { email, label, labelConfig, date }  (status labels)
    const flagEmailMap = {}; // woNumber -> { email, label, labelConfig, date }  (escalation flag)

    for (const label of labelsToCheck) {
      const labelConfig = LABEL_STATUS_MAP[label];
      if (!labelConfig) continue;

      try {
        const rawEmails = await fetchEmailsFromLabel(label, searchDays);
        if (rawEmails.length === 0) continue;

        for (const email of rawEmails) {
          results.processed++;

          const woNumber = extractWONumber(email.subject, email.body);
          if (!woNumber) {
            results.errors.push(`Could not find WO# in: ${email.subject.substring(0, 50)}`);
            continue;
          }

          const emailDate = new Date(email.date);

          // Flag labels (escalation) go to their own bucket — they do NOT
          // compete for the cbre_status slot, so they can't overwrite a status.
          if (labelConfig.type === 'flag') {
            if (!flagEmailMap[woNumber] || emailDate > flagEmailMap[woNumber].date) {
              flagEmailMap[woNumber] = { email, label, labelConfig, date: emailDate };
            }
            continue;
          }

          // Keep only the NEWEST status email per WO (most recent status wins)
          if (!woEmailMap[woNumber] || emailDate > woEmailMap[woNumber].date) {
            woEmailMap[woNumber] = { email, label, labelConfig, date: emailDate };
          }
        }
      } catch (labelErr) {
        results.errors.push(`Error fetching label ${label}: ${labelErr.message}`);
      }
    }

    // ========== PHASE 2: Apply the winning (newest) status per WO ==========
    for (const [woNumber, entry] of Object.entries(woEmailMap)) {
      const { email: winningEmail, label, labelConfig } = entry;

      try {
        // Find the work order
        const { data: workOrder, error: woError } = await supabase
          .from('work_orders')
          .select('wo_id, wo_number, building, cbre_status, billing_status, comments, nte')
          .eq('wo_number', woNumber)
          .single();

        if (woError || !workOrder) {
          results.notFound++;
          results.errors.push(`WO ${woNumber} not found in system`);
          continue;
        }

        // Skip if WO already has this status (duplicate prevention)
        if (workOrder.cbre_status === labelConfig.cbre_status) {
          results.skipped++;
          continue;
        }

        // ── Sticky protection ───────────────────────────────────────────────
        // Don't let a regressive (lower-ranked) status overwrite a protected
        // milestone the WO already reached (e.g. quote_approved). Log the
        // incoming email as a comment instead so nothing is lost.
        const incomingRank = STATUS_RANK[labelConfig.cbre_status] ?? 0;
        const currentRank  = STATUS_RANK[workOrder.cbre_status] ?? 0;
        if (PROTECTED_STATUSES.has(workOrder.cbre_status) && incomingRank < currentRank) {
          if (!dryRun) {
            const ts = new Date().toLocaleString();
            const note = `[CBRE ${labelConfig.cbre_status.toUpperCase()} — IGNORED, ${workOrder.cbre_status.toUpperCase()} is protected] ${ts}\nEmail: ${winningEmail.subject}`;
            const mergedComments = workOrder.comments ? `${workOrder.comments}\n\n${note}` : note;
            await supabase
              .from('work_orders')
              .update({ comments: mergedComments })
              .eq('wo_id', workOrder.wo_id);
          }
          results.skipped++;
          results.updates.push({
            wo_number: woNumber,
            building: workOrder.building,
            label,
            new_status: labelConfig.cbre_status,
            old_status: workOrder.cbre_status,
            sticky_protected: true,
            subject: winningEmail.subject.substring(0, 80),
          });
          continue;
        }

        // Build update
        const updateData = {
          cbre_status: labelConfig.cbre_status,
          cbre_status_updated_at: new Date().toISOString(),
          cbre_status_acknowledged_at: null  // mark as unacknowledged so dashboard shows the marker
        };

        if (labelConfig.billing_status) {
          updateData.billing_status = labelConfig.billing_status;
        }

        // Extract NTE for approvals (try email body first; quote fallback applied below)
        let newNTE = null;
        if (labelConfig.extractNTE) {
          newNTE = extractApprovedNTE(winningEmail.subject, winningEmail.body);
        }

        // Extract quote amount for tracking
        let submittedQuoteAmount = null;
        if (labelConfig.extractQuoteAmount) {
          submittedQuoteAmount = extractSubmittedQuoteAmount(winningEmail.subject, winningEmail.body);
        }

        // Add to comments
        const timestamp = new Date().toLocaleString();
        let newComment = `[CBRE ${labelConfig.cbre_status.toUpperCase()}] ${timestamp}\nEmail: ${winningEmail.subject}`;
        if (newNTE) {
          newComment += `\n✅ NTE Updated: ${workOrder.nte?.toFixed(2) || '0.00'} → ${newNTE.toFixed(2)}`;
        }
        if (submittedQuoteAmount) {
          newComment += `\n📤 Quote Submitted: ${submittedQuoteAmount.toFixed(2)}`;
        }
        const updatedComments = workOrder.comments 
          ? `${workOrder.comments}\n\n${newComment}`
          : newComment;

        updateData.comments = updatedComments;

        let invoiceUpdated = false;
        let nteApplied      = null;   // tracking object from applyQuoteApproval()

        if (!dryRun) {
          // ────────────────────────────────────────────────────────────────
          // For quote_approved: apply the NTE update via the shared helper.
          // This auto-falls-back to work_order_quotes.new_nte_amount when the
          // email body didn't contain a parsable amount, AND it flips the
          // matching quote to approved. We do this BEFORE the main work_orders
          // update so the helper's nte write doesn't get clobbered.
          // ────────────────────────────────────────────────────────────────
          if (labelConfig.cbre_status === 'quote_approved') {
            try {
              nteApplied = await applyQuoteApproval(supabase, workOrder.wo_id, {
                overrideNTE: newNTE,  // null is fine — helper will try the quote
              });
              if (nteApplied.applied) {
                // Make sure downstream code (comment + notification) uses the
                // actual amount we just applied, even if it came from the quote.
                newNTE = nteApplied.newNTE;
              }
            } catch (approvalErr) {
              results.errors.push(`Quote approval failed for ${woNumber}: ${approvalErr.message}`);
            }
          }

          // Update work order (status / comments / billing_status)
          // Note: we intentionally do NOT include `nte` here — applyQuoteApproval
          // already wrote it. Including it again would just be a redundant write.
          const { error: updateError } = await supabase
            .from('work_orders')
            .update(updateData)
            .eq('wo_id', workOrder.wo_id);

          if (updateError) {
            results.errors.push(`Failed to update ${woNumber}: ${updateError.message}`);
            continue;
          }

          // Update invoice status if specified
          if (labelConfig.invoice_status) {
            const { data: invoice, error: invoiceError } = await supabase
              .from('invoices')
              .select('invoice_id, invoice_number, status')
              .eq('wo_id', workOrder.wo_id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            if (invoice && !invoiceError) {
              const { error: invoiceUpdateError } = await supabase
                .from('invoices')
                .update({ 
                  status: labelConfig.invoice_status,
                  rejection_reason: winningEmail.subject,
                  rejected_at: new Date().toISOString()
                })
                .eq('invoice_id', invoice.invoice_id);

              if (!invoiceUpdateError) {
                invoiceUpdated = true;
                console.log(`Updated invoice ${invoice.invoice_number} to status: ${labelConfig.invoice_status}`);
              }
            }
          }

          // Send notification (unless skipNotify is set)
          if (!skipNotify && (labelConfig.notify || newNTE)) {
            await sendNotification(labelConfig.cbre_status, workOrder, winningEmail.subject, newNTE);
          }
        }

        results.updated++;
        results.updates.push({
          wo_number: woNumber,
          building: workOrder.building,
          label: label,
          new_status: labelConfig.cbre_status,
          email_date: entry.date.toISOString(),
          new_nte: newNTE,
          old_nte: workOrder.nte,
          nte_source: nteApplied?.source || (newNTE ? 'email' : null),
          nte_applied: nteApplied?.applied || false,
          old_status: workOrder.cbre_status,
          submitted_quote: submittedQuoteAmount,
          invoice_updated: invoiceUpdated,
          invoice_status: labelConfig.invoice_status || null,
          subject: winningEmail.subject.substring(0, 80),
          notified: labelConfig.notify || !!newNTE
        });

      } catch (msgErr) {
        results.errors.push(`Error processing WO ${woNumber}: ${msgErr.message}`);
      }
    }

    // ========== PHASE 3: Apply escalation FLAGS (independent of cbre_status) ==========
    for (const [woNumber, entry] of Object.entries(flagEmailMap)) {
      const { email: winningEmail, labelConfig } = entry;

      try {
        const { data: workOrder, error: woError } = await supabase
          .from('work_orders')
          .select('wo_id, wo_number, building, escalation, comments')
          .eq('wo_number', woNumber)
          .single();

        if (woError || !workOrder) {
          results.notFound++;
          results.errors.push(`WO ${woNumber} not found in system (escalation)`);
          continue;
        }

        // Duplicate prevention: already escalated
        if (workOrder.escalation === true) {
          results.skipped++;
          continue;
        }

        if (!dryRun) {
          const ts = new Date().toLocaleString();
          const note = `[CBRE ESCALATION] ${ts}\nEmail: ${winningEmail.subject}`;
          const mergedComments = workOrder.comments ? `${workOrder.comments}\n\n${note}` : note;

          const { error: flagError } = await supabase
            .from('work_orders')
            .update({
              escalation: true,
              escalation_updated_at: new Date().toISOString(),
              escalation_acknowledged_at: null,
              comments: mergedComments,
            })
            .eq('wo_id', workOrder.wo_id);

          if (flagError) {
            results.errors.push(`Failed to flag ${woNumber}: ${flagError.message}`);
            continue;
          }

          if (!skipNotify && labelConfig.notify) {
            await sendNotification('escalation', workOrder, winningEmail.subject);
          }
        }

        results.updated++;
        results.updates.push({
          wo_number: woNumber,
          building: workOrder.building,
          label: 'escalation',
          new_status: 'escalation (flag)',
          flag: true,
          email_date: entry.date.toISOString(),
          subject: winningEmail.subject.substring(0, 80),
          notified: labelConfig.notify,
        });

      } catch (msgErr) {
        results.errors.push(`Error processing escalation for WO ${woNumber}: ${msgErr.message}`);
      }
    }

    return Response.json({
      success: true,
      message: `Processed ${results.processed} emails, ${Object.keys(woEmailMap).length} status WOs + ${Object.keys(flagEmailMap).length} escalation flags, updated ${results.updated}, skipped ${results.skipped} (already current)`,
      dryRun,
      searchDays,
      ...results
    });

  } catch (error) {
    console.error('Email sync error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// POST: Manually trigger sync
export async function POST(request) {
  try {
    // Try to parse body, but don't fail if empty
    let body = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch (e) {
      // Empty body is fine
    }
    
    const { label } = body;

    const url = new URL(request.url);
    if (label) url.searchParams.set('label', label);
    
    const response = await GET(new Request(url.toString()));
    return response;

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
