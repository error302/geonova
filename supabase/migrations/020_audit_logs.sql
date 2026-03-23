create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  event_type text not null,
  description text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

alter table audit_logs enable row level security;

create policy "Users can view their own audit logs"
on audit_logs for select using (user_id = auth.uid());

create policy "Users can insert their own audit logs"
on audit_logs for insert with check (user_id = auth.uid());

create index if not exists idx_audit_logs_user_created
on audit_logs (user_id, created_at desc);
