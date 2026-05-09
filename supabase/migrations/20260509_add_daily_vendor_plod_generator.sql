create table if not exists public.synthetic_daily_plod_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shift_date date not null,
  vendor_name text not null,
  plod_id uuid references public.plods(id) on delete set null,
  hole_id uuid references public.holes(id) on delete set null,
  drilled_meters numeric,
  created_at timestamp with time zone not null default now(),
  constraint synthetic_daily_plod_runs_org_date_vendor_key unique (organization_id, shift_date, vendor_name)
);

create index if not exists synthetic_daily_plod_runs_org_date_idx
  on public.synthetic_daily_plod_runs (organization_id, shift_date desc);

create or replace function public.ensure_daily_synthetic_plod_activity_types(
  p_org_id uuid,
  p_created_by uuid default null
)
returns void
language plpgsql
as $$
declare
  v_created_by uuid;
begin
  select coalesce(p_created_by, owner_id)
    into v_created_by
  from public.organizations
  where id = p_org_id;

  if v_created_by is null then
    raise exception 'Organisation % was not found or has no owner_id', p_org_id;
  end if;

  insert into public.plod_activity_types (
    organization_id,
    activity_type,
    description,
    created_by,
    "group",
    label,
    plod_type_scope,
    billable,
    rate,
    rate_period,
    rate_mode,
    rate_unit_name,
    rate_unit_interval
  )
  select
    p_org_id,
    seed.activity_type,
    seed.description,
    v_created_by,
    seed.group_name,
    seed.label,
    seed.plod_type_scope,
    seed.billable,
    seed.rate,
    seed.rate_period,
    seed.rate_mode,
    seed.rate_unit_name,
    seed.rate_unit_interval
  from (
    values
      (
        'rc_meters_drilled',
        'RC Metres Drilled',
        'Drilling',
        'Meter-based drilling quantity for rotary/RC shifts.',
        '{drilling_geology}'::text[],
        true,
        94::numeric,
        null::text,
        'unit'::text,
        'm'::text,
        1::numeric
      ),
      (
        'diamond_meters_drilled',
        'Diamond Metres Drilled',
        'Drilling',
        'Meter-based drilling quantity for diamond drilling shifts.',
        '{drilling_geology}'::text[],
        true,
        335::numeric,
        null::text,
        'unit'::text,
        'm'::text,
        1::numeric
      ),
      (
        'hydro_meters_drilled',
        'Hydro Metres Drilled',
        'Drilling',
        'Meter-based drilling quantity for hydro drilling shifts.',
        '{drilling_geology}'::text[],
        true,
        148::numeric,
        null::text,
        'unit'::text,
        'm'::text,
        1::numeric
      ),
      (
        'setup_drilling',
        'Setup Drilling',
        'Drilling',
        'Shift setup, safety checks, and drill setup before active drilling starts.',
        '{drilling_geology}'::text[],
        true,
        220::numeric,
        'hourly'::text,
        'time'::text,
        null::text,
        null::numeric
      ),
      (
        'bit_change',
        'Bit Change',
        'Drilling',
        'Consumable drill bit change during the shift.',
        '{drilling_geology}'::text[],
        true,
        285::numeric,
        null::text,
        'unit'::text,
        'change'::text,
        1::numeric
      )
  ) as seed(activity_type, label, group_name, description, plod_type_scope, billable, rate, rate_period, rate_mode, rate_unit_name, rate_unit_interval)
  where not exists (
    select 1
    from public.plod_activity_types existing
    where existing.organization_id = p_org_id
      and existing.activity_type = seed.activity_type
  );

  update public.plod_activity_types existing
  set description = seed.description,
      "group" = seed.group_name,
      label = seed.label,
      plod_type_scope = seed.plod_type_scope,
      billable = seed.billable,
      rate = seed.rate,
      rate_period = seed.rate_period,
      rate_mode = seed.rate_mode,
      rate_unit_name = seed.rate_unit_name,
      rate_unit_interval = seed.rate_unit_interval
  from (
    values
      (
        'rc_meters_drilled',
        'RC Metres Drilled',
        'Drilling',
        'Meter-based drilling quantity for rotary/RC shifts.',
        '{drilling_geology}'::text[],
        true,
        94::numeric,
        null::text,
        'unit'::text,
        'm'::text,
        1::numeric
      ),
      (
        'diamond_meters_drilled',
        'Diamond Metres Drilled',
        'Drilling',
        'Meter-based drilling quantity for diamond drilling shifts.',
        '{drilling_geology}'::text[],
        true,
        335::numeric,
        null::text,
        'unit'::text,
        'm'::text,
        1::numeric
      ),
      (
        'hydro_meters_drilled',
        'Hydro Metres Drilled',
        'Drilling',
        'Meter-based drilling quantity for hydro drilling shifts.',
        '{drilling_geology}'::text[],
        true,
        148::numeric,
        null::text,
        'unit'::text,
        'm'::text,
        1::numeric
      ),
      (
        'setup_drilling',
        'Setup Drilling',
        'Drilling',
        'Shift setup, safety checks, and drill setup before active drilling starts.',
        '{drilling_geology}'::text[],
        true,
        220::numeric,
        'hourly'::text,
        'time'::text,
        null::text,
        null::numeric
      ),
      (
        'bit_change',
        'Bit Change',
        'Drilling',
        'Consumable drill bit change during the shift.',
        '{drilling_geology}'::text[],
        true,
        285::numeric,
        null::text,
        'unit'::text,
        'change'::text,
        1::numeric
      )
  ) as seed(activity_type, label, group_name, description, plod_type_scope, billable, rate, rate_period, rate_mode, rate_unit_name, rate_unit_interval)
  where existing.organization_id = p_org_id
    and existing.activity_type = seed.activity_type;
end;
$$;

create or replace function public.generate_daily_vendor_plods(
  p_org_id uuid,
  p_shift_date date default current_date
)
returns table (
  vendor_name text,
  plod_id uuid,
  hole_id uuid,
  drilled_meters numeric,
  status text
)
language plpgsql
as $$
declare
  v_owner_id uuid;
  v_plod_type_id uuid;
  v_has_pricing_fn boolean := false;
  v_vendor record;
  v_vendor_id uuid;
  v_candidate record;
  v_created_plod_id uuid;
  v_drilled_meters numeric;
  v_shift_start timestamptz;
  v_shift_finish timestamptz;
  v_first_vendor_day boolean;
  v_include_dispatch boolean;
begin
  select owner_id
    into v_owner_id
  from public.organizations
  where id = p_org_id;

  if v_owner_id is null then
    raise exception 'Organisation % was not found or has no owner_id', p_org_id;
  end if;

  select exists (
    select 1
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'lock_plod_pricing_snapshot'
  )
    into v_has_pricing_fn;

  select id
    into v_plod_type_id
  from public.plod_types
  where organization_id = p_org_id
    and is_active = true
    and (
      code = 'drilling_geology'
      or lower(name) = 'drilling geology'
    )
  order by case when code = 'drilling_geology' then 0 else 1 end, sort_order, name
  limit 1;

  if v_plod_type_id is null then
    raise exception 'Organisation % does not have an active drilling geology PLOD type', p_org_id;
  end if;

  perform public.ensure_daily_synthetic_plod_activity_types(p_org_id, v_owner_id);

  for v_vendor in
    select *
    from (
      values
        ('Outback RC Drilling', 'GS-RC-%', 'rc_meters_drilled', '06:00:00', '18:00:00', 60::numeric, 120::numeric, 0),
        ('Kestrel Diamond Drilling', 'GS-DD-%', 'diamond_meters_drilled', '06:00:00', '18:00:00', 6::numeric, 20::numeric, 1),
        ('AquaWest Hydro', 'GS-HYDRO-%', 'hydro_meters_drilled', '07:00:00', '17:00:00', 4::numeric, 18::numeric, 1)
    ) as seed(vendor_name, resource_pattern, meter_activity_type, shift_start_time, shift_finish_time, meter_min, meter_max, meter_precision)
  loop
    if exists (
      select 1
      from public.synthetic_daily_plod_runs existing_run
      where existing_run.organization_id = p_org_id
        and existing_run.shift_date = p_shift_date
        and existing_run.vendor_name = v_vendor.vendor_name
    ) then
      vendor_name := v_vendor.vendor_name;
      plod_id := null;
      hole_id := null;
      drilled_meters := null;
      status := 'skipped_existing';
      return next;
      continue;
    end if;

    select id
      into v_vendor_id
    from public.vendors
    where organization_id = p_org_id
      and name = v_vendor.vendor_name
    limit 1;

    if v_vendor_id is null then
      vendor_name := v_vendor.vendor_name;
      plod_id := null;
      hole_id := null;
      drilled_meters := null;
      status := 'skipped_missing_vendor';
      return next;
      continue;
    end if;

    select
      assignment.resource_id,
      resource.name as resource_name,
      hole.id as hole_id,
      hole.project_id,
      hole.hole_id as hole_code
      into v_candidate
    from public.hole_schedule_task_assignments assignment
    join public.hole_schedule_tasks schedule_task
      on schedule_task.id = assignment.schedule_task_id
     and schedule_task.organization_id = p_org_id
     and schedule_task.task_code = 'drill'
    join public.holes hole
      on hole.id = assignment.hole_id
     and hole.organization_id = p_org_id
     and hole.project_id is not null
    join public.resources resource
      on resource.id = assignment.resource_id
     and resource.organization_id = p_org_id
    where assignment.organization_id = p_org_id
      and p_shift_date between assignment.planned_start_date and assignment.planned_finish_date
      and resource.name like v_vendor.resource_pattern
    order by assignment.planned_start_date, assignment.lane_rank nulls first, hole.hole_id
    limit 1;

    if v_candidate.hole_id is null then
      vendor_name := v_vendor.vendor_name;
      plod_id := null;
      hole_id := null;
      drilled_meters := null;
      status := 'skipped_no_scheduled_hole';
      return next;
      continue;
    end if;

    v_shift_start := (p_shift_date::text || ' ' || v_vendor.shift_start_time || '+08')::timestamptz;
    v_shift_finish := (p_shift_date::text || ' ' || v_vendor.shift_finish_time || '+08')::timestamptz;

    v_drilled_meters := case
      when v_vendor.meter_precision = 0 then floor(v_vendor.meter_min + random() * ((v_vendor.meter_max - v_vendor.meter_min) + 1))::numeric
      else round((v_vendor.meter_min + random() * (v_vendor.meter_max - v_vendor.meter_min))::numeric, v_vendor.meter_precision)
    end;

    v_first_vendor_day := not exists (
      select 1
      from public.synthetic_daily_plod_runs prior_run
      where prior_run.organization_id = p_org_id
        and prior_run.vendor_name = v_vendor.vendor_name
        and prior_run.shift_date < p_shift_date
    );

    v_include_dispatch := random() < 0.35;

    insert into public.plods (
      organization_id,
      vendor_id,
      hole_id,
      started_at,
      finished_at,
      notes,
      created_by,
      resource_id,
      plod_type_id,
      shift_date
    )
    values (
      p_org_id,
      v_vendor_id,
      v_candidate.hole_id,
      v_shift_start,
      v_shift_finish,
      format(
        'AUTO DAILY PLOD | date=%s | vendor=%s | hole=%s | meters=%s',
        p_shift_date,
        v_vendor.vendor_name,
        v_candidate.hole_code,
        v_drilled_meters
      ),
      v_owner_id,
      v_candidate.resource_id,
      v_plod_type_id,
      p_shift_date
    )
    returning id into v_created_plod_id;

    if v_first_vendor_day then
      insert into public.plod_activities (
        plod_id,
        activity_type_id,
        hole_id,
        started_at,
        finished_at,
        notes,
        machine_hours,
        unit_quantity,
        project_id
      )
      select
        v_created_plod_id,
        activity_type.id,
        v_candidate.hole_id,
        v_shift_start,
        v_shift_start + interval '1 hour',
        format('Initial mobilisation and site readiness for %s.', v_candidate.hole_code),
        1::numeric,
        null::numeric,
        v_candidate.project_id
      from public.plod_activity_types activity_type
      where activity_type.organization_id = p_org_id
        and activity_type.activity_type = 'rig_mobilisation';
    end if;

    if v_vendor.vendor_name = 'Outback RC Drilling' then
      insert into public.plod_activities (
        plod_id,
        activity_type_id,
        hole_id,
        started_at,
        finished_at,
        notes,
        machine_hours,
        unit_quantity,
        project_id
      )
      select
        v_created_plod_id,
        activity_type.id,
        v_candidate.hole_id,
        seed.activity_start,
        seed.activity_finish,
        seed.notes,
        seed.machine_hours,
        seed.unit_quantity,
        v_candidate.project_id
      from (
        values
          ('setup_drilling', v_shift_start, v_shift_start + interval '1 hour', 'Daily pre-start, safety, and setup complete.', 1::numeric, null::numeric),
          ('drill_rig_operation', v_shift_start + interval '1 hour', v_shift_finish - interval '1 hour', format('RC drilling progressed on %s.', v_candidate.hole_code), 10::numeric, null::numeric),
          (v_vendor.meter_activity_type, v_shift_start + interval '1 hour', v_shift_finish - interval '1 hour', format('Outback RC advanced %s m on %s.', v_drilled_meters, v_candidate.hole_code), null::numeric, v_drilled_meters),
          ('water_cart_support', v_shift_start + interval '2 hour', v_shift_start + interval '8 hour', format('Water cart and dust suppression supported %s.', v_candidate.hole_code), 6::numeric, null::numeric),
          ('geologist_logging', v_shift_finish - interval '3 hour', v_shift_finish, format('Geology logging and shift reconciliation completed for %s.', v_candidate.hole_code), 3::numeric, null::numeric)
      ) as seed(activity_type, activity_start, activity_finish, notes, machine_hours, unit_quantity)
      join public.plod_activity_types activity_type
        on activity_type.organization_id = p_org_id
       and activity_type.activity_type = seed.activity_type;

      if v_include_dispatch then
        insert into public.plod_activities (
          plod_id,
          activity_type_id,
          hole_id,
          started_at,
          finished_at,
          notes,
          project_id
        )
        select
          v_created_plod_id,
          activity_type.id,
          v_candidate.hole_id,
          v_shift_finish - interval '2 hour',
          v_shift_finish - interval '30 minute',
          format('Samples from %s were prepared and dispatched at end of shift.', v_candidate.hole_code),
          v_candidate.project_id
        from public.plod_activity_types activity_type
        where activity_type.organization_id = p_org_id
          and activity_type.activity_type = 'sample_dispatch';
      end if;
    elsif v_vendor.vendor_name = 'Kestrel Diamond Drilling' then
      insert into public.plod_activities (
        plod_id,
        activity_type_id,
        hole_id,
        started_at,
        finished_at,
        notes,
        machine_hours,
        unit_quantity,
        project_id
      )
      select
        v_created_plod_id,
        activity_type.id,
        v_candidate.hole_id,
        seed.activity_start,
        seed.activity_finish,
        seed.notes,
        seed.machine_hours,
        seed.unit_quantity,
        v_candidate.project_id
      from (
        values
          ('setup_drilling', v_shift_start, v_shift_start + interval '1 hour', 'Diamond rig setup, line-up, and pre-start completed.', 1::numeric, null::numeric),
          ('drill_rig_operation', v_shift_start + interval '1 hour', v_shift_finish, format('Diamond drilling progressed on %s.', v_candidate.hole_code), 11::numeric, null::numeric),
          (v_vendor.meter_activity_type, v_shift_start + interval '1 hour', v_shift_finish, format('Kestrel advanced %s m on %s.', v_drilled_meters, v_candidate.hole_code), null::numeric, v_drilled_meters),
          ('core_processing', v_shift_start + interval '6 hour', v_shift_finish - interval '1 hour', format('Core handling and tray prep completed for %s.', v_candidate.hole_code), 5::numeric, null::numeric),
          ('geologist_logging', v_shift_finish - interval '3 hour', v_shift_finish, format('Logging and structural observations captured for %s.', v_candidate.hole_code), 3::numeric, null::numeric),
          ('bit_change', v_shift_start + interval '5 hour', v_shift_start + interval '5 hour 30 minute', format('Consumables changed during the Kestrel shift on %s.', v_candidate.hole_code), null::numeric, 1::numeric)
      ) as seed(activity_type, activity_start, activity_finish, notes, machine_hours, unit_quantity)
      join public.plod_activity_types activity_type
        on activity_type.organization_id = p_org_id
       and activity_type.activity_type = seed.activity_type;
    else
      insert into public.plod_activities (
        plod_id,
        activity_type_id,
        hole_id,
        started_at,
        finished_at,
        notes,
        machine_hours,
        unit_quantity,
        project_id
      )
      select
        v_created_plod_id,
        activity_type.id,
        v_candidate.hole_id,
        seed.activity_start,
        seed.activity_finish,
        seed.notes,
        seed.machine_hours,
        seed.unit_quantity,
        v_candidate.project_id
      from (
        values
          ('setup_drilling', v_shift_start, v_shift_start + interval '1 hour', 'Hydro rig setup and access checks completed.', 1::numeric, null::numeric),
          ('drill_rig_operation', v_shift_start + interval '1 hour', v_shift_finish, format('Hydro drilling progressed on %s.', v_candidate.hole_code), 9::numeric, null::numeric),
          (v_vendor.meter_activity_type, v_shift_start + interval '1 hour', v_shift_finish, format('AquaWest advanced %s m on %s.', v_drilled_meters, v_candidate.hole_code), null::numeric, v_drilled_meters),
          ('water_cart_support', v_shift_start + interval '2 hour', v_shift_start + interval '6 hour', format('Water management supported hydro operations on %s.', v_candidate.hole_code), 4::numeric, null::numeric),
          ('geologist_logging', v_shift_finish - interval '2 hour', v_shift_finish, format('Hydro logging and reconciliation completed for %s.', v_candidate.hole_code), 2::numeric, null::numeric)
      ) as seed(activity_type, activity_start, activity_finish, notes, machine_hours, unit_quantity)
      join public.plod_activity_types activity_type
        on activity_type.organization_id = p_org_id
       and activity_type.activity_type = seed.activity_type;
    end if;

    insert into public.synthetic_daily_plod_runs (
      organization_id,
      shift_date,
      vendor_name,
      plod_id,
      hole_id,
      drilled_meters
    )
    values (
      p_org_id,
      p_shift_date,
      v_vendor.vendor_name,
      v_created_plod_id,
      v_candidate.hole_id,
      v_drilled_meters
    );

    if v_has_pricing_fn then
      begin
        perform public.lock_plod_pricing_snapshot(v_created_plod_id, 'nearest'::billing_round_mode, 15);
      exception
        when others then
          raise notice 'Failed to lock pricing snapshot for plod %: %', v_created_plod_id, sqlerrm;
      end;
    end if;

    vendor_name := v_vendor.vendor_name;
    plod_id := v_created_plod_id;
    hole_id := v_candidate.hole_id;
    drilled_meters := v_drilled_meters;
    status := 'created';
    return next;
  end loop;
end;
$$;