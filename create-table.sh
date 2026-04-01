#!/bin/bash
# Create surveyor_profiles table via Supabase REST API

curl -X POST "https://hqdovpgztgqhumhnvfoh.supabase.co/rest/v1/rpc/exec_sql" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxZG92cGd6dGdxaHVtaG52Zm9oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzM3MDIyMCwiZXhwIjoyMDg4OTQ2MjIwfQ.TAhW5Q8kw22c5kozUmR9PQUj_yc3MYShqPHwlils7P4" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxZG92cGd6dGdxaHVtaG52Zm9oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzM3MDIyMCwiZXhwIjoyMDg4OTQ2MjIwfQ.TAhW5Q8kw22c5kozUmR9PQUj_yc3MYShqPHwlils7P4" \
  -H "Content-Type: application/json" \
  -d '{"query":"CREATE TABLE IF NOT EXISTS surveyor_profiles (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL UNIQUE, display_name TEXT, isk_number TEXT, firm_name TEXT, county TEXT, specializations TEXT[] DEFAULT ARRAY[]::TEXT[], years_experience INTEGER, bio TEXT, profile_public BOOLEAN DEFAULT true, average_rating DECIMAL(3,2) DEFAULT 0, total_jobs INTEGER DEFAULT 0, verified_surveyor BOOLEAN DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())"}'
