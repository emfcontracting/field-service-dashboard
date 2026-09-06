// lib/cbreEmailParser.js
// -----------------------------------------------------------------------------
// THE parser for CBRE dispatch e-mails ("Dispatch of Work Order C1234567 -
// Priority: P2-Urgent", PM work orders, "Principal Workorder Created"). One
// copy, used by the import cron, the manual import (ImportModal) and the
// backfill report. The three copies this replaces had drifted: only the cron
// wrote the canonical P-code (priority_code) — the manual import still stored
// the legacy emergency/high/medium/low buckets (audit finding D3).
//
// parseCBREEmail(subject, body) → work order fields (wo_number, building,
// address, priority, priority_code, description, nte, date_entered, targets,
// contact lines …). Pure: no I/O.
// classifySubject / extractWoFromSubject: subject-only helpers for triage
// (backfill, health) that must not need the body.
// -----------------------------------------------------------------------------
import { buildContactLines } from '@/app/api/email-import/contactParser';
import { parseCbreDateEntered, parseCbreTargetResponse, parseCbreTargetCompletion } from '@/app/api/email-import/parseCbreDate';
import { PRIORITY_CODES } from '@/lib/priorityCodes';

export function parseCBREEmail(subject, body) {
  const workOrder = {
    wo_number: '',
    building: '',
    address: '',
    city: '',
    state: '',
    priority: 'P4',
    date_entered: new Date().toISOString(),
    work_order_description: '',
    requestor: '',
    requestor_phone: '',
    status: 'pending',
    comments: '',
    nte: 0
  };

  // Detect if this is a PM (Preventive Maintenance) work order
  const isPM = (subject || '').toLowerCase().includes('pm work order') || 
               (body || '').toLowerCase().includes('preventive maintenance description');

  // Clean the content - handle quoted-printable encoding
  const cleanBody = (body || '')
    .replace(/=\r?\n/g, '')           // Remove soft line breaks
    .replace(/=3D/g, '=')             // Decode =3D to =
    .replace(/=20/g, ' ')             // Decode =20 to space
    .replace(/=2F/g, '/')             // Decode =2F to /
    .replace(/=2C/g, ',')             // Decode =2C to comma
    .replace(/<[^>]+>/g, ' ')         // Remove HTML tags
    .replace(/&nbsp;/g, ' ')          // Replace &nbsp;
    .replace(/&amp;/g, '&')           // Replace &amp;
    .replace(/\s+/g, ' ')             // Normalize whitespace
    .trim();

  // Extract WO number from subject
  // Handle multiple formats:
  // - "Dispatch of Work Order C2959324 - Priority: P2-Urgent"
  // - "Dispatch_of_Work_Order_C2959324_-_Priority__P2-Urgent" (underscores)
  // - "PM Work Order P2919408"
  // - "Dispatch of Work Order ST3162410 ..." (multi-letter prefix)
  // Prefix can be 0-3 letters (C, P, S, ST, etc.)
  const woMatch = (subject || '').match(/(?:PM[\s_]+)?Work[\s_]+Order[\s_]+([A-Z]{0,3}\d+)/i);
  if (woMatch) {
    workOrder.wo_number = woMatch[1].toUpperCase();
  }

  // Extract Priority
  const priorityMatch = cleanBody.match(/Priority[:\s_]*(P\d+)[\s\-_]*([^<\n]*)/i) || 
                        (subject || '').match(/Priority[:\s_]*(P\d+)/i);
  if (priorityMatch) {
    const pCode = priorityMatch[1].toUpperCase();
    workOrder.priority_code = pCode;   // canonical P-code (for target history)
    const pText = (priorityMatch[2] || '').toLowerCase();
    const pNum = parseInt(pCode.replace('P', ''));
    const canonical = `P${pNum}`;

    if (PRIORITY_CODES[canonical]) {
      // Store the real CBRE priority code (P1, P4, P10 …) — single source of
      // truth, see lib/priorityCodes.js. The old emergency/high/medium/low
      // buckets broke the P-code filters and KPI targets.
      workOrder.priority = canonical;
    } else if (pNum === 1 || pText.includes('emergency')) {
      workOrder.priority = 'P1';
    } else if (pNum === 2 || pText.includes('urgent') || pText.includes('24 hour')) {
      workOrder.priority = 'P2';
    } else if (pNum === 3 || pNum === 4 || pText.includes('48 hour') || pText.includes('72 hour')) {
      workOrder.priority = 'P4';
    } else {
      workOrder.priority = 'P5';
    }
  }

  // Extract Date Entered. CBRE stamps this in Eastern and usually includes the
  // source offset (e.g. "UTC-05"); parseCbreDateEntered honors it and returns a
  // correct UTC instant. Without it, the naive string is read in the runtime
  // zone (UTC on Vercel) and lands 4-5 hours early.
  const dateEntered = parseCbreDateEntered(cleanBody);
  if (dateEntered) {
    workOrder.date_entered = dateEntered;
  }

  // CBRE targets (KPI clock basis) — structured, with time + UTC offset.
  workOrder.target_response_at   = parseCbreTargetResponse(cleanBody);
  workOrder.target_completion_at = parseCbreTargetCompletion(cleanBody);

  // Extract Building
  const buildingMatch = cleanBody.match(/Building:\s*([^<\n]+?)(?=\s*Floor|\s*Area|\s*Country|$)/i);
  if (buildingMatch) {
    workOrder.building = buildingMatch[1].trim().substring(0, 200);
  }

  // Extract Address
  const addressMatch = cleanBody.match(/Address:\s*([^<\n]+?)(?=\s*Country|\s*Building|$)/i);
  if (addressMatch) {
    workOrder.address = addressMatch[1].replace(/,\s*,/g, ',').replace(/,\s*$/, '').trim();
  }

  // Extract City, State
  const locationMatch = cleanBody.match(/Country,?\s*St,?\s*City[:\s]*(?:USA?),?\s*([A-Z]{2}),?\s*([A-Za-z\s]+)/i);
  if (locationMatch) {
    workOrder.state = locationMatch[1].trim();
    workOrder.city = locationMatch[2].trim();
  }

  // Extract Requestor/Site Contact
  let requestorMatch = cleanBody.match(/Work Order Requestor Name and Phone:\s*([^,<\n]+),?\s*([\d\-\(\)\s]+)?/i);
  if (!requestorMatch) {
    requestorMatch = cleanBody.match(/UPS Site Contact:\s*([^(<\n]+)\s*\(?([\d\-]+)\)?/i);
  }
  if (requestorMatch) {
    workOrder.requestor = requestorMatch[1].trim();
    if (requestorMatch[2]) {
      workOrder.requestor_phone = requestorMatch[2].replace(/[^\d\-]/g, '').trim();
    }
  }

  // Extract NTE
  const nteMatch = cleanBody.match(/should not exceed\s*\*?\*?([\d,]+\.?\d*)\s*USD\*?\*?/i);
  if (nteMatch) {
    workOrder.nte = parseFloat(nteMatch[1].replace(/,/g, '')) || 0;
  }

  // Extract Description
  let description = '';
  let descMatch = cleanBody.match(/Problem Description:\s*(.+?)(?=Assignment Name|Notes to Vendor|Service Location|$)/is);
  if (!descMatch || !descMatch[1].trim()) {
    descMatch = cleanBody.match(/Preventive Maintenance Description:\s*(.+?)(?=Service Location|Asset|PM Action|$)/is);
  }
  const pmActionMatch = cleanBody.match(/PM Action Steps:\s*[-]+\s*(.+?)(?=If you have any questions|Assignment Name|$)/is);
  if (descMatch && descMatch[1]) {
    description = descMatch[1].replace(/\s+/g, ' ').trim();
  }
  if (pmActionMatch && pmActionMatch[1]) {
    const pmAction = pmActionMatch[1].replace(/\s+/g, ' ').trim();
    if (pmAction && !description.includes(pmAction)) {
      description = description ? `${description}\n\nPM Action: ${pmAction}` : pmAction;
    }
  }
  workOrder.work_order_description = description.substring(0, 2000);

  // Build comments
  const comments = [];
  if (isPM) comments.push('[PM - Preventive Maintenance]');
  if (workOrder.address) comments.push(`Address: ${workOrder.address}`);
  if (workOrder.city && workOrder.state) comments.push(`Location: ${workOrder.city}, ${workOrder.state}`);
  // CBRE escalation contacts (Dispatcher / Conveyors / Environmental / Capital / GTSG ...)
  const contactLines = buildContactLines(cleanBody);
  if (contactLines.length > 0) {
    comments.push('📞 CBRE Contacts');
    contactLines.forEach(line => comments.push(line));
  }
  const targetMatch = cleanBody.match(/Target Completion:\s*([A-Za-z]+\s+\d+\s+\d+)/i);
  if (targetMatch) comments.push(`Target Completion: ${targetMatch[1].trim()}`);
  const tagMatch = cleanBody.match(/Tag Number:\s*(\d+)/i);
  if (tagMatch) comments.push(`Asset Tag: ${tagMatch[1]}`);
  comments.push(`[Auto-imported from CBRE ${isPM ? 'PM ' : ''}email on ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST]`);
  workOrder.comments = comments.join('\n');

  return workOrder;
}

export function classifySubject(subject) {
  const s = (subject || '').toLowerCase();

  // Real new dispatch indicators (some are prefixed "ALERT:" / "Principal Workorder Created").
  const looksDispatch =
    s.includes('dispatch of work order') ||
    s.includes('dispatch_of_work_order') ||
    s.includes('pm work order') ||
    s.includes('principal workorder');

  if (looksDispatch) {
    // ...but a cancellation/reassignment OF a work order is not a new dispatch.
    if (s.includes('cancellation') || s.includes('cancelled') || s.includes('canceled')) return 'cancellation';
    if (s.includes('reassignment') || s.includes('reassigned')) return 'reassignment';
    return 'dispatch';
  }

  if (s.includes('cancellation') || s.includes('cancelled') || s.includes('canceled')) return 'cancellation';
  if (s.includes('reassignment') || s.includes('reassigned')) return 'reassignment';
  if (s.includes('escalation')) return 'escalation';
  if (s.includes('ovd alert') || s.includes('alert')) return 'alert';
  return 'other';
}

// Robust WO-number extraction from a subject line.
// Layer 1 (canonical): "...Work Order ST3162410..." / "PM Work Order P2919408".
// Layer 2 (loose):     any "<1-3 letters><6+ digits>" token (covers "WO# C2765194",
//                      "OVD Alert - Work Order #C2856093", project subjects, etc.).
export function extractWoFromSubject(subject) {
  const s = subject || '';

  const canonical = s.match(/(?:PM[\s_]+)?Work[\s_]+Order[\s_]+([A-Z]{0,3}\d+)/i);
  if (canonical && canonical[1]) {
    return { wo: canonical[1].toUpperCase(), matchType: 'canonical' };
  }

  const loose = s.match(/\b([A-Z]{1,3}\d{6,})\b/i);
  if (loose && loose[1]) {
    return { wo: loose[1].toUpperCase(), matchType: 'loose' };
  }

  return { wo: null, matchType: null };
}

