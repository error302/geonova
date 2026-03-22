-- Plan usage tracking table
-- Tracks feature usage per user for monitoring and enforcement

create table plan_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  feature text not null,
  usage_count integer default 0,
  usage_limit integer not null default -1,
  last_incremented_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(user_id, feature)
);

alter table plan_usage enable row level security;

create policy "Users manage own usage"
on plan_usage for all using (user_id = auth.uid());

-- Usage tracking function: increments or creates a usage record
create or replace function increment_usage(
  p_user_id uuid,
  p_feature text,
  p_increment integer default 1
) returns integer as $$
declare
  v_current integer;
  v_limit integer;
  v_new_count integer;
begin
  select usage_count, usage_limit into v_current, v_limit
  from plan_usage
  where user_id = p_user_id and feature = p_feature;

  if not found then
    insert into plan_usage (user_id, feature, usage_count) values (p_user_id, p_feature, p_increment);
    return p_increment;
  end if;

  if v_limit >= 0 and v_current + p_increment > v_limit then
    return -1;
  end if;

  update plan_usage
  set usage_count = usage_count + p_increment,
      last_incremented_at = now()
  where user_id = p_user_id and feature = p_feature
  returning usage_count into v_new_count;

  return v_new_count;
end;
$$ language plpgsql security definer;

-- Check if user has usage remaining for a feature
create or replace function has_usage_remaining(
  p_user_id uuid,
  p_feature text
) returns boolean as $$
declare
  v_current integer;
  v_limit integer;
begin
  select usage_count, usage_limit into v_current, v_limit
  from plan_usage
  where user_id = p_user_id and feature = p_feature;

  if not found then return true; end if;
  if v_limit < 0 then return true; end if;
  return v_current < v_limit;
end;
$$ language plpgsql security definer;
