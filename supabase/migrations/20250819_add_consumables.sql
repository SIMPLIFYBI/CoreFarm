-- Consumables and Purchase Orders schema
-- Tables: consumable_items, purchase_orders, purchase_order_items

-- Drop safely if needed (optional)
-- drop table if exists purchase_order_items;
-- drop table if exists purchase_orders;
-- drop table if exists consumable_items;

create table if not exists public.consumable_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  label text not null,
  count integer not null default 0,
  updated_at timestamp with time zone default now(),
  unique (organization_id, key)
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  po_number text null,
  status text not null default 'not_ordered' check (status in ('not_ordered','ordered','received')),
  ordered_date date null,
  received_date date null,
  comments text null,
  created_at timestamp with time zone default now()
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  po_id uuid not null references public.purchase_orders(id) on delete cascade,
  item_key text not null,
  label text not null,
  quantity integer not null check (quantity > 0),
  status text not null default 'outstanding' check (status in ('outstanding','ordered','received')),
  created_at timestamp with time zone default now()
);

-- RLS
alter table public.consumable_items enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;

-- Policies: allow org members to read/write within their org
create policy if not exists consumable_items_org_read on public.consumable_items
  for select
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = consumable_items.organization_id and m.user_id = auth.uid()
    )
  );

create policy if not exists consumable_items_org_write on public.consumable_items
  for insert with check (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = consumable_items.organization_id and m.user_id = auth.uid()
    )
  )
  for update using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = consumable_items.organization_id and m.user_id = auth.uid()
    )
  );

create policy if not exists purchase_orders_org_read on public.purchase_orders
  for select
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = purchase_orders.organization_id and m.user_id = auth.uid()
    )
  );

create policy if not exists purchase_orders_org_write on public.purchase_orders
  for insert with check (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = purchase_orders.organization_id and m.user_id = auth.uid()
    )
  )
  for update using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = purchase_orders.organization_id and m.user_id = auth.uid()
    )
  );

create policy if not exists purchase_order_items_org_read on public.purchase_order_items
  for select
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = purchase_order_items.organization_id and m.user_id = auth.uid()
    )
  );

create policy if not exists purchase_order_items_org_write on public.purchase_order_items
  for insert with check (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = purchase_order_items.organization_id and m.user_id = auth.uid()
    )
  )
  for update using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = purchase_order_items.organization_id and m.user_id = auth.uid()
    )
  )
  for delete using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = purchase_order_items.organization_id and m.user_id = auth.uid()
    )
  );
