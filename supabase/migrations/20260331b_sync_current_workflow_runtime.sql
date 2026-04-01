create or replace function public.sync_project_current_workflow_runtime()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_substage_count integer := 0;
begin
  if new.current_workflow_id is null or new.current_workflow_phase_id is null then
    return new;
  end if;

  if new.current_workflow_substage_id is not null then
    insert into public.project_workflow_substage_statuses (
      project_id,
      workflow_id,
      workflow_phase_id,
      workflow_substage_id,
      status_key
    )
    values (
      new.id,
      new.current_workflow_id,
      new.current_workflow_phase_id,
      new.current_workflow_substage_id,
      coalesce(new.current_workflow_status_key, 'not_started')
    )
    on conflict (project_id, workflow_substage_id) do update
      set status_key = excluded.status_key,
          workflow_id = excluded.workflow_id,
          workflow_phase_id = excluded.workflow_phase_id,
          updated_at = now();

    return new;
  end if;

  select count(*)::integer
    into v_substage_count
  from public.workflow_substage_definitions s
  where s.workflow_phase_id = new.current_workflow_phase_id;

  if v_substage_count = 0 then
    insert into public.project_workflow_phase_statuses (
      project_id,
      workflow_id,
      workflow_phase_id,
      status_key
    )
    values (
      new.id,
      new.current_workflow_id,
      new.current_workflow_phase_id,
      coalesce(new.current_workflow_status_key, 'not_started')
    )
    on conflict (project_id, workflow_phase_id) do update
      set status_key = excluded.status_key,
          workflow_id = excluded.workflow_id,
          updated_at = now();
  end if;

  return new;
end;
$$;

create or replace function public.sync_hole_current_workflow_runtime()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_substage_count integer := 0;
begin
  if new.current_workflow_id is null or new.current_workflow_phase_id is null then
    return new;
  end if;

  if new.current_workflow_substage_id is not null then
    insert into public.hole_workflow_substage_statuses (
      hole_id,
      workflow_id,
      workflow_phase_id,
      workflow_substage_id,
      status_key
    )
    values (
      new.id,
      new.current_workflow_id,
      new.current_workflow_phase_id,
      new.current_workflow_substage_id,
      coalesce(new.current_workflow_status_key, 'not_started')
    )
    on conflict (hole_id, workflow_substage_id) do update
      set status_key = excluded.status_key,
          workflow_id = excluded.workflow_id,
          workflow_phase_id = excluded.workflow_phase_id,
          updated_at = now();

    return new;
  end if;

  select count(*)::integer
    into v_substage_count
  from public.workflow_substage_definitions s
  where s.workflow_phase_id = new.current_workflow_phase_id;

  if v_substage_count = 0 then
    insert into public.hole_workflow_phase_statuses (
      hole_id,
      workflow_id,
      workflow_phase_id,
      status_key
    )
    values (
      new.id,
      new.current_workflow_id,
      new.current_workflow_phase_id,
      coalesce(new.current_workflow_status_key, 'not_started')
    )
    on conflict (hole_id, workflow_phase_id) do update
      set status_key = excluded.status_key,
          workflow_id = excluded.workflow_id,
          updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_project_current_workflow_runtime on public.projects;
create trigger trg_sync_project_current_workflow_runtime
after insert or update of current_workflow_id, current_workflow_phase_id, current_workflow_substage_id, current_workflow_status_key
on public.projects
for each row
execute function public.sync_project_current_workflow_runtime();

drop trigger if exists trg_sync_hole_current_workflow_runtime on public.holes;
create trigger trg_sync_hole_current_workflow_runtime
after insert or update of current_workflow_id, current_workflow_phase_id, current_workflow_substage_id, current_workflow_status_key
on public.holes
for each row
execute function public.sync_hole_current_workflow_runtime();