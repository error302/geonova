-- Create/Update signatures table
create table if not exists signatures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  project_id uuid references projects(id) on delete cascade,
  document_hash text not null,
  signer_name text not null,
  isk_number text,
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_signatures_user_id on signatures(user_id);
create index if not exists idx_signatures_project_id on signatures(project_id);

alter table signatures enable row level security;

create policy "Anyone can view signatures for verification"
on signatures for select using (true);

create policy "Users can insert their own signatures"
on signatures for insert
with check (user_id = auth.uid());
