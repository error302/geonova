-- Create surveyor_profiles table for community features
-- Run this against your Supabase database

CREATE TABLE IF NOT EXISTS surveyor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  isk_number TEXT,
  firm_name TEXT,
  county TEXT,
  specializations TEXT[] DEFAULT '{}',
  years_experience INTEGER,
  bio TEXT,
  profile_public BOOLEAN DEFAULT true,
  average_rating DECIMAL(3,2) DEFAULT 0,
  total_jobs INTEGER DEFAULT 0,
  verified_surveyor BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_surveyor_profiles_user_id ON surveyor_profiles(user_id);
CREATE INDEX idx_surveyor_profiles_county ON surveyor_profiles(county);
CREATE INDEX idx_surveyor_profiles_public ON surveyor_profiles(profile_public) WHERE profile_public = true;
