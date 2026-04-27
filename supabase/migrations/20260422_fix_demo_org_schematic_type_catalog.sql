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
    ('d2000000-0000-4000-8000-000000000001'::uuid, v_demo_org_id, 'Ferruginous cover', '#b45309', 10, true, v_demo_owner_id, 'dots'),
    ('d2000000-0000-4000-8000-000000000002'::uuid, v_demo_org_id, 'Clayey saprolite', '#ca8a04', 20, true, v_demo_owner_id, 'speckle'),
    ('d2000000-0000-4000-8000-000000000003'::uuid, v_demo_org_id, 'Mottled saprock', '#84cc16', 30, true, v_demo_owner_id, 'bedding'),
    ('d2000000-0000-4000-8000-000000000004'::uuid, v_demo_org_id, 'Fractured mafic volcanics', '#0f766e', 40, true, v_demo_owner_id, 'crosshatch'),
    ('d2000000-0000-4000-8000-000000000005'::uuid, v_demo_org_id, 'Fresh basalt', '#334155', 50, true, v_demo_owner_id, 'solid'),
    ('d2000000-0000-4000-8000-000000000006'::uuid, v_demo_org_id, 'Oxide regolith', '#fb923c', 60, true, v_demo_owner_id, 'dash'),
    ('d2000000-0000-4000-8000-000000000007'::uuid, v_demo_org_id, 'Sheared mafic volcanics', '#7c3aed', 70, true, v_demo_owner_id, 'chevron'),
    ('d2000000-0000-4000-8000-000000000008'::uuid, v_demo_org_id, 'Quartz-carbonate veining', '#e5e7eb', 80, true, v_demo_owner_id, 'bedding'),
    ('d2000000-0000-4000-8000-000000000009'::uuid, v_demo_org_id, 'Fresh dolerite', '#1e293b', 90, true, v_demo_owner_id, 'solid')
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
    ('d2100000-0000-4000-8000-000000000001'::uuid, v_demo_org_id, 'Surface collar', '#cbd5e1', 10, true, v_demo_owner_id),
    ('d2100000-0000-4000-8000-000000000002'::uuid, v_demo_org_id, 'Steel casing', '#94a3b8', 20, true, v_demo_owner_id),
    ('d2100000-0000-4000-8000-000000000003'::uuid, v_demo_org_id, 'PVC casing', '#38bdf8', 30, true, v_demo_owner_id),
    ('d2100000-0000-4000-8000-000000000004'::uuid, v_demo_org_id, 'Slotted screen', '#22c55e', 40, true, v_demo_owner_id),
    ('d2100000-0000-4000-8000-000000000005'::uuid, v_demo_org_id, 'Casing shoe', '#f59e0b', 50, true, v_demo_owner_id)
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
    ('d2200000-0000-4000-8000-000000000001'::uuid, v_demo_org_id, 'Cement-bentonite seal', '#f1f5f9', 10, true, v_demo_owner_id),
    ('d2200000-0000-4000-8000-000000000002'::uuid, v_demo_org_id, 'Bentonite seal', '#fde68a', 20, true, v_demo_owner_id),
    ('d2200000-0000-4000-8000-000000000003'::uuid, v_demo_org_id, 'Filter sand pack', '#f59e0b', 30, true, v_demo_owner_id),
    ('d2200000-0000-4000-8000-000000000004'::uuid, v_demo_org_id, 'Pea gravel backfill', '#a3a3a3', 40, true, v_demo_owner_id)
  on conflict (id) do update
    set organization_id = excluded.organization_id,
        name = excluded.name,
        color = excluded.color,
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
    ('d2300000-0000-4000-8000-000000000001'::uuid, v_demo_org_id, 'vw_piezometer', 'VW piezometer', 'sensor', 'piezometer', '#22c55e', 10, true, '{"fields":[{"key":"model","label":"Model","type":"text"},{"key":"serial_no","label":"Serial No","type":"text"},{"key":"screen_zone","label":"Screen Zone","type":"text"},{"key":"baseline_kpa","label":"Baseline kPa","type":"number"}]}'::jsonb, v_demo_owner_id),
    ('d2300000-0000-4000-8000-000000000002'::uuid, v_demo_org_id, 'telemetry_logger', 'Telemetry logger', 'instrument', 'data_logger', '#38bdf8', 20, true, '{"fields":[{"key":"logger_id","label":"Logger ID","type":"text"},{"key":"sample_interval","label":"Sample Interval","type":"select","options":["15 min","30 min","60 min"]},{"key":"telemetry_enabled","label":"Telemetry Enabled","type":"boolean"}]}'::jsonb, v_demo_owner_id),
    ('d2300000-0000-4000-8000-000000000003'::uuid, v_demo_org_id, 'submersible_pump', 'Submersible pump', 'pump', 'submersible_pump', '#f97316', 30, true, '{"fields":[{"key":"pump_duty_lps","label":"Pump Duty (L/s)","type":"number"},{"key":"rising_main","label":"Rising Main","type":"text"},{"key":"commissioning_status","label":"Commissioning Status","type":"select","options":["Standby","Commissioned","Tested"]}]}'::jsonb, v_demo_owner_id),
    ('d2300000-0000-4000-8000-000000000004'::uuid, v_demo_org_id, 'wellhead_gate_valve', 'Wellhead gate valve', 'valve', 'gate_valve', '#c084fc', 40, true, '{"fields":[{"key":"valve_size","label":"Valve Size","type":"text"},{"key":"pressure_rating","label":"Pressure Rating","type":"text"},{"key":"locked_out","label":"Locked Out","type":"boolean"}]}'::jsonb, v_demo_owner_id),
    ('d2300000-0000-4000-8000-000000000005'::uuid, v_demo_org_id, 'packer_assembly', 'Packer assembly', 'packer', 'single_packer', '#ef4444', 50, true, '{"fields":[{"key":"pack_off_pressure_kpa","label":"Pack-Off Pressure (kPa)","type":"number"},{"key":"inflation_medium","label":"Inflation Medium","type":"select","options":["Water","Nitrogen"]},{"key":"target_zone","label":"Target Zone","type":"text"}]}'::jsonb, v_demo_owner_id)
  on conflict (id) do update
    set organization_id = excluded.organization_id,
        key = excluded.key,
        name = excluded.name,
        category = excluded.category,
        icon = excluded.icon,
        color = excluded.color,
        sort_order = excluded.sort_order,
        is_active = excluded.is_active,
        details_schema = excluded.details_schema,
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
    ('d2400000-0000-4000-8000-000000000001'::uuid, v_demo_org_id, 'VW piezometer', '#22c55e', 'piezometer', 10, true, v_demo_owner_id),
    ('d2400000-0000-4000-8000-000000000002'::uuid, v_demo_org_id, 'Pressure transducer', '#0ea5e9', 'pressure_sensor', 20, true, v_demo_owner_id),
    ('d2400000-0000-4000-8000-000000000003'::uuid, v_demo_org_id, 'Water level sensor', '#38bdf8', 'water_level_sensor', 30, true, v_demo_owner_id),
    ('d2400000-0000-4000-8000-000000000004'::uuid, v_demo_org_id, 'Telemetry logger', '#8b5cf6', 'data_logger', 40, true, v_demo_owner_id)
  on conflict (id) do update
    set organization_id = excluded.organization_id,
        name = excluded.name,
        color = excluded.color,
        icon = excluded.icon,
        sort_order = excluded.sort_order,
        is_active = excluded.is_active,
        created_by = excluded.created_by;
end;
$$;
