-- QB Stage 3: only qb_pdf_url is new (qb_invoice_id, qb_invoice_number,
-- synced_to_qb_at already exist from the original scaffolding)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS qb_pdf_url TEXT;
