create table if not exists public.workflow_definitions (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null,
  entity_type text not null,
  key text not null,
  name text not null,
  description text,
  color text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint workflow_definitions_pkey primary key (id),
  constraint workflow_definitions_organization_id_fkey foreign key (organization_id) references public.organizations(id),
  constraint workflow_definitions_created_by_fkey foreign key (created_by) references auth.users(id),
  constraint workflow_definitions_entity_type_check check (entity_type = any (array['hole'::text, 'project'::text])),
  constraint workflow_definitions_key_present_check check (btrim(key) <> ''),
  constraint workflow_definitions_name_present_check check (btrim(name) <> ''),
  constraint workflow_definitions_org_entity_key_key unique (organization_id, entity_type, key)
);

create index if not exists workflow_definitions_org_entity_sort_idx
  on public.workflow_definitions (organization_id, entity_type, is_active, sort_order, name);

create table if not exists public.workflow_stages (
  id uuid not null default gen_random_uuid(),
  workflow_id uuid not null,
  key text not null,
  name text not null,
  description text,
  color text,
  sort_order integer not null default 0,
  is_terminal boolean not null default false,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint workflow_stages_pkey primary key (id),
  constraint workflow_stages_workflow_id_fkey foreign key (workflow_id) references public.workflow_definitions(id) on delete cascade,
  constraint workflow_stages_key_present_check check (btrim(key) <> ''),
  constraint workflow_stages_name_present_check check (btrim(name) <> ''),
  constraint workflow_stages_workflow_key_key unique (workflow_id, key)
);

create index if not exists workflow_stages_workflow_sort_idx
  on public.workflow_stages (workflow_id, is_active, sort_order, name);

alter table public.projects
  add column if not exists current_workflow_id uuid,
  add column if not exists current_workflow_stage_id uuid;

alter table public.holes
  add column if not exists current_workflow_id uuid,
  add column if not exists current_workflow_stage_id uuid;

alter table public.projects
  drop constraint if exists projects_current_workflow_id_fkey;

alter table public.projects
  add constraint projects_current_workflow_id_fkey
  foreign key (current_workflow_id) references public.workflow_definitions(id);

alter table public.projects
  drop constraint if exists projects_current_workflow_stage_id_fkey;

alter table public.projects
  add constraint projects_current_workflow_stage_id_fkey
  foreign key (current_workflow_stage_id) references public.workflow_stages(id);

alter table public.holes
  drop constraint if exists holes_current_workflow_id_fkey;

alter table public.holes
  add constraint holes_current_workflow_id_fkey
  foreign key (current_workflow_id) references public.workflow_definitions(id);

alter table public.holes
  drop constraint if exists holes_current_workflow_stage_id_fkey;

alter table public.holes
  add constraint holes_current_workflow_stage_id_fkey
  foreign key (current_workflow_stage_id) references public.workflow_stages(id);

create index if not exists projects_current_workflow_id_idx
  on public.projects (current_workflow_id);

create index if not exists projects_current_workflow_stage_id_idx
  on public.projects (current_workflow_stage_id);

create index if not exists holes_current_workflow_id_idx
  on public.holes (current_workflow_id);

create index if not exists holes_current_workflow_stage_id_idx
  on public.holes (current_workflow_stage_id);

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
  v_workflow_org_id uuid;
  v_workflow_entity_type text;
  v_workflow_active boolean;
  v_stage_workflow_id uuid;
  v_stage_active boolean;
begin
  if new.organization_id is null then
    return new;
  end if;

  if v_workflow_id is null and v_stage_id is null then
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

  if v_stage_id is null then
    select s.id
      into v_stage_id
    from public.workflow_stages s
    where s.workflow_id = v_workflow_id
      and s.is_active = true
    order by s.sort_order asc, s.name asc
    limit 1;

    if v_stage_id is null then
      raise exception 'Workflow % has no active stages', v_workflow_id using errcode = '23514';
    end if;
  end if;

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

  new.current_workflow_id := v_workflow_id;
  new.current_workflow_stage_id := v_stage_id;
  return new;
end;
$$;

drop trigger if exists trg_validate_projects_workflow_assignment on public.projects;
create trigger trg_validate_projects_workflow_assignment
before insert or update of organization_id, current_workflow_id, current_workflow_stage_id
on public.projects
for each row
execute function public.validate_entity_workflow_assignment('project');

drop trigger if exists trg_validate_holes_workflow_assignment on public.holes;
create trigger trg_validate_holes_workflow_assignment
before insert or update of organization_id, current_workflow_id, current_workflow_stage_id
on public.holes
for each row
execute function public.validate_entity_workflow_assignment('hole');

alter table public.workflow_definitions enable row level security;
alter table public.workflow_stages enable row level security;

drop policy if exists workflow_definitions_org_read on public.workflow_definitions;
create policy workflow_definitions_org_read on public.workflow_definitions
  for select
  using (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = workflow_definitions.organization_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists workflow_definitions_org_insert on public.workflow_definitions;
create policy workflow_definitions_org_insert on public.workflow_definitions
  for insert
  with check (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = workflow_definitions.organization_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists workflow_definitions_org_update on public.workflow_definitions;
create policy workflow_definitions_org_update on public.workflow_definitions
  for update
  using (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = workflow_definitions.organization_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = workflow_definitions.organization_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists workflow_definitions_org_delete on public.workflow_definitions;
create policy workflow_definitions_org_delete on public.workflow_definitions
  for delete
  using (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = workflow_definitions.organization_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists workflow_stages_org_read on public.workflow_stages;
create policy workflow_stages_org_read on public.workflow_stages
  for select
  using (
    exists (
      select 1
      from public.workflow_definitions w
      join public.organization_members m
        on m.organization_id = w.organization_id
      where w.id = workflow_stages.workflow_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists workflow_stages_org_insert on public.workflow_stages;
create policy workflow_stages_org_insert on public.workflow_stages
  for insert
  with check (
    exists (
      select 1
      from public.workflow_definitions w
      join public.organization_members m
        on m.organization_id = w.organization_id
      where w.id = workflow_stages.workflow_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists workflow_stages_org_update on public.workflow_stages;
create policy workflow_stages_org_update on public.workflow_stages
  for update
  using (
    exists (
      select 1
      from public.workflow_definitions w
      join public.organization_members m
        on m.organization_id = w.organization_id
      where w.id = workflow_stages.workflow_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workflow_definitions w
      join public.organization_members m
        on m.organization_id = w.organization_id
      where w.id = workflow_stages.workflow_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists workflow_stages_org_delete on public.workflow_stages;
create policy workflow_stages_org_delete on public.workflow_stages
  for delete
  using (
    exists (
      select 1
      from public.workflow_definitions w
      join public.organization_members m
        on m.organization_id = w.organization_id
      where w.id = workflow_stages.workflow_id
        and m.user_id = auth.uid()
    )
  );