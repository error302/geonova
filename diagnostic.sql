-- Metardu Database Diagnostic Script
-- Run this in Supabase SQL Editor to check production state

-- 1. How many tables exist?
SELECT COUNT(*) as table_count 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- 2. List all existing tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 3. Check if core tables exist
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects') as projects_exists,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'survey_points') as survey_points_exists,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_subscriptions') as subscriptions_exists;

-- 4. Count projects
SELECT COUNT(*) as project_count FROM projects;

-- 5. Check if any project exists for the test ID
SELECT * FROM projects 
WHERE id = '5cc9732a-a363-4f30-bf65-dfc6a5a22170';

-- 6. Check RLS is enabled on projects
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'projects';

-- 7. List RLS policies on projects table
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'projects';
