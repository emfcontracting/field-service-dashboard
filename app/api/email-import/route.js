// app/api/email-import/route.js
// Fetches work order emails from Gmail via IMAP and parses CBRE dispatch format
// Supports both regular dispatch and PM (Preventive Maintenance) work orders
import { createClient } from '@supabase/supabase-js';
import { fetchMessages, addFlags, sinceDays } from '@/lib/imap';
import { parseCBREEmail } from '@/lib/cbreEmailParser';
import { requireStaff } from '@/lib/serverAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Connect to Gmail via IMAP
// IMAP + parsing live in lib/imap.js / lib/cbreEmailParser.js — the same
// parser the cron uses (this copy used to store legacy priority buckets).
async function fetchEmails(includeRead = false, days = 3) {
  const subject = ['OR', ['SUBJECT', 'Work Order'], ['SUBJECT', 'Dispatch']];
  const criteria = includeRead ? [sinceDays(days), subject] : ['UNSEEN', subject];
  const { messages } = await fetchMessages({ account: 'import', box: 'INBOX', criteria });
  return messages;
}

const markAsRead = (uid) => addFlags({ account: 'import', box: 'INBOX', uids: uid });

export async function GET(request) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;
  try {
    // Check for query params
    const { searchParams } = new URL(request.url);
    const includeRead = searchParams.get('includeRead') === 'true';
    const days = parseInt(searchParams.get('days')) || 3;
    
    console.log('=== Manual Email Import Fetch (IMAP) ===');
    console.log('Parameters:', { includeRead, days });
    
    // Check if IMAP is configured
    const email = process.env.EMAIL_IMPORT_USER;
    const password = process.env.EMAIL_IMPORT_PASSWORD;

    if (!email || !password) {
      return Response.json({
        success: false,
        error: 'IMAP not configured. Please add EMAIL_IMPORT_USER and EMAIL_IMPORT_PASSWORD to environment variables.',
        debug: {
          hasUser: !!email,
          hasPassword: !!password
        }
      }, { status: 400 });
    }

    // Fetch emails via IMAP
    const rawEmails = await fetchEmails(includeRead, days);
    
    console.log('IMAP fetch result:', {
      emailCount: rawEmails.length,
      timestamp: new Date().toISOString()
    });
    
    if (rawEmails.length === 0) {
      return Response.json({
        success: true,
        message: 'No new work order emails found',
        emails: [],
        debug: {
          includeRead,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Get existing WO numbers to check for duplicates
    const { data: existingWOs } = await supabase
      .from('work_orders')
      .select('wo_number');
    const existingWONumbers = new Set((existingWOs || []).map(wo => wo.wo_number));

    // Parse emails
    const emails = [];
    const duplicates = [];
    
    for (const email of rawEmails) {
      try {
        // Parse CBRE format
        const workOrder = parseCBREEmail(email.subject, email.body);

        // Check if this WO already exists
        if (workOrder.wo_number && existingWONumbers.has(workOrder.wo_number)) {
          duplicates.push({
            wo_number: workOrder.wo_number,
            building: workOrder.building,
            subject: email.subject
          });
          continue; // Skip duplicates
        }

        emails.push({
          emailId: email.uid,
          subject: email.subject,
          receivedAt: email.date.toISOString(),
          parsedData: workOrder
        });
      } catch (parseErr) {
        console.error('Error parsing email:', parseErr);
      }
    }

    return Response.json({
      success: true,
      message: emails.length > 0 
        ? `Found ${emails.length} new work order email(s)${duplicates.length > 0 ? ` (${duplicates.length} duplicates skipped)` : ''}`
        : duplicates.length > 0 
          ? `All ${duplicates.length} email(s) are duplicates of existing work orders`
          : 'No new work order emails found',
      emails,
      duplicates
    });

  } catch (error) {
    console.error('Email fetch error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// POST: Import selected emails as work orders OR parse pasted content
export async function POST(request) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    
    // Handle paste/parse action (simple mode)
    if (body.action === 'parse') {
      const content = body.emailContent || '';
      const parsed = parseCBREEmail('', content);
      
      // Try to extract WO from content if not found
      if (!parsed.wo_number) {
        const woMatch = content.match(/work order[^\dA-Z]*([A-Z]{0,3}\d{5,})/i);
        if (woMatch) parsed.wo_number = woMatch[1].toUpperCase();
      }
      
      return Response.json({ success: true, parsedData: parsed });
    }
    
    // Handle single import from paste
    if (body.action === 'import' && body.workOrder) {
      const wo = body.workOrder;
      
      if (!wo.wo_number) {
        return Response.json({ success: false, error: 'Work order number is required' }, { status: 400 });
      }
      
      // Check if exists
      const { data: existing } = await supabase
        .from('work_orders')
        .select('wo_id')
        .eq('wo_number', wo.wo_number)
        .single();

      if (existing) {
        return Response.json({ success: false, error: `Work order ${wo.wo_number} already exists` }, { status: 400 });
      }

      // Insert (race-safe: ON CONFLICT DO NOTHING via upsert)
      const { data: insertedRows, error } = await supabase
        .from('work_orders')
        .upsert({
          wo_number: wo.wo_number,
          building: wo.building,
          priority: wo.priority,
          date_entered: wo.date_entered,
          work_order_description: wo.work_order_description,
          requestor: wo.requestor,
          requestor_phone: wo.requestor_phone || null,
          status: 'pending',
          comments: wo.comments,
          nte: wo.nte || 0
        }, { onConflict: 'wo_number', ignoreDuplicates: true })
        .select();

      if (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
      }

      if (!insertedRows || insertedRows.length === 0) {
        return Response.json({ success: false, error: `Work order ${wo.wo_number} already exists` }, { status: 400 });
      }

      return Response.json({ success: true, message: `Work order ${wo.wo_number} created!`, workOrder: insertedRows[0] });
    }
    
    // Handle bulk import from IMAP
    const { emailIds, workOrders, markAsRead: shouldMarkRead = true } = body;

    if (!workOrders || workOrders.length === 0) {
      return Response.json({ success: false, error: 'No work orders provided' }, { status: 400 });
    }

    const results = { imported: 0, skipped: 0, errors: [] };

    for (let i = 0; i < workOrders.length; i++) {
      const wo = workOrders[i];
      const emailId = emailIds?.[i];

      try {
        // Check if WO already exists
        const { data: existing } = await supabase
          .from('work_orders')
          .select('wo_id')
          .eq('wo_number', wo.wo_number)
          .single();

        if (existing) {
          results.skipped++;
          results.errors.push(`${wo.wo_number}: Already exists`);
          continue;
        }

        // Insert work order (race-safe: ON CONFLICT DO NOTHING via upsert)
        const { data: insertedRows, error: insertError } = await supabase
          .from('work_orders')
          .upsert({
            wo_number: wo.wo_number,
            building: wo.building,
            priority: wo.priority,
            date_entered: wo.date_entered,
            work_order_description: wo.work_order_description,
            requestor: wo.requestor,
            requestor_phone: wo.requestor_phone || null,
            status: wo.status || 'pending',
            comments: wo.comments,
            nte: wo.nte || 0
          }, { onConflict: 'wo_number', ignoreDuplicates: true })
          .select();

        if (insertError) {
          results.errors.push(`${wo.wo_number}: ${insertError.message}`);
          continue;
        }

        // No row returned = conflict = already existed (race caught at insert).
        if (!insertedRows || insertedRows.length === 0) {
          results.skipped++;
          results.errors.push(`${wo.wo_number}: Already exists`);
          continue;
        }

        results.imported++;

        // Mark email as read if requested
        if (shouldMarkRead && emailId) {
          try {
            await markAsRead(emailId);
          } catch (e) {
            console.log('Could not mark email as read:', e.message);
          }
        }

      } catch (err) {
        results.errors.push(`${wo.wo_number}: ${err.message}`);
      }
    }

    return Response.json({
      success: true,
      message: `Imported ${results.imported} work order(s), skipped ${results.skipped}`,
      ...results
    });

  } catch (error) {
    console.error('Import error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
