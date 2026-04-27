create table if not exists public.hole_schedule_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id),
  hole_id uuid not null references public.holes(id) on delete cascade,
  task_code text not null,
  task_name text not null,
  task_group text not null default 'drilling',
  required_resource_type text check (
    required_resource_type is null
    or required_resource_type = any (array['Drill Rig'::text, 'Dump Truck'::text, 'General Earthworks'::text, 'Ancillary'::text, 'Water Cart'::text, 'Other'::text])
  ),
  sequence_no integer not null default 100 check (sequence_no >= 0),
  target_start_date date,
  target_finish_date date,
  planning_status text not null default 'draft' check (planning_status in ('draft', 'scheduled', 'firm', 'cancelled')),
  locked boolean not null default false,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hole_schedule_tasks_hole_task_key unique (hole_id, task_code),
  constraint hole_schedule_tasks_task_code_present_check check (btrim(task_code) <> ''),
  constraint hole_schedule_tasks_task_name_present_check check (btrim(task_name) <> ''),
  constraint hole_schedule_tasks_task_group_present_check check (btrim(task_group) <> ''),
  constraint hole_schedule_tasks_target_date_order_check check (
    target_start_date is null
    or target_finish_date is null
    or target_finish_date >= target_start_date
  )
);

create index if not exists hole_schedule_tasks_org_project_window_idx
  on public.hole_schedule_tasks (organization_id, project_id, target_start_date, target_finish_date, sequence_no);

create index if not exists hole_schedule_tasks_org_status_window_idx
  on public.hole_schedule_tasks (organization_id, planning_status, target_start_date, sequence_no);

create index if not exists hole_schedule_tasks_hole_sequence_idx
  on public.hole_schedule_tasks (hole_id, sequence_no, task_code);

create table if not exists public.hole_schedule_task_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id),
  hole_id uuid not null references public.holes(id) on delete cascade,
  schedule_task_id uuid not null references public.hole_schedule_tasks(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  planned_start_date date not null,
  planned_finish_date date not null,
  assignment_status text not null default 'scheduled' check (assignment_status in ('scheduled', 'firm', 'cancelled')),
  lane_rank integer not null default 1000 check (lane_rank >= 0),
  locked boolean not null default false,
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hole_schedule_task_assignments_date_order_check check (planned_finish_date >= planned_start_date)
);

create index if not exists hole_schedule_task_assignments_task_window_idx
  on public.hole_schedule_task_assignments (schedule_task_id, planned_start_date, planned_finish_date)
  where assignment_status <> 'cancelled';

create index if not exists hole_schedule_task_assignments_resource_window_idx
  on public.hole_schedule_task_assignments (organization_id, resource_id, planned_start_date, planned_finish_date, lane_rank)
  where assignment_status <> 'cancelled';

create index if not exists hole_schedule_task_assignments_project_window_idx
  on public.hole_schedule_task_assignments (organization_id, project_id, planned_start_date, planned_finish_date);

create or replace function public.sync_hole_schedule_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hole_org_id uuid;
  v_hole_project_id uuid;
begin
  select h.organization_id, h.project_id
    into v_hole_org_id, v_hole_project_id
  from public.holes h
  where h.id = new.hole_id;

  if v_hole_org_id is null then
    raise exception 'Hole % does not exist', new.hole_id using errcode = '23503';
  end if;

  if new.organization_id is not null and new.organization_id <> v_hole_org_id then
    raise exception 'Hole % does not belong to organization %', new.hole_id, new.organization_id using errcode = '23514';
  end if;

  if new.project_id is not null and new.project_id <> v_hole_project_id then
    raise exception 'Hole % does not belong to project %', new.hole_id, new.project_id using errcode = '23514';
  end if;

  new.organization_id := v_hole_org_id;
  new.project_id := v_hole_project_id;
  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists trg_sync_hole_schedule_task on public.hole_schedule_tasks;
create trigger trg_sync_hole_schedule_task
before insert or update of organization_id, project_id, hole_id, task_code, task_name, task_group, required_resource_type, sequence_no, target_start_date, target_finish_date, planning_status, locked, notes, metadata
on public.hole_schedule_tasks
for each row
execute function public.sync_hole_schedule_task();

create or replace function public.sync_hole_schedule_task_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_org_id uuid;
  v_task_project_id uuid;
  v_task_hole_id uuid;
  v_required_resource_type text;
  v_resource_org_id uuid;
  v_resource_type text;
begin
  select t.organization_id, t.project_id, t.hole_id, t.required_resource_type
    into v_task_org_id, v_task_project_id, v_task_hole_id, v_required_resource_type
  from public.hole_schedule_tasks t
  where t.id = new.schedule_task_id;

  if v_task_org_id is null then
    raise exception 'Schedule task % does not exist', new.schedule_task_id using errcode = '23503';
  end if;

  if new.organization_id is not null and new.organization_id <> v_task_org_id then
    raise exception 'Schedule task % does not belong to organization %', new.schedule_task_id, new.organization_id using errcode = '23514';
  end if;

  if new.project_id is not null and new.project_id <> v_task_project_id then
    raise exception 'Schedule task % does not belong to project %', new.schedule_task_id, new.project_id using errcode = '23514';
  end if;

  if new.hole_id is not null and new.hole_id <> v_task_hole_id then
    raise exception 'Schedule task % does not belong to hole %', new.schedule_task_id, new.hole_id using errcode = '23514';
  end if;

  select r.organization_id, r.resource_type
    into v_resource_org_id, v_resource_type
  from public.resources r
  where r.id = new.resource_id;

  if v_resource_org_id is null then
    raise exception 'Resource % does not exist', new.resource_id using errcode = '23503';
  end if;

  if v_resource_org_id <> v_task_org_id then
    raise exception 'Resource % does not belong to organization %', new.resource_id, v_task_org_id using errcode = '23514';
  end if;

  if v_required_resource_type is not null and coalesce(v_resource_type, '') <> v_required_resource_type then
    raise exception 'Resource % must be of type % for task %', new.resource_id, v_required_resource_type, new.schedule_task_id using errcode = '23514';
  end if;

  new.organization_id := v_task_org_id;
  new.project_id := v_task_project_id;
  new.hole_id := v_task_hole_id;
  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists trg_sync_hole_schedule_task_assignment on public.hole_schedule_task_assignments;
create trigger trg_sync_hole_schedule_task_assignment
before insert or update of organization_id, project_id, hole_id, schedule_task_id, resource_id, planned_start_date, planned_finish_date, assignment_status, lane_rank, locked, notes
on public.hole_schedule_task_assignments
for each row
execute function public.sync_hole_schedule_task_assignment();

create or replace function public.validate_hole_schedule_task_assignment_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conflicting_assignment_id uuid;
  v_conflicting_hole_code text;
begin
  if new.assignment_status = 'cancelled' then
    return new;
  end if;

  select a.id, h.hole_id
    into v_conflicting_assignment_id, v_conflicting_hole_code
  from public.hole_schedule_task_assignments a
  join public.holes h
    on h.id = a.hole_id
  where a.organization_id = new.organization_id
    and a.resource_id = new.resource_id
    and a.assignment_status <> 'cancelled'
    and a.id <> new.id
    and daterange(a.planned_start_date, a.planned_finish_date + 1, '[)')
        && daterange(new.planned_start_date, new.planned_finish_date + 1, '[)')
  limit 1;

  if v_conflicting_assignment_id is not null then
    raise exception 'Resource % already has overlapping work scheduled for hole %', new.resource_id, coalesce(v_conflicting_hole_code, v_conflicting_assignment_id::text)
      using errcode = '23P01';
  end if;

  select a.id, h.hole_id
    into v_conflicting_assignment_id, v_conflicting_hole_code
  from public.hole_schedule_task_assignments a
  join public.holes h
    on h.id = a.hole_id
  where a.schedule_task_id = new.schedule_task_id
    and a.assignment_status <> 'cancelled'
    and a.id <> new.id
    and daterange(a.planned_start_date, a.planned_finish_date + 1, '[)')
        && daterange(new.planned_start_date, new.planned_finish_date + 1, '[)')
  limit 1;

  if v_conflicting_assignment_id is not null then
    raise exception 'Task % already has overlapping resource work scheduled for hole %', new.schedule_task_id, coalesce(v_conflicting_hole_code, v_conflicting_assignment_id::text)
      using errcode = '23P01';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_hole_schedule_task_assignment_overlap on public.hole_schedule_task_assignments;
create trigger trg_validate_hole_schedule_task_assignment_overlap
before insert or update of resource_id, planned_start_date, planned_finish_date, assignment_status, schedule_task_id
on public.hole_schedule_task_assignments
for each row
execute function public.validate_hole_schedule_task_assignment_overlap();

create or replace function public.sync_hole_schedule_items_from_hole()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.hole_schedule_tasks
  set organization_id = new.organization_id,
      project_id = new.project_id,
      updated_at = now()
  where hole_id = new.id
    and (
      organization_id is distinct from new.organization_id
      or project_id is distinct from new.project_id
    );

  update public.hole_schedule_task_assignments
  set organization_id = new.organization_id,
      project_id = new.project_id,
      updated_at = now()
  where hole_id = new.id
    and (
      organization_id is distinct from new.organization_id
      or project_id is distinct from new.project_id
    );

  return new;
end;
$$;

drop trigger if exists trg_sync_hole_schedule_items_from_hole on public.holes;
create trigger trg_sync_hole_schedule_items_from_hole
after update of organization_id, project_id
on public.holes
for each row
execute function public.sync_hole_schedule_items_from_hole();

create or replace function public.ensure_default_hole_schedule_tasks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.hole_schedule_tasks (
    organization_id,
    project_id,
    hole_id,
    task_code,
    task_name,
    task_group,
    required_resource_type,
    sequence_no,
    planning_status,
    created_by
  )
  values (
    new.organization_id,
    new.project_id,
    new.id,
    'drill',
    'Drilling',
    'drilling',
    'Drill Rig',
    10,
    'draft',
    new.created_by
  )
  on conflict (hole_id, task_code) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_ensure_default_hole_schedule_tasks on public.holes;
create trigger trg_ensure_default_hole_schedule_tasks
after insert on public.holes
for each row
execute function public.ensure_default_hole_schedule_tasks();

insert into public.hole_schedule_tasks (
  organization_id,
  project_id,
  hole_id,
  task_code,
  task_name,
  task_group,
  required_resource_type,
  sequence_no,
  planning_status,
  created_by
)
select
  h.organization_id,
  h.project_id,
  h.id,
  'drill',
  'Drilling',
  'drilling',
  'Drill Rig',
  10,
  'draft',
  h.created_by
from public.holes h
where h.organization_id is not null
  and h.project_id is not null
on conflict (hole_id, task_code) do nothing;

alter table public.hole_schedule_tasks enable row level security;
alter table public.hole_schedule_task_assignments enable row level security;

drop policy if exists hole_schedule_tasks_org_read on public.hole_schedule_tasks;
create policy hole_schedule_tasks_org_read on public.hole_schedule_tasks
  for select
  using (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = hole_schedule_tasks.organization_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists hole_schedule_tasks_org_insert on public.hole_schedule_tasks;
create policy hole_schedule_tasks_org_insert on public.hole_schedule_tasks
  for insert
  with check (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = hole_schedule_tasks.organization_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'member')
    )
  );

drop policy if exists hole_schedule_tasks_org_update on public.hole_schedule_tasks;
create policy hole_schedule_tasks_org_update on public.hole_schedule_tasks
  for update
  using (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = hole_schedule_tasks.organization_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'member')
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = hole_schedule_tasks.organization_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'member')
    )
  );

drop policy if exists hole_schedule_tasks_org_delete on public.hole_schedule_tasks;
create policy hole_schedule_tasks_org_delete on public.hole_schedule_tasks
  for delete
  using (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = hole_schedule_tasks.organization_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'member')
    )
  );

drop policy if exists hole_schedule_task_assignments_org_read on public.hole_schedule_task_assignments;
create policy hole_schedule_task_assignments_org_read on public.hole_schedule_task_assignments
  for select
  using (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = hole_schedule_task_assignments.organization_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists hole_schedule_task_assignments_org_insert on public.hole_schedule_task_assignments;
create policy hole_schedule_task_assignments_org_insert on public.hole_schedule_task_assignments
  for insert
  with check (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = hole_schedule_task_assignments.organization_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'member')
    )
  );

drop policy if exists hole_schedule_task_assignments_org_update on public.hole_schedule_task_assignments;
create policy hole_schedule_task_assignments_org_update on public.hole_schedule_task_assignments
  for update
  using (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = hole_schedule_task_assignments.organization_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'member')
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = hole_schedule_task_assignments.organization_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'member')
    )
  );

drop policy if exists hole_schedule_task_assignments_org_delete on public.hole_schedule_task_assignments;
create policy hole_schedule_task_assignments_org_delete on public.hole_schedule_task_assignments
  for delete
  using (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = hole_schedule_task_assignments.organization_id
        and m.user_id = auth.uid()
        and m.role in ('admin', 'member')
    )
  );