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

do $$
declare
  v_demo_org_id constant uuid := 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid;
  v_demo_owner_id uuid;
  v_as_of_date constant date := date '2026-04-24';
begin
  select owner_id
    into v_demo_owner_id
  from public.organizations
  where id = v_demo_org_id;

  if v_demo_owner_id is null then
    raise exception 'Demo organisation % was not found or has no owner_id', v_demo_org_id;
  end if;

  insert into public.resources (
    organization_id,
    name,
    description,
    resource_type,
    created_by
  )
  select
    v_demo_org_id,
    seed.name,
    seed.description,
    'Drill Rig',
    v_demo_owner_id
  from (
    values
      ('GS-RC-RIG-01', 'Primary RC rig for the northern Golden Spur fence lines and odd-numbered southern follow-up holes.'),
      ('GS-RC-RIG-02', 'Second RC rig for the central Golden Spur program and even-numbered southern follow-up holes.'),
      ('GS-HYDRO-RIG-01', 'Hydro program rig for monitoring bores and piezometer installs.'),
      ('GS-DD-RIG-01', 'Diamond rig for deep structural and metallurgical tails.')
  ) as seed(name, description)
  where not exists (
    select 1
    from public.resources existing
    where existing.organization_id = v_demo_org_id
      and existing.name = seed.name
  );

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
    v_demo_owner_id
  from public.holes h
  where h.organization_id = v_demo_org_id
    and h.project_id is not null
    and not exists (
      select 1
      from public.hole_schedule_tasks existing
      where existing.hole_id = h.id
        and existing.task_code = 'drill'
    );

  delete from public.hole_schedule_task_assignments a
  using public.hole_schedule_tasks t
  where a.schedule_task_id = t.id
    and t.organization_id = v_demo_org_id
    and t.task_code = 'drill';

  create temp table tmp_demo_drill_schedule_seed on commit drop as
  with rig_resources as (
    select r.id as resource_id, r.name as rig_name
    from public.resources r
    where r.organization_id = v_demo_org_id
      and r.resource_type = 'Drill Rig'
      and r.name in ('GS-RC-RIG-01', 'GS-RC-RIG-02', 'GS-HYDRO-RIG-01', 'GS-DD-RIG-01')
  ),
  base_holes as (
    select
      h.id as hole_id,
      h.organization_id,
      h.project_id,
      h.hole_id as hole_code,
      t.id as schedule_task_id,
      case
        when h.hole_id like 'GSNRC%' then 'GS-RC-RIG-01'
        when h.hole_id like 'GSCRC%' then 'GS-RC-RIG-02'
        when h.hole_id like 'GSSRC%' and mod(right(h.hole_id, 3)::integer, 2) = 1 then 'GS-RC-RIG-01'
        when h.hole_id like 'GSSRC%' then 'GS-RC-RIG-02'
        when h.hole_id like 'GSHYD%' then 'GS-HYDRO-RIG-01'
        when h.hole_id like 'GSDD%' then 'GS-DD-RIG-01'
      end as rig_name,
      case
        when h.hole_id like 'GSDD%' then greatest(5, ceil(coalesce(h.planned_depth, h.depth, 360) / 90.0))::integer
        when h.hole_id like 'GSHYD%' then greatest(2, ceil(coalesce(h.planned_depth, h.depth, 102) / 65.0))::integer
        else greatest(2, ceil(coalesce(h.planned_depth, h.depth, 170) / 110.0))::integer
      end as duration_days,
      case
        when h.state = 'drilled' then 'firm'
        else 'scheduled'
      end as planning_status,
      case
        when h.state = 'drilled' then 'firm'
        else 'scheduled'
      end as assignment_status,
      case
        when h.state = 'drilled' then 1
        when h.state = 'in_progress' then 2
        else 3
      end as state_bucket,
      case
        when h.hole_id like 'GSNRC%' then date '2026-02-03'
        when h.hole_id like 'GSCRC%' then date '2026-02-20'
        when h.hole_id like 'GSSRC%' then date '2026-03-08'
        when h.hole_id like 'GSHYD%' then date '2026-01-15'
        when h.hole_id like 'GSDD%' then date '2026-02-12'
      end as campaign_start_date,
      right(h.hole_id, 3)::integer as seq_no
    from public.holes h
    join public.hole_schedule_tasks t
      on t.hole_id = h.id
     and t.task_code = 'drill'
    where h.organization_id = v_demo_org_id
      and h.project_id is not null
      and (
        h.hole_id like 'GSNRC%'
        or h.hole_id like 'GSCRC%'
        or h.hole_id like 'GSSRC%'
        or h.hole_id like 'GSHYD%'
        or h.hole_id like 'GSDD%'
      )
  ),
  resource_starts as (
    select
      b.rig_name,
      min(b.campaign_start_date) as resource_start_date
    from base_holes b
    group by b.rig_name
  ),
  completed_seed as (
    select
      b.organization_id,
      b.project_id,
      b.hole_id,
      b.schedule_task_id,
      rr.resource_id,
      (
        rs.resource_start_date
        + coalesce(
            sum(b.duration_days + 1) over (
              partition by b.rig_name
              order by b.campaign_start_date, b.project_id, b.seq_no
              rows between unbounded preceding and 1 preceding
            ),
            0
          )::integer
      ) as planned_start_date,
      b.duration_days,
      b.planning_status,
      b.assignment_status,
      b.rig_name
    from base_holes b
    join rig_resources rr
      on rr.rig_name = b.rig_name
    join resource_starts rs
      on rs.rig_name = b.rig_name
    where b.state_bucket = 1
  ),
  completed_schedule as (
    select
      c.organization_id,
      c.project_id,
      c.hole_id,
      c.schedule_task_id,
      c.resource_id,
      c.planned_start_date,
      (c.planned_start_date + (c.duration_days - 1))::date as planned_finish_date,
      c.planning_status,
      c.assignment_status,
      c.rig_name
    from completed_seed c
  ),
  completed_rollup as (
    select
      c.rig_name,
      max(c.planned_finish_date) as last_completed_finish
    from completed_schedule c
    group by c.rig_name
  ),
  in_progress_anchor as (
    select
      rs.rig_name,
      greatest(coalesce(cr.last_completed_finish + 1, rs.resource_start_date), v_as_of_date - 2) as anchor_date
    from resource_starts rs
    left join completed_rollup cr
      on cr.rig_name = rs.rig_name
  ),
  in_progress_seed as (
    select
      b.organization_id,
      b.project_id,
      b.hole_id,
      b.schedule_task_id,
      rr.resource_id,
      (
        ia.anchor_date
        + coalesce(
            sum(b.duration_days + 1) over (
              partition by b.rig_name
              order by b.campaign_start_date, b.project_id, b.seq_no
              rows between unbounded preceding and 1 preceding
            ),
            0
          )::integer
      ) as planned_start_date,
      b.duration_days,
      b.planning_status,
      b.assignment_status,
      b.rig_name
    from base_holes b
    join rig_resources rr
      on rr.rig_name = b.rig_name
    join in_progress_anchor ia
      on ia.rig_name = b.rig_name
    where b.state_bucket = 2
  ),
  in_progress_schedule as (
    select
      i.organization_id,
      i.project_id,
      i.hole_id,
      i.schedule_task_id,
      i.resource_id,
      i.planned_start_date,
      (i.planned_start_date + (i.duration_days - 1))::date as planned_finish_date,
      i.planning_status,
      i.assignment_status,
      i.rig_name
    from in_progress_seed i
  ),
  in_progress_rollup as (
    select
      i.rig_name,
      max(i.planned_finish_date) as last_in_progress_finish
    from in_progress_schedule i
    group by i.rig_name
  ),
  proposed_anchor as (
    select
      rs.rig_name,
      greatest(
        coalesce(ir.last_in_progress_finish + 1, cr.last_completed_finish + 1, rs.resource_start_date),
        v_as_of_date + 3
      ) as anchor_date
    from resource_starts rs
    left join completed_rollup cr
      on cr.rig_name = rs.rig_name
    left join in_progress_rollup ir
      on ir.rig_name = rs.rig_name
  ),
  proposed_seed as (
    select
      b.organization_id,
      b.project_id,
      b.hole_id,
      b.schedule_task_id,
      rr.resource_id,
      (
        pa.anchor_date
        + coalesce(
            sum(b.duration_days + 1) over (
              partition by b.rig_name
              order by b.campaign_start_date, b.project_id, b.seq_no
              rows between unbounded preceding and 1 preceding
            ),
            0
          )::integer
      ) as planned_start_date,
      b.duration_days,
      b.planning_status,
      b.assignment_status,
      b.rig_name
    from base_holes b
    join rig_resources rr
      on rr.rig_name = b.rig_name
    join proposed_anchor pa
      on pa.rig_name = b.rig_name
    where b.state_bucket = 3
  ),
  proposed_schedule as (
    select
      p.organization_id,
      p.project_id,
      p.hole_id,
      p.schedule_task_id,
      p.resource_id,
      p.planned_start_date,
      (p.planned_start_date + (p.duration_days - 1))::date as planned_finish_date,
      p.planning_status,
      p.assignment_status,
      p.rig_name
    from proposed_seed p
  )
  select * from completed_schedule
  union all
  select * from in_progress_schedule
  union all
  select * from proposed_schedule;

  update public.hole_schedule_tasks t
  set target_start_date = s.planned_start_date,
      target_finish_date = s.planned_finish_date,
      planning_status = s.planning_status,
      notes = case
        when coalesce(btrim(t.notes), '') = '' then 'Seeded demo drill schedule.'
        else t.notes
      end
  from tmp_demo_drill_schedule_seed s
  where t.id = s.schedule_task_id;

  insert into public.hole_schedule_task_assignments (
    organization_id,
    project_id,
    hole_id,
    schedule_task_id,
    resource_id,
    planned_start_date,
    planned_finish_date,
    assignment_status,
    lane_rank,
    notes,
    created_by
  )
  select
    s.organization_id,
    s.project_id,
    s.hole_id,
    s.schedule_task_id,
    s.resource_id,
    s.planned_start_date,
    s.planned_finish_date,
    s.assignment_status,
    1000,
    'Seeded demo drill schedule.',
    v_demo_owner_id
  from tmp_demo_drill_schedule_seed s;
end;
$$;