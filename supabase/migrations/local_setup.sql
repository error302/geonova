-- Core tables for local PostgreSQL (no Supabase dependencies)
-- Run this against your local metardu database

-- Enable UUID generation
create extension if not exists pgcrypto;
create extension if not exists postgis;

-- Simplified users table (local auth)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz not null default now()
);

-- Projects table (no auth dependency for local dev)
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  name text not null,
  description text,
  location text,
  survey_type text,
  utm_zone integer check (utm_zone between 1 and 60),
  hemisphere text check (hemisphere in ('N','S')),
  status text default 'draft',
  metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_projects_user_id on projects(user_id);

-- Survey points table
create table if not exists survey_points (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  easting double precision not null,
  northing double precision not null,
  elevation double precision,
  is_control boolean default false,
  control_order text check (control_order in ('primary','secondary','temporary')),
  locked boolean default false,
  point_type text default 'normal',
  created_at timestamptz not null default now(),
  unique(project_id, name)
);

create index idx_survey_points_project_id on survey_points(project_id);

-- Beacons table
create table if not exists beacons (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  beacon_type text,
  easting double precision,
  northing double precision,
  elevation double precision,
  description text,
  created_at timestamptz not null default now()
);

create index idx_beacons_project_id on beacons(project_id);

-- Field books / leveling observations
create table if not exists leveling_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  run_number integer,
  computation_method text default 'hpc',
  observations jsonb default '[]',
  start_bm_ref text,
  start_rl double precision,
  end_bm_ref text,
  end_rl double precision,
  total_distance double precision,
  misclosure double precision,
  adjusted boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists leveling_stations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references leveling_runs(id) on delete cascade,
  station_id text not null,
  back_sight double precision,
  intermediate_sight double precision,
  fore_sight double precision,
  reduced_level double precision,
  distance double precision,
  remarks text,
  created_at timestamptz not null default now()
);

-- Parcels table
create table if not exists parcels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  parcel_number text,
  area_hectares double precision,
  geometry geometry(Polygon, 32737), -- UTM Zone 37S for Kenya
  created_at timestamptz not null default now()
);

create index idx_parcels_project_id on parcels(project_id);

-- Alignments table
create table if not exists alignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  alignment_type text,
  geometry geometry(LineString, 32737),
  created_at timestamptz not null default now()
);

create index idx_alignments_project_id on alignments(project_id);

-- Insert a default local user for development
insert into users (id, email) 
values ('00000000-0000-0000-0000-000000000001', 'local@metardu.ke')
on conflict (email) do nothing;

-- Insert a demo project
insert into projects (id, user_id, name, description, location, survey_type, utm_zone, hemisphere, status)
values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Demo Survey Project',
  'A sample project to demonstrate METARDU capabilities',
  'Nairobi, Kenya',
  'boundary',
  37,
  'S',
  'active'
)
on conflict do nothing;

-- Insert demo survey points
insert into survey_points (project_id, name, easting, northing, elevation, is_control, control_order)
values 
  ('10000000-0000-0000-0000-000000000001', 'BM1', 250000, 9850000, 1450.234, true, 'primary'),
  ('10000000-0000-0000-0000-000000000001', 'P1', 250050, 9850050, NULL, false, NULL),
  ('10000000-0000-0000-0000-000000000001', 'P2', 250100, 9850100, NULL, false, NULL),
  ('10000000-0000-0000-0000-000000000001', 'P3', 250150, 9850150, NULL, false, NULL)
on conflict do nothing;

-- Insert demo beacons
insert into beacons (project_id, name, beacon_type, easting, northing, elevation, description)
values
  ('10000000-0000-0000-0000-000000000001', 'A', 'concrete', 250000, 9850000, 1450.234, 'Corner beacon - iron pin'),
  ('10000000-0000-0000-0000-000000000001', 'B', 'concrete', 250100, 9850000, NULL, 'Corner beacon'),
  ('10000000-0000-0000-0000-000000000001', 'C', 'pipe', 250100, 9850100, NULL, 'Iron pipe'),
  ('10000000-0000-0000-0000-000000000001', 'D', 'concrete', 250000, 9850100, NULL, 'Corner beacon')
on conflict do nothing;
