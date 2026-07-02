// lib/cbreNteEmail.js
// ─────────────────────────────────────────────────────────────────────────────
// Email builders for the 'cbre_nte_submitted' notification.
// Fired automatically the moment a CBRE NTE increase is created — techs are
// NOT relied on to inform anyone. EMAIL ONLY (no SMS, no push) per policy;
// recipients come from notification_subscriptions ("nur an ausgewählte").
// Kept in its own module so app/api/notifications/route.js only needs a tiny
// import + branch.
// ─────────────────────────────────────────────────────────────────────────────

const money = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n)
    ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';
};

const CBRE_GREEN = '#003F2D';

export function buildCbreNteSubmittedSubject(workOrder, quote) {
  const wo = workOrder || {};
  const q = quote || {};
  const amount = money(q.new_nte_amount);
  return `🟢 CBRE NTE Submitted: WO ${wo.wo_number || '?'} — New NTE $` + amount;
}

export function buildCbreNteSubmittedEmailText(workOrder, quote, actorName, recipientName) {
  const wo = workOrder || {};
  const q = quote || {};
  const onSite =
    q.is_on_site === true ? 'YES — technician on site'
    : q.is_on_site === false ? 'No — off site / return visit'
    : 'Not specified';

  return `
CBRE NTE INCREASE SUBMITTED — ADMIN ACTION REQUIRED

Hi ${recipientName || 'Admin'},

${actorName || 'A technician'} just submitted a CBRE NTE increase request.
The tech was instructed NOT to contact CBRE — all CBRE communication
(Chris/Adriana) is handled by the admin office.

Work Order:      ${wo.wo_number || 'N/A'}
Building:        ${wo.building || 'N/A'}
Submitted By:    ${actorName || 'N/A'}
Type:            ${q.is_verbal_nte ? 'VERBAL (approved by: ' + (q.verbal_approved_by || 'N/A') + ')' : 'WRITTEN (needs CBRE submission)'}
Tech On Site:    ${onSite}
Additional Work: $${money(q.grand_total)}
NEW NTE NEEDED:  $${money(q.new_nte_amount)}

Open the dashboard to review and print the request:
https://field-service-dashboard.vercel.app/dashboard

---
EMF Contracting LLC | Field Service Management
  `.trim();
}

export function buildCbreNteSubmittedEmailHTML(workOrder, quote, actorName, recipientName) {
  const wo = workOrder || {};
  const q = quote || {};

  const onSiteBadge =
    q.is_on_site === true
      ? '<span style="background-color:#15803d;color:#fff;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:bold;">● TECH ON SITE</span>'
      : q.is_on_site === false
        ? '<span style="background-color:#475569;color:#fff;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:bold;">○ OFF SITE</span>'
        : '';

  const typeLine = q.is_verbal_nte
    ? 'VERBAL — approved by: ' + (q.verbal_approved_by || 'N/A')
    : 'WRITTEN — needs upload to CBRE';

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:20px;">
        <div style="background-color:#1f2937;border-radius:8px;overflow:hidden;">
          <div style="background-color:${CBRE_GREEN};padding:20px;text-align:center;">
            <div style="color:#fff;font-size:13px;letter-spacing:6px;font-weight:bold;margin-bottom:4px;">CBRE</div>
            <h1 style="color:white;margin:0;font-size:21px;">🟢 NTE Increase Submitted</h1>
          </div>
          <div style="padding:20px;color:white;">
            <p style="margin:0 0 15px 0;font-size:16px;">Hi ${recipientName || 'Admin'},</p>
            <p style="margin:0 0 20px 0;color:#9ca3af;">
              <strong>${actorName || 'A technician'}</strong> just submitted a CBRE NTE increase request.
              The tech was instructed <strong>not to contact CBRE</strong> — the admin office handles
              all CBRE communication (Chris/Adriana).
            </p>
            <div style="text-align:center;margin-bottom:16px;">${onSiteBadge}</div>
            <div style="background-color:#374151;border-radius:8px;padding:15px;margin-bottom:20px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:6px 0;color:#9ca3af;width:140px;">WO #:</td><td style="padding:6px 0;color:white;font-weight:bold;">${wo.wo_number || 'N/A'}</td></tr>
                <tr><td style="padding:6px 0;color:#9ca3af;">Building:</td><td style="padding:6px 0;color:white;">${wo.building || 'Not specified'}</td></tr>
                <tr><td style="padding:6px 0;color:#9ca3af;">Submitted By:</td><td style="padding:6px 0;color:white;">${actorName || 'N/A'}</td></tr>
                <tr><td style="padding:6px 0;color:#9ca3af;">Type:</td><td style="padding:6px 0;color:white;">${typeLine}</td></tr>
                <tr><td style="padding:6px 0;color:#9ca3af;">Additional Work:</td><td style="padding:6px 0;color:white;">$${money(q.grand_total)}</td></tr>
                <tr><td style="padding:6px 0;color:#9ca3af;">NEW NTE NEEDED:</td><td style="padding:6px 0;color:#4ade80;font-weight:bold;font-size:16px;">$${money(q.new_nte_amount)}</td></tr>
              </table>
            </div>
            <div style="text-align:center;margin:25px 0;">
              <a href="https://field-service-dashboard.vercel.app/dashboard"
                 style="background-color:${CBRE_GREEN};color:white;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">
                📊 Review in Dashboard
              </a>
            </div>
          </div>
          <div style="background-color:#111827;padding:15px;text-align:center;border-top:1px solid #374151;">
            <p style="margin:0;color:#6b7280;font-size:12px;">EMF Contracting LLC | Field Service Management</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}
