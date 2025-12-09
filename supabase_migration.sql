-- Create users table in Supabase with KYC progress tracking
-- Run this SQL in your Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/editor

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  supabase_uid UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mobile_number VARCHAR(15) NOT NULL,

  -- KYC Status and Progress
  kyc_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'rejected'
  kyc_step VARCHAR(50) DEFAULT 'onboarding', -- 'onboarding', 'identity_scan', 'address_scan', 'liveness', 'completed'

  -- Personal Information
  full_name VARCHAR(255),
  date_of_birth DATE,

  -- Identity Document Details
  identity_doc_type VARCHAR(50), -- 'pan', 'aadhaar', 'passport'
  identity_doc_number VARCHAR(100),
  identity_doc_image_url TEXT,

  -- Address Document Details
  address_doc_type VARCHAR(50), -- 'aadhaar', 'passport', 'voter_id'
  address_doc_number VARCHAR(100),
  address_doc_image_url TEXT,
  address_line TEXT,

  -- Liveness Check
  selfie_image_url TEXT,
  liveness_verified BOOLEAN DEFAULT false,

  -- Reference ID for completed KYC
  reference_id VARCHAR(50) UNIQUE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_supabase_uid ON users(supabase_uid);
CREATE INDEX IF NOT EXISTS idx_users_mobile_number ON users(mobile_number);
CREATE INDEX IF NOT EXISTS idx_users_reference_id ON users(reference_id);
CREATE INDEX IF NOT EXISTS idx_users_kyc_status ON users(kyc_status);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows users to read their own data
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT
  USING (auth.uid() = supabase_uid);

-- Create a policy that allows users to update their own data
CREATE POLICY "Users can update their own data" ON users
  FOR UPDATE
  USING (auth.uid() = supabase_uid);

-- Create a policy that allows inserting new users (for registration)
CREATE POLICY "Enable insert for authenticated users" ON users
  FOR INSERT
  WITH CHECK (auth.uid() = supabase_uid);

-- Function to generate reference ID
CREATE OR REPLACE FUNCTION generate_reference_id()
RETURNS TEXT AS $$
BEGIN
  RETURN 'KYC' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
