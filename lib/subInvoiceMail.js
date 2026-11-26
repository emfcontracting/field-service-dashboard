// lib/subInvoiceMail.js  (server only)
// -----------------------------------------------------------------------------
// Mails a stored subcontractor invoice as PDF to its addressee
// (lib/invoiceRecipient): EMF, or the other client's e-mail. Sent from the
// EMF Gmail account (EMAIL_USER / EMAIL_PASS) with the subcontractor as
// Reply-To and in CC, so answers go to him and he keeps a copy.
// Recipient and content always come from the database, never from the browser.
// { reminder: true }: friendly payment reminder for the open amount (English,
// like the invoice itself).
// -----------------------------------------------------------------------------
import nodemailer from 'nodemailer';
import { invoiceRecipient } from './invoiceRecipient';
import { buildSubInvoicePdf } from './subInvoicePdf';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function mailSubInvoice({ invoice, userData, profile, lineItems }, { reminder = false } = {}) {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) throw new Error('Email service not configured');

  const to = invoiceRecipient(invoice);
  if (!to.email) throw new Error('This invoice has no recipient e-mail');

  const from = profile?.business_name || `${userData?.first_name || ''} ${userData?.last_name || ''}`.trim() || 'Subcontractor';
  const total = (parseFloat(invoice.grand_total) || 0).toFixed(2);
  const paidSoFar = parseFloat(invoice.amount_paid) || 0;
  const open = Math.max(0, (parseFloat(invoice.grand_total) || 0) - paidSoFar).toFixed(2);
  const sentOn = invoice.sent_at
    ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(invoice.sent_at))
    : '';
  const pdf = await buildSubInvoicePdf({ invoice, userData, profile, lineItems });

  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  const info = await transporter.sendMail({
    from: `"${from.replace(/"/g, '')}" <${user}>`,
    to: to.email,
    cc: userData?.email || undefined,
    replyTo: userData?.email || undefined,
    subject: reminder
      ? `Payment reminder: Invoice ${invoice.invoice_number} — $${open} open`
      : `Invoice ${invoice.invoice_number} — ${from} — $${total}`,
    html: reminder
      ? `<p>Hello${to.isEmf ? '' : ` ${esc(to.name)}`},</p>
<p>a friendly reminder that invoice <strong>${esc(invoice.invoice_number)}</strong>${sentOn ? `, sent on ${esc(sentOn)},` : ''} still shows <strong>$${open}</strong> open${paidSoFar > 0 ? ` ($${paidSoFar.toFixed(2)} of $${total} received — thank you)` : ''}.</p>
<p>The invoice is attached again. If you have already paid, please disregard this message.</p>
<p>Thank you,<br>${esc(from)}${userData?.email ? `<br>${esc(userData.email)}` : ''}</p>`
      : `<p>Hello${to.isEmf ? '' : ` ${esc(to.name)}`},</p>
<p>please find attached invoice <strong>${esc(invoice.invoice_number)}</strong>${invoice.period_start ? ` for ${esc(invoice.period_start)} – ${esc(invoice.period_end)}` : ''}.</p>
<p>Total due: <strong>$${total}</strong></p>
<p>Thank you,<br>${esc(from)}${userData?.email ? `<br>${esc(userData.email)}` : ''}</p>`,
    attachments: [{ filename: `${invoice.invoice_number}.pdf`, content: Buffer.from(pdf), contentType: 'application/pdf' }],
  });
  return { messageId: info.messageId, to: to.email };
}
