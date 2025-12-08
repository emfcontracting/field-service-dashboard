-- Subcontractor Portal Tables
-- Run this in Supabase SQL Editor

-- Subcontractor profiles (rates, access control)
CREATE TABLE IF NOT EXISTS subcontractor_profiles (
    profile_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT false,
    subscription_status VARCHAR(20) DEFAULT 'trial', -- trial, active, expired, disabled
    subscription_expires_at TIMESTAMP WITH TIME ZONE,
    hourly_rate DECIMAL(10,2) DEFAULT 35.00,
    ot_rate DECIMAL(10,2) DEFAULT 52.50,
    mileage_rate DECIMAL(10,4) DEFAULT 0.6700,
    pin_hash VARCHAR(255), -- Separate PIN for contractor portal
    business_name VARCHAR(255),
    business_address TEXT,
    tax_id VARCHAR(50), -- Optional EIN or SSN last 4
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Subcontractor invoices
CREATE TABLE IF NOT EXISTS subcontractor_invoices (
    invoice_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) NOT NULL, -- SUB-2024-001
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Calculated totals
    total_regular_hours DECIMAL(10,2) DEFAULT 0,
    total_ot_hours DECIMAL(10,2) DEFAULT 0,
    total_hours_amount DECIMAL(10,2) DEFAULT 0,
    total_miles DECIMAL(10,1) DEFAULT 0,
    total_mileage_amount DECIMAL(10,2) DEFAULT 0,
    total_line_items_amount DECIMAL(10,2) DEFAULT 0,
    grand_total DECIMAL(10,2) DEFAULT 0,
    
    -- Rates used (snapshot at time of invoice)
    hourly_rate_used DECIMAL(10,2),
    ot_rate_used DECIMAL(10,2),
    mileage_rate_used DECIMAL(10,4),
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'draft', -- draft, sent, paid
    notes TEXT,
    
    -- Email tracking
    sent_to_email VARCHAR(255),
    sent_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoice line items (custom additions like materials)
CREATE TABLE IF NOT EXISTS subcontractor_invoice_items (
    item_id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES subcontractor_invoices(invoice_id) ON DELETE CASCADE,
    wo_id INTEGER REFERENCES work_orders(wo_id) ON DELETE SET NULL,
    item_type VARCHAR(20) DEFAULT 'custom', -- hours, mileage, custom
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) DEFAULT 1,
    rate DECIMAL(10,4),
    amount DECIMAL(10,2) NOT NULL,
    work_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sub_profiles_user ON subcontractor_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_invoices_user ON subcontractor_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_invoices_status ON subcontractor_invoices(status);
CREATE INDEX IF NOT EXISTS idx_sub_invoice_items_invoice ON subcontractor_invoice_items(invoice_id);

-- Enable RLS
ALTER TABLE subcontractor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractor_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractor_invoice_items ENABLE ROW LEVEL SECURITY;

-- Policies for subcontractor_profiles
CREATE POLICY "Allow all access to subcontractor_profiles" ON subcontractor_profiles
    FOR ALL USING (true) WITH CHECK (true);

-- Policies for subcontractor_invoices
CREATE POLICY "Allow all access to subcontractor_invoices" ON subcontractor_invoices
    FOR ALL USING (true) WITH CHECK (true);

-- Policies for subcontractor_invoice_items
CREATE POLICY "Allow all access to subcontractor_invoice_items" ON subcontractor_invoice_items
    FOR ALL USING (true) WITH CHECK (true);
