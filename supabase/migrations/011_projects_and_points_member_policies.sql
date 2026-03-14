-- Expand RLS to support project collaboration via project_members.
-- Requires 006_project_members.sql (project_members table + trigger).

do $$
begin
  create policy "Members can view projects"
  on projects for select
  using (
    user_id = auth.uid()
    or id in (
      select pm.project_id
      from project_members pm
      where pm.user_id = auth.uid()
        and pm.status = 'accepted'
    )
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Members can view survey points"
  on survey_points for select
  using (
    project_id in (
      select p.id from projects p where p.user_id = auth.uid()
    )
    or project_id in (
      select pm.project_id
      from project_members pm
      where pm.user_id = auth.uid()
        and pm.status = 'accepted'
    )
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Editors can insert survey points"
  on survey_points for insert
  with check (
    project_id in (
      select p.id from projects p where p.user_id = auth.uid()
    )
    or project_id in (
      select pm.project_id
      from project_members pm
      where pm.user_id = auth.uid()
        and pm.status = 'accepted'
        and pm.role in ('owner','supervisor','surveyor')
    )
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Editors can update survey points"
  on survey_points for update
  using (
    project_id in (
      select p.id from projects p where p.user_id = auth.uid()
    )
    or project_id in (
      select pm.project_id
      from project_members pm
      where pm.user_id = auth.uid()
        and pm.status = 'accepted'
        and pm.role in ('owner','supervisor','surveyor')
    )
  )
  with check (
    project_id in (
      select p.id from projects p where p.user_id = auth.uid()
    )
    or project_id in (
      select pm.project_id
      from project_members pm
      where pm.user_id = auth.uid()
        and pm.status = 'accepted'
        and pm.role in ('owner','supervisor','surveyor')
    )
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Editors can delete survey points"
  on survey_points for delete
  using (
    project_id in (
      select p.id from projects p where p.user_id = auth.uid()
    )
    or project_id in (
      select pm.project_id
      from project_members pm
      where pm.user_id = auth.uid()
        and pm.status = 'accepted'
        and pm.role in ('owner','supervisor','surveyor')
    )
  );
exception
  when duplicate_object then null;
end $$;

