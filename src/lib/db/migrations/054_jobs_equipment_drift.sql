-- Fix schema drift: Add missing 'equipment' array column to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS equipment text[] DEFAULT '{}'::text[];
