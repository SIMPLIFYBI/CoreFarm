do $$
declare
  v_demo_org_id constant uuid := 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid;
  v_demo_owner_id uuid;
begin
  select owner_id
    into v_demo_owner_id
  from public.organizations
  where id = v_demo_org_id;

  if v_demo_owner_id is null then
    raise exception 'Demo organisation % was not found or has no owner_id', v_demo_org_id;
  end if;

  insert into public.hole_task_types (
    organization_id,
    key,
    name,
    description,
    color,
    sort_order,
    is_active,
    created_by
  )
  values
    (v_demo_org_id, 'orientation', 'Orientation', 'Mark and validate core orientation lines before detailed logging.', '#38bdf8', 10, true, v_demo_owner_id),
    (v_demo_org_id, 'magnetic_susceptibility', 'Magnetic Susceptibility', 'Collect meter-based magnetic susceptibility readings through competent core.', '#8b5cf6', 20, true, v_demo_owner_id),
    (v_demo_org_id, 'whole_core_sampling', 'Whole Core Sampling', 'Select and dispatch intact core intervals for metallurgical and geochemical work.', '#22c55e', 30, true, v_demo_owner_id),
    (v_demo_org_id, 'cutting', 'Cutting', 'Cut and tray core to prepare sampling intervals and archive halves.', '#f97316', 40, true, v_demo_owner_id),
    (v_demo_org_id, 'rqd', 'RQD', 'Log recovery and RQD across all recovered core runs.', '#f59e0b', 50, true, v_demo_owner_id),
    (v_demo_org_id, 'specific_gravity', 'Specific Gravity', 'Collect SG determinations across selected fresh rock intervals.', '#14b8a6', 60, true, v_demo_owner_id),
    (v_demo_org_id, 'dry_photography', 'Dry Photography', 'Capture dry tray photography after reconstruction and metre marking.', '#facc15', 70, true, v_demo_owner_id),
    (v_demo_org_id, 'wet_photography', 'Wet Photography', 'Capture wet photography before cutting and sampling.', '#0ea5e9', 80, true, v_demo_owner_id),
    (v_demo_org_id, 'geotechnical_logging', 'Geotechnical Logging', 'Record geotechnical defects, weathering, fracture frequency, and recovery notes.', '#a78bfa', 90, true, v_demo_owner_id),
    (v_demo_org_id, 'structural_logging', 'Structural Logging', 'Capture alpha-beta structure measurements and alteration intensity across oriented core.', '#ef4444', 100, true, v_demo_owner_id)
  on conflict (organization_id, key) do update
    set name = excluded.name,
        description = excluded.description,
        color = excluded.color,
        sort_order = excluded.sort_order,
        is_active = excluded.is_active,
        created_by = excluded.created_by,
        updated_at = now();

  delete from public.hole_task_progress
  where hole_id in (
      select h.id
      from public.holes h
      where h.organization_id = v_demo_org_id
        and h.hole_id like 'GSDD%'
    )
    and task_type in (
      'orientation',
      'magnetic_susceptibility',
      'whole_core_sampling',
      'cutting',
      'rqd',
      'specific_gravity',
      'dry_photography',
      'wet_photography',
      'geotechnical_logging',
      'structural_logging'
    );

  delete from public.hole_task_intervals
  where hole_id in (
      select h.id
      from public.holes h
      where h.organization_id = v_demo_org_id
        and h.hole_id like 'GSDD%'
    )
    and task_type in (
      'orientation',
      'magnetic_susceptibility',
      'whole_core_sampling',
      'cutting',
      'rqd',
      'specific_gravity',
      'dry_photography',
      'wet_photography',
      'geotechnical_logging',
      'structural_logging'
    );

  with diamond_holes as (
    select
      h.id,
      h.hole_id,
      right(h.hole_id, 3)::integer as seq,
      coalesce(h.depth, h.planned_depth)::numeric as effective_depth_m,
      h.depth::numeric as actual_depth_m,
      coalesce(h.completed_at::date, h.started_at::date, current_date) as activity_date
    from public.holes h
    where h.organization_id = v_demo_org_id
      and h.hole_id like 'GSDD%'
      and coalesce(h.depth, h.planned_depth) is not null
  )
  insert into public.hole_task_intervals (
    hole_id,
    task_type,
    from_m,
    to_m,
    task_type_id
  )
  select
    dh.id,
    planned.task_type,
    planned.from_m,
    planned.to_m,
    task_type.id
  from diamond_holes dh
  cross join lateral (
    select
      dh.effective_depth_m as end_m,
      greatest(24::numeric, round(dh.effective_depth_m * 0.08, 1)) as orientation_from_m,
      greatest(18::numeric, round(dh.effective_depth_m * 0.06, 1)) as ms_from_m,
      greatest(38::numeric, round(dh.effective_depth_m * 0.10, 1)) as structural_from_m,
      greatest(145::numeric, round(dh.effective_depth_m * 0.44, 1)) as sample_from_m,
      least(dh.effective_depth_m - 42, greatest(225::numeric, round(dh.effective_depth_m * 0.68, 1))) as sample_to_m,
      greatest(175::numeric, round(dh.effective_depth_m * 0.56, 1)) as sg_from_m,
      least(dh.effective_depth_m - 18, greatest(245::numeric, round(dh.effective_depth_m * 0.78, 1))) as sg_to_m
  ) bounds
  cross join lateral (
    values
      ('dry_photography', 0::numeric, bounds.end_m),
      ('wet_photography', 0::numeric, bounds.end_m),
      ('rqd', 0::numeric, bounds.end_m),
      ('geotechnical_logging', 0::numeric, bounds.end_m),
      ('cutting', 0::numeric, bounds.end_m),
      ('magnetic_susceptibility', bounds.ms_from_m, bounds.end_m),
      ('orientation', bounds.orientation_from_m, bounds.end_m),
      ('structural_logging', bounds.structural_from_m, bounds.end_m),
      ('whole_core_sampling', bounds.sample_from_m, bounds.sample_to_m),
      ('specific_gravity', bounds.sg_from_m, bounds.sg_to_m)
  ) as planned(task_type, from_m, to_m)
  join public.hole_task_types task_type
    on task_type.organization_id = v_demo_org_id
   and task_type.key = planned.task_type
  where planned.from_m < planned.to_m;

  with diamond_holes as (
    select
      h.id,
      h.hole_id,
      right(h.hole_id, 3)::integer as seq,
      h.depth::numeric as actual_depth_m,
      coalesce(h.completed_at::date, h.started_at::date, current_date) as activity_date
    from public.holes h
    where h.organization_id = v_demo_org_id
      and h.hole_id like 'GSDD%'
      and h.depth is not null
  )
  insert into public.hole_task_progress (
    hole_id,
    task_type,
    from_m,
    to_m,
    user_id,
    logged_on,
    task_type_id
  )
  select
    dh.id,
    progress.task_type,
    progress.from_m,
    progress.to_m,
    v_demo_owner_id,
    progress.logged_on,
    task_type.id
  from diamond_holes dh
  cross join lateral (
    select
      dh.actual_depth_m as end_m,
      greatest(24::numeric, round(dh.actual_depth_m * 0.08, 1)) as orientation_from_m,
      greatest(18::numeric, round(dh.actual_depth_m * 0.06, 1)) as ms_from_m,
      greatest(38::numeric, round(dh.actual_depth_m * 0.10, 1)) as structural_from_m,
      greatest(145::numeric, round(dh.actual_depth_m * 0.44, 1)) as sample_from_m,
      least(dh.actual_depth_m - 42, greatest(225::numeric, round(dh.actual_depth_m * 0.68, 1))) as sample_to_m,
      greatest(175::numeric, round(dh.actual_depth_m * 0.56, 1)) as sg_from_m,
      least(dh.actual_depth_m - 18, greatest(245::numeric, round(dh.actual_depth_m * 0.78, 1))) as sg_to_m
  ) bounds
  cross join lateral (
    values
      (
        'GSDD001', 'dry_photography', 0::numeric, bounds.end_m, dh.activity_date - 17
      ),
      (
        'GSDD001', 'wet_photography', 0::numeric, bounds.end_m, dh.activity_date - 16
      ),
      (
        'GSDD001', 'rqd', 0::numeric, bounds.end_m, dh.activity_date - 15
      ),
      (
        'GSDD001', 'geotechnical_logging', 0::numeric, bounds.end_m, dh.activity_date - 14
      ),
      (
        'GSDD001', 'cutting', 0::numeric, bounds.end_m, dh.activity_date - 11
      ),
      (
        'GSDD001', 'magnetic_susceptibility', bounds.ms_from_m, bounds.end_m, dh.activity_date - 13
      ),
      (
        'GSDD001', 'orientation', bounds.orientation_from_m, bounds.end_m, dh.activity_date - 12
      ),
      (
        'GSDD001', 'structural_logging', bounds.structural_from_m, bounds.end_m, dh.activity_date - 10
      ),
      (
        'GSDD001', 'whole_core_sampling', bounds.sample_from_m, bounds.sample_to_m, dh.activity_date - 8
      ),
      (
        'GSDD001', 'specific_gravity', bounds.sg_from_m, bounds.sg_to_m, dh.activity_date - 6
      ),

      (
        'GSDD002', 'dry_photography', 0::numeric, bounds.end_m, dh.activity_date - 14
      ),
      (
        'GSDD002', 'wet_photography', 0::numeric, bounds.end_m, dh.activity_date - 13
      ),
      (
        'GSDD002', 'orientation', bounds.orientation_from_m, bounds.end_m, dh.activity_date - 12
      ),
      (
        'GSDD002', 'magnetic_susceptibility', bounds.ms_from_m, bounds.end_m, dh.activity_date - 11
      ),
      (
        'GSDD002', 'rqd', 0::numeric, least(bounds.end_m, 236::numeric), dh.activity_date - 9
      ),
      (
        'GSDD002', 'geotechnical_logging', 0::numeric, least(bounds.end_m, 214::numeric), dh.activity_date - 8
      ),
      (
        'GSDD002', 'structural_logging', bounds.structural_from_m, least(bounds.end_m, 188::numeric), dh.activity_date - 7
      ),
      (
        'GSDD002', 'cutting', 0::numeric, least(bounds.end_m, 162::numeric), dh.activity_date - 6
      ),
      (
        'GSDD002', 'whole_core_sampling', bounds.sample_from_m, least(bounds.sample_to_m, bounds.sample_from_m + 58), dh.activity_date - 4
      ),
      (
        'GSDD002', 'specific_gravity', bounds.sg_from_m, least(bounds.sg_to_m, bounds.sg_from_m + 26), dh.activity_date - 3
      ),

      (
        'GSDD003', 'dry_photography', 0::numeric, bounds.end_m, dh.activity_date - 10
      ),
      (
        'GSDD003', 'wet_photography', 0::numeric, bounds.end_m, dh.activity_date - 9
      ),
      (
        'GSDD003', 'rqd', 0::numeric, bounds.end_m, dh.activity_date - 8
      ),
      (
        'GSDD003', 'geotechnical_logging', 0::numeric, bounds.end_m, dh.activity_date - 8
      ),
      (
        'GSDD003', 'magnetic_susceptibility', bounds.ms_from_m, bounds.end_m, dh.activity_date - 7
      ),
      (
        'GSDD003', 'orientation', bounds.orientation_from_m, least(bounds.end_m, 252::numeric), dh.activity_date - 6
      ),
      (
        'GSDD003', 'structural_logging', bounds.structural_from_m, least(bounds.end_m, 244::numeric), dh.activity_date - 5
      ),
      (
        'GSDD003', 'cutting', 0::numeric, least(bounds.end_m, 124::numeric), dh.activity_date - 4
      )
  ) as progress(hole_code, task_type, from_m, to_m, logged_on)
  join public.hole_task_types task_type
    on task_type.organization_id = v_demo_org_id
   and task_type.key = progress.task_type
  where dh.hole_id = progress.hole_code
    and progress.from_m < progress.to_m;
end;
$$;