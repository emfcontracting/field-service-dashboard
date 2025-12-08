-- Subcontractor Portal Tables
-- Run this in Supabase SQL Editor

-- Subcontractor profiles (rates, access control)
CREATE TABLE IF NOT EXISTS subcontractor_profiles (
    profile_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
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
    invoice_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
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
    item_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id UUID NOT NULL REFERENCES subcontractor_invoices(invoice_id) ON DELETE CASCADE,
    wo_id UUID REFERENCES work_orders(wo_id) ON DELETE SET NULL,
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

-- Generate next invoice number function
CREATE OR REPLACE FUNCTION generate_sub_invoice_number(p_user_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    v_year VARCHAR(4);
    v_count INTEGER;
    v_initials VARCHAR(10);
BEGIN
    v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
    
    -- Get user initials
    SELECT UPPER(SUBSTRING(first_name, 1, 1) || SUBSTRING(last_name, 1, 1))
    INTO v_initials
    FROM users WHERE user_id = p_user_id;
    
    -- Count existing invoices for this user this year
    SELECT COUNT(*) + 1 INTO v_count
    FROM subcontractor_invoices
    WHERE user_id = p_user_id
    AND invoice_number LIKE 'SUB-' || v_year || '-%';
    
    RETURN 'SUB-' || v_year || '-' || COALESCE(v_initials, 'XX') || '-' || LPAD(v_count::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;
