-- Core project + points tables for GeoNova
-- Keeps the schema reproducible from a clean Supabase database.

create extension if not exists pgcrypto;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  location text,
  utm_zone integer not null check (utm_zone between 1 and 60),
  hemisphere text not null check (hemisphere in ('N','S')),
  created_at timestamptz not null default now()
);

create index if not exists idx_projects_user_id on projects(user_id);

create table if not exists survey_points (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  easting double precision not null,
  northing double precision not null,
  elevation double precision,
  is_control boolean not null default false,
  control_order text check (control_order in ('primary','secondary','temporary')),
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  unique(project_id, name)
);

create index if not exists idx_survey_points_project_id on survey_points(project_id);

alter table projects enable row level security;
alter table survey_points enable row level security;

do $$
begin
  create policy "Users manage own projects"
  on projects for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Users manage points in own projects"
  on survey_points for all
  using (
    project_id in (select id from projects where user_id = auth.uid())
  )
  with check (
    project_id in (select id from projects where user_id = auth.uid())
  );
exception
  when duplicate_object then null;
end $$;

