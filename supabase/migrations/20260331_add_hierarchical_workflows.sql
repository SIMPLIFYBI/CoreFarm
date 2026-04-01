create table if not exists public.workflow_status_catalog (
  key text not null,
  name text not null,
  color text not null,
  sort_order integer not null,
  constraint workflow_status_catalog_pkey primary key (key),
  constraint workflow_status_catalog_key_check check (key = any (array['not_started'::text, 'planned'::text, 'in_progress'::text, 'complete'::text])),
  constraint workflow_status_catalog_name_check check (btrim(name) <> ''),
  constraint workflow_status_catalog_color_check check (btrim(color) <> '')
);

insert into public.workflow_status_catalog (key, name, color, sort_order)
values
  ('not_started', 'Not Started', '#64748b', 10),
  ('planned', 'Planned', '#38bdf8', 20),
  ('in_progress', 'In Progress', '#f59e0b', 30),
  ('complete', 'Complete', '#10b981', 40)
on conflict (key) do update
set
  name = excluded.name,
  color = excluded.color,
  sort_order = excluded.sort_order;

create table if not exists public.workflow_phase_definitions (
  id uuid not null default gen_random_uuid(),
  workflow_id uuid not null,
  phase_index integer not null,
  name text,
  description text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint workflow_phase_definitions_pkey primary key (id),
  constraint workflow_phase_definitions_workflow_id_fkey foreign key (workflow_id) references public.workflow_definitions(id) on delete cascade,
  constraint workflow_phase_definitions_phase_index_check check (phase_index between 1 and 5),
  constraint workflow_phase_definitions_name_check check (name is null or btrim(name) <> ''),
  constraint workflow_phase_definitions_workflow_phase_index_key unique (workflow_id, phase_index)
);

create index if not exists workflow_phase_definitions_workflow_idx
  on public.workflow_phase_definitions (workflow_id, phase_index);

create table if not exists public.workflow_substage_definitions (
  id uuid not null default gen_random_uuid(),
  workflow_phase_id uuid not null,
  substage_index integer not null,
  name text not null,
  description text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint workflow_substage_definitions_pkey primary key (id),
  constraint workflow_substage_definitions_workflow_phase_id_fkey foreign key (workflow_phase_id) references public.workflow_phase_definitions(id) on delete cascade,
  constraint workflow_substage_definitions_substage_index_check check (substage_index between 1 and 5),
  constraint workflow_substage_definitions_name_check check (btrim(name) <> ''),
  constraint workflow_substage_definitions_phase_substage_index_key unique (workflow_phase_id, substage_index)
);

create index if not exists workflow_substage_definitions_phase_idx
  on public.workflow_substage_definitions (workflow_phase_id, substage_index);

alter table public.projects
  add column if not exists current_workflow_phase_id uuid,
  add column if not exists current_workflow_substage_id uuid,
  add column if not exists current_workflow_status_key text;

alter table public.holes
  add column if not exists current_workflow_phase_id uuid,
  add column if not exists current_workflow_substage_id uuid,
  add column if not exists current_workflow_status_key text;

alter table public.projects
  drop constraint if exists projects_current_workflow_phase_id_fkey;

alter table public.projects
  add constraint projects_current_workflow_phase_id_fkey
  foreign key (current_workflow_phase_id) references public.workflow_phase_definitions(id);

alter table public.projects
  drop constraint if exists projects_current_workflow_substage_id_fkey;

alter table public.projects
  add constraint projects_current_workflow_substage_id_fkey
  foreign key (current_workflow_substage_id) references public.workflow_substage_definitions(id);

alter table public.projects
  drop constraint if exists projects_current_workflow_status_key_fkey;

alter table public.projects
  add constraint projects_current_workflow_status_key_fkey
  foreign key (current_workflow_status_key) references public.workflow_status_catalog(key);

alter table public.holes
  drop constraint if exists holes_current_workflow_phase_id_fkey;

alter table public.holes
  add constraint holes_current_workflow_phase_id_fkey
  foreign key (current_workflow_phase_id) references public.workflow_phase_definitions(id);

alter table public.holes
  drop constraint if exists holes_current_workflow_substage_id_fkey;

alter table public.holes
  add constraint holes_current_workflow_substage_id_fkey
  foreign key (current_workflow_substage_id) references public.workflow_substage_definitions(id);

alter table public.holes
  drop constraint if exists holes_current_workflow_status_key_fkey;

alter table public.holes
  add constraint holes_current_workflow_status_key_fkey
  foreign key (current_workflow_status_key) references public.workflow_status_catalog(key);

create index if not exists projects_current_workflow_phase_id_idx
  on public.projects (current_workflow_phase_id);

create index if not exists projects_current_workflow_substage_id_idx
  on public.projects (current_workflow_substage_id);

create index if not exists projects_current_workflow_status_key_idx
  on public.projects (current_workflow_status_key);

create index if not exists holes_current_workflow_phase_id_idx
  on public.holes (current_workflow_phase_id);

create index if not exists holes_current_workflow_substage_id_idx
  on public.holes (current_workflow_substage_id);

create index if not exists holes_current_workflow_status_key_idx
  on public.holes (current_workflow_status_key);

update public.projects
set
  current_workflow_id = null,
  current_workflow_stage_id = null,
  current_workflow_phase_id = null,
  current_workflow_substage_id = null,
  current_workflow_status_key = null
where current_workflow_id is not null
   or current_workflow_stage_id is not null
   or current_workflow_phase_id is not null
   or current_workflow_substage_id is not null
   or current_workflow_status_key is not null;

update public.holes
set
  current_workflow_id = null,
  current_workflow_stage_id = null,
  current_workflow_phase_id = null,
  current_workflow_substage_id = null,
  current_workflow_status_key = null
where current_workflow_id is not null
   or current_workflow_stage_id is not null
   or current_workflow_phase_id is not null
   or current_workflow_substage_id is not null
   or current_workflow_status_key is not null;

delete from public.workflow_definitions;

create or replace function public.ensure_workflow_phase_slots()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workflow_phase_definitions (workflow_id, phase_index)
  select new.id, series.phase_index
  from generate_series(1, 5) as series(phase_index)
  on conflict (workflow_id, phase_index) do nothing;

  return new;
end;
$$;

insert into public.workflow_phase_definitions (workflow_id, phase_index)
select w.id, series.phase_index
from public.workflow_definitions w
cross join generate_series(1, 5) as series(phase_index)
on conflict (workflow_id, phase_index) do nothing;

drop trigger if exists trg_workflow_definition_phase_slots on public.workflow_definitions;
create trigger trg_workflow_definition_phase_slots
after insert on public.workflow_definitions
for each row
execute function public.ensure_workflow_phase_slots();

create or replace function public.validate_entity_workflow_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity_type text := tg_argv[0];
  v_workflow_id uuid := new.current_workflow_id;
  v_stage_id uuid := new.current_workflow_stage_id;
  v_phase_id uuid := new.current_workflow_phase_id;
  v_substage_id uuid := new.current_workflow_substage_id;
  v_workflow_org_id uuid;
  v_workflow_entity_type text;
  v_workflow_active boolean;
  v_stage_workflow_id uuid;
  v_stage_active boolean;
  v_phase_workflow_id uuid;
  v_phase_name text;
  v_substage_phase_id uuid;
  v_substage_workflow_id uuid;
  v_substage_name text;
begin
  if new.organization_id is null then
    return new;
  end if;

  if v_workflow_id is null and v_stage_id is null and v_phase_id is null and v_substage_id is null then
    new.current_workflow_status_key := null;
    return new;
  end if;

  if v_stage_id is not null and v_workflow_id is null then
    select s.workflow_id, s.is_active
      into v_workflow_id, v_stage_active
    from public.workflow_stages s
    where s.id = v_stage_id;

    if v_workflow_id is null then
      raise exception 'Workflow stage % does not exist', v_stage_id using errcode = '23503';
    end if;
  end if;

  if v_substage_id is not null then
    select s.workflow_phase_id, p.workflow_id, s.name
      into v_substage_phase_id, v_substage_workflow_id, v_substage_name
    from public.workflow_substage_definitions s
    join public.workflow_phase_definitions p on p.id = s.workflow_phase_id
    where s.id = v_substage_id;

    if v_substage_phase_id is null then
      raise exception 'Workflow substage % does not exist', v_substage_id using errcode = '23503';
    end if;

    if coalesce(btrim(v_substage_name), '') = '' then
      raise exception 'Workflow substage % is blank and cannot be assigned', v_substage_id using errcode = '23514';
    end if;

    if v_phase_id is null then
      v_phase_id := v_substage_phase_id;
    elsif v_phase_id <> v_substage_phase_id then
      raise exception 'Workflow substage % does not belong to phase %', v_substage_id, v_phase_id using errcode = '23514';
    end if;

    if v_workflow_id is null then
      v_workflow_id := v_substage_workflow_id;
    elsif v_workflow_id <> v_substage_workflow_id then
      raise exception 'Workflow substage % does not belong to workflow %', v_substage_id, v_workflow_id using errcode = '23514';
    end if;
  end if;

  if v_phase_id is not null then
    select p.workflow_id, p.name
      into v_phase_workflow_id, v_phase_name
    from public.workflow_phase_definitions p
    where p.id = v_phase_id;

    if v_phase_workflow_id is null then
      raise exception 'Workflow phase % does not exist', v_phase_id using errcode = '23503';
    end if;

    if coalesce(btrim(v_phase_name), '') = '' then
      raise exception 'Workflow phase % is blank and cannot be assigned', v_phase_id using errcode = '23514';
    end if;

    if v_workflow_id is null then
      v_workflow_id := v_phase_workflow_id;
    elsif v_phase_workflow_id <> v_workflow_id then
      raise exception 'Workflow phase % does not belong to workflow %', v_phase_id, v_workflow_id using errcode = '23514';
    end if;
  end if;

  select w.organization_id, w.entity_type, w.is_active
    into v_workflow_org_id, v_workflow_entity_type, v_workflow_active
  from public.workflow_definitions w
  where w.id = v_workflow_id;

  if v_workflow_org_id is null then
    raise exception 'Workflow % does not exist', v_workflow_id using errcode = '23503';
  end if;

  if v_workflow_org_id <> new.organization_id then
    raise exception 'Workflow % does not belong to organization %', v_workflow_id, new.organization_id using errcode = '23514';
  end if;

  if v_workflow_entity_type <> v_entity_type then
    raise exception 'Workflow % is for % records, not % records', v_workflow_id, v_workflow_entity_type, v_entity_type using errcode = '23514';
  end if;

  if not coalesce(v_workflow_active, false) then
    raise exception 'Workflow % is inactive', v_workflow_id using errcode = '23514';
  end if;

  if v_stage_id is not null then
    select s.workflow_id, s.is_active
      into v_stage_workflow_id, v_stage_active
    from public.workflow_stages s
    where s.id = v_stage_id;

    if v_stage_workflow_id is null then
      raise exception 'Workflow stage % does not exist', v_stage_id using errcode = '23503';
    end if;

    if v_stage_workflow_id <> v_workflow_id then
      raise exception 'Workflow stage % does not belong to workflow %', v_stage_id, v_workflow_id using errcode = '23514';
    end if;

    if not coalesce(v_stage_active, false) then
      raise exception 'Workflow stage % is inactive', v_stage_id using errcode = '23514';
    end if;
  end if;

  new.current_workflow_id := v_workflow_id;
  new.current_workflow_phase_id := v_phase_id;
  new.current_workflow_substage_id := v_substage_id;

  if (v_workflow_id is not null or v_phase_id is not null or v_substage_id is not null or v_stage_id is not null)
    and new.current_workflow_status_key is null then
    new.current_workflow_status_key := 'not_started';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_projects_workflow_assignment on public.projects;
create trigger trg_validate_projects_workflow_assignment
before insert or update of organization_id, current_workflow_id, current_workflow_stage_id, current_workflow_phase_id, current_workflow_substage_id, current_workflow_status_key
on public.projects
for each row
execute function public.validate_entity_workflow_assignment('project');

drop trigger if exists trg_validate_holes_workflow_assignment on public.holes;
create trigger trg_validate_holes_workflow_assignment
before insert or update of organization_id, current_workflow_id, current_workflow_stage_id, current_workflow_phase_id, current_workflow_substage_id, current_workflow_status_key
on public.holes
for each row
execute function public.validate_entity_workflow_assignment('hole');

create table if not exists public.project_workflow_phase_statuses (
  id uuid not null default gen_random_uuid(),
  project_id uuid not null,
  workflow_id uuid not null,
  workflow_phase_id uuid not null,
  status_key text not null default 'not_started',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint project_workflow_phase_statuses_pkey primary key (id),
  constraint project_workflow_phase_statuses_project_id_fkey foreign key (project_id) references public.projects(id) on delete cascade,
  constraint project_workflow_phase_statuses_workflow_id_fkey foreign key (workflow_id) references public.workflow_definitions(id) on delete cascade,
  constraint project_workflow_phase_statuses_phase_id_fkey foreign key (workflow_phase_id) references public.workflow_phase_definitions(id) on delete cascade,
  constraint project_workflow_phase_statuses_status_key_fkey foreign key (status_key) references public.workflow_status_catalog(key),
  constraint project_workflow_phase_statuses_project_phase_key unique (project_id, workflow_phase_id)
);

create index if not exists project_workflow_phase_statuses_project_idx
  on public.project_workflow_phase_statuses (project_id, workflow_phase_id);

create table if not exists public.project_workflow_substage_statuses (
  id uuid not null default gen_random_uuid(),
  project_id uuid not null,
  workflow_id uuid not null,
  workflow_phase_id uuid not null,
  workflow_substage_id uuid not null,
  status_key text not null default 'not_started',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint project_workflow_substage_statuses_pkey primary key (id),
  constraint project_workflow_substage_statuses_project_id_fkey foreign key (project_id) references public.projects(id) on delete cascade,
  constraint project_workflow_substage_statuses_workflow_id_fkey foreign key (workflow_id) references public.workflow_definitions(id) on delete cascade,
  constraint project_workflow_substage_statuses_phase_id_fkey foreign key (workflow_phase_id) references public.workflow_phase_definitions(id) on delete cascade,
  constraint project_workflow_substage_statuses_substage_id_fkey foreign key (workflow_substage_id) references public.workflow_substage_definitions(id) on delete cascade,
  constraint project_workflow_substage_statuses_status_key_fkey foreign key (status_key) references public.workflow_status_catalog(key),
  constraint project_workflow_substage_statuses_project_substage_key unique (project_id, workflow_substage_id)
);

create index if not exists project_workflow_substage_statuses_project_idx
  on public.project_workflow_substage_statuses (project_id, workflow_phase_id, workflow_substage_id);

create table if not exists public.hole_workflow_phase_statuses (
  id uuid not null default gen_random_uuid(),
  hole_id uuid not null,
  workflow_id uuid not null,
  workflow_phase_id uuid not null,
  status_key text not null default 'not_started',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint hole_workflow_phase_statuses_pkey primary key (id),
  constraint hole_workflow_phase_statuses_hole_id_fkey foreign key (hole_id) references public.holes(id) on delete cascade,
  constraint hole_workflow_phase_statuses_workflow_id_fkey foreign key (workflow_id) references public.workflow_definitions(id) on delete cascade,
  constraint hole_workflow_phase_statuses_phase_id_fkey foreign key (workflow_phase_id) references public.workflow_phase_definitions(id) on delete cascade,
  constraint hole_workflow_phase_statuses_status_key_fkey foreign key (status_key) references public.workflow_status_catalog(key),
  constraint hole_workflow_phase_statuses_hole_phase_key unique (hole_id, workflow_phase_id)
);

create index if not exists hole_workflow_phase_statuses_hole_idx
  on public.hole_workflow_phase_statuses (hole_id, workflow_phase_id);

create table if not exists public.hole_workflow_substage_statuses (
  id uuid not null default gen_random_uuid(),
  hole_id uuid not null,
  workflow_id uuid not null,
  workflow_phase_id uuid not null,
  workflow_substage_id uuid not null,
  status_key text not null default 'not_started',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint hole_workflow_substage_statuses_pkey primary key (id),
  constraint hole_workflow_substage_statuses_hole_id_fkey foreign key (hole_id) references public.holes(id) on delete cascade,
  constraint hole_workflow_substage_statuses_workflow_id_fkey foreign key (workflow_id) references public.workflow_definitions(id) on delete cascade,
  constraint hole_workflow_substage_statuses_phase_id_fkey foreign key (workflow_phase_id) references public.workflow_phase_definitions(id) on delete cascade,
  constraint hole_workflow_substage_statuses_substage_id_fkey foreign key (workflow_substage_id) references public.workflow_substage_definitions(id) on delete cascade,
  constraint hole_workflow_substage_statuses_status_key_fkey foreign key (status_key) references public.workflow_status_catalog(key),
  constraint hole_workflow_substage_statuses_hole_substage_key unique (hole_id, workflow_substage_id)
);

create index if not exists hole_workflow_substage_statuses_hole_idx
  on public.hole_workflow_substage_statuses (hole_id, workflow_phase_id, workflow_substage_id);

create or replace function public.validate_project_workflow_phase_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_org_id uuid;
  v_project_workflow_id uuid;
  v_phase_workflow_id uuid;
  v_phase_name text;
begin
  select p.organization_id, p.current_workflow_id
    into v_project_org_id, v_project_workflow_id
  from public.projects p
  where p.id = new.project_id;

  if v_project_org_id is null then
    raise exception 'Project % does not exist', new.project_id using errcode = '23503';
  end if;

  if v_project_workflow_id is null then
    raise exception 'Project % has no workflow assigned', new.project_id using errcode = '23514';
  end if;

  select p.workflow_id, p.name
    into v_phase_workflow_id, v_phase_name
  from public.workflow_phase_definitions p
  where p.id = new.workflow_phase_id;

  if v_phase_workflow_id is null then
    raise exception 'Workflow phase % does not exist', new.workflow_phase_id using errcode = '23503';
  end if;

  if coalesce(btrim(v_phase_name), '') = '' then
    raise exception 'Workflow phase % is blank and cannot be tracked', new.workflow_phase_id using errcode = '23514';
  end if;

  if v_phase_workflow_id <> v_project_workflow_id then
    raise exception 'Workflow phase % does not belong to project workflow %', new.workflow_phase_id, v_project_workflow_id using errcode = '23514';
  end if;

  new.workflow_id := v_phase_workflow_id;
  if new.status_key is null then
    new.status_key := 'not_started';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.prevent_direct_phase_status_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() < 2 then
    raise exception 'Phase statuses are derived from substage statuses and cannot be changed directly' using errcode = '23514';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.validate_project_workflow_substage_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_org_id uuid;
  v_project_workflow_id uuid;
  v_phase_id uuid;
  v_workflow_id uuid;
  v_substage_name text;
begin
  select p.organization_id, p.current_workflow_id
    into v_project_org_id, v_project_workflow_id
  from public.projects p
  where p.id = new.project_id;

  if v_project_org_id is null then
    raise exception 'Project % does not exist', new.project_id using errcode = '23503';
  end if;

  if v_project_workflow_id is null then
    raise exception 'Project % has no workflow assigned', new.project_id using errcode = '23514';
  end if;

  select s.workflow_phase_id, p.workflow_id, s.name
    into v_phase_id, v_workflow_id, v_substage_name
  from public.workflow_substage_definitions s
  join public.workflow_phase_definitions p on p.id = s.workflow_phase_id
  where s.id = new.workflow_substage_id;

  if v_phase_id is null then
    raise exception 'Workflow substage % does not exist', new.workflow_substage_id using errcode = '23503';
  end if;

  if coalesce(btrim(v_substage_name), '') = '' then
    raise exception 'Workflow substage % is blank and cannot be tracked', new.workflow_substage_id using errcode = '23514';
  end if;

  if v_workflow_id <> v_project_workflow_id then
    raise exception 'Workflow substage % does not belong to project workflow %', new.workflow_substage_id, v_project_workflow_id using errcode = '23514';
  end if;

  if new.workflow_phase_id is not null and new.workflow_phase_id <> v_phase_id then
    raise exception 'Workflow substage % does not belong to phase %', new.workflow_substage_id, new.workflow_phase_id using errcode = '23514';
  end if;

  new.workflow_id := v_workflow_id;
  new.workflow_phase_id := v_phase_id;
  if new.status_key is null then
    new.status_key := 'not_started';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.validate_hole_workflow_phase_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hole_org_id uuid;
  v_hole_workflow_id uuid;
  v_phase_workflow_id uuid;
  v_phase_name text;
begin
  select h.organization_id, h.current_workflow_id
    into v_hole_org_id, v_hole_workflow_id
  from public.holes h
  where h.id = new.hole_id;

  if v_hole_org_id is null then
    raise exception 'Hole % does not exist', new.hole_id using errcode = '23503';
  end if;

  if v_hole_workflow_id is null then
    raise exception 'Hole % has no workflow assigned', new.hole_id using errcode = '23514';
  end if;

  select p.workflow_id, p.name
    into v_phase_workflow_id, v_phase_name
  from public.workflow_phase_definitions p
  where p.id = new.workflow_phase_id;

  if v_phase_workflow_id is null then
    raise exception 'Workflow phase % does not exist', new.workflow_phase_id using errcode = '23503';
  end if;

  if coalesce(btrim(v_phase_name), '') = '' then
    raise exception 'Workflow phase % is blank and cannot be tracked', new.workflow_phase_id using errcode = '23514';
  end if;

  if v_phase_workflow_id <> v_hole_workflow_id then
    raise exception 'Workflow phase % does not belong to hole workflow %', new.workflow_phase_id, v_hole_workflow_id using errcode = '23514';
  end if;

  new.workflow_id := v_phase_workflow_id;
  if new.status_key is null then
    new.status_key := 'not_started';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.validate_hole_workflow_substage_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hole_org_id uuid;
  v_hole_workflow_id uuid;
  v_phase_id uuid;
  v_workflow_id uuid;
  v_substage_name text;
begin
  select h.organization_id, h.current_workflow_id
    into v_hole_org_id, v_hole_workflow_id
  from public.holes h
  where h.id = new.hole_id;

  if v_hole_org_id is null then
    raise exception 'Hole % does not exist', new.hole_id using errcode = '23503';
  end if;

  if v_hole_workflow_id is null then
    raise exception 'Hole % has no workflow assigned', new.hole_id using errcode = '23514';
  end if;

  select s.workflow_phase_id, p.workflow_id, s.name
    into v_phase_id, v_workflow_id, v_substage_name
  from public.workflow_substage_definitions s
  join public.workflow_phase_definitions p on p.id = s.workflow_phase_id
  where s.id = new.workflow_substage_id;

  if v_phase_id is null then
    raise exception 'Workflow substage % does not exist', new.workflow_substage_id using errcode = '23503';
  end if;

  if coalesce(btrim(v_substage_name), '') = '' then
    raise exception 'Workflow substage % is blank and cannot be tracked', new.workflow_substage_id using errcode = '23514';
  end if;

  if v_workflow_id <> v_hole_workflow_id then
    raise exception 'Workflow substage % does not belong to hole workflow %', new.workflow_substage_id, v_hole_workflow_id using errcode = '23514';
  end if;

  if new.workflow_phase_id is not null and new.workflow_phase_id <> v_phase_id then
    raise exception 'Workflow substage % does not belong to phase %', new.workflow_substage_id, new.workflow_phase_id using errcode = '23514';
  end if;

  new.workflow_id := v_workflow_id;
  new.workflow_phase_id := v_phase_id;
  if new.status_key is null then
    new.status_key := 'not_started';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.derive_workflow_phase_status(
  v_complete_count integer,
  v_in_progress_count integer,
  v_planned_count integer,
  v_not_started_count integer,
  v_total_count integer
)
returns text
language plpgsql
immutable
as $$
begin
  if coalesce(v_total_count, 0) = 0 then
    return 'not_started';
  end if;

  if coalesce(v_complete_count, 0) = v_total_count then
    return 'complete';
  end if;

  if coalesce(v_in_progress_count, 0) > 0 then
    return 'in_progress';
  end if;

  if coalesce(v_complete_count, 0) > 0 then
    return 'in_progress';
  end if;

  if coalesce(v_planned_count, 0) > 0 then
    return 'planned';
  end if;

  if coalesce(v_not_started_count, 0) = v_total_count then
    return 'not_started';
  end if;

  return 'not_started';
end;
$$;

create or replace function public.sync_project_phase_status_from_substages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid := coalesce(new.project_id, old.project_id);
  v_phase_id uuid := coalesce(new.workflow_phase_id, old.workflow_phase_id);
  v_workflow_id uuid;
  v_total_count integer;
  v_complete_count integer;
  v_in_progress_count integer;
  v_planned_count integer;
  v_not_started_count integer;
  v_status_key text;
begin
  select p.workflow_id
    into v_workflow_id
  from public.workflow_phase_definitions p
  where p.id = v_phase_id;

  if v_workflow_id is null then
    return coalesce(new, old);
  end if;

  select
    count(*)::integer,
    count(*) filter (where coalesce(s.status_key, 'not_started') = 'complete')::integer,
    count(*) filter (where coalesce(s.status_key, 'not_started') = 'in_progress')::integer,
    count(*) filter (where coalesce(s.status_key, 'not_started') = 'planned')::integer,
    count(*) filter (where coalesce(s.status_key, 'not_started') = 'not_started')::integer
    into v_total_count, v_complete_count, v_in_progress_count, v_planned_count, v_not_started_count
  from public.workflow_substage_definitions d
  left join public.project_workflow_substage_statuses s
    on s.workflow_substage_id = d.id
   and s.project_id = v_project_id
  where d.workflow_phase_id = v_phase_id;

  v_status_key := public.derive_workflow_phase_status(v_complete_count, v_in_progress_count, v_planned_count, v_not_started_count, v_total_count);

  insert into public.project_workflow_phase_statuses (project_id, workflow_id, workflow_phase_id, status_key)
  values (v_project_id, v_workflow_id, v_phase_id, v_status_key)
  on conflict (project_id, workflow_phase_id) do update
    set status_key = excluded.status_key,
        workflow_id = excluded.workflow_id,
        updated_at = now();

  return coalesce(new, old);
end;
$$;

create or replace function public.sync_hole_phase_status_from_substages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hole_id uuid := coalesce(new.hole_id, old.hole_id);
  v_phase_id uuid := coalesce(new.workflow_phase_id, old.workflow_phase_id);
  v_workflow_id uuid;
  v_total_count integer;
  v_complete_count integer;
  v_in_progress_count integer;
  v_planned_count integer;
  v_not_started_count integer;
  v_status_key text;
begin
  select p.workflow_id
    into v_workflow_id
  from public.workflow_phase_definitions p
  where p.id = v_phase_id;

  if v_workflow_id is null then
    return coalesce(new, old);
  end if;

  select
    count(*)::integer,
    count(*) filter (where coalesce(s.status_key, 'not_started') = 'complete')::integer,
    count(*) filter (where coalesce(s.status_key, 'not_started') = 'in_progress')::integer,
    count(*) filter (where coalesce(s.status_key, 'not_started') = 'planned')::integer,
    count(*) filter (where coalesce(s.status_key, 'not_started') = 'not_started')::integer
    into v_total_count, v_complete_count, v_in_progress_count, v_planned_count, v_not_started_count
  from public.workflow_substage_definitions d
  left join public.hole_workflow_substage_statuses s
    on s.workflow_substage_id = d.id
   and s.hole_id = v_hole_id
  where d.workflow_phase_id = v_phase_id;

  v_status_key := public.derive_workflow_phase_status(v_complete_count, v_in_progress_count, v_planned_count, v_not_started_count, v_total_count);

  insert into public.hole_workflow_phase_statuses (hole_id, workflow_id, workflow_phase_id, status_key)
  values (v_hole_id, v_workflow_id, v_phase_id, v_status_key)
  on conflict (hole_id, workflow_phase_id) do update
    set status_key = excluded.status_key,
        workflow_id = excluded.workflow_id,
        updated_at = now();

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_validate_project_workflow_phase_status on public.project_workflow_phase_statuses;
create trigger trg_validate_project_workflow_phase_status
before insert or update on public.project_workflow_phase_statuses
for each row
execute function public.validate_project_workflow_phase_status();

drop trigger if exists trg_prevent_direct_project_phase_status_write on public.project_workflow_phase_statuses;
create trigger trg_prevent_direct_project_phase_status_write
before insert or update or delete on public.project_workflow_phase_statuses
for each row
execute function public.prevent_direct_phase_status_write();

drop trigger if exists trg_validate_project_workflow_substage_status on public.project_workflow_substage_statuses;
create trigger trg_validate_project_workflow_substage_status
before insert or update on public.project_workflow_substage_statuses
for each row
execute function public.validate_project_workflow_substage_status();

drop trigger if exists trg_validate_hole_workflow_phase_status on public.hole_workflow_phase_statuses;
create trigger trg_validate_hole_workflow_phase_status
before insert or update on public.hole_workflow_phase_statuses
for each row
execute function public.validate_hole_workflow_phase_status();

drop trigger if exists trg_prevent_direct_hole_phase_status_write on public.hole_workflow_phase_statuses;
create trigger trg_prevent_direct_hole_phase_status_write
before insert or update or delete on public.hole_workflow_phase_statuses
for each row
execute function public.prevent_direct_phase_status_write();

drop trigger if exists trg_validate_hole_workflow_substage_status on public.hole_workflow_substage_statuses;
create trigger trg_validate_hole_workflow_substage_status
before insert or update on public.hole_workflow_substage_statuses
for each row
execute function public.validate_hole_workflow_substage_status();

drop trigger if exists trg_sync_project_phase_status_from_substages on public.project_workflow_substage_statuses;
create trigger trg_sync_project_phase_status_from_substages
after insert or update or delete on public.project_workflow_substage_statuses
for each row
execute function public.sync_project_phase_status_from_substages();

drop trigger if exists trg_sync_hole_phase_status_from_substages on public.hole_workflow_substage_statuses;
create trigger trg_sync_hole_phase_status_from_substages
after insert or update or delete on public.hole_workflow_substage_statuses
for each row
execute function public.sync_hole_phase_status_from_substages();

alter table public.workflow_phase_definitions enable row level security;
alter table public.workflow_substage_definitions enable row level security;
alter table public.project_workflow_phase_statuses enable row level security;
alter table public.project_workflow_substage_statuses enable row level security;
alter table public.hole_workflow_phase_statuses enable row level security;
alter table public.hole_workflow_substage_statuses enable row level security;

drop policy if exists workflow_phase_definitions_org_read on public.workflow_phase_definitions;
create policy workflow_phase_definitions_org_read on public.workflow_phase_definitions
  for select
  using (
    exists (
      select 1
      from public.workflow_definitions w
      join public.organization_members m on m.organization_id = w.organization_id
      where w.id = workflow_phase_definitions.workflow_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists workflow_phase_definitions_org_insert on public.workflow_phase_definitions;
create policy workflow_phase_definitions_org_insert on public.workflow_phase_definitions
  for insert
  with check (
    exists (
      select 1
      from public.workflow_definitions w
      join public.organization_members m on m.organization_id = w.organization_id
      where w.id = workflow_phase_definitions.workflow_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists workflow_phase_definitions_org_update on public.workflow_phase_definitions;
create policy workflow_phase_definitions_org_update on public.workflow_phase_definitions
  for update
  using (
    exists (
      select 1
      from public.workflow_definitions w
      join public.organization_members m on m.organization_id = w.organization_id
      where w.id = workflow_phase_definitions.workflow_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workflow_definitions w
      join public.organization_members m on m.organization_id = w.organization_id
      where w.id = workflow_phase_definitions.workflow_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists workflow_phase_definitions_org_delete on public.workflow_phase_definitions;
create policy workflow_phase_definitions_org_delete on public.workflow_phase_definitions
  for delete
  using (
    exists (
      select 1
      from public.workflow_definitions w
      join public.organization_members m on m.organization_id = w.organization_id
      where w.id = workflow_phase_definitions.workflow_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists workflow_substage_definitions_org_read on public.workflow_substage_definitions;
create policy workflow_substage_definitions_org_read on public.workflow_substage_definitions
  for select
  using (
    exists (
      select 1
      from public.workflow_phase_definitions p
      join public.workflow_definitions w on w.id = p.workflow_id
      join public.organization_members m on m.organization_id = w.organization_id
      where p.id = workflow_substage_definitions.workflow_phase_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists workflow_substage_definitions_org_insert on public.workflow_substage_definitions;
create policy workflow_substage_definitions_org_insert on public.workflow_substage_definitions
  for insert
  with check (
    exists (
      select 1
      from public.workflow_phase_definitions p
      join public.workflow_definitions w on w.id = p.workflow_id
      join public.organization_members m on m.organization_id = w.organization_id
      where p.id = workflow_substage_definitions.workflow_phase_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists workflow_substage_definitions_org_update on public.workflow_substage_definitions;
create policy workflow_substage_definitions_org_update on public.workflow_substage_definitions
  for update
  using (
    exists (
      select 1
      from public.workflow_phase_definitions p
      join public.workflow_definitions w on w.id = p.workflow_id
      join public.organization_members m on m.organization_id = w.organization_id
      where p.id = workflow_substage_definitions.workflow_phase_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workflow_phase_definitions p
      join public.workflow_definitions w on w.id = p.workflow_id
      join public.organization_members m on m.organization_id = w.organization_id
      where p.id = workflow_substage_definitions.workflow_phase_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists workflow_substage_definitions_org_delete on public.workflow_substage_definitions;
create policy workflow_substage_definitions_org_delete on public.workflow_substage_definitions
  for delete
  using (
    exists (
      select 1
      from public.workflow_phase_definitions p
      join public.workflow_definitions w on w.id = p.workflow_id
      join public.organization_members m on m.organization_id = w.organization_id
      where p.id = workflow_substage_definitions.workflow_phase_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists project_workflow_phase_statuses_org_read on public.project_workflow_phase_statuses;
create policy project_workflow_phase_statuses_org_read on public.project_workflow_phase_statuses
  for select
  using (
    exists (
      select 1
      from public.projects p
      join public.organization_members m on m.organization_id = p.organization_id
      where p.id = project_workflow_phase_statuses.project_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists project_workflow_phase_statuses_org_insert on public.project_workflow_phase_statuses;
drop policy if exists project_workflow_phase_statuses_org_update on public.project_workflow_phase_statuses;
drop policy if exists project_workflow_phase_statuses_org_delete on public.project_workflow_phase_statuses;

drop policy if exists project_workflow_substage_statuses_org_read on public.project_workflow_substage_statuses;
create policy project_workflow_substage_statuses_org_read on public.project_workflow_substage_statuses
  for select
  using (
    exists (
      select 1
      from public.projects p
      join public.organization_members m on m.organization_id = p.organization_id
      where p.id = project_workflow_substage_statuses.project_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists project_workflow_substage_statuses_org_insert on public.project_workflow_substage_statuses;
create policy project_workflow_substage_statuses_org_insert on public.project_workflow_substage_statuses
  for insert
  with check (
    exists (
      select 1
      from public.projects p
      join public.organization_members m on m.organization_id = p.organization_id
      where p.id = project_workflow_substage_statuses.project_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists project_workflow_substage_statuses_org_update on public.project_workflow_substage_statuses;
create policy project_workflow_substage_statuses_org_update on public.project_workflow_substage_statuses
  for update
  using (
    exists (
      select 1
      from public.projects p
      join public.organization_members m on m.organization_id = p.organization_id
      where p.id = project_workflow_substage_statuses.project_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.projects p
      join public.organization_members m on m.organization_id = p.organization_id
      where p.id = project_workflow_substage_statuses.project_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists project_workflow_substage_statuses_org_delete on public.project_workflow_substage_statuses;
create policy project_workflow_substage_statuses_org_delete on public.project_workflow_substage_statuses
  for delete
  using (
    exists (
      select 1
      from public.projects p
      join public.organization_members m on m.organization_id = p.organization_id
      where p.id = project_workflow_substage_statuses.project_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists hole_workflow_phase_statuses_org_read on public.hole_workflow_phase_statuses;
create policy hole_workflow_phase_statuses_org_read on public.hole_workflow_phase_statuses
  for select
  using (
    exists (
      select 1
      from public.holes h
      join public.organization_members m on m.organization_id = h.organization_id
      where h.id = hole_workflow_phase_statuses.hole_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists hole_workflow_phase_statuses_org_insert on public.hole_workflow_phase_statuses;
drop policy if exists hole_workflow_phase_statuses_org_update on public.hole_workflow_phase_statuses;
drop policy if exists hole_workflow_phase_statuses_org_delete on public.hole_workflow_phase_statuses;

drop policy if exists hole_workflow_substage_statuses_org_read on public.hole_workflow_substage_statuses;
create policy hole_workflow_substage_statuses_org_read on public.hole_workflow_substage_statuses
  for select
  using (
    exists (
      select 1
      from public.holes h
      join public.organization_members m on m.organization_id = h.organization_id
      where h.id = hole_workflow_substage_statuses.hole_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists hole_workflow_substage_statuses_org_insert on public.hole_workflow_substage_statuses;
create policy hole_workflow_substage_statuses_org_insert on public.hole_workflow_substage_statuses
  for insert
  with check (
    exists (
      select 1
      from public.holes h
      join public.organization_members m on m.organization_id = h.organization_id
      where h.id = hole_workflow_substage_statuses.hole_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists hole_workflow_substage_statuses_org_update on public.hole_workflow_substage_statuses;
create policy hole_workflow_substage_statuses_org_update on public.hole_workflow_substage_statuses
  for update
  using (
    exists (
      select 1
      from public.holes h
      join public.organization_members m on m.organization_id = h.organization_id
      where h.id = hole_workflow_substage_statuses.hole_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.holes h
      join public.organization_members m on m.organization_id = h.organization_id
      where h.id = hole_workflow_substage_statuses.hole_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists hole_workflow_substage_statuses_org_delete on public.hole_workflow_substage_statuses;
create policy hole_workflow_substage_statuses_org_delete on public.hole_workflow_substage_statuses
  for delete
  using (
    exists (
      select 1
      from public.holes h
      join public.organization_members m on m.organization_id = h.organization_id
      where h.id = hole_workflow_substage_statuses.hole_id
        and m.user_id = auth.uid()
    )
  );