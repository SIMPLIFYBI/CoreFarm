alter table public.hole_task_intervals enable row level security;
alter table public.hole_task_progress enable row level security;

drop policy if exists hole_task_intervals_org_read on public.hole_task_intervals;
create policy hole_task_intervals_org_read on public.hole_task_intervals
  for select
  using (
    exists (
      select 1
      from public.holes h
      join public.organization_members m on m.organization_id = h.organization_id
      where h.id = hole_task_intervals.hole_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists hole_task_intervals_org_insert on public.hole_task_intervals;
create policy hole_task_intervals_org_insert on public.hole_task_intervals
  for insert
  with check (
    exists (
      select 1
      from public.holes h
      join public.organization_members m on m.organization_id = h.organization_id
      where h.id = hole_task_intervals.hole_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists hole_task_intervals_org_update on public.hole_task_intervals;
create policy hole_task_intervals_org_update on public.hole_task_intervals
  for update
  using (
    exists (
      select 1
      from public.holes h
      join public.organization_members m on m.organization_id = h.organization_id
      where h.id = hole_task_intervals.hole_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.holes h
      join public.organization_members m on m.organization_id = h.organization_id
      where h.id = hole_task_intervals.hole_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists hole_task_intervals_org_delete on public.hole_task_intervals;
create policy hole_task_intervals_org_delete on public.hole_task_intervals
  for delete
  using (
    exists (
      select 1
      from public.holes h
      join public.organization_members m on m.organization_id = h.organization_id
      where h.id = hole_task_intervals.hole_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists hole_task_progress_org_read on public.hole_task_progress;
create policy hole_task_progress_org_read on public.hole_task_progress
  for select
  using (
    exists (
      select 1
      from public.holes h
      join public.organization_members m on m.organization_id = h.organization_id
      where h.id = hole_task_progress.hole_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists hole_task_progress_org_insert on public.hole_task_progress;
create policy hole_task_progress_org_insert on public.hole_task_progress
  for insert
  with check (
    exists (
      select 1
      from public.holes h
      join public.organization_members m on m.organization_id = h.organization_id
      where h.id = hole_task_progress.hole_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists hole_task_progress_org_update on public.hole_task_progress;
create policy hole_task_progress_org_update on public.hole_task_progress
  for update
  using (
    exists (
      select 1
      from public.holes h
      join public.organization_members m on m.organization_id = h.organization_id
      where h.id = hole_task_progress.hole_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.holes h
      join public.organization_members m on m.organization_id = h.organization_id
      where h.id = hole_task_progress.hole_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists hole_task_progress_org_delete on public.hole_task_progress;
create policy hole_task_progress_org_delete on public.hole_task_progress
  for delete
  using (
    exists (
      select 1
      from public.holes h
      join public.organization_members m on m.organization_id = h.organization_id
      where h.id = hole_task_progress.hole_id
        and m.user_id = auth.uid()
    )
  );

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'hole_task_intervals'
      and policyname = 'hole_task_intervals_demo_anon_read'
  ) then
    create policy hole_task_intervals_demo_anon_read
      on public.hole_task_intervals
      for select
      to anon
      using (
        exists (
          select 1
          from public.holes h
          where h.id = hole_task_intervals.hole_id
            and h.organization_id = 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'hole_task_progress'
      and policyname = 'hole_task_progress_demo_anon_read'
  ) then
    create policy hole_task_progress_demo_anon_read
      on public.hole_task_progress
      for select
      to anon
      using (
        exists (
          select 1
          from public.holes h
          where h.id = hole_task_progress.hole_id
            and h.organization_id = 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'hole_task_types'
      and policyname = 'hole_task_types_demo_anon_read'
  ) then
    create policy hole_task_types_demo_anon_read
      on public.hole_task_types
      for select
      to anon
      using (
        hole_task_types.organization_id = 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid
      );
  end if;
end
$$;