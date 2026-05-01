do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'asset_locations'
      and policyname = 'asset_locations_demo_anon_read'
  ) then
    create policy asset_locations_demo_anon_read
      on public.asset_locations
      for select
      to anon
      using (
        asset_locations.organization_id = 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid
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
      and tablename = 'workflow_definitions'
      and policyname = 'workflow_definitions_demo_anon_read'
  ) then
    create policy workflow_definitions_demo_anon_read
      on public.workflow_definitions
      for select
      to anon
      using (
        workflow_definitions.organization_id = 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid
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
      and tablename = 'workflow_phase_definitions'
      and policyname = 'workflow_phase_definitions_demo_anon_read'
  ) then
    create policy workflow_phase_definitions_demo_anon_read
      on public.workflow_phase_definitions
      for select
      to anon
      using (
        exists (
          select 1
          from public.workflow_definitions w
          where w.id = workflow_phase_definitions.workflow_id
            and w.organization_id = 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid
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
      and tablename = 'workflow_substage_definitions'
      and policyname = 'workflow_substage_definitions_demo_anon_read'
  ) then
    create policy workflow_substage_definitions_demo_anon_read
      on public.workflow_substage_definitions
      for select
      to anon
      using (
        exists (
          select 1
          from public.workflow_phase_definitions p
          join public.workflow_definitions w on w.id = p.workflow_id
          where p.id = workflow_substage_definitions.workflow_phase_id
            and w.organization_id = 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid
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
      and tablename = 'hole_workflow_phase_statuses'
      and policyname = 'hole_workflow_phase_statuses_demo_anon_read'
  ) then
    create policy hole_workflow_phase_statuses_demo_anon_read
      on public.hole_workflow_phase_statuses
      for select
      to anon
      using (
        exists (
          select 1
          from public.holes h
          where h.id = hole_workflow_phase_statuses.hole_id
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
      and tablename = 'hole_workflow_substage_statuses'
      and policyname = 'hole_workflow_substage_statuses_demo_anon_read'
  ) then
    create policy hole_workflow_substage_statuses_demo_anon_read
      on public.hole_workflow_substage_statuses
      for select
      to anon
      using (
        exists (
          select 1
          from public.holes h
          where h.id = hole_workflow_substage_statuses.hole_id
            and h.organization_id = 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid
        )
      );
  end if;
end
$$;