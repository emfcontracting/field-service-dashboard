-- Invoice Verification Table
-- For tracking external contractor invoice verifications
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS invoice_verifications (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    invoice_number VARCHAR(100),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- What they claimed
    claimed_regular_hours DECIMAL(10,2) DEFAULT 0,
    claimed_ot_hours DECIMAL(10,2) DEFAULT 0,
    claimed_miles DECIMAL(10,1) DEFAULT 0,
    claimed_total DECIMAL(10,2) DEFAULT 0,
    
    -- What EMF has
    emf_regular_hours DECIMAL(10,2) DEFAULT 0,
    emf_ot_hours DECIMAL(10,2) DEFAULT 0,
    emf_miles DECIMAL(10,1) DEFAULT 0,
    
    -- Verification result
    has_discrepancy BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'pending', -- pending, verified, flagged, resolved
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified_by UUID REFERENCES users(user_id)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_invoice_verifications_user ON invoice_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_verifications_status ON invoice_verifications(status);
CREATE INDEX IF NOT EXISTS idx_invoice_verifications_period ON invoice_verifications(period_start, period_end);

-- Enable RLS
ALTER TABLE invoice_verifications ENABLE ROW LEVEL SECURITY;

-- Policy for access
CREATE POLICY "Allow all access to invoice_verifications" ON invoice_verifications
    FOR ALL USING (true) WITH CHECK (true);
