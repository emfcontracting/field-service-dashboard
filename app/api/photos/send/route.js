// POST /api/photos/send
// Body: { woNumber, building, description, status, submittedBy, kind,
//         batchLabel?, photos: [{ name, base64, mimeType }] }
//
// Emails the tech's photos/receipts to the office (emfcbre@gmail.com) via
// nodemailer — so delivery no longer depends on the tech's device Mail app
// (the iOS Apple-Mail hand-off was silently failing). verify-photos (IMAP on
// emfcbre@gmail.com) still detects it via the WO number in the subject.
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

const OFFICE_EMAIL = 'emfcbre@gmail.com';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      woNumber,
      building = '',
      description = '',
      status = '',
      submittedBy = '',
      kind = 'photos',
      batchLabel = '',
      photos = [],
    } = body || {};

    if (!woNumber) return NextResponse.json({ error: 'woNumber required' }, { status: 400 });
    if (!Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json({ error: 'no photos' }, { status: 400 });
    }

    const emailUser = process.env.EMAIL_USER || 'emfcbre@gmail.com';
    const emailPass = process.env.EMAIL_PASS;
    if (!emailPass) return NextResponse.json({ error: 'EMAIL_PASS not configured' }, { status: 500 });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: emailUser, pass: emailPass },
    });

    const label = kind === 'receipts' ? 'Receipts' : 'Photos';
    const subject = `${label} - ${woNumber} - ${building}${batchLabel ? ` ${batchLabel}` : ''}`.trim();
    const text =
      `Work Order: ${woNumber}\n` +
      `Building: ${building}\n` +
      `Description: ${description}\n` +
      `Status: ${status}\n` +
      `Submitted by: ${submittedBy}\n` +
      `Date: ${new Date().toLocaleString('en-US')}\n\n` +
      `${photos.length} ${label.toLowerCase()} attached.`;

    const attachments = photos.map((p, i) => ({
      filename: p.name || `${kind}_${woNumber}_${i + 1}.jpg`,
      content: p.base64,
      encoding: 'base64',
      contentType: p.mimeType || 'image/jpeg',
    }));

    await transporter.sendMail({
      from: `"EMF FieldService" <${emailUser}>`,
      to: OFFICE_EMAIL,
      subject,
      text,
      attachments,
    });

    return NextResponse.json({ ok: true, count: photos.length });
  } catch (err) {
    console.error('[photos/send] error:', err);
    return NextResponse.json({ error: err?.message || 'send failed' }, { status: 500 });
  }
}
