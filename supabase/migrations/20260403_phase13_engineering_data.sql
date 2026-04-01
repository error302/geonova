-- Phase 13: Engineering Survey Database Foundation
-- Adds engineering_data JSONB column for Road Design and Drainage Survey modes

-- Add engineering_data column to projects table
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS engineering_data JSONB;

COMMENT ON COLUMN projects.engineering_data IS 
'Engineering Survey data: { mode: "road" | "drainage", standard: "KRDM2017" | "KeRRA", road?: {...}, drainage?: {...} }';

-- Enable RLS on the new column (projects table already has RLS)
-- Create a simple policy to allow owners to read their own engineering data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Owners can read engineering data'
  ) THEN
    CREATE POLICY "Owners can read engineering data" ON projects
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END
$$;

-- Index for faster queries on engineering mode
CREATE INDEX IF NOT EXISTS idx_projects_engineering_data_mode 
ON projects ((engineering_data->>'mode')) 
WHERE engineering_data IS NOT NULL;