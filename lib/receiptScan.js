// lib/receiptScan.js  (server only)
// -----------------------------------------------------------------------------
// Reads a receipt photo/PDF with Claude: vendor, date, total, receipt number
// and a suggested expense category from the sub's own category list. The sub
// always confirms — nothing is saved from here. Model: ANTHROPIC_RECEIPT_MODEL,
// default claude-haiku-5-5; falls back to the model extract-invoice already
// uses if the default is not available on the account.
// -----------------------------------------------------------------------------
import Anthropic from '@anthropic-ai/sdk';

const FALLBACK_MODEL = 'claude-sonnet-4-20250514';

function prompt(categories) {
  return `This is a purchase receipt (or invoice) of a self-employed field technician.
Read it and answer with JSON only:
{
  "vendor": "store or company name, or null",
  "date": "YYYY-MM-DD or null",
  "total": number (the amount actually paid, incl. tax) or null,
  "receipt_number": "receipt / invoice / transaction number or null",
  "category": one of ${JSON.stringify(categories)} that fits best, or null,
  "summary": "what was bought, max 12 words"
}
If a value is not readable, use null. Do not guess numbers.`;
}

export async function scanReceipt({ base64, mediaType, categories = [] }) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Receipt scan not configured');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const isPdf = mediaType === 'application/pdf';
  const content = [
    { type: isPdf ? 'document' : 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
    { type: 'text', text: prompt(categories) },
  ];
  const models = [process.env.ANTHROPIC_RECEIPT_MODEL || 'claude-haiku-5-5', FALLBACK_MODEL];

  let lastErr;
  for (const model of [...new Set(models)]) {
    try {
      const res = await client.messages.create({ model, max_tokens: 600, messages: [{ role: 'user', content }] });
      const text = res.content.find((c) => c.type === 'text')?.text || '';
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('No JSON in scan result');
      const raw = JSON.parse(m[0]);
      const total = typeof raw.total === 'number' ? raw.total : parseFloat(raw.total);
      return {
        vendor: raw.vendor ? String(raw.vendor).slice(0, 200) : null,
        date: /^\d{4}-\d{2}-\d{2}$/.test(raw.date || '') ? raw.date : null,
        total: Number.isFinite(total) && total > 0 ? Math.round(total * 100) / 100 : null,
        receipt_number: raw.receipt_number ? String(raw.receipt_number).slice(0, 100) : null,
        category: categories.includes(raw.category) ? raw.category : null,
        summary: raw.summary ? String(raw.summary).slice(0, 200) : null,
        model,
      };
    } catch (e) {
      lastErr = e;
      // Model not available → try the fallback; anything else → stop.
      if (!(e?.status === 404 || /model/i.test(e?.message || ''))) break;
    }
  }
  throw lastErr || new Error('Receipt scan failed');
}
