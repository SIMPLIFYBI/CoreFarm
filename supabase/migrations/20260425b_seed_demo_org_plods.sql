do $$
declare
  v_demo_org_id constant uuid := 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid;
  v_demo_owner_id uuid;
  v_has_pricing_fn boolean := false;
  v_tax_rate numeric := 10;
begin
  select owner_id
    into v_demo_owner_id
  from public.organizations
  where id = v_demo_org_id;

  if v_demo_owner_id is null then
    raise exception 'Demo organisation % was not found or has no owner_id', v_demo_org_id;
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
      ('GS-RC-RIG-01', 'Primary RC rig for northern and odd-numbered southern fence-line drilling.'),
      ('GS-RC-RIG-02', 'Second RC rig for central and even-numbered southern drilling.'),
      ('GS-HYDRO-RIG-01', 'Hydro rig for monitoring bores and completion work.'),
      ('GS-DD-RIG-01', 'Diamond rig for deep follow-up and structural work.')
  ) as seed(name, description)
  where not exists (
    select 1
    from public.resources existing
    where existing.organization_id = v_demo_org_id
      and existing.name = seed.name
  );

  insert into public.vendors (
    organization_id,
    name,
    contact,
    created_by
  )
  select
    v_demo_org_id,
    seed.name,
    seed.contact,
    v_demo_owner_id
  from (
    values
      ('Outback RC Drilling', 'ops@outbackrc.example'),
      ('AquaWest Hydro', 'dispatch@aquawest.example'),
      ('Kestrel Diamond Drilling', 'fielddesk@kestrel.example')
  ) as seed(name, contact)
  where not exists (
    select 1
    from public.vendors existing
    where existing.organization_id = v_demo_org_id
      and existing.name = seed.name
  );

  create temp table tmp_demo_plod_seed (
    plod_key text primary key,
    shift_date date not null,
    plod_type_code text not null,
    resource_name text,
    vendor_name text,
    hole_code text,
    shift_index integer not null,
    shift_count integer not null,
    start_ts timestamptz not null,
    finish_ts timestamptz not null,
    notes text not null
  ) on commit drop;

  insert into tmp_demo_plod_seed (
    plod_key,
    shift_date,
    plod_type_code,
    resource_name,
    vendor_name,
    hole_code,
    shift_index,
    shift_count,
    start_ts,
    finish_ts,
    notes
  )
  select
    h.hole_id || '-' || to_char(shift_day.shift_date, 'YYYYMMDD') as plod_key,
    shift_day.shift_date,
    'drilling_geology',
    resource.name,
    case
      when resource.name like 'GS-HYDRO-%' then 'AquaWest Hydro'
      when resource.name like 'GS-DD-%' then 'Kestrel Diamond Drilling'
      else 'Outback RC Drilling'
    end as vendor_name,
    h.hole_id,
    ((shift_day.shift_date - assignment.planned_start_date) + 1)::integer as shift_index,
    ((assignment.planned_finish_date - assignment.planned_start_date) + 1)::integer as shift_count,
    (
      shift_day.shift_date::text
      || case when resource.name like 'GS-HYDRO-%' then ' 07:00:00+08' else ' 06:00:00+08' end
    )::timestamptz as start_ts,
    (
      shift_day.shift_date::text
      || case when resource.name like 'GS-HYDRO-%' then ' 17:00:00+08' else ' 18:00:00+08' end
    )::timestamptz as finish_ts,
    format(
      'Seeded demo plod: %s drilling %s on shift %s of %s.',
      resource.name,
      h.hole_id,
      ((shift_day.shift_date - assignment.planned_start_date) + 1)::integer,
      ((assignment.planned_finish_date - assignment.planned_start_date) + 1)::integer
    ) as notes
  from public.hole_schedule_task_assignments assignment
  join public.hole_schedule_tasks schedule_task
    on schedule_task.id = assignment.schedule_task_id
   and schedule_task.task_code = 'drill'
  join public.holes h
    on h.id = assignment.hole_id
   and h.organization_id = v_demo_org_id
   and h.state = 'drilled'
  join public.resources resource
    on resource.id = assignment.resource_id
   and resource.organization_id = v_demo_org_id
  cross join lateral (
    select generate_series(assignment.planned_start_date, assignment.planned_finish_date, interval '1 day')::date as shift_date
  ) shift_day;

  create temp table tmp_demo_activity_seed (
    plod_key text not null,
    activity_type text not null,
    hole_code text,
    activity_start timestamptz not null,
    activity_finish timestamptz not null,
    machine_hours numeric,
    unit_quantity numeric,
    notes text
  ) on commit drop;

  insert into tmp_demo_activity_seed (
    plod_key,
    activity_type,
    hole_code,
    activity_start,
    activity_finish,
    machine_hours,
    unit_quantity,
    notes
  )
  select
    seed.plod_key,
    'drill_rig_operation',
    seed.hole_code,
    seed.start_ts,
    seed.finish_ts,
    case
      when seed.resource_name like 'GS-HYDRO-%' then 9.0::numeric
      when seed.resource_name like 'GS-DD-%' then 11.25::numeric
      else 11.5::numeric
    end,
    null::numeric,
    format('Primary drill shift on %s for hole %s.', seed.resource_name, seed.hole_code)
  from tmp_demo_plod_seed seed

  union all

  select
    seed.plod_key,
    'drill_crew_support',
    seed.hole_code,
    seed.start_ts,
    seed.finish_ts,
    null::numeric,
    null::numeric,
    format('Field crew supported drilling, sampling, and shift changeover on %s.', seed.hole_code)
  from tmp_demo_plod_seed seed

  union all

  select
    seed.plod_key,
    'water_cart_support',
    seed.hole_code,
    seed.start_ts + interval '1 hour',
    case
      when seed.resource_name like 'GS-HYDRO-%' then seed.start_ts + interval '5 hours'
      else seed.start_ts + interval '6 hours'
    end,
    case
      when seed.resource_name like 'GS-HYDRO-%' then 4.0::numeric
      else 5.0::numeric
    end,
    null::numeric,
    format('Water support and dust suppression for %s during active drilling.', seed.hole_code)
  from tmp_demo_plod_seed seed
  where seed.resource_name not like 'GS-DD-%'

  union all

  select
    seed.plod_key,
    'core_processing',
    seed.hole_code,
    seed.start_ts + interval '6 hours',
    seed.finish_ts - interval '1 hour',
    null::numeric,
    null::numeric,
    format('Core trays from %s were processed and prepared for logging.', seed.hole_code)
  from tmp_demo_plod_seed seed
  where seed.resource_name like 'GS-DD-%'

  union all

  select
    seed.plod_key,
    'geologist_logging',
    seed.hole_code,
    seed.finish_ts - interval '4 hours',
    seed.finish_ts - interval '1 hour',
    null::numeric,
    null::numeric,
    format('Geology logging completed for %s on shift %s of %s.', seed.hole_code, seed.shift_index, seed.shift_count)
  from tmp_demo_plod_seed seed

  union all

  select
    seed.plod_key,
    'sample_dispatch',
    seed.hole_code,
    seed.finish_ts - interval '2 hours',
    seed.finish_ts,
    null::numeric,
    null::numeric,
    format('End-of-hole dispatch and reconciliation completed for %s.', seed.hole_code)
  from tmp_demo_plod_seed seed
  where seed.shift_index = seed.shift_count
    and seed.resource_name not like 'GS-DD-%';

  delete from public.plod_pricing_snapshot_lines lines
  using public.plod_pricing_snapshots snapshots, public.plods plods
  where lines.snapshot_id = snapshots.id
    and snapshots.plod_id = plods.id
    and plods.organization_id = v_demo_org_id
    and plods.notes like 'Seeded demo plod:%';

  delete from public.plod_pricing_snapshots snapshots
  using public.plods plods
  where snapshots.plod_id = plods.id
    and plods.organization_id = v_demo_org_id
    and plods.notes like 'Seeded demo plod:%';

  update public.plods
  set pricing_locked_at = null,
      pricing_locked_by = null,
      updated_at = now()
  where organization_id = v_demo_org_id
    and notes like 'Seeded demo plod:%';

  delete from public.plod_activities activities
  using public.plods plods
  where activities.plod_id = plods.id
    and plods.organization_id = v_demo_org_id
    and plods.notes like 'Seeded demo plod:%';

  delete from public.plods
  where organization_id = v_demo_org_id
    and notes like 'Seeded demo plod:%';

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
  select
    v_demo_org_id,
    vendor.id,
    hole.id,
    seed.start_ts,
    seed.finish_ts,
    seed.notes,
    v_demo_owner_id,
    resource.id,
    plod_type.id,
    seed.shift_date
  from tmp_demo_plod_seed seed
  join public.plod_types plod_type
    on plod_type.organization_id = v_demo_org_id
   and plod_type.code = seed.plod_type_code
  left join public.resources resource
    on resource.organization_id = v_demo_org_id
   and resource.name = seed.resource_name
  left join public.vendors vendor
    on vendor.organization_id = v_demo_org_id
   and vendor.name = seed.vendor_name
  left join public.holes hole
    on hole.organization_id = v_demo_org_id
   and hole.hole_id = seed.hole_code;

  create temp table tmp_inserted_demo_plods on commit drop as
  select
    seed.plod_key,
    plod.id as plod_id,
    hole.id as hole_id,
    hole.project_id,
    seed.shift_date,
    seed.notes
  from tmp_demo_plod_seed seed
  join public.plods plod
    on plod.organization_id = v_demo_org_id
   and plod.notes = seed.notes
   and plod.started_at = seed.start_ts
   and plod.finished_at = seed.finish_ts
  left join public.holes hole
    on hole.organization_id = v_demo_org_id
   and hole.hole_id = seed.hole_code;

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
    plod.plod_id,
    activity_type.id,
    hole.id,
    seed.activity_start,
    seed.activity_finish,
    seed.notes,
    seed.machine_hours,
    seed.unit_quantity,
    coalesce(hole.project_id, plod.project_id)
  from tmp_demo_activity_seed seed
  join tmp_inserted_demo_plods plod
    on plod.plod_key = seed.plod_key
  join public.plod_activity_types activity_type
    on activity_type.organization_id = v_demo_org_id
   and activity_type.activity_type = seed.activity_type
  left join public.holes hole
    on hole.organization_id = v_demo_org_id
   and hole.hole_id = seed.hole_code;

  if v_has_pricing_fn then
    for v_demo_owner_id in
      select plod_id
      from tmp_inserted_demo_plods
    loop
      execute 'select public.lock_plod_pricing_snapshot($1, ''nearest''::billing_round_mode, 15)'
        using v_demo_owner_id;
    end loop;
  else
    create temp table tmp_demo_activity_pricing on commit drop as
    with latest_rates as (
      select distinct on (r.plod_activity_type_id)
        r.plod_activity_type_id,
        r.rate,
        r.rate_period,
        r.billable
      from public.plod_activity_type_rates r
      where r.organization_id = v_demo_org_id
        and r.effective_from <= date '2026-04-25'
        and (r.effective_to is null or r.effective_to >= date '2026-04-25')
      order by r.plod_activity_type_id, r.effective_from desc
    )
    select
      activity.id as activity_id,
      activity.plod_id,
      coalesce(latest.rate, activity_type.rate, 0::numeric) as unit_rate,
      coalesce(latest.rate_period, activity_type.rate_period) as rate_period,
      activity_type.rate_mode,
      activity_type.rate_unit_name,
      case
        when activity_type.rate_mode = 'unit' then coalesce(activity.unit_quantity, 1::numeric)
        when coalesce(latest.rate_period, activity_type.rate_period) = 'hourly' then coalesce(activity.machine_hours, ceil((extract(epoch from (activity.finished_at - activity.started_at)) / 900.0)) / 4.0)
        else 1::numeric
      end as quantity
    from public.plod_activities activity
    join public.plod_activity_types activity_type
      on activity_type.id = activity.activity_type_id
    left join latest_rates latest
      on latest.plod_activity_type_id = activity.activity_type_id
    where activity.plod_id in (select plod_id from tmp_inserted_demo_plods);

    create temp table tmp_demo_snapshot_seed on commit drop as
    select
      gen_random_uuid() as snapshot_id,
      plod.id as plod_id,
      plod.organization_id,
      'AUD'::text as currency,
      v_tax_rate as tax_rate,
      'nearest'::billing_round_mode as rounding_mode,
      15 as duration_block_minutes,
      round(sum(pricing.quantity * pricing.unit_rate), 2) as total_ex_tax,
      round(sum(pricing.quantity * pricing.unit_rate) * (v_tax_rate / 100.0), 2) as total_tax,
      round(sum(pricing.quantity * pricing.unit_rate) * (1 + (v_tax_rate / 100.0)), 2) as total_inc_tax,
      1 as calc_version,
      now() as locked_at,
      v_demo_owner_id as locked_by,
      now() as created_at
    from public.plods plod
    join tmp_demo_activity_pricing pricing
      on pricing.plod_id = plod.id
    group by plod.id, plod.organization_id;

    insert into public.plod_pricing_snapshots (
      id,
      plod_id,
      organization_id,
      currency,
      tax_rate,
      rounding_mode,
      duration_block_minutes,
      total_ex_tax,
      total_tax,
      total_inc_tax,
      calc_version,
      locked_at,
      locked_by,
      created_at
    )
    select
      snapshot_id,
      plod_id,
      organization_id,
      currency,
      tax_rate,
      rounding_mode,
      duration_block_minutes,
      total_ex_tax,
      total_tax,
      total_inc_tax,
      calc_version,
      locked_at,
      locked_by,
      created_at
    from tmp_demo_snapshot_seed;

    insert into public.plod_pricing_snapshot_lines (
      snapshot_id,
      line_kind,
      source_table,
      source_id,
      description,
      quantity,
      unit,
      unit_rate,
      rate_period,
      line_ex_tax,
      line_tax,
      line_inc_tax,
      meta,
      created_at
    )
    select
      snapshot.snapshot_id,
      'activity',
      'plod_activities',
      activity.id,
      coalesce(activity_type.label, activity_type.activity_type),
      pricing.quantity,
      case
        when activity_type.rate_mode = 'unit' then coalesce(activity_type.rate_unit_name, 'unit')
        when pricing.rate_period = 'hourly' then 'hour'
        when pricing.rate_period = 'daily' then 'day'
        when pricing.rate_period = 'weekly' then 'week'
        else coalesce(activity_type.rate_unit_name, 'unit')
      end,
      pricing.unit_rate,
      pricing.rate_period,
      round(pricing.quantity * pricing.unit_rate, 2),
      round((pricing.quantity * pricing.unit_rate) * (v_tax_rate / 100.0), 2),
      round((pricing.quantity * pricing.unit_rate) * (1 + (v_tax_rate / 100.0)), 2),
      jsonb_build_object('seeded', true, 'rate_mode', activity_type.rate_mode),
      now()
    from public.plod_activities activity
    join tmp_demo_activity_pricing pricing
      on pricing.activity_id = activity.id
    join tmp_demo_snapshot_seed snapshot
      on snapshot.plod_id = activity.plod_id
    join public.plod_activity_types activity_type
      on activity_type.id = activity.activity_type_id;
  end if;
end;
$$;