do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'projects'
      and policyname = 'projects_demo_anon_read'
  ) then
    create policy projects_demo_anon_read
      on public.projects
      for select
      to anon
      using (
        projects.organization_id = 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid
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
      and tablename = 'holes'
      and policyname = 'holes_demo_anon_read'
  ) then
    create policy holes_demo_anon_read
      on public.holes
      for select
      to anon
      using (
        holes.organization_id = 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid
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
      and tablename = 'assets'
      and policyname = 'assets_demo_anon_read'
  ) then
    create policy assets_demo_anon_read
      on public.assets
      for select
      to anon
      using (
        assets.organization_id = 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid
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
      and tablename = 'asset_types'
      and policyname = 'asset_types_demo_anon_read'
  ) then
    create policy asset_types_demo_anon_read
      on public.asset_types
      for select
      to anon
      using (true);
  end if;
end
$$;