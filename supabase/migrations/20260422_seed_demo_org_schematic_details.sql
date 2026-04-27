do $$
declare
  v_demo_org_id constant uuid := 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid;
  v_demo_owner_id uuid;

  v_lith_cover_id constant uuid := 'd2000000-0000-4000-8000-000000000001'::uuid;
  v_lith_saprolite_id constant uuid := 'd2000000-0000-4000-8000-000000000002'::uuid;
  v_lith_mottled_id constant uuid := 'd2000000-0000-4000-8000-000000000003'::uuid;
  v_lith_fractured_mafic_id constant uuid := 'd2000000-0000-4000-8000-000000000004'::uuid;
  v_lith_fresh_basalt_id constant uuid := 'd2000000-0000-4000-8000-000000000005'::uuid;
  v_lith_oxide_id constant uuid := 'd2000000-0000-4000-8000-000000000006'::uuid;
  v_lith_shear_id constant uuid := 'd2000000-0000-4000-8000-000000000007'::uuid;
  v_lith_quartz_vein_id constant uuid := 'd2000000-0000-4000-8000-000000000008'::uuid;
  v_lith_fresh_dolerite_id constant uuid := 'd2000000-0000-4000-8000-000000000009'::uuid;

  v_construction_collar_id constant uuid := 'd2100000-0000-4000-8000-000000000001'::uuid;
  v_construction_steel_casing_id constant uuid := 'd2100000-0000-4000-8000-000000000002'::uuid;
  v_construction_pvc_casing_id constant uuid := 'd2100000-0000-4000-8000-000000000003'::uuid;
  v_construction_screen_id constant uuid := 'd2100000-0000-4000-8000-000000000004'::uuid;
  v_construction_shoe_id constant uuid := 'd2100000-0000-4000-8000-000000000005'::uuid;

  v_annulus_cement_id constant uuid := 'd2200000-0000-4000-8000-000000000001'::uuid;
  v_annulus_bentonite_id constant uuid := 'd2200000-0000-4000-8000-000000000002'::uuid;
  v_annulus_filter_sand_id constant uuid := 'd2200000-0000-4000-8000-000000000003'::uuid;
  v_annulus_gravel_id constant uuid := 'd2200000-0000-4000-8000-000000000004'::uuid;

  v_component_vwp_id constant uuid := 'd2300000-0000-4000-8000-000000000001'::uuid;
  v_component_logger_id constant uuid := 'd2300000-0000-4000-8000-000000000002'::uuid;
  v_component_pump_id constant uuid := 'd2300000-0000-4000-8000-000000000003'::uuid;
  v_component_valve_id constant uuid := 'd2300000-0000-4000-8000-000000000004'::uuid;
  v_component_packer_id constant uuid := 'd2300000-0000-4000-8000-000000000005'::uuid;

  v_sensor_vwp_id constant uuid := 'd2400000-0000-4000-8000-000000000001'::uuid;
  v_sensor_pressure_id constant uuid := 'd2400000-0000-4000-8000-000000000002'::uuid;
  v_sensor_water_level_id constant uuid := 'd2400000-0000-4000-8000-000000000003'::uuid;
  v_sensor_logger_id constant uuid := 'd2400000-0000-4000-8000-000000000004'::uuid;
begin
  select owner_id
    into v_demo_owner_id
  from public.organizations
  where id = v_demo_org_id;

  if v_demo_owner_id is null then
    raise exception 'Demo organisation % was not found or has no owner_id', v_demo_org_id;
  end if;

  insert into public.drillhole_lithology_types (
    id,
    organization_id,
    name,
    color,
    sort_order,
    is_active,
    created_by,
    pattern_key
  )
  values
    (v_lith_cover_id, v_demo_org_id, 'Ferruginous cover', '#b45309', 10, true, v_demo_owner_id, 'dots'),
    (v_lith_saprolite_id, v_demo_org_id, 'Clayey saprolite', '#ca8a04', 20, true, v_demo_owner_id, 'speckle'),
    (v_lith_mottled_id, v_demo_org_id, 'Mottled saprock', '#84cc16', 30, true, v_demo_owner_id, 'bedding'),
    (v_lith_fractured_mafic_id, v_demo_org_id, 'Fractured mafic volcanics', '#0f766e', 40, true, v_demo_owner_id, 'crosshatch'),
    (v_lith_fresh_basalt_id, v_demo_org_id, 'Fresh basalt', '#334155', 50, true, v_demo_owner_id, 'solid'),
    (v_lith_oxide_id, v_demo_org_id, 'Oxide regolith', '#fb923c', 60, true, v_demo_owner_id, 'dash'),
    (v_lith_shear_id, v_demo_org_id, 'Sheared mafic volcanics', '#7c3aed', 70, true, v_demo_owner_id, 'chevron'),
    (v_lith_quartz_vein_id, v_demo_org_id, 'Quartz-carbonate veining', '#e5e7eb', 80, true, v_demo_owner_id, 'bedding'),
    (v_lith_fresh_dolerite_id, v_demo_org_id, 'Fresh dolerite', '#1e293b', 90, true, v_demo_owner_id, 'solid')
  on conflict (id) do update
    set organization_id = excluded.organization_id,
      name = excluded.name,
        color = excluded.color,
        sort_order = excluded.sort_order,
        is_active = excluded.is_active,
      created_by = excluded.created_by,
      pattern_key = excluded.pattern_key;

  insert into public.drillhole_construction_types (
    id,
    organization_id,
    name,
    color,
    sort_order,
    is_active,
    created_by
  )
  values
    (v_construction_collar_id, v_demo_org_id, 'Surface collar', '#cbd5e1', 10, true, v_demo_owner_id),
    (v_construction_steel_casing_id, v_demo_org_id, 'Steel casing', '#94a3b8', 20, true, v_demo_owner_id),
    (v_construction_pvc_casing_id, v_demo_org_id, 'PVC casing', '#38bdf8', 30, true, v_demo_owner_id),
    (v_construction_screen_id, v_demo_org_id, 'Slotted screen', '#22c55e', 40, true, v_demo_owner_id),
    (v_construction_shoe_id, v_demo_org_id, 'Casing shoe', '#f59e0b', 50, true, v_demo_owner_id)
  on conflict (id) do update
    set organization_id = excluded.organization_id,
      name = excluded.name,
        color = excluded.color,
        sort_order = excluded.sort_order,
      is_active = excluded.is_active,
      created_by = excluded.created_by;

  insert into public.drillhole_annulus_types (
    id,
    organization_id,
    name,
    color,
    sort_order,
    is_active,
    created_by
  )
  values
    (v_annulus_cement_id, v_demo_org_id, 'Cement-bentonite seal', '#f1f5f9', 10, true, v_demo_owner_id),
    (v_annulus_bentonite_id, v_demo_org_id, 'Bentonite seal', '#fde68a', 20, true, v_demo_owner_id),
    (v_annulus_filter_sand_id, v_demo_org_id, 'Filter sand pack', '#f59e0b', 30, true, v_demo_owner_id),
    (v_annulus_gravel_id, v_demo_org_id, 'Pea gravel backfill', '#a3a3a3', 40, true, v_demo_owner_id)
  on conflict (id) do update
    set organization_id = excluded.organization_id,
        name = excluded.name,
        color = excluded.color,
        sort_order = excluded.sort_order,
        is_active = excluded.is_active,
        created_by = excluded.created_by;

  insert into public.drillhole_sensor_types (
    id,
    organization_id,
    name,
    color,
    icon,
    sort_order,
    is_active,
    created_by
  )
  values
    (v_sensor_vwp_id, v_demo_org_id, 'VW piezometer', '#22c55e', 'piezometer', 10, true, v_demo_owner_id),
    (v_sensor_pressure_id, v_demo_org_id, 'Pressure transducer', '#0ea5e9', 'pressure_sensor', 20, true, v_demo_owner_id),
    (v_sensor_water_level_id, v_demo_org_id, 'Water level sensor', '#38bdf8', 'water_level_sensor', 30, true, v_demo_owner_id),
    (v_sensor_logger_id, v_demo_org_id, 'Telemetry logger', '#8b5cf6', 'data_logger', 40, true, v_demo_owner_id)
  on conflict (id) do update
    set organization_id = excluded.organization_id,
        name = excluded.name,
        color = excluded.color,
        icon = excluded.icon,
        sort_order = excluded.sort_order,
        is_active = excluded.is_active,
        created_by = excluded.created_by;

  insert into public.drillhole_component_types (
    id,
    organization_id,
    key,
    name,
    category,
    icon,
    color,
    sort_order,
    is_active,
    details_schema,
    created_by
  )
  values
    (
      v_component_vwp_id,
      v_demo_org_id,
      'vw_piezometer',
      'VW piezometer',
      'sensor',
      'piezometer',
      '#22c55e',
      10,
      true,
      '{"fields":[{"key":"model","label":"Model","type":"text"},{"key":"serial_no","label":"Serial No","type":"text"},{"key":"screen_zone","label":"Screen Zone","type":"text"},{"key":"baseline_kpa","label":"Baseline kPa","type":"number"}]}'::jsonb,
      v_demo_owner_id
    ),
    (
      v_component_logger_id,
      v_demo_org_id,
      'telemetry_logger',
      'Telemetry logger',
      'instrument',
      'data_logger',
      '#38bdf8',
      20,
      true,
      '{"fields":[{"key":"logger_id","label":"Logger ID","type":"text"},{"key":"sample_interval","label":"Sample Interval","type":"select","options":["15 min","30 min","60 min"]},{"key":"telemetry_enabled","label":"Telemetry Enabled","type":"boolean"}]}'::jsonb,
      v_demo_owner_id
    ),
    (
      v_component_pump_id,
      v_demo_org_id,
      'submersible_pump',
      'Submersible pump',
      'pump',
      'submersible_pump',
      '#f97316',
      30,
      true,
      '{"fields":[{"key":"pump_duty_lps","label":"Pump Duty (L/s)","type":"number"},{"key":"rising_main","label":"Rising Main","type":"text"},{"key":"commissioning_status","label":"Commissioning Status","type":"select","options":["Standby","Commissioned","Tested"]}]}'::jsonb,
      v_demo_owner_id
    ),
    (
      v_component_valve_id,
      v_demo_org_id,
      'wellhead_gate_valve',
      'Wellhead gate valve',
      'valve',
      'gate_valve',
      '#c084fc',
      40,
      true,
      '{"fields":[{"key":"valve_size","label":"Valve Size","type":"text"},{"key":"pressure_rating","label":"Pressure Rating","type":"text"},{"key":"locked_out","label":"Locked Out","type":"boolean"}]}'::jsonb,
      v_demo_owner_id
    ),
    (
      v_component_packer_id,
      v_demo_org_id,
      'packer_assembly',
      'Packer assembly',
      'packer',
      'single_packer',
      '#ef4444',
      50,
      true,
      '{"fields":[{"key":"pack_off_pressure_kpa","label":"Pack-Off Pressure (kPa)","type":"number"},{"key":"inflation_medium","label":"Inflation Medium","type":"select","options":["Water","Nitrogen"]},{"key":"target_zone","label":"Target Zone","type":"text"}]}'::jsonb,
      v_demo_owner_id
    )
  on conflict (id) do update
    set organization_id = excluded.organization_id,
      key = excluded.key,
        name = excluded.name,
        category = excluded.category,
        icon = excluded.icon,
        color = excluded.color,
        sort_order = excluded.sort_order,
        is_active = excluded.is_active,
      created_by = excluded.created_by,
        details_schema = excluded.details_schema;

  delete from public.drillhole_geology_intervals
  where organization_id = v_demo_org_id
    and hole_id in (
      select h.id
      from public.holes h
      where h.organization_id = v_demo_org_id
        and h.depth is not null
        and (h.hole_id like 'GSHYD%' or h.hole_id like 'GSDD%')
    );

  delete from public.drillhole_construction_intervals
  where organization_id = v_demo_org_id
    and hole_id in (
      select h.id
      from public.holes h
      where h.organization_id = v_demo_org_id
        and h.depth is not null
        and (h.hole_id like 'GSHYD%' or h.hole_id like 'GSDD%')
    );

  delete from public.drillhole_annulus_intervals
  where organization_id = v_demo_org_id
    and hole_id in (
      select h.id
      from public.holes h
      where h.organization_id = v_demo_org_id
        and h.depth is not null
        and (h.hole_id like 'GSHYD%' or h.hole_id like 'GSDD%')
    );

  delete from public.drillhole_components
  where organization_id = v_demo_org_id
    and hole_id in (
      select h.id
      from public.holes h
      where h.organization_id = v_demo_org_id
        and h.depth is not null
        and (h.hole_id like 'GSHYD%' or h.hole_id like 'GSDD%')
    );

  with hydro_holes as (
    select
      h.id,
      h.hole_id,
      h.depth::numeric as depth_m,
      right(h.hole_id, 3)::integer as seq
    from public.holes h
    where h.organization_id = v_demo_org_id
      and h.depth is not null
      and h.hole_id like 'GSHYD%'
  )
  insert into public.drillhole_geology_intervals (
    id,
    organization_id,
    hole_id,
    lithology_type_id,
    from_m,
    to_m,
    notes,
    created_by
  )
  select
    gen_random_uuid(),
    v_demo_org_id,
    hh.id,
    case layer.layer_key
      when 'cover' then v_lith_cover_id
      when 'saprolite' then v_lith_saprolite_id
      when 'mottled' then v_lith_mottled_id
      when 'fractured_mafic' then v_lith_fractured_mafic_id
      when 'fresh_basalt' then v_lith_fresh_basalt_id
    end,
    layer.from_m,
    layer.to_m,
    layer.notes,
    v_demo_owner_id
  from hydro_holes hh
  cross join lateral (
    select
      least(hh.depth_m - 40, greatest(5::numeric, round(hh.depth_m * 0.08, 1))) as z1,
      least(hh.depth_m - 28, greatest(15::numeric, round(hh.depth_m * 0.24, 1) + (hh.seq % 2))) as z2,
      least(hh.depth_m - 18, greatest(28::numeric, round(hh.depth_m * 0.44, 1))) as z3,
      least(hh.depth_m - 4, greatest(42::numeric, round(hh.depth_m * 0.79, 1))) as z4
  ) bounds
  cross join lateral (
    values
      ('cover', 0::numeric, bounds.z1, 'Ferruginous sheetwash cover with minor calcrete development.'),
      ('saprolite', bounds.z1, bounds.z2, 'Clay-rich saprolite with elevated moisture retention.'),
      ('mottled', bounds.z2, bounds.z3, 'Mottled saprock with local silica flooding and clay seams.'),
      ('fractured_mafic', bounds.z3, bounds.z4, 'Highly fractured mafic volcanics forming the main transmissive aquifer interval.'),
      ('fresh_basalt', bounds.z4, hh.depth_m, 'Fresh basalt and doleritic footwall with tighter fractures at depth.')
  ) as layer(layer_key, from_m, to_m, notes)
  where layer.from_m < layer.to_m;

  with diamond_holes as (
    select
      h.id,
      h.hole_id,
      h.depth::numeric as depth_m,
      right(h.hole_id, 3)::integer as seq
    from public.holes h
    where h.organization_id = v_demo_org_id
      and h.depth is not null
      and h.hole_id like 'GSDD%'
  )
  insert into public.drillhole_geology_intervals (
    id,
    organization_id,
    hole_id,
    lithology_type_id,
    from_m,
    to_m,
    notes,
    created_by
  )
  select
    gen_random_uuid(),
    v_demo_org_id,
    dh.id,
    case layer.layer_key
      when 'oxide' then v_lith_oxide_id
      when 'saprolite' then v_lith_saprolite_id
      when 'shear' then v_lith_shear_id
      when 'quartz_vein' then v_lith_quartz_vein_id
      when 'fresh_dolerite' then v_lith_fresh_dolerite_id
    end,
    layer.from_m,
    layer.to_m,
    layer.notes,
    v_demo_owner_id
  from diamond_holes dh
  cross join lateral (
    select
      least(dh.depth_m - 260, greatest(10::numeric, round(dh.depth_m * 0.04, 1))) as z1,
      least(dh.depth_m - 210, greatest(26::numeric, round(dh.depth_m * 0.12, 1))) as z2,
      least(dh.depth_m - 110, greatest(70::numeric, round(dh.depth_m * 0.33, 1))) as z3,
      least(dh.depth_m - 50, greatest(130::numeric, round(dh.depth_m * 0.63, 1))) as z4
  ) bounds
  cross join lateral (
    values
      ('oxide', 0::numeric, bounds.z1, 'Oxidised transported profile and ferricrete cap.'),
      ('saprolite', bounds.z1, bounds.z2, 'Saprolitic transition with clay-altered mafic volcanics.'),
      ('shear', bounds.z2, bounds.z3, 'Sheared mafic sequence with foliation-parallel carbonate alteration.'),
      ('quartz_vein', bounds.z3, bounds.z4, 'Quartz-carbonate vein swarm with pyrite stringers and local brecciation.'),
      ('fresh_dolerite', bounds.z4, dh.depth_m, 'Competent fresh dolerite and basalt below the mineralised shear corridor.')
  ) as layer(layer_key, from_m, to_m, notes)
  where layer.from_m < layer.to_m;

  with hydro_holes as (
    select
      h.id,
      h.hole_id,
      h.depth::numeric as depth_m,
      right(h.hole_id, 3)::integer as seq,
      coalesce(h.completed_at, h.started_at, now()) as installed_at
    from public.holes h
    where h.organization_id = v_demo_org_id
      and h.depth is not null
      and h.hole_id like 'GSHYD%'
  )
  insert into public.drillhole_construction_intervals (
    id,
    organization_id,
    hole_id,
    construction_type_id,
    from_m,
    to_m,
    notes,
    created_by
  )
  select
    gen_random_uuid(),
    v_demo_org_id,
    hh.id,
    case layer.layer_key
      when 'collar' then v_construction_collar_id
      when 'steel' then v_construction_steel_casing_id
      when 'pvc' then v_construction_pvc_casing_id
      when 'screen' then v_construction_screen_id
      when 'shoe' then v_construction_shoe_id
    end,
    layer.from_m,
    layer.to_m,
    layer.notes,
    v_demo_owner_id
  from hydro_holes hh
  cross join lateral (
    select
      0.8::numeric as collar_end,
      6.0::numeric as steel_end,
      least(hh.depth_m - 6, greatest(20::numeric, round(hh.depth_m * 0.79, 1))) as screen_start,
      hh.depth_m - 3 as screen_end
  ) bounds
  cross join lateral (
    values
      ('collar', 0::numeric, bounds.collar_end, 'Concrete monument and flush-mounted protective cover.'),
      ('steel', bounds.collar_end, bounds.steel_end, 'Surface steel conductor casing grouted through shallow collapse-prone ground.'),
      ('pvc', bounds.steel_end, bounds.screen_start, 'PVC production casing set across saprolite and upper fractured basalt.'),
      ('screen', bounds.screen_start, bounds.screen_end, 'Slotted screen set across the interpreted transmissive aquifer horizon.'),
      ('shoe', bounds.screen_end, hh.depth_m, 'Short sump and casing shoe to collect fines during development.')
  ) as layer(layer_key, from_m, to_m, notes)
  where layer.from_m < layer.to_m;

  with diamond_holes as (
    select
      h.id,
      h.hole_id,
      h.depth::numeric as depth_m,
      right(h.hole_id, 3)::integer as seq,
      coalesce(h.completed_at, h.started_at, now()) as installed_at
    from public.holes h
    where h.organization_id = v_demo_org_id
      and h.depth is not null
      and h.hole_id like 'GSDD%'
  )
  insert into public.drillhole_construction_intervals (
    id,
    organization_id,
    hole_id,
    construction_type_id,
    from_m,
    to_m,
    notes,
    created_by
  )
  select
    gen_random_uuid(),
    v_demo_org_id,
    dh.id,
    case layer.layer_key
      when 'collar' then v_construction_collar_id
      when 'steel' then v_construction_steel_casing_id
      when 'pvc' then v_construction_pvc_casing_id
      when 'screen' then v_construction_screen_id
      when 'shoe' then v_construction_shoe_id
    end,
    layer.from_m,
    layer.to_m,
    layer.notes,
    v_demo_owner_id
  from diamond_holes dh
  cross join lateral (
    select
      1.0::numeric as collar_end,
      18.0::numeric as steel_end,
      greatest(180::numeric, dh.depth_m - (32 + (dh.seq * 3))) as screen_start,
      dh.depth_m - 4 as screen_end
  ) bounds
  cross join lateral (
    values
      ('collar', 0::numeric, bounds.collar_end, 'Survey monument, standpipe headworks and lockable cap assembly.'),
      ('steel', bounds.collar_end, bounds.steel_end, 'Steel conductor casing installed through broken oxide and upper saprolite.'),
      ('pvc', bounds.steel_end, bounds.screen_start, 'PVC standpipe set through the main host sequence to the target shear zone.'),
      ('screen', bounds.screen_start, bounds.screen_end, 'Slotted monitoring screen installed adjacent to the mineralised structure.'),
      ('shoe', bounds.screen_end, dh.depth_m, 'Short tail and shoe below the screened interval to stabilise the completion.')
  ) as layer(layer_key, from_m, to_m, notes)
  where layer.from_m < layer.to_m;

  with hydro_holes as (
    select
      h.id,
      h.hole_id,
      h.depth::numeric as depth_m,
      right(h.hole_id, 3)::integer as seq
    from public.holes h
    where h.organization_id = v_demo_org_id
      and h.depth is not null
      and h.hole_id like 'GSHYD%'
  )
  insert into public.drillhole_annulus_intervals (
    id,
    organization_id,
    hole_id,
    annulus_type_id,
    from_m,
    to_m,
    notes,
    created_by
  )
  select
    gen_random_uuid(),
    v_demo_org_id,
    hh.id,
    case layer.layer_key
      when 'cement' then v_annulus_cement_id
      when 'bentonite' then v_annulus_bentonite_id
      when 'sand' then v_annulus_filter_sand_id
      when 'gravel' then v_annulus_gravel_id
    end,
    layer.from_m,
    layer.to_m,
    layer.notes,
    v_demo_owner_id
  from hydro_holes hh
  cross join lateral (
    select
      least(hh.depth_m - 6, greatest(20::numeric, round(hh.depth_m * 0.79, 1))) as screen_start,
      hh.depth_m - 3 as screen_end
  ) bounds
  cross join lateral (
    values
      ('cement', 0::numeric, 4.0::numeric, 'Cement-bentonite seal below the surface monument.'),
      ('bentonite', 4.0::numeric, bounds.screen_start - 4, 'Hydrated bentonite seal isolating upper weathered groundwater.'),
      ('sand', bounds.screen_start - 4, bounds.screen_end + 1, 'Filter sand pack placed around the screened interval.'),
      ('gravel', bounds.screen_end + 1, hh.depth_m, 'Pea gravel tail below the screen to support development and flushing.')
  ) as layer(layer_key, from_m, to_m, notes)
  where layer.from_m < layer.to_m;

  with diamond_holes as (
    select
      h.id,
      h.hole_id,
      h.depth::numeric as depth_m,
      right(h.hole_id, 3)::integer as seq
    from public.holes h
    where h.organization_id = v_demo_org_id
      and h.depth is not null
      and h.hole_id like 'GSDD%'
  )
  insert into public.drillhole_annulus_intervals (
    id,
    organization_id,
    hole_id,
    annulus_type_id,
    from_m,
    to_m,
    notes,
    created_by
  )
  select
    gen_random_uuid(),
    v_demo_org_id,
    dh.id,
    case layer.layer_key
      when 'cement' then v_annulus_cement_id
      when 'bentonite' then v_annulus_bentonite_id
      when 'sand' then v_annulus_filter_sand_id
      when 'gravel' then v_annulus_gravel_id
    end,
    layer.from_m,
    layer.to_m,
    layer.notes,
    v_demo_owner_id
  from diamond_holes dh
  cross join lateral (
    select
      greatest(180::numeric, dh.depth_m - (32 + (dh.seq * 3))) as screen_start,
      dh.depth_m - 4 as screen_end
  ) bounds
  cross join lateral (
    values
      ('cement', 0::numeric, 14.0::numeric, 'Neat cement grout column through the near-surface conductor section.'),
      ('bentonite', 14.0::numeric, bounds.screen_start - 8, 'Bentonite seal isolating the upper structure above the target horizon.'),
      ('sand', bounds.screen_start - 8, bounds.screen_end + 1, 'Silica filter pack bridging the targeted sheared interval.'),
      ('gravel', bounds.screen_end + 1, dh.depth_m, 'Coarse tail pack supporting the shoe below the screen.')
  ) as layer(layer_key, from_m, to_m, notes)
  where layer.from_m < layer.to_m;

  with hydro_holes as (
    select
      h.id,
      h.hole_id,
      h.depth::numeric as depth_m,
      right(h.hole_id, 3)::integer as seq,
      coalesce(h.completed_at, h.started_at, now()) as installed_at
    from public.holes h
    where h.organization_id = v_demo_org_id
      and h.depth is not null
      and h.hole_id like 'GSHYD%'
  )
  insert into public.drillhole_components (
    id,
    organization_id,
    hole_id,
    component_type_id,
    depth_m,
    label,
    status,
    details,
    notes,
    installed_at,
    created_by
  )
  select
    gen_random_uuid(),
    v_demo_org_id,
    hh.id,
    component.component_type_id,
    component.depth_m,
    component.label,
    component.status,
    component.details,
    component.notes,
    hh.installed_at,
    v_demo_owner_id
  from hydro_holes hh
  cross join lateral (
    select
      least(hh.depth_m - 6, greatest(20::numeric, round(hh.depth_m * 0.79, 1))) as screen_start,
      hh.depth_m - 3 as screen_end
  ) bounds
  cross join lateral (
    values
      (
        v_component_valve_id,
        0.6::numeric,
        concat('WHV-', right(hh.hole_id, 3)),
        'installed',
        jsonb_build_object('valve_size', '50 mm', 'pressure_rating', 'PN16', 'locked_out', false),
        'Isolation valve mounted below the flush-mount protective cap.'
      ),
      (
        v_component_logger_id,
        1.4::numeric,
        concat('DL-', right(hh.hole_id, 3)),
        'installed',
        jsonb_build_object('logger_id', concat('GS-HYD-L', right(hh.hole_id, 3)), 'sample_interval', '60 min', 'telemetry_enabled', (hh.seq % 2 = 0)),
        'Telemetry logger commissioned after development and baseline recovery.'
      ),
      (
        v_component_vwp_id,
        round((bounds.screen_start + bounds.screen_end) / 2, 1),
        concat('VWP-', right(hh.hole_id, 3), '-A'),
        'installed',
        jsonb_build_object('model', 'Geokon 4500S', 'serial_no', concat('GK45-', right(hh.hole_id, 3)), 'screen_zone', concat(round(bounds.screen_start, 1), '-', round(bounds.screen_end, 1), ' m'), 'baseline_kpa', 108 + (hh.seq * 7)),
        'Primary VW piezometer landed mid-screen for standing water and recovery monitoring.'
      )
  ) as component(component_type_id, depth_m, label, status, details, notes)
  where component.depth_m <= hh.depth_m;

  with hydro_holes as (
    select
      h.id,
      h.hole_id,
      h.depth::numeric as depth_m,
      right(h.hole_id, 3)::integer as seq,
      coalesce(h.completed_at, h.started_at, now()) as installed_at
    from public.holes h
    where h.organization_id = v_demo_org_id
      and h.depth is not null
      and h.hole_id like 'GSHYD%'
      and (right(h.hole_id, 3)::integer % 2 = 1)
  )
  insert into public.drillhole_components (
    id,
    organization_id,
    hole_id,
    component_type_id,
    depth_m,
    label,
    status,
    details,
    notes,
    installed_at,
    created_by
  )
  select
    gen_random_uuid(),
    v_demo_org_id,
    hh.id,
    v_component_pump_id,
    round(bounds.screen_start + 3, 1),
    concat('PMP-', right(hh.hole_id, 3)),
    'installed',
    jsonb_build_object('pump_duty_lps', 1.5 + (hh.seq * 0.2), 'rising_main', '32 mm HDPE', 'commissioning_status', 'Commissioned'),
    'Low-yield development pump retained for purge sampling and slug test work.',
    hh.installed_at,
    v_demo_owner_id
  from hydro_holes hh
  cross join lateral (
    select least(hh.depth_m - 6, greatest(20::numeric, round(hh.depth_m * 0.79, 1))) as screen_start
  ) bounds
  where round(bounds.screen_start + 3, 1) <= hh.depth_m;

  with diamond_holes as (
    select
      h.id,
      h.hole_id,
      h.depth::numeric as depth_m,
      right(h.hole_id, 3)::integer as seq,
      coalesce(h.completed_at, h.started_at, now()) as installed_at
    from public.holes h
    where h.organization_id = v_demo_org_id
      and h.depth is not null
      and h.hole_id like 'GSDD%'
  )
  insert into public.drillhole_components (
    id,
    organization_id,
    hole_id,
    component_type_id,
    depth_m,
    label,
    status,
    details,
    notes,
    installed_at,
    created_by
  )
  select
    gen_random_uuid(),
    v_demo_org_id,
    dh.id,
    component.component_type_id,
    component.depth_m,
    component.label,
    component.status,
    component.details,
    component.notes,
    dh.installed_at,
    v_demo_owner_id
  from diamond_holes dh
  cross join lateral (
    select
      greatest(180::numeric, dh.depth_m - (32 + (dh.seq * 3))) as screen_start,
      dh.depth_m - 4 as screen_end
  ) bounds
  cross join lateral (
    values
      (
        v_component_logger_id,
        1.6::numeric,
        concat('DL-', right(dh.hole_id, 3)),
        'installed',
        jsonb_build_object('logger_id', concat('GS-DD-L', right(dh.hole_id, 3)), 'sample_interval', '30 min', 'telemetry_enabled', true),
        'Surface logger installed in the lockable headworks enclosure.'
      ),
      (
        v_component_packer_id,
        round(bounds.screen_start - 2, 1),
        concat('PKR-', right(dh.hole_id, 3)),
        'installed',
        jsonb_build_object('pack_off_pressure_kpa', 320 + (dh.seq * 15), 'inflation_medium', 'Water', 'target_zone', concat(round(bounds.screen_start - 4, 1), '-', round(bounds.screen_start + 6, 1), ' m')),
        'Single packer isolating the upper shoulder of the interpreted shear zone.'
      ),
      (
        v_component_vwp_id,
        round(bounds.screen_start + 8, 1),
        concat('VWP-', right(dh.hole_id, 3), '-D'),
        'installed',
        jsonb_build_object('model', 'RST VW2100', 'serial_no', concat('RST-', right(dh.hole_id, 3)), 'screen_zone', concat(round(bounds.screen_start, 1), '-', round(bounds.screen_end, 1), ' m'), 'baseline_kpa', 185 + (dh.seq * 12)),
        'Deep VW piezometer positioned inside the screen opposite the mineralised structure.'
      )
  ) as component(component_type_id, depth_m, label, status, details, notes)
  where component.depth_m <= dh.depth_m;
end;
$$;