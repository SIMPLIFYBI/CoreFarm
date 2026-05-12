alter table if exists public.plods enable row level security;
alter table if exists public.plod_activities enable row level security;
alter table if exists public.vendors enable row level security;
alter table if exists public.plod_types enable row level security;
alter table if exists public.plod_activity_types enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'plods'
      and policyname = 'plods_demo_anon_read'
  ) then
    create policy plods_demo_anon_read
      on public.plods
      for select
      to anon
      using (
        plods.organization_id = 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid
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
      and tablename = 'plod_activities'
      and policyname = 'plod_activities_demo_anon_read'
  ) then
    create policy plod_activities_demo_anon_read
      on public.plod_activities
      for select
      to anon
      using (
        exists (
          select 1
          from public.plods p
          where p.id = plod_activities.plod_id
            and p.organization_id = 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid
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
      and tablename = 'vendors'
      and policyname = 'vendors_demo_anon_read'
  ) then
    create policy vendors_demo_anon_read
      on public.vendors
      for select
      to anon
      using (
        vendors.organization_id = 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid
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
      and tablename = 'plod_types'
      and policyname = 'plod_types_demo_anon_read'
  ) then
    create policy plod_types_demo_anon_read
      on public.plod_types
      for select
      to anon
      using (
        plod_types.organization_id = 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid
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
      and tablename = 'plod_activity_types'
      and policyname = 'plod_activity_types_demo_anon_read'
  ) then
    create policy plod_activity_types_demo_anon_read
      on public.plod_activity_types
      for select
      to anon
      using (
        plod_activity_types.organization_id = 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid
      );
  end if;
end
$$;