-- QB Stage 3: push FSM invoices to QuickBooks + store the official QB PDF
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS qb_invoice_qbid TEXT,
  ADD COLUMN IF NOT EXISTS qb_pdf_url      TEXT,
  ADD COLUMN IF NOT EXISTS qb_synced_at    TIMESTAMPTZ;
