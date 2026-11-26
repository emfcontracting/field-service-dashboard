// lib/subInvoiceMail.js  (server only)
// -----------------------------------------------------------------------------
// Mails a stored subcontractor invoice as PDF to its addressee
// (lib/invoiceRecipient): EMF, or the other client's e-mail. Sent from the
// EMF Gmail account (EMAIL_USER / EMAIL_PASS) with the subcontractor as
// Reply-To and in CC, so answers go to him and he keeps a copy.
// Recipient and content always come from the database, never from the browser.
// -----------------------------------------------------------------------------
import nodemailer from 'nodemailer';
import { invoiceRecipient } from './invoiceRecipient';
import { buildSubInvoicePdf } from './subInvoicePdf';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function mailSubInvoice({ invoice, userData, profile, lineItems }) {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) throw new Error('Email service not configured');

  const to = invoiceRecipient(invoice);
  if (!to.email) throw new Error('This invoice has no recipient e-mail');

  const from = profile?.business_name || `${userData?.first_name || ''} ${userData?.last_name || ''}`.trim() || 'Subcontractor';
  const total = (parseFloat(invoice.grand_total) || 0).toFixed(2);
  const pdf = await buildSubInvoicePdf({ invoice, userData, profile, lineItems });

  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  const info = await transporter.sendMail({
    from: `"${from.replace(/"/g, '')}" <${user}>`,
    to: to.email,
    cc: userData?.email || undefined,
    replyTo: userData?.email || undefined,
    subject: `Invoice ${invoice.invoice_number} — ${from} — $${total}`,
    html: `<p>Hello${to.isEmf ? '' : ` ${esc(to.name)}`},</p>
<p>please find attached invoice <strong>${esc(invoice.invoice_number)}</strong>${invoice.period_start ? ` for ${esc(invoice.period_start)} – ${esc(invoice.period_end)}` : ''}.</p>
<p>Total due: <strong>$${total}</strong></p>
<p>Thank you,<br>${esc(from)}${userData?.email ? `<br>${esc(userData.email)}` : ''}</p>`,
    attachments: [{ filename: `${invoice.invoice_number}.pdf`, content: Buffer.from(pdf), contentType: 'application/pdf' }],
  });
  return { messageId: info.messageId, to: to.email };
}
