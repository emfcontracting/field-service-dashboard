-- Migration: Add CBRE/VWAS Integration Fields
-- Created: 2025-12-07
-- Description: Adds fields needed for CBRE invoicing workflow integration with VWAS

-- =====================================================
-- WORK ORDERS TABLE - CBRE/VWAS Fields
-- =====================================================

-- VWAS Work Order Number (external reference)
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS vwas_wo_number VARCHAR(50);

-- CBRE-specific NTE (Not-To-Exceed) amount from VWAS
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS cbre_nte DECIMAL(10,2);

-- Track if invoice has been submitted to VWAS
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS vwas_invoice_submitted BOOLEAN DEFAULT FALSE;

-- Timestamp when submitted to VWAS
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS vwas_submitted_at TIMESTAMP;

-- Reference to photos email in emfcbre@gmail.com
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS photos_email_reference VARCHAR(255);

-- Client identifier (to filter CBRE vs other clients)
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS client VARCHAR(100);

-- =====================================================
-- INVOICES TABLE - CBRE/VWAS Fields
-- =====================================================

-- Track if invoice has been submitted to VWAS
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vwas_submitted BOOLEAN DEFAULT FALSE;

-- Timestamp when submitted to VWAS
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vwas_submitted_at TIMESTAMP;

-- CBRE-specific status tracking
-- Values: 'pending_vwas', 'submitted_to_vwas', 'paid'
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cbre_status VARCHAR(50);

-- =====================================================
-- INDEXES for better query performance
-- =====================================================

-- Index for filtering CBRE work orders
CREATE INDEX IF NOT EXISTS idx_work_orders_client ON work_orders(client);

-- Index for VWAS work order lookups
CREATE INDEX IF NOT EXISTS idx_work_orders_vwas_wo ON work_orders(vwas_wo_number);

-- Index for CBRE invoice status
CREATE INDEX IF NOT EXISTS idx_invoices_cbre_status ON invoices(cbre_status);

-- =====================================================
-- COMMENTS (for documentation)
-- =====================================================

COMMENT ON COLUMN work_orders.vwas_wo_number IS 'Work order number from VWAS/Verisae system';
COMMENT ON COLUMN work_orders.cbre_nte IS 'Not-To-Exceed amount from CBRE/VWAS';
COMMENT ON COLUMN work_orders.vwas_invoice_submitted IS 'Whether invoice has been uploaded to VWAS';
COMMENT ON COLUMN work_orders.vwas_submitted_at IS 'Timestamp when invoice was submitted to VWAS';
COMMENT ON COLUMN work_orders.photos_email_reference IS 'Email reference for job photos in emfcbre@gmail.com';
COMMENT ON COLUMN work_orders.client IS 'Client identifier (e.g., CBRE, UPS, etc.)';

COMMENT ON COLUMN invoices.vwas_submitted IS 'Whether invoice has been uploaded to VWAS';
COMMENT ON COLUMN invoices.vwas_submitted_at IS 'Timestamp when invoice was submitted to VWAS';
COMMENT ON COLUMN invoices.cbre_status IS 'CBRE workflow status: pending_vwas, submitted_to_vwas, paid';
