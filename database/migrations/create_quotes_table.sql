-- NTE Increase / Quote Tables for FSM System
-- Run this in Supabase SQL Editor

-- Main NTE Increase table
CREATE TABLE IF NOT EXISTS work_order_quotes (
  quote_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wo_id INTEGER REFERENCES work_orders(wo_id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(user_id),
  
  -- Quote Type
  is_verbal_nte BOOLEAN DEFAULT FALSE,
  verbal_approved_by VARCHAR(255),
  
  -- Labor Estimates
  estimated_techs INTEGER DEFAULT 1,
  estimated_rt_hours DECIMAL(10,2) DEFAULT 0,
  estimated_ot_hours DECIMAL(10,2) DEFAULT 0,
  
  -- Costs (before markup)
  material_cost DECIMAL(10,2) DEFAULT 0,
  equipment_cost DECIMAL(10,2) DEFAULT 0,
  rental_cost DECIMAL(10,2) DEFAULT 0,
  trailer_cost DECIMAL(10,2) DEFAULT 0,
  
  -- Mileage
  estimated_miles DECIMAL(10,2) DEFAULT 0,
  
  -- Calculated totals (stored for reference)
  labor_total DECIMAL(10,2) DEFAULT 0,
  materials_with_markup DECIMAL(10,2) DEFAULT 0,
  equipment_with_markup DECIMAL(10,2) DEFAULT 0,
  admin_fee DECIMAL(10,2) DEFAULT 128,
  mileage_total DECIMAL(10,2) DEFAULT 0,
  grand_total DECIMAL(10,2) DEFAULT 0,
  
  -- Notes/Description
  description TEXT,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Material line items for quotes
CREATE TABLE IF NOT EXISTS quote_materials (
  material_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID REFERENCES work_order_quotes(quote_id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit_cost DECIMAL(10,2) DEFAULT 0,
  total_cost DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_quotes_wo_id ON work_order_quotes(wo_id);
CREATE INDEX IF NOT EXISTS idx_quote_materials_quote_id ON quote_materials(quote_id);

-- Enable RLS
ALTER TABLE work_order_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_materials ENABLE ROW LEVEL SECURITY;

-- RLS Policies for work_order_quotes
CREATE POLICY "Users can view quotes for their work orders" ON work_order_quotes
  FOR SELECT USING (true);

CREATE POLICY "Lead techs can create quotes" ON work_order_quotes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update quotes" ON work_order_quotes
  FOR UPDATE USING (true);

CREATE POLICY "Admins can delete quotes" ON work_order_quotes
  FOR DELETE USING (true);

-- RLS Policies for quote_materials
CREATE POLICY "Users can view quote materials" ON quote_materials
  FOR SELECT USING (true);

CREATE POLICY "Users can create quote materials" ON quote_materials
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update quote materials" ON quote_materials
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete quote materials" ON quote_materials
  FOR DELETE USING (true);
