create table if not exists public.consumable_location_inventory (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  consumable_item_id uuid not null references public.consumable_items(id) on delete cascade,
  location_id uuid not null references public.asset_locations(id) on delete cascade,
  count integer not null default 0 check (count >= 0),
  reorder_value integer not null default 0 check (reorder_value >= 0),
  created_by uuid references auth.users(id),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (organization_id, consumable_item_id, location_id)
);

create index if not exists consumable_location_inventory_org_idx
  on public.consumable_location_inventory (organization_id);

create index if not exists consumable_location_inventory_location_idx
  on public.consumable_location_inventory (location_id);

create index if not exists consumable_location_inventory_item_idx
  on public.consumable_location_inventory (consumable_item_id);

alter table public.consumable_location_inventory enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'consumable_location_inventory'
      and policyname = 'consumable_location_inventory_org_read'
  ) then
    create policy consumable_location_inventory_org_read
      on public.consumable_location_inventory
      for select
      using (
        exists (
          select 1
          from public.organization_members m
          where m.organization_id = consumable_location_inventory.organization_id
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
      and tablename = 'consumable_location_inventory'
      and policyname = 'consumable_location_inventory_org_insert'
  ) then
    create policy consumable_location_inventory_org_insert
      on public.consumable_location_inventory
      for insert
      with check (
        exists (
          select 1
          from public.organization_members m
          where m.organization_id = consumable_location_inventory.organization_id
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
      and tablename = 'consumable_location_inventory'
      and policyname = 'consumable_location_inventory_org_update'
  ) then
    create policy consumable_location_inventory_org_update
      on public.consumable_location_inventory
      for update
      using (
        exists (
          select 1
          from public.organization_members m
          where m.organization_id = consumable_location_inventory.organization_id
            and m.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.organization_members m
          where m.organization_id = consumable_location_inventory.organization_id
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
      and tablename = 'consumable_location_inventory'
      and policyname = 'consumable_location_inventory_org_delete'
  ) then
    create policy consumable_location_inventory_org_delete
      on public.consumable_location_inventory
      for delete
      using (
        exists (
          select 1
          from public.organization_members m
          where m.organization_id = consumable_location_inventory.organization_id
            and m.user_id = auth.uid()
        )
      );
  end if;
end
$$;