alter table public.drillhole_lithology_types enable row level security;
alter table public.drillhole_construction_types enable row level security;
alter table public.drillhole_annulus_types enable row level security;
alter table public.drillhole_geology_intervals enable row level security;
alter table public.drillhole_construction_intervals enable row level security;
alter table public.drillhole_annulus_intervals enable row level security;

drop policy if exists drillhole_lithology_types_org_read on public.drillhole_lithology_types;
create policy drillhole_lithology_types_org_read on public.drillhole_lithology_types
  for select
  using (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = drillhole_lithology_types.organization_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists drillhole_construction_types_org_read on public.drillhole_construction_types;
create policy drillhole_construction_types_org_read on public.drillhole_construction_types
  for select
  using (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = drillhole_construction_types.organization_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists drillhole_annulus_types_org_read on public.drillhole_annulus_types;
create policy drillhole_annulus_types_org_read on public.drillhole_annulus_types
  for select
  using (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = drillhole_annulus_types.organization_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists drillhole_geology_intervals_org_read on public.drillhole_geology_intervals;
create policy drillhole_geology_intervals_org_read on public.drillhole_geology_intervals
  for select
  using (
    exists (
      select 1
      from public.holes h
      join public.organization_members m on m.organization_id = h.organization_id
      where h.id = drillhole_geology_intervals.hole_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists drillhole_construction_intervals_org_read on public.drillhole_construction_intervals;
create policy drillhole_construction_intervals_org_read on public.drillhole_construction_intervals
  for select
  using (
    exists (
      select 1
      from public.holes h
      join public.organization_members m on m.organization_id = h.organization_id
      where h.id = drillhole_construction_intervals.hole_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists drillhole_annulus_intervals_org_read on public.drillhole_annulus_intervals;
create policy drillhole_annulus_intervals_org_read on public.drillhole_annulus_intervals
  for select
  using (
    exists (
      select 1
      from public.holes h
      join public.organization_members m on m.organization_id = h.organization_id
      where h.id = drillhole_annulus_intervals.hole_id
        and m.user_id = auth.uid()
    )
  );

do $$
begin
  if to_regclass('public.drillhole_component_types') is not null then
    execute 'alter table public.drillhole_component_types enable row level security';
    execute 'drop policy if exists drillhole_component_types_org_read on public.drillhole_component_types';
    execute $sql$
      create policy drillhole_component_types_org_read on public.drillhole_component_types
        for select
        using (
          exists (
            select 1
            from public.organization_members m
            where m.organization_id = drillhole_component_types.organization_id
              and m.user_id = auth.uid()
          )
        )
    $sql$;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.drillhole_components') is not null then
    execute 'alter table public.drillhole_components enable row level security';
    execute 'drop policy if exists drillhole_components_org_read on public.drillhole_components';
    execute $sql$
      create policy drillhole_components_org_read on public.drillhole_components
        for select
        using (
          exists (
            select 1
            from public.holes h
            join public.organization_members m on m.organization_id = h.organization_id
            where h.id = drillhole_components.hole_id
              and m.user_id = auth.uid()
          )
        )
    $sql$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'drillhole_lithology_types'
      and policyname = 'drillhole_lithology_types_demo_anon_read'
  ) then
    create policy drillhole_lithology_types_demo_anon_read
      on public.drillhole_lithology_types
      for select
      to anon
      using (drillhole_lithology_types.organization_id = 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'drillhole_construction_types'
      and policyname = 'drillhole_construction_types_demo_anon_read'
  ) then
    create policy drillhole_construction_types_demo_anon_read
      on public.drillhole_construction_types
      for select
      to anon
      using (drillhole_construction_types.organization_id = 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'drillhole_annulus_types'
      and policyname = 'drillhole_annulus_types_demo_anon_read'
  ) then
    create policy drillhole_annulus_types_demo_anon_read
      on public.drillhole_annulus_types
      for select
      to anon
      using (drillhole_annulus_types.organization_id = 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'drillhole_geology_intervals'
      and policyname = 'drillhole_geology_intervals_demo_anon_read'
  ) then
    create policy drillhole_geology_intervals_demo_anon_read
      on public.drillhole_geology_intervals
      for select
      to anon
      using (
        drillhole_geology_intervals.organization_id = 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'drillhole_construction_intervals'
      and policyname = 'drillhole_construction_intervals_demo_anon_read'
  ) then
    create policy drillhole_construction_intervals_demo_anon_read
      on public.drillhole_construction_intervals
      for select
      to anon
      using (
        drillhole_construction_intervals.organization_id = 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'drillhole_annulus_intervals'
      and policyname = 'drillhole_annulus_intervals_demo_anon_read'
  ) then
    create policy drillhole_annulus_intervals_demo_anon_read
      on public.drillhole_annulus_intervals
      for select
      to anon
      using (
        drillhole_annulus_intervals.organization_id = 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid
      );
  end if;
end
$$;

do $$
begin
  if to_regclass('public.drillhole_component_types') is not null then
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'drillhole_component_types'
        and policyname = 'drillhole_component_types_demo_anon_read'
    ) then
      execute $sql$
        create policy drillhole_component_types_demo_anon_read
          on public.drillhole_component_types
          for select
          to anon
          using (drillhole_component_types.organization_id = 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid)
      $sql$;
    end if;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.drillhole_components') is not null then
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'drillhole_components'
        and policyname = 'drillhole_components_demo_anon_read'
    ) then
      execute $sql$
        create policy drillhole_components_demo_anon_read
          on public.drillhole_components
          for select
          to anon
          using (drillhole_components.organization_id = 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid)
      $sql$;
    end if;
  end if;
end
$$;