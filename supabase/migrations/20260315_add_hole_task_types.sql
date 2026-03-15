create table if not exists public.hole_task_types (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null,
  key text not null,
  name text not null,
  description text,
  color text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint hole_task_types_pkey primary key (id),
  constraint hole_task_types_organization_id_fkey foreign key (organization_id) references public.organizations(id),
  constraint hole_task_types_created_by_fkey foreign key (created_by) references auth.users(id),
  constraint hole_task_types_organization_id_key_key unique (organization_id, key),
  constraint hole_task_types_organization_id_name_key unique (organization_id, name),
  constraint hole_task_types_key_present_check check (btrim(key) <> ''),
  constraint hole_task_types_name_present_check check (btrim(name) <> '')
);

create index if not exists hole_task_types_org_active_sort_idx
  on public.hole_task_types (organization_id, is_active, sort_order, name);

with default_task_types(sort_order, key, name, color) as (
  values
    (10, 'orientation', 'Orientation', '#38bdf8'),
    (20, 'magnetic_susceptibility', 'Magnetic Susceptibility', '#8b5cf6'),
    (30, 'whole_core_sampling', 'Whole Core Sampling', '#22c55e'),
    (40, 'cutting', 'Cutting', '#f97316'),
    (50, 'rqd', 'RQD', '#f59e0b'),
    (60, 'specific_gravity', 'Specific Gravity', '#14b8a6')
)
insert into public.hole_task_types (organization_id, key, name, color, sort_order)
select o.id, d.key, d.name, d.color, d.sort_order
from public.organizations o
cross join default_task_types d
on conflict (organization_id, key) do nothing;

alter table public.hole_task_intervals
  add column if not exists task_type_id uuid;

alter table public.hole_task_progress
  add column if not exists task_type_id uuid;

create index if not exists hole_task_intervals_task_type_id_idx
  on public.hole_task_intervals (task_type_id);

create index if not exists hole_task_progress_task_type_id_idx
  on public.hole_task_progress (task_type_id);

alter table public.hole_task_intervals
  drop constraint if exists hole_task_intervals_task_type_check;

alter table public.hole_task_intervals
  drop constraint if exists hole_task_intervals_task_type_present_check;

alter table public.hole_task_intervals
  add constraint hole_task_intervals_task_type_present_check
  check (btrim(task_type) <> '');

alter table public.hole_task_progress
  drop constraint if exists hole_task_progress_task_type_check;

alter table public.hole_task_progress
  drop constraint if exists hole_task_progress_task_type_present_check;

alter table public.hole_task_progress
  add constraint hole_task_progress_task_type_present_check
  check (btrim(task_type) <> '');

alter table public.hole_task_intervals
  drop constraint if exists hole_task_intervals_task_type_id_fkey;

alter table public.hole_task_intervals
  add constraint hole_task_intervals_task_type_id_fkey
  foreign key (task_type_id) references public.hole_task_types(id);

alter table public.hole_task_progress
  drop constraint if exists hole_task_progress_task_type_id_fkey;

alter table public.hole_task_progress
  add constraint hole_task_progress_task_type_id_fkey
  foreign key (task_type_id) references public.hole_task_types(id);

create or replace function public.sync_hole_task_type_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_task_id uuid;
  v_task_key text;
  v_task_org_id uuid;
begin
  select h.organization_id
    into v_org_id
  from public.holes h
  where h.id = new.hole_id;

  if v_org_id is null then
    return new;
  end if;

  if new.task_type_id is not null then
    select t.id, t.key, t.organization_id
      into v_task_id, v_task_key, v_task_org_id
    from public.hole_task_types t
    where t.id = new.task_type_id;

    if v_task_id is null then
      raise exception 'Task type % does not exist', new.task_type_id using errcode = '23503';
    end if;

    if v_task_org_id <> v_org_id then
      raise exception 'Task type % does not belong to the same organization as hole %', new.task_type_id, new.hole_id using errcode = '23514';
    end if;

    if new.task_type is null or btrim(new.task_type) = '' then
      new.task_type := v_task_key;
    elsif new.task_type <> v_task_key then
      raise exception 'task_type % does not match task_type_id %', new.task_type, new.task_type_id using errcode = '23514';
    end if;

    return new;
  end if;

  if new.task_type is null or btrim(new.task_type) = '' then
    raise exception 'task_type is required' using errcode = '23502';
  end if;

  select t.id, t.key, t.organization_id
    into v_task_id, v_task_key, v_task_org_id
  from public.hole_task_types t
  where t.organization_id = v_org_id
    and t.key = new.task_type
  limit 1;

  if v_task_id is null then
    insert into public.hole_task_types (organization_id, key, name, sort_order)
    values (
      v_org_id,
      new.task_type,
      case
        when position('_' in new.task_type) > 0 then initcap(replace(new.task_type, '_', ' '))
        else new.task_type
      end,
      999
    )
    on conflict (organization_id, key) do update
      set key = excluded.key
    returning id, key, organization_id
      into v_task_id, v_task_key, v_task_org_id;
  end if;

  new.task_type_id := v_task_id;
  new.task_type := v_task_key;
  return new;
end;
$$;

update public.hole_task_intervals i
set task_type_id = t.id
from public.holes h
join public.hole_task_types t
  on t.organization_id = h.organization_id
where h.id = i.hole_id
  and t.key = i.task_type
  and i.task_type_id is null;

update public.hole_task_progress p
set task_type_id = t.id
from public.holes h
join public.hole_task_types t
  on t.organization_id = h.organization_id
where h.id = p.hole_id
  and t.key = p.task_type
  and p.task_type_id is null;

drop trigger if exists trg_sync_hole_task_intervals_task_type on public.hole_task_intervals;
create trigger trg_sync_hole_task_intervals_task_type
before insert or update of hole_id, task_type, task_type_id
on public.hole_task_intervals
for each row
execute function public.sync_hole_task_type_assignment();

drop trigger if exists trg_sync_hole_task_progress_task_type on public.hole_task_progress;
create trigger trg_sync_hole_task_progress_task_type
before insert or update of hole_id, task_type, task_type_id
on public.hole_task_progress
for each row
execute function public.sync_hole_task_type_assignment();

alter table public.hole_task_types enable row level security;

drop policy if exists hole_task_types_org_read on public.hole_task_types;
create policy hole_task_types_org_read on public.hole_task_types
  for select
  using (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = hole_task_types.organization_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists hole_task_types_org_insert on public.hole_task_types;
create policy hole_task_types_org_insert on public.hole_task_types
  for insert
  with check (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = hole_task_types.organization_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists hole_task_types_org_update on public.hole_task_types;
create policy hole_task_types_org_update on public.hole_task_types
  for update
  using (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = hole_task_types.organization_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = hole_task_types.organization_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists hole_task_types_org_delete on public.hole_task_types;
create policy hole_task_types_org_delete on public.hole_task_types
  for delete
  using (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = hole_task_types.organization_id
        and m.user_id = auth.uid()
    )
  );
