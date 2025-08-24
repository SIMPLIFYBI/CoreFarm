-- Initial schema for CoreFarm
-- Users are managed by Supabase Auth (auth.users)

-- Extensions
create extension if not exists pgcrypto; -- for gen_random_uuid()
create extension if not exists btree_gist;

-- Multi-tenant organizations
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','member')) default 'member',
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','member')) default 'member',
  invited_by uuid references auth.users(id) on delete set null,
  status text not null check (status in ('pending','accepted','revoked')) default 'pending',
  created_at timestamptz default now()
);

-- Only one pending invite per org+email (case-insensitive)
create unique index if not exists uniq_pending_invite_org_email
on public.organization_invites (organization_id, (lower(email)))
where status = 'pending';

-- When a membership is created, auto-mark any pending invite for that user+org as accepted
create or replace function public.on_membership_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member_email text;
begin
  select u.email into member_email from auth.users u where u.id = new.user_id;
  if member_email is not null then
    update public.organization_invites
    set status = 'accepted'
    where organization_id = new.organization_id
      and lower(email) = lower(member_email)
      and status = 'pending';
  end if;
  return new;
end;
$$;

-- Progress with user email for a hole, gated by org access
drop function if exists public.get_hole_progress_with_email(uuid);
create or replace function public.get_hole_progress_with_email(p_hole_id uuid)
returns table(id uuid, task_type text, from_m numeric, to_m numeric, user_id uuid, email text, name text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.task_type, p.from_m, p.to_m, p.user_id, u.email,
         coalesce(u.raw_user_meta_data->>'name', u.email) as name,
         p.created_at
  from public.hole_task_progress p
  join auth.users u on u.id = p.user_id
  where p.hole_id = p_hole_id
    and exists (
      select 1 from public.holes h
      where h.id = p_hole_id and (
        (h.organization_id is not null and public.is_current_org_member(h.organization_id))
        or (h.organization_id is null and h.created_by = auth.uid())
      )
    );
$$;

drop trigger if exists trg_on_membership_created on public.organization_members;
create trigger trg_on_membership_created
after insert on public.organization_members
for each row execute function public.on_membership_created();

-- Secure helper: list members with email for an organization
drop function if exists public.get_org_members_with_email(uuid);
create or replace function public.get_org_members_with_email(org uuid)
returns table(user_id uuid, email text, name text, role text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id, u.email,
         coalesce(u.raw_user_meta_data->>'name', u.email) as name,
         m.role, m.created_at
  from public.organization_members m
  join auth.users u on u.id = m.user_id
  where m.organization_id = org
    and public.is_current_org_member(org);
$$;

-- Helper to read current user's email from JWT claims
create or replace function public.current_user_email()
returns text
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true), '')::json->>'email';
$$;

-- Helper functions to avoid policy recursion
create or replace function public.is_current_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_current_org_admin(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org_id and m.user_id = auth.uid() and m.role = 'admin'
  );
$$;

-- Auto-add org owner as admin member
create or replace function public.on_org_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.organization_members(organization_id, user_id, role, added_by)
  values (new.id, new.owner_id, 'admin', new.owner_id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists trg_on_org_created on public.organizations;
create trigger trg_on_org_created
after insert on public.organizations
for each row execute function public.on_org_created();

-- Holes
create table if not exists public.holes (
  id uuid primary key default gen_random_uuid(),
  hole_id text not null,
  depth numeric,
  drilling_diameter text,
  project_name text,
  drilling_contractor text,
  created_at timestamptz default now(),
  created_by uuid not null default auth.uid() references auth.users(id)
);

-- Associate holes to an organization (nullable for legacy rows)
alter table public.holes add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
create index if not exists idx_holes_org on public.holes(organization_id);

-- Constrain drilling_diameter to common sizes (allow null)
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'holes_drilling_diameter_check'
  ) then
    alter table public.holes
      add constraint holes_drilling_diameter_check
      check (drilling_diameter is null or drilling_diameter in ('NQ','HQ','PQ','Other')) not valid;
  end if;
end $$;

-- Tasks that can be assigned to holes (e.g., photography, geotech, logging, sampling)
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  created_at timestamptz default now()
);

-- Task intervals per hole
-- task_type is constrained by a check to one of the known types
create table if not exists public.hole_task_intervals (
  id uuid primary key default gen_random_uuid(),
  hole_id uuid not null references public.holes(id) on delete cascade,
  task_type text not null,
  from_m numeric not null,
  to_m numeric not null,
  created_at timestamptz default now(),
  constraint hole_task_intervals_task_type_check check (task_type in (
    'orientation', 'magnetic_susceptibility', 'whole_core_sampling', 'cutting', 'rqd', 'specific_gravity'
  ))
);

-- Activity log for productivity metrics
create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hole_id uuid references public.holes(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  action text not null, -- e.g., 'start_task','complete_task','upload_photo'
  details jsonb,
  created_at timestamptz default now()
);

-- User progress towards tasks (non-overlapping intervals per hole+task)
create table if not exists public.hole_task_progress (
  id uuid primary key default gen_random_uuid(),
  hole_id uuid not null references public.holes(id) on delete cascade,
  task_type text not null,
  from_m numeric not null,
  to_m numeric not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  -- Date the work was performed (separate from created_at which is insert timestamp)
  logged_on date default current_date,
  interval numrange generated always as (numrange(from_m, to_m, '[)')) stored,
  constraint hole_task_progress_task_type_check check (task_type in (
    'orientation', 'magnetic_susceptibility', 'whole_core_sampling', 'cutting', 'rqd', 'specific_gravity'
  )),
  constraint hole_task_progress_bounds check (to_m > from_m)
);

-- Backfill schema in existing DBs if column is missing
alter table public.hole_task_progress add column if not exists logged_on date default current_date;

-- Prevent overlapping progress intervals for same hole+task (allow touching at boundaries)
create index if not exists idx_hole_task_progress_gist on public.hole_task_progress using gist (hole_id, task_type, interval);
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'hole_task_progress_no_overlap'
  ) then
    alter table public.hole_task_progress
      add constraint hole_task_progress_no_overlap exclude using gist (
        hole_id with =,
        task_type with =,
        interval with &&
      );
  end if;
end $$;

-- RLS
alter table public.holes enable row level security;
alter table public.hole_task_intervals enable row level security;
alter table public.activity enable row level security;
alter table public.hole_task_progress enable row level security;

-- Policies (basic: users can read all; users can insert/update rows they touch)
-- Org access helpers in policies will rely on membership
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invites enable row level security;

-- Organizations policies
drop policy if exists "read orgs" on public.organizations;
drop policy if exists "create org" on public.organizations;
drop policy if exists "update own org" on public.organizations;
create policy "read orgs" on public.organizations for select using (
  public.is_current_org_member(id) or owner_id = auth.uid()
);
create policy "create org" on public.organizations for insert with check (owner_id = auth.uid());
create policy "update own org" on public.organizations for update using (owner_id = auth.uid());

-- Organization members policies
drop policy if exists "read members" on public.organization_members;
drop policy if exists "add members (admin)" on public.organization_members;
drop policy if exists "self-join via invite" on public.organization_members;
drop policy if exists "update members (admin)" on public.organization_members;
drop policy if exists "remove members (admin or self)" on public.organization_members;
create policy "read members" on public.organization_members for select using (
  public.is_current_org_member(organization_id)
);
-- Admins can add any user to their org
create policy "add members (admin)" on public.organization_members for insert with check (
  public.is_current_org_admin(organization_id)
);
-- Invited user can add themselves based on a pending invite to their email
create policy "self-join via invite" on public.organization_members for insert with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.organization_invites i
    where i.organization_id = organization_members.organization_id
      and i.email = lower(public.current_user_email())
      and i.status = 'pending'
  )
);
create policy "update members (admin)" on public.organization_members for update using (
  public.is_current_org_admin(organization_id)
);
create policy "remove members (admin or self)" on public.organization_members for delete using (
  -- admin of org OR deleting own membership
  public.is_current_org_admin(organization_id) or user_id = auth.uid()
);

-- Organization invites policies
drop policy if exists "read invites (admin or self)" on public.organization_invites;
drop policy if exists "create invites (admin)" on public.organization_invites;
drop policy if exists "update invites (admin or self)" on public.organization_invites;
drop policy if exists "delete invites (admin)" on public.organization_invites;
create policy "read invites (admin or self)" on public.organization_invites for select using (
  public.is_current_org_admin(organization_id) or organization_invites.email = lower(public.current_user_email())
);
create policy "create invites (admin)" on public.organization_invites for insert with check (
  public.is_current_org_admin(organization_id)
);
create policy "update invites (admin or self)" on public.organization_invites for update using (
  public.is_current_org_admin(organization_id) or organization_invites.email = lower(public.current_user_email())
);
create policy "delete invites (admin)" on public.organization_invites for delete using (
  public.is_current_org_admin(organization_id)
);

-- Rework existing policies to enforce org isolation
drop policy if exists "read holes" on public.holes;
drop policy if exists "insert holes" on public.holes;
drop policy if exists "update holes" on public.holes;
drop policy if exists "delete holes" on public.holes;
create policy "read holes" on public.holes for select using (
  (organization_id is not null and public.is_current_org_member(organization_id))
  or (organization_id is null and created_by = auth.uid())
);
create policy "insert holes" on public.holes for insert with check (
  auth.uid() = created_by and (
    (organization_id is not null and public.is_current_org_member(organization_id))
    or organization_id is null
  )
);
create policy "update holes" on public.holes for update using (
  auth.uid() = created_by or public.is_current_org_admin(organization_id)
);
create policy "delete holes" on public.holes for delete using (
  -- Any member can delete holes within their organization; legacy personal holes deletable by creator
  (organization_id is not null and public.is_current_org_member(organization_id))
  or (organization_id is null and auth.uid() = created_by)
);

drop policy if exists "read hole task intervals" on public.hole_task_intervals;
drop policy if exists "write hole task intervals" on public.hole_task_intervals;
create policy "read hole task intervals" on public.hole_task_intervals for select using (
  exists (
    select 1 from public.holes h
    where h.id = hole_task_intervals.hole_id and (
      (h.organization_id is not null and public.is_current_org_member(h.organization_id))
      or (h.organization_id is null and h.created_by = auth.uid())
    )
  )
);
create policy "write hole task intervals" on public.hole_task_intervals for all using (
  exists (
    select 1 from public.holes h
    where h.id = hole_task_intervals.hole_id and (
      (h.organization_id is not null and public.is_current_org_member(h.organization_id))
      or (h.organization_id is null and h.created_by = auth.uid())
    )
  )
) with check (
  exists (
    select 1 from public.holes h
    where h.id = hole_task_intervals.hole_id and (
      (h.organization_id is not null and public.is_current_org_member(h.organization_id))
      or (h.organization_id is null and h.created_by = auth.uid())
    )
  )
);

drop policy if exists "read activity" on public.activity;
drop policy if exists "write activity" on public.activity;
create policy "read activity" on public.activity for select using (auth.uid() = user_id);
create policy "write activity" on public.activity for insert with check (auth.uid() = user_id);

-- Progress policies: users can read all; users can write their own; admins TBD
drop policy if exists "read progress" on public.hole_task_progress;
drop policy if exists "write progress" on public.hole_task_progress;
drop policy if exists "update own progress" on public.hole_task_progress;
drop policy if exists "delete own progress" on public.hole_task_progress;
create policy "read progress" on public.hole_task_progress for select using (
  exists (
    select 1 from public.holes h
    where h.id = hole_task_progress.hole_id and (
      (h.organization_id is not null and public.is_current_org_member(h.organization_id))
      or (h.organization_id is null and h.created_by = auth.uid())
    )
  )
);
create policy "write progress" on public.hole_task_progress for insert with check (
  auth.uid() = user_id and exists (
    select 1 from public.holes h
    where h.id = hole_task_progress.hole_id and (
      (h.organization_id is not null and public.is_current_org_member(h.organization_id))
      or (h.organization_id is null and h.created_by = auth.uid())
    )
  )
);
create policy "update own progress" on public.hole_task_progress for update using (
  auth.uid() = user_id and exists (
    select 1 from public.holes h
    where h.id = hole_task_progress.hole_id and (
      (h.organization_id is not null and public.is_current_org_member(h.organization_id))
      or (h.organization_id is null and h.created_by = auth.uid())
    )
  )
);
create policy "delete own progress" on public.hole_task_progress for delete using (
  auth.uid() = user_id and exists (
    select 1 from public.holes h
    where h.id = hole_task_progress.hole_id and (
      (h.organization_id is not null and public.is_current_org_member(h.organization_id))
      or (h.organization_id is null and h.created_by = auth.uid())
    )
  )
);

-- Completion view per hole+task: planned vs progress (meters)
create or replace view public.hole_task_completion as
select
  hti.hole_id,
  hti.task_type,
  sum(hti.to_m - hti.from_m) as planned_m,
  coalesce(sum(greatest(0, least(hti.to_m, htp.to_m) - greatest(hti.from_m, htp.from_m))), 0) as done_m
from public.hole_task_intervals hti
left join public.hole_task_progress htp
  on htp.hole_id = hti.hole_id
 and htp.task_type = hti.task_type
 and htp.to_m > hti.from_m
 and htp.from_m < hti.to_m
group by hti.hole_id, hti.task_type;

-- Completion summary per hole across all tasks
create or replace view public.hole_completion_summary as
select
  c.hole_id,
  sum(c.planned_m) as planned_total_m,
  sum(c.done_m) as done_total_m,
  case when sum(c.planned_m) > 0 then round((sum(c.done_m) / sum(c.planned_m)) * 100, 1) else 0 end as percent_done
from public.hole_task_completion c
group by c.hole_id;

-- ============================================================
-- Consumables: inventory, purchase requests, and purchase orders
-- ============================================================

-- Inventory items per organization
create table if not exists public.consumable_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  label text not null,
  count integer not null default 0 check (count >= 0),
  -- Reorder threshold (when inventory at or below this value, highlight for reorder). 0 disables threshold.
  reorder_value integer not null default 0 check (reorder_value >= 0),
  -- Whether this item should appear in the consumables report dashboard
  include_in_report boolean not null default false,
  updated_at timestamptz default now()
);

create unique index if not exists uniq_consumable_item_org_key
on public.consumable_items (organization_id, key);

create index if not exists idx_consumable_items_org
on public.consumable_items (organization_id);

alter table public.consumable_items enable row level security;

drop policy if exists "read consumable items (org)" on public.consumable_items;
drop policy if exists "write consumable items (org)" on public.consumable_items;
create policy "read consumable items (org)" on public.consumable_items for select using (
  public.is_current_org_member(organization_id)
);
create policy "write consumable items (org)" on public.consumable_items for all using (
  public.is_current_org_member(organization_id)
) with check (
  public.is_current_org_member(organization_id)
);

-- Ensure reorder_value column exists for environments created before this field was added
alter table public.consumable_items add column if not exists reorder_value integer not null default 0 check (reorder_value >= 0);

-- Purchase Orders per organization
-- status: not_ordered (draft / request bucket), ordered, received
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text, -- human-friendly name used before PO number is generated
  po_number text, -- nullable until assigned
  status text not null check (status in ('not_ordered','ordered','received')) default 'not_ordered',
  ordered_date date,
  received_date date,
  comments text,
  created_at timestamptz default now()
);

create index if not exists idx_purchase_orders_org on public.purchase_orders(organization_id);
create index if not exists idx_purchase_orders_po_number on public.purchase_orders(po_number);

alter table public.purchase_orders enable row level security;

drop policy if exists "read purchase orders (org)" on public.purchase_orders;
drop policy if exists "write purchase orders (org)" on public.purchase_orders;
create policy "read purchase orders (org)" on public.purchase_orders for select using (
  public.is_current_org_member(organization_id)
);
create policy "write purchase orders (org)" on public.purchase_orders for all using (
  public.is_current_org_member(organization_id)
) with check (
  public.is_current_org_member(organization_id)
);

-- Items within a purchase order (also denormalized organization_id for simple RLS filtering)
-- item status: outstanding, ordered, received
create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  po_id uuid references public.purchase_orders(id) on delete cascade,
  -- Order number is a client-provided pre-PO grouping identifier (different from PO number)
  order_number text,
  item_key text not null,
  label text not null,
  quantity integer not null check (quantity > 0),
  status text not null check (status in ('outstanding','ordered','received')) default 'outstanding',
  created_at timestamptz default now()
);

-- Ensure existing databases drop NOT NULL on po_id if present
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'purchase_order_items' and column_name = 'po_id' and is_nullable = 'NO'
  ) then
    alter table public.purchase_order_items alter column po_id drop not null;
  end if;
end $$;

create index if not exists idx_po_items_org on public.purchase_order_items(organization_id);
create index if not exists idx_po_items_po on public.purchase_order_items(po_id);
-- Ensure column exists for existing databases
alter table public.purchase_order_items add column if not exists order_number text;
create index if not exists idx_po_items_order_number on public.purchase_order_items(organization_id, order_number);

alter table public.purchase_order_items enable row level security;

drop policy if exists "read purchase order items (org)" on public.purchase_order_items;
drop policy if exists "write purchase order items (org)" on public.purchase_order_items;
create policy "read purchase order items (org)" on public.purchase_order_items for select using (
  public.is_current_org_member(organization_id)
);
create policy "write purchase order items (org)" on public.purchase_order_items for all using (
  public.is_current_org_member(organization_id)
) with check (
  public.is_current_org_member(organization_id)
);

-- Optional: maintain updated_at on consumable_items
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists trg_touch_consumable_items on public.consumable_items;
create trigger trg_touch_consumable_items
before update on public.consumable_items
for each row execute function public.touch_updated_at();

