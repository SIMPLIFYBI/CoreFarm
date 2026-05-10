alter table if exists public.asset_types enable row level security;
alter table if exists public.tasks enable row level security;
alter table if exists public.app_admins enable row level security;
alter table if exists public.dispatches enable row level security;
alter table if exists public.dispatch_items enable row level security;
alter table if exists public.plod_activity_type_rates enable row level security;
alter table if exists public.contract_activity_type_rates enable row level security;
alter table if exists public.plod_pricing_snapshots enable row level security;
alter table if exists public.plod_pricing_snapshot_lines enable row level security;

grant select on table public.asset_types to anon, authenticated;
grant select on table public.tasks to anon, authenticated;
grant select on table public.app_admins to authenticated;
grant select, insert, update, delete on table public.dispatches to authenticated;
grant select, insert, update, delete on table public.dispatch_items to authenticated;
grant select on table public.plod_activity_type_rates to authenticated;
grant select on table public.contract_activity_type_rates to authenticated;
grant select, insert, update, delete on table public.plod_pricing_snapshots to authenticated;
grant select, insert, update, delete on table public.plod_pricing_snapshot_lines to authenticated;

do $$
begin
  if to_regclass('public.asset_types') is not null then
    if exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'asset_types'
        and policyname = 'asset_types_public_read'
    ) then
      execute 'drop policy asset_types_public_read on public.asset_types';
    end if;

    execute $sql$
      create policy asset_types_public_read
        on public.asset_types
        for select
        to anon, authenticated
        using (true)
    $sql$;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.tasks') is not null then
    if exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'tasks'
        and policyname = 'tasks_public_read'
    ) then
      execute 'drop policy tasks_public_read on public.tasks';
    end if;

    execute $sql$
      create policy tasks_public_read
        on public.tasks
        for select
        to anon, authenticated
        using (true)
    $sql$;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.app_admins') is not null then
    if exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'app_admins'
        and policyname = 'app_admins_self_read'
    ) then
      execute 'drop policy app_admins_self_read on public.app_admins';
    end if;

    execute $sql$
      create policy app_admins_self_read
        on public.app_admins
        for select
        to authenticated
        using (app_admins.user_id = auth.uid())
    $sql$;
  end if;
end
$$;

do $$
declare
  policy_name text;
begin
  if to_regclass('public.dispatches') is not null then
    for policy_name in
      select unnest(array[
        'dispatches_org_read',
        'dispatches_org_insert',
        'dispatches_org_update',
        'dispatches_org_delete'
      ])
    loop
      if exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'dispatches'
          and policyname = policy_name
      ) then
        execute format('drop policy %I on public.dispatches', policy_name);
      end if;
    end loop;

    execute $sql$
      create policy dispatches_org_read
        on public.dispatches
        for select
        to authenticated
        using (
          exists (
            select 1
            from public.organization_members m
            where m.organization_id = dispatches.organization_id
              and m.user_id = auth.uid()
          )
        )
    $sql$;

    execute $sql$
      create policy dispatches_org_insert
        on public.dispatches
        for insert
        to authenticated
        with check (
          exists (
            select 1
            from public.organization_members m
            where m.organization_id = dispatches.organization_id
              and m.user_id = auth.uid()
          )
        )
    $sql$;

    execute $sql$
      create policy dispatches_org_update
        on public.dispatches
        for update
        to authenticated
        using (
          exists (
            select 1
            from public.organization_members m
            where m.organization_id = dispatches.organization_id
              and m.user_id = auth.uid()
          )
        )
        with check (
          exists (
            select 1
            from public.organization_members m
            where m.organization_id = dispatches.organization_id
              and m.user_id = auth.uid()
          )
        )
    $sql$;

    execute $sql$
      create policy dispatches_org_delete
        on public.dispatches
        for delete
        to authenticated
        using (
          exists (
            select 1
            from public.organization_members m
            where m.organization_id = dispatches.organization_id
              and m.user_id = auth.uid()
          )
        )
    $sql$;
  end if;
end
$$ language plpgsql;

do $$
declare
  policy_name text;
begin
  if to_regclass('public.dispatch_items') is not null then
    for policy_name in
      select unnest(array[
        'dispatch_items_org_read',
        'dispatch_items_org_insert',
        'dispatch_items_org_update',
        'dispatch_items_org_delete'
      ])
    loop
      if exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'dispatch_items'
          and policyname = policy_name
      ) then
        execute format('drop policy %I on public.dispatch_items', policy_name);
      end if;
    end loop;

    execute $sql$
      create policy dispatch_items_org_read
        on public.dispatch_items
        for select
        to authenticated
        using (
          exists (
            select 1
            from public.organization_members m
            where m.organization_id = dispatch_items.organization_id
              and m.user_id = auth.uid()
          )
        )
    $sql$;

    execute $sql$
      create policy dispatch_items_org_insert
        on public.dispatch_items
        for insert
        to authenticated
        with check (
          exists (
            select 1
            from public.organization_members m
            where m.organization_id = dispatch_items.organization_id
              and m.user_id = auth.uid()
          )
        )
    $sql$;

    execute $sql$
      create policy dispatch_items_org_update
        on public.dispatch_items
        for update
        to authenticated
        using (
          exists (
            select 1
            from public.organization_members m
            where m.organization_id = dispatch_items.organization_id
              and m.user_id = auth.uid()
          )
        )
        with check (
          exists (
            select 1
            from public.organization_members m
            where m.organization_id = dispatch_items.organization_id
              and m.user_id = auth.uid()
          )
        )
    $sql$;

    execute $sql$
      create policy dispatch_items_org_delete
        on public.dispatch_items
        for delete
        to authenticated
        using (
          exists (
            select 1
            from public.organization_members m
            where m.organization_id = dispatch_items.organization_id
              and m.user_id = auth.uid()
          )
        )
    $sql$;
  end if;
end
$$ language plpgsql;

do $$
begin
  if to_regclass('public.plod_activity_type_rates') is not null then
    if exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'plod_activity_type_rates'
        and policyname = 'plod_activity_type_rates_org_read'
    ) then
      execute 'drop policy plod_activity_type_rates_org_read on public.plod_activity_type_rates';
    end if;

    execute $sql$
      create policy plod_activity_type_rates_org_read
        on public.plod_activity_type_rates
        for select
        to authenticated
        using (
          exists (
            select 1
            from public.organization_members m
            where m.organization_id = plod_activity_type_rates.organization_id
              and m.user_id = auth.uid()
          )
        )
    $sql$;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.contract_activity_type_rates') is not null then
    if exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'contract_activity_type_rates'
        and policyname = 'contract_activity_type_rates_org_read'
    ) then
      execute 'drop policy contract_activity_type_rates_org_read on public.contract_activity_type_rates';
    end if;

    execute $sql$
      create policy contract_activity_type_rates_org_read
        on public.contract_activity_type_rates
        for select
        to authenticated
        using (
          exists (
            select 1
            from public.organization_members m
            where m.organization_id = contract_activity_type_rates.organization_id
              and m.user_id = auth.uid()
          )
        )
    $sql$;
  end if;
end
$$;

do $$
declare
  policy_name text;
begin
  if to_regclass('public.plod_pricing_snapshots') is not null then
    for policy_name in
      select unnest(array[
        'plod_pricing_snapshots_org_read',
        'plod_pricing_snapshots_org_insert',
        'plod_pricing_snapshots_org_update',
        'plod_pricing_snapshots_org_delete'
      ])
    loop
      if exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'plod_pricing_snapshots'
          and policyname = policy_name
      ) then
        execute format('drop policy %I on public.plod_pricing_snapshots', policy_name);
      end if;
    end loop;

    execute $sql$
      create policy plod_pricing_snapshots_org_read
        on public.plod_pricing_snapshots
        for select
        to authenticated
        using (
          exists (
            select 1
            from public.organization_members m
            where m.organization_id = plod_pricing_snapshots.organization_id
              and m.user_id = auth.uid()
          )
        )
    $sql$;

    execute $sql$
      create policy plod_pricing_snapshots_org_insert
        on public.plod_pricing_snapshots
        for insert
        to authenticated
        with check (
          exists (
            select 1
            from public.organization_members m
            where m.organization_id = plod_pricing_snapshots.organization_id
              and m.user_id = auth.uid()
          )
        )
    $sql$;

    execute $sql$
      create policy plod_pricing_snapshots_org_update
        on public.plod_pricing_snapshots
        for update
        to authenticated
        using (
          exists (
            select 1
            from public.organization_members m
            where m.organization_id = plod_pricing_snapshots.organization_id
              and m.user_id = auth.uid()
          )
        )
        with check (
          exists (
            select 1
            from public.organization_members m
            where m.organization_id = plod_pricing_snapshots.organization_id
              and m.user_id = auth.uid()
          )
        )
    $sql$;

    execute $sql$
      create policy plod_pricing_snapshots_org_delete
        on public.plod_pricing_snapshots
        for delete
        to authenticated
        using (
          exists (
            select 1
            from public.organization_members m
            where m.organization_id = plod_pricing_snapshots.organization_id
              and m.user_id = auth.uid()
          )
        )
    $sql$;
  end if;
end
$$ language plpgsql;

do $$
declare
  policy_name text;
begin
  if to_regclass('public.plod_pricing_snapshot_lines') is not null then
    for policy_name in
      select unnest(array[
        'plod_pricing_snapshot_lines_org_read',
        'plod_pricing_snapshot_lines_org_insert',
        'plod_pricing_snapshot_lines_org_update',
        'plod_pricing_snapshot_lines_org_delete'
      ])
    loop
      if exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'plod_pricing_snapshot_lines'
          and policyname = policy_name
      ) then
        execute format('drop policy %I on public.plod_pricing_snapshot_lines', policy_name);
      end if;
    end loop;

    execute $sql$
      create policy plod_pricing_snapshot_lines_org_read
        on public.plod_pricing_snapshot_lines
        for select
        to authenticated
        using (
          exists (
            select 1
            from public.plod_pricing_snapshots snapshots
            join public.organization_members m on m.organization_id = snapshots.organization_id
            where snapshots.id = plod_pricing_snapshot_lines.snapshot_id
              and m.user_id = auth.uid()
          )
        )
    $sql$;

    execute $sql$
      create policy plod_pricing_snapshot_lines_org_insert
        on public.plod_pricing_snapshot_lines
        for insert
        to authenticated
        with check (
          exists (
            select 1
            from public.plod_pricing_snapshots snapshots
            join public.organization_members m on m.organization_id = snapshots.organization_id
            where snapshots.id = plod_pricing_snapshot_lines.snapshot_id
              and m.user_id = auth.uid()
          )
        )
    $sql$;

    execute $sql$
      create policy plod_pricing_snapshot_lines_org_update
        on public.plod_pricing_snapshot_lines
        for update
        to authenticated
        using (
          exists (
            select 1
            from public.plod_pricing_snapshots snapshots
            join public.organization_members m on m.organization_id = snapshots.organization_id
            where snapshots.id = plod_pricing_snapshot_lines.snapshot_id
              and m.user_id = auth.uid()
          )
        )
        with check (
          exists (
            select 1
            from public.plod_pricing_snapshots snapshots
            join public.organization_members m on m.organization_id = snapshots.organization_id
            where snapshots.id = plod_pricing_snapshot_lines.snapshot_id
              and m.user_id = auth.uid()
          )
        )
    $sql$;

    execute $sql$
      create policy plod_pricing_snapshot_lines_org_delete
        on public.plod_pricing_snapshot_lines
        for delete
        to authenticated
        using (
          exists (
            select 1
            from public.plod_pricing_snapshots snapshots
            join public.organization_members m on m.organization_id = snapshots.organization_id
            where snapshots.id = plod_pricing_snapshot_lines.snapshot_id
              and m.user_id = auth.uid()
          )
        )
    $sql$;
  end if;
end
$$ language plpgsql;