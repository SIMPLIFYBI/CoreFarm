alter table public.asset_locations enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'asset_locations'
      and policyname = 'asset_locations_org_read'
  ) then
    create policy asset_locations_org_read
      on public.asset_locations
      for select
      using (
        exists (
          select 1
          from public.organization_members m
          where m.organization_id = asset_locations.organization_id
            and m.user_id = auth.uid()
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
      and tablename = 'asset_locations'
      and policyname = 'asset_locations_org_insert'
  ) then
    create policy asset_locations_org_insert
      on public.asset_locations
      for insert
      with check (
        exists (
          select 1
          from public.organization_members m
          where m.organization_id = asset_locations.organization_id
            and m.user_id = auth.uid()
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
      and tablename = 'asset_locations'
      and policyname = 'asset_locations_org_update'
  ) then
    create policy asset_locations_org_update
      on public.asset_locations
      for update
      using (
        exists (
          select 1
          from public.organization_members m
          where m.organization_id = asset_locations.organization_id
            and m.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.organization_members m
          where m.organization_id = asset_locations.organization_id
            and m.user_id = auth.uid()
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
      and tablename = 'asset_locations'
      and policyname = 'asset_locations_org_delete'
  ) then
    create policy asset_locations_org_delete
      on public.asset_locations
      for delete
      using (
        exists (
          select 1
          from public.organization_members m
          where m.organization_id = asset_locations.organization_id
            and m.user_id = auth.uid()
        )
      );
  end if;
end
$$;