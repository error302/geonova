-- Field Mission Planner tables
-- Jobs, equipment recommendations, checklists for GeoNova

-- Enable PostGIS if not already
create extension if not exists postgis;

-- Jobs table
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  client text,
  survey_type text not null check (survey_type in ('boundary', 'topographic', 'leveling', 'road', 'construction', 'control', 'mining', 'hydrographic', 'drone', 'gnss', 'other')),
  location geography(point, 4326),
  scheduled_date timestamptz,
  crew_size integer check (crew_size > 0),
  status text default 'planned' check (status in ('planned', 'active', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_jobs_user_id on jobs(user_id);
create index idx_jobs_scheduled_date on jobs(scheduled_date);
create index idx_jobs_status on jobs(status);

-- Equipment recommendations (jsonb for flexibility)
create table if not exists equipment_recommendations (
  id uuid primary key default gen_random_uuid(),
  survey_type text primary key,
  equipment jsonb not null,
  created_at timestamptz not null default now()
);

-- Job checklists
create table if not exists job_checklists (
  id uuid primary key default gen_random_uuid(),
  survey_type text primary key,
  tasks jsonb not null,
  created_at timestamptz not null default now()
);

-- Seed equipment data
insert into equipment_recommendations (survey_type, equipment) values
('boundary', '["Total Station", "Prism", "Tripod", "Range poles", "Nails / pegs", "Field book"]'::jsonb),
('topographic', '["GNSS receiver", "Total station", "Prism pole", "Drone (optional)"]'::jsonb),
('leveling', '["Automatic level", "Level staff", "Pegs", "Measuring tape"]'::jsonb),
('road', '["Total station", "GNSS", "Prism pole", "Reflectors"]'::jsonb),
('construction', '["Total station", "Prism", "GNSS", "Laser level"]'::jsonb)
on conflict (survey_type) do nothing;

-- Seed checklist data
insert into job_checklists (survey_type, tasks) values
('boundary', '["Charge GNSS batteries", "Pack tripod", "Download control points", "Clear SD cards", "Check prism constant"]'::jsonb),
('topographic', '["Calibrate drone", "Check GNSS RTK status", "Battery management plan", "Backup storage ready"]'::jsonb),
('leveling', '["Check level staff calibration", "Bubble check on instrument", "Tripod stability test"]'::jsonb)
on conflict (survey_type) do nothing;

-- Enable RLS
alter table jobs enable row level security;
alter table equipment_recommendations enable row level security;
alter table job_checklists enable row level security;

-- RLS policies
do $$
begin
  create policy "Users manage own jobs" on jobs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "Public read equipment/checklists" on equipment_recommendations for select using (true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "Public read checklists" on job_checklists for select using (true);
exception when duplicate_object then null;
end $$;

-- Realtime for jobs
alter publication supabase_realtime add table jobs;

-- Trigger for updated_at
create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_jobs_updated_at before update on jobs
  for each row execute procedure handle_updated_at();

-- Grant permissions
grant all on jobs to service_role;
grant all on equipment_recommendations to service_role;
grant all on job_checklists to service_role;
grant execute on function handle_updated_at to service_role;

