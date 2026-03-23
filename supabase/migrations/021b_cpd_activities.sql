-- Create CPD Activities table
create table if not exists cpd_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  provider text not null,
  date timestamptz not null default now(),
  hours numeric(4,1) not null,
  category text not null,
  source text not null,
  created_at timestamptz not null default now()
);

alter table cpd_activities enable row level security;

create policy "Users can view their own CPD activities"
on cpd_activities for select
using (user_id = auth.uid());

create policy "Users can insert their own CPD activities"
on cpd_activities for insert
with check (user_id = auth.uid());
