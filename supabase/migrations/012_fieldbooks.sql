-- GeoNova Digital Field Book storage
-- Stores structured field observations for offline/online sync.

create table if not exists public.fieldbooks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null, -- leveling | traverse | control | hydrographic | mining
  name text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fieldbooks_project_id_idx on public.fieldbooks(project_id);
create index if not exists fieldbooks_user_id_idx on public.fieldbooks(user_id);

alter table public.fieldbooks enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists fieldbooks_set_updated_at on public.fieldbooks;
create trigger fieldbooks_set_updated_at
before update on public.fieldbooks
for each row execute function public.set_updated_at();

-- Owners can CRUD their fieldbooks
drop policy if exists "fieldbooks_select_own" on public.fieldbooks;
create policy "fieldbooks_select_own"
on public.fieldbooks for select
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.projects p
    where p.id = fieldbooks.project_id
      and p.user_id = auth.uid()
  )
  or exists (
    select 1 from public.project_members pm
    where pm.project_id = fieldbooks.project_id
      and pm.user_id = auth.uid()
      and pm.status = 'accepted'
  )
);

drop policy if exists "fieldbooks_insert_own" on public.fieldbooks;
create policy "fieldbooks_insert_own"
on public.fieldbooks for insert
with check (
  auth.uid() = user_id
  and (
    exists (
      select 1 from public.projects p
      where p.id = fieldbooks.project_id
        and p.user_id = auth.uid()
    )
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = fieldbooks.project_id
        and pm.user_id = auth.uid()
        and pm.status = 'accepted'
    )
  )
);

drop policy if exists "fieldbooks_update_own" on public.fieldbooks;
create policy "fieldbooks_update_own"
on public.fieldbooks for update
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.projects p
    where p.id = fieldbooks.project_id
      and p.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  or exists (
    select 1 from public.projects p
    where p.id = fieldbooks.project_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "fieldbooks_delete_own" on public.fieldbooks;
create policy "fieldbooks_delete_own"
on public.fieldbooks for delete
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.projects p
    where p.id = fieldbooks.project_id
      and p.user_id = auth.uid()
  )
);
