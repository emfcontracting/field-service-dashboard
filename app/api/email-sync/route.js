// app/api/email-sync/route.js
// Syncs CBRE status updates from Gmail labels via IMAP (Escalation, Quote Approval, Quote Rejected, Quote Submitted, Reassignment)
import { createClient } from '@supabase/supabase-js';
import Imap from 'imap';
import { simpleParser } from 'mailparser';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Gmail label to CBRE status mapping
const LABEL_STATUS_MAP = {
  'escalation': { cbre_status: 'escalation', notify: true, notifyRoles: ['admin', 'office'] },
  'quote-approval': { cbre_status: 'quote_approved', billing_status: 'quote_approved', notify: false, extractNTE: true },
  'quote-rejected': { cbre_status: 'quote_rejected', notify: true, notifyRoles: ['admin', 'office'] },
  'quote-submitted': { cbre_status: 'quote_submitted', billing_status: 'quoted', notify: false, extractQuoteAmount: true },
  'reassignment-of': { cbre_status: 'reassigned', notify: true, notifyRoles: ['admin', 'office'] },
  'invoice-rejected': { cbre_status: 'invoice_rejected', invoice_status: 'rejected', notify: true, notifyRoles: ['admin', 'office'] },
  'cancellation': { cbre_status: 'cancelled', notify: true, notifyRoles: ['admin', 'office'] },
};

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
async function fetchEmailsFromLabel(labelName) {
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

        // Only unread emails
        imap.search(['UNSEEN'], (err, results) => {
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
              simpleParser(buffer, (err, parsed) => {
                if (err) {
                  console.error('Parse error:', err);
                  return;
                }

                emails.push({
                  uid,
                  subject: parsed.subject || '',
                  from: parsed.from?.text || '',
                  date: parsed.date || new Date(),
                  body: parsed.html || parsed.textAsHtml || parsed.text || ''
                });
              });
            });
          });

          fetch.once('error', (err) => {
            imap.end();
            reject(err);
          });

          fetch.once('end', () => {
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

// Send notification to office/admin staff
async function sendNotification(type, workOrder, emailSubject, newNTE = null) {
  try {
    const { data: users } = await supabase
      .from('users')
      .select('user_id, first_name, last_name, phone, sms_carrier, email')
      .in('role', ['admin', 'office']);

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
      notFound: 0,
      errors: [],
      updates: []
    };

    for (const label of labelsToCheck) {
      const labelConfig = LABEL_STATUS_MAP[label];
      if (!labelConfig) continue;

      try {
        const rawEmails = await fetchEmailsFromLabel(label);

        if (rawEmails.length === 0) continue;

        // Process each email
        for (const email of rawEmails) {
          try {
            results.processed++;

            // Extract WO number
            const woNumber = extractWONumber(email.subject, email.body);

            if (!woNumber) {
              results.errors.push(`Could not find WO# in: ${email.subject.substring(0, 50)}`);
              if (!dryRun) await markAsRead(label, email.uid);
              continue;
            }

            // Find the work order
            const { data: workOrder, error: woError } = await supabase
              .from('work_orders')
              .select('wo_id, wo_number, building, cbre_status, billing_status, comments, nte')
              .eq('wo_number', woNumber)
              .single();

            if (woError || !workOrder) {
              results.notFound++;
              results.errors.push(`WO ${woNumber} not found in system`);
              if (!dryRun) await markAsRead(label, email.uid);
              continue;
            }

            // Build update
            const updateData = {
              cbre_status: labelConfig.cbre_status,
              cbre_status_updated_at: new Date().toISOString()
            };

            if (labelConfig.billing_status) {
              updateData.billing_status = labelConfig.billing_status;
            }

            // Extract NTE for approvals
            let newNTE = null;
            if (labelConfig.extractNTE) {
              newNTE = extractApprovedNTE(email.subject, email.body);
              if (newNTE) {
                updateData.nte = newNTE;
              }
            }

            // Extract quote amount for tracking
            let submittedQuoteAmount = null;
            if (labelConfig.extractQuoteAmount) {
              submittedQuoteAmount = extractSubmittedQuoteAmount(email.subject, email.body);
            }

            // Add to comments
            const timestamp = new Date().toLocaleString();
            let newComment = `[CBRE ${labelConfig.cbre_status.toUpperCase()}] ${timestamp}\nEmail: ${email.subject}`;
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

            if (!dryRun) {
              // Update work order
              const { error: updateError } = await supabase
                .from('work_orders')
                .update(updateData)
                .eq('wo_id', workOrder.wo_id);

              if (updateError) {
                results.errors.push(`Failed to update ${woNumber}: ${updateError.message}`);
                continue;
              }

              // Update NTE increase requests if quote approved
              if (labelConfig.cbre_status === 'quote_approved') {
                await supabase
                  .from('work_order_quotes')
                  .update({ 
                    nte_status: 'approved',
                    approved_at: new Date().toISOString()
                  })
                  .eq('wo_id', workOrder.wo_id)
                  .in('nte_status', ['pending', 'submitted']);
              }

              // Update invoice status if specified
              let invoiceUpdated = false;
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
                      rejection_reason: email.subject,
                      rejected_at: new Date().toISOString()
                    })
                    .eq('invoice_id', invoice.invoice_id);

                  if (!invoiceUpdateError) {
                    invoiceUpdated = true;
                    console.log(`Updated invoice ${invoice.invoice_number} to status: ${labelConfig.invoice_status}`);
                  }
                }
              }

              // Mark as read
              await markAsRead(label, email.uid);

              // Send notification
              if (labelConfig.notify || newNTE) {
                await sendNotification(labelConfig.cbre_status, workOrder, email.subject, newNTE);
              }
            }

            results.updated++;
            results.updates.push({
              wo_number: woNumber,
              building: workOrder.building,
              label: label,
              new_status: labelConfig.cbre_status,
              new_nte: newNTE,
              old_nte: workOrder.nte,
              submitted_quote: submittedQuoteAmount,
              invoice_updated: invoiceUpdated,
              invoice_status: labelConfig.invoice_status || null,
              subject: email.subject.substring(0, 80),
              notified: labelConfig.notify || !!newNTE
            });

          } catch (msgErr) {
            results.errors.push(`Error processing message: ${msgErr.message}`);
          }
        }

      } catch (labelErr) {
        results.errors.push(`Error processing label ${label}: ${labelErr.message}`);
      }
    }

    return Response.json({
      success: true,
      message: `Processed ${results.processed} emails, updated ${results.updated} work orders`,
      dryRun,
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
    const body = await request.json();
    const { label } = body;

    const url = new URL(request.url);
    if (label) url.searchParams.set('label', label);
    
    const response = await GET(new Request(url.toString()));
    return response;

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
