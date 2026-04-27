do $$
declare
  v_demo_org_id constant uuid := 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid;
  v_demo_owner_id uuid;
  v_rc_descriptor_id constant uuid := 'd1000000-0000-4000-8000-000000000001'::uuid;
  v_hydro_descriptor_id constant uuid := 'd1000000-0000-4000-8000-000000000002'::uuid;
  v_diamond_descriptor_id constant uuid := 'd1000000-0000-4000-8000-000000000003'::uuid;
begin
  select owner_id
    into v_demo_owner_id
  from public.organizations
  where id = v_demo_org_id;

  if v_demo_owner_id is null then
    raise exception 'Demo organisation % was not found or has no owner_id', v_demo_org_id;
  end if;

  insert into public.hole_descriptors (
    id,
    organization_id,
    key,
    name,
    category,
    color,
    sort_order,
    is_active,
    created_by
  )
  values
    (v_rc_descriptor_id, v_demo_org_id, 'rc', 'RC', 'Drilling Type', '#f59e0b', 10, true, v_demo_owner_id),
    (v_hydro_descriptor_id, v_demo_org_id, 'hydro', 'Hydrogeology', 'Drilling Type', '#22c55e', 20, true, v_demo_owner_id),
    (v_diamond_descriptor_id, v_demo_org_id, 'diamond', 'Diamond', 'Drilling Type', '#38bdf8', 30, true, v_demo_owner_id)
  on conflict (id) do update
    set key = excluded.key,
        name = excluded.name,
        category = excluded.category,
        color = excluded.color,
        sort_order = excluded.sort_order,
        is_active = excluded.is_active,
        updated_at = now();

  insert into public.projects (
    id,
    organization_id,
    name,
    start_date,
    finish_date,
    cost_code,
    wbs_code,
    created_by,
    coordinate_crs_code,
    coordinate_crs_name
  )
  values
    ('a1000000-0000-4000-8000-000000000001', v_demo_org_id, 'Golden Spur RC North', date '2026-02-03', date '2026-04-18', 'GS-RCN', 'GS.RCN', v_demo_owner_id, 'EPSG:4326', 'WGS 84'),
    ('a1000000-0000-4000-8000-000000000002', v_demo_org_id, 'Golden Spur RC Central', date '2026-02-20', date '2026-05-07', 'GS-RCC', 'GS.RCC', v_demo_owner_id, 'EPSG:4326', 'WGS 84'),
    ('a1000000-0000-4000-8000-000000000003', v_demo_org_id, 'Golden Spur RC South', date '2026-03-08', date '2026-05-26', 'GS-RCS', 'GS.RCS', v_demo_owner_id, 'EPSG:4326', 'WGS 84'),
    ('a1000000-0000-4000-8000-000000000004', v_demo_org_id, 'Golden Spur Hydro Sentinel', date '2026-01-15', date '2026-04-11', 'GS-HYD', 'GS.HYD', v_demo_owner_id, 'EPSG:4326', 'WGS 84'),
    ('a1000000-0000-4000-8000-000000000005', v_demo_org_id, 'Golden Spur Diamond Deeps', date '2026-02-12', date '2026-06-03', 'GS-DD', 'GS.DD', v_demo_owner_id, 'EPSG:4326', 'WGS 84')
  on conflict (id) do update
    set name = excluded.name,
        start_date = excluded.start_date,
        finish_date = excluded.finish_date,
        cost_code = excluded.cost_code,
        wbs_code = excluded.wbs_code,
        coordinate_crs_code = excluded.coordinate_crs_code,
        coordinate_crs_name = excluded.coordinate_crs_name,
        updated_at = now();

  insert into public.tenements (
    id,
    organization_id,
    tenement_number,
    tenement_type,
    application_number,
    status,
    date_applied,
    date_granted,
    renewal_date,
    expenditure_commitment,
    heritage_agreements,
    created_by
  )
  values
    ('b1000000-0000-4000-8000-000000000001', v_demo_org_id, 'M25/1042', 'Mining Lease', 'APP-25-1042', 'Granted', date '2023-09-12', date '2024-03-08', date '2029-03-08', 1450000, 'Ngadju heritage clearance complete', v_demo_owner_id),
    ('b1000000-0000-4000-8000-000000000002', v_demo_org_id, 'M25/1043', 'Mining Lease', 'APP-25-1043', 'Granted', date '2023-09-12', date '2024-03-08', date '2029-03-08', 1380000, 'Ngadju heritage clearance complete', v_demo_owner_id),
    ('b1000000-0000-4000-8000-000000000003', v_demo_org_id, 'M25/1044', 'Mining Lease', 'APP-25-1044', 'Granted', date '2023-10-05', date '2024-03-29', date '2029-03-29', 1510000, 'Ngadju heritage clearance complete', v_demo_owner_id),
    ('b1000000-0000-4000-8000-000000000004', v_demo_org_id, 'G25/221', 'Groundwater Licence', 'APP-G25-221', 'Granted', date '2023-08-19', date '2024-01-23', date '2028-01-23', 280000, 'Pastoral access agreement active', v_demo_owner_id),
    ('b1000000-0000-4000-8000-000000000005', v_demo_org_id, 'M25/1045', 'Mining Lease', 'APP-25-1045', 'Granted', date '2023-11-01', date '2024-04-18', date '2029-04-18', 1640000, 'Heritage survey complete', v_demo_owner_id)
  on conflict (id) do update
    set tenement_number = excluded.tenement_number,
        tenement_type = excluded.tenement_type,
        application_number = excluded.application_number,
        status = excluded.status,
        date_applied = excluded.date_applied,
        date_granted = excluded.date_granted,
        renewal_date = excluded.renewal_date,
        expenditure_commitment = excluded.expenditure_commitment,
        heritage_agreements = excluded.heritage_agreements,
        updated_at = now();

  insert into public.asset_locations (
    id,
    organization_id,
    name,
    description,
    created_by
  )
  values
    ('c1000000-0000-4000-8000-000000000001', v_demo_org_id, 'Golden Spur North Laydown', 'Primary RC support yard for the northern grid program.', v_demo_owner_id),
    ('c1000000-0000-4000-8000-000000000002', v_demo_org_id, 'Golden Spur Central Laydown', 'Shared support yard between the central and southern RC campaigns.', v_demo_owner_id),
    ('c1000000-0000-4000-8000-000000000003', v_demo_org_id, 'Golden Spur Hydro Yard', 'Hydrogeology support yard with pump and monitoring equipment.', v_demo_owner_id),
    ('c1000000-0000-4000-8000-000000000004', v_demo_org_id, 'Golden Spur Diamond Laydown', 'Diamond drilling laydown with core handling and workshop support.', v_demo_owner_id)
  on conflict (id) do update
    set name = excluded.name,
        description = excluded.description;

  insert into public.asset_types (name, description)
  values
    ('Drill Rig', 'Mobile drilling rig asset'),
    ('Compressor', 'Air compressor package'),
    ('Water Tank', 'Portable water storage tank'),
    ('Generator', 'Site generator set'),
    ('Light Vehicle', 'Field vehicle'),
    ('Fuel Pod', 'Self-bunded fuel pod'),
    ('Pump', 'Groundwater or dewatering pump'),
    ('Workshop Container', 'Maintenance workshop container'),
    ('Core Shed', 'Portable core logging and storage shed')
  on conflict (name) do update
    set description = excluded.description;

  insert into public.holes (
    hole_id,
    depth,
    drilling_diameter,
    drilling_contractor,
    created_by,
    organization_id,
    project_id,
    tenement_id,
    planned_depth,
    state,
    water_level_m,
    azimuth,
    dip,
    collar_longitude,
    collar_latitude,
    collar_elevation_m,
    collar_source,
    started_at,
    completed_at,
    completion_status,
    completion_notes
  )
  select
    format('GSNRC%s', lpad((((r * 4) + c + 1))::text, 3, '0')),
    case when ((r * 4) + c + 1) <= 8 then 150 + (r * 12) + (c * 5) else null end,
    'Other',
    'Outback RC Drilling',
    v_demo_owner_id,
    v_demo_org_id,
    'a1000000-0000-4000-8000-000000000001'::uuid,
    'b1000000-0000-4000-8000-000000000001'::uuid,
    155 + (r * 12) + (c * 5),
    case
      when ((r * 4) + c + 1) <= 8 then 'drilled'
      when ((r * 4) + c + 1) <= 10 then 'in_progress'
      else 'proposed'
    end,
    null,
    90,
    -60,
    121.455 + (c * 0.00135),
    -30.688 - (r * 0.00108),
    348 + (r * 2) + c,
    'gps',
    case when ((r * 4) + c + 1) <= 10 then now() - make_interval(days => 55 - ((r * 4) + c + 1) * 2) end,
    case when ((r * 4) + c + 1) <= 8 then now() - make_interval(days => 31 - ((r * 4) + c + 1)) end,
    case when ((r * 4) + c + 1) <= 8 then 'completed' end,
    case when ((r * 4) + c + 1) <= 8 then 'Shallow oxide reconnaissance completed.' end
  from generate_series(0, 2) as r
  cross join generate_series(0, 3) as c
  where not exists (
    select 1
    from public.holes existing
    where existing.organization_id = v_demo_org_id
      and existing.hole_id = format('GSNRC%s', lpad((((r * 4) + c + 1))::text, 3, '0'))
  );

  insert into public.holes (
    hole_id,
    depth,
    drilling_diameter,
    drilling_contractor,
    created_by,
    organization_id,
    project_id,
    tenement_id,
    planned_depth,
    state,
    water_level_m,
    azimuth,
    dip,
    collar_longitude,
    collar_latitude,
    collar_elevation_m,
    collar_source,
    started_at,
    completed_at,
    completion_status,
    completion_notes
  )
  select
    format('GSCRC%s', lpad((((r * 4) + c + 1))::text, 3, '0')),
    case when ((r * 4) + c + 1) <= 9 then 165 + (r * 10) + (c * 6) else null end,
    'Other',
    'Outback RC Drilling',
    v_demo_owner_id,
    v_demo_org_id,
    'a1000000-0000-4000-8000-000000000002'::uuid,
    'b1000000-0000-4000-8000-000000000002'::uuid,
    170 + (r * 10) + (c * 6),
    case
      when ((r * 4) + c + 1) <= 9 then 'drilled'
      when ((r * 4) + c + 1) <= 11 then 'in_progress'
      else 'proposed'
    end,
    null,
    90,
    -60,
    121.487 + (c * 0.00128),
    -30.739 - (r * 0.0011),
    356 + (r * 2) + c,
    'gps',
    case when ((r * 4) + c + 1) <= 11 then now() - make_interval(days => 48 - ((r * 4) + c + 1) * 2) end,
    case when ((r * 4) + c + 1) <= 9 then now() - make_interval(days => 23 - ((r * 4) + c + 1)) end,
    case when ((r * 4) + c + 1) <= 9 then 'completed' end,
    case when ((r * 4) + c + 1) <= 9 then 'Fresh rock follow-up line completed.' end
  from generate_series(0, 2) as r
  cross join generate_series(0, 3) as c
  where not exists (
    select 1
    from public.holes existing
    where existing.organization_id = v_demo_org_id
      and existing.hole_id = format('GSCRC%s', lpad((((r * 4) + c + 1))::text, 3, '0'))
  );

  insert into public.holes (
    hole_id,
    depth,
    drilling_diameter,
    drilling_contractor,
    created_by,
    organization_id,
    project_id,
    tenement_id,
    planned_depth,
    state,
    water_level_m,
    azimuth,
    dip,
    collar_longitude,
    collar_latitude,
    collar_elevation_m,
    collar_source,
    started_at,
    completed_at,
    completion_status,
    completion_notes
  )
  select
    format('GSSRC%s', lpad((((r * 4) + c + 1))::text, 3, '0')),
    case when ((r * 4) + c + 1) <= 7 then 175 + (r * 11) + (c * 7) else null end,
    'Other',
    'Pilbara Grade Control',
    v_demo_owner_id,
    v_demo_org_id,
    'a1000000-0000-4000-8000-000000000003'::uuid,
    'b1000000-0000-4000-8000-000000000003'::uuid,
    180 + (r * 11) + (c * 7),
    case
      when ((r * 4) + c + 1) <= 7 then 'drilled'
      when ((r * 4) + c + 1) <= 10 then 'in_progress'
      else 'proposed'
    end,
    null,
    90,
    -60,
    121.517 + (c * 0.0013),
    -30.802 - (r * 0.00112),
    362 + (r * 2) + c,
    'gps',
    case when ((r * 4) + c + 1) <= 10 then now() - make_interval(days => 39 - ((r * 4) + c + 1) * 2) end,
    case when ((r * 4) + c + 1) <= 7 then now() - make_interval(days => 18 - ((r * 4) + c + 1)) end,
    case when ((r * 4) + c + 1) <= 7 then 'completed' end,
    case when ((r * 4) + c + 1) <= 7 then 'Southern fence line drillout completed.' end
  from generate_series(0, 2) as r
  cross join generate_series(0, 3) as c
  where not exists (
    select 1
    from public.holes existing
    where existing.organization_id = v_demo_org_id
      and existing.hole_id = format('GSSRC%s', lpad((((r * 4) + c + 1))::text, 3, '0'))
  );

  insert into public.holes (
    hole_id,
    depth,
    drilling_diameter,
    drilling_contractor,
    created_by,
    organization_id,
    project_id,
    tenement_id,
    planned_depth,
    state,
    water_level_m,
    azimuth,
    dip,
    collar_longitude,
    collar_latitude,
    collar_elevation_m,
    collar_source,
    started_at,
    completed_at,
    completion_status,
    completion_notes
  )
  select
    format('GSHYD%s', lpad((idx + 1)::text, 3, '0')),
    case when idx <= 5 then 96 + (idx * 9) else null end,
    'Other',
    'AquaWest Hydro',
    v_demo_owner_id,
    v_demo_org_id,
    'a1000000-0000-4000-8000-000000000004'::uuid,
    'b1000000-0000-4000-8000-000000000004'::uuid,
    102 + (idx * 9),
    case when idx <= 5 then 'drilled' when idx <= 6 then 'in_progress' else 'proposed' end,
    case when idx <= 5 then 24 + (idx * 3.4) end,
    180,
    -90,
    121.432 + (idx * 0.00175),
    -30.765 + ((idx % 2) * 0.00042),
    344 + idx,
    'survey',
    case when idx <= 6 then now() - make_interval(days => 64 - idx * 4) end,
    case when idx <= 5 then now() - make_interval(days => 34 - idx * 2) end,
    case when idx <= 5 then 'completed' end,
    case when idx <= 5 then 'Standing water intersection and monitoring piezometer install complete.' end
  from generate_series(0, 7) as idx
  where not exists (
    select 1
    from public.holes existing
    where existing.organization_id = v_demo_org_id
      and existing.hole_id = format('GSHYD%s', lpad((idx + 1)::text, 3, '0'))
  );

  insert into public.holes (
    hole_id,
    depth,
    drilling_diameter,
    drilling_contractor,
    created_by,
    organization_id,
    project_id,
    tenement_id,
    planned_depth,
    state,
    water_level_m,
    azimuth,
    dip,
    collar_longitude,
    collar_latitude,
    collar_elevation_m,
    collar_source,
    started_at,
    completed_at,
    completion_status,
    completion_notes
  )
  select
    format('GSDD%s', lpad((idx + 1)::text, 3, '0')),
    case when idx <= 3 then 330 + (idx * 42) else null end,
    case when idx % 2 = 0 then 'NQ' else 'HQ' end,
    'Kestrel Diamond Drilling',
    v_demo_owner_id,
    v_demo_org_id,
    'a1000000-0000-4000-8000-000000000005'::uuid,
    'b1000000-0000-4000-8000-000000000005'::uuid,
    360 + (idx * 45),
    case when idx <= 3 then 'drilled' when idx = 4 then 'in_progress' else 'proposed' end,
    case when idx <= 3 then 78 + (idx * 5.5) end,
    120 + (idx * 12),
    -60 - (idx * 3),
    121.552 + ((idx % 3) * 0.00122),
    -30.726 - ((idx / 3) * 0.0014),
    358 + idx,
    'survey',
    case when idx <= 4 then now() - make_interval(days => 88 - idx * 8) end,
    case when idx <= 3 then now() - make_interval(days => 28 - idx * 3) end,
    case when idx <= 3 then 'completed' end,
    case when idx <= 3 then 'Diamond tails completed for structural and metallurgical follow-up.' end
  from generate_series(0, 5) as idx
  where not exists (
    select 1
    from public.holes existing
    where existing.organization_id = v_demo_org_id
      and existing.hole_id = format('GSDD%s', lpad((idx + 1)::text, 3, '0'))
  );

  insert into public.hole_descriptor_assignments (
    id,
    organization_id,
    hole_id,
    descriptor_id,
    created_by
  )
  select
    gen_random_uuid(),
    v_demo_org_id,
    h.id,
    case
      when h.hole_id like 'GS%RC%' then v_rc_descriptor_id
      when h.hole_id like 'GSHYD%' then v_hydro_descriptor_id
      when h.hole_id like 'GSDD%' then v_diamond_descriptor_id
    end,
    v_demo_owner_id
  from public.holes h
  where h.organization_id = v_demo_org_id
    and (h.hole_id like 'GS%RC%' or h.hole_id like 'GSHYD%' or h.hole_id like 'GSDD%')
    and not exists (
      select 1
      from public.hole_descriptor_assignments existing
      where existing.organization_id = v_demo_org_id
        and existing.hole_id = h.id
        and existing.descriptor_id = case
          when h.hole_id like 'GS%RC%' then v_rc_descriptor_id
          when h.hole_id like 'GSHYD%' then v_hydro_descriptor_id
          when h.hole_id like 'GSDD%' then v_diamond_descriptor_id
        end
    );

  insert into public.assets (
    organization_id,
    name,
    asset_type,
    value,
    location_id,
    next_service_date,
    service_interval_months,
    status,
    updated_by,
    updated_at,
    asset_type_id,
    project_id,
    longitude,
    latitude,
    coordinate_source
  )
  select
    v_demo_org_id,
    seed.name,
    seed.asset_type_name,
    seed.asset_value,
    seed.location_id,
    seed.next_service_date,
    seed.service_interval_months,
    seed.status,
    v_demo_owner_id,
    now(),
    asset_type.id,
    seed.project_id,
    seed.longitude,
    seed.latitude,
    'manual'
  from (
    values
      ('GS-RC-RIG-01', 'Drill Rig', 2250000::numeric, 'c1000000-0000-4000-8000-000000000001'::uuid, date '2026-06-14', 3, 'Active', 'a1000000-0000-4000-8000-000000000001'::uuid, 121.4662::double precision, -30.6883::double precision),
      ('GS-RC-COMP-01', 'Compressor', 185000::numeric, 'c1000000-0000-4000-8000-000000000001'::uuid, date '2026-05-28', 6, 'Active', 'a1000000-0000-4000-8000-000000000001'::uuid, 121.4666::double precision, -30.6886::double precision),
      ('GS-RC-WAT-01', 'Water Tank', 92000::numeric, 'c1000000-0000-4000-8000-000000000001'::uuid, date '2026-07-01', 12, 'Active', 'a1000000-0000-4000-8000-000000000001'::uuid, 121.4658::double precision, -30.6889::double precision),
      ('GS-RC-GEN-01', 'Generator', 78000::numeric, 'c1000000-0000-4000-8000-000000000001'::uuid, date '2026-06-22', 6, 'Active', 'a1000000-0000-4000-8000-000000000001'::uuid, 121.4669::double precision, -30.6881::double precision),
      ('GS-RC-UTE-01', 'Light Vehicle', 64000::numeric, 'c1000000-0000-4000-8000-000000000001'::uuid, date '2026-08-05', 12, 'Active', 'a1000000-0000-4000-8000-000000000001'::uuid, 121.4655::double precision, -30.6884::double precision),
      ('GS-RC-FUEL-01', 'Fuel Pod', 118000::numeric, 'c1000000-0000-4000-8000-000000000001'::uuid, date '2026-07-19', 12, 'Active', 'a1000000-0000-4000-8000-000000000001'::uuid, 121.4663::double precision, -30.6888::double precision),
      ('GS-RC-RIG-02', 'Drill Rig', 2210000::numeric, 'c1000000-0000-4000-8000-000000000002'::uuid, date '2026-06-17', 3, 'Active', 'a1000000-0000-4000-8000-000000000002'::uuid, 121.4970::double precision, -30.7394::double precision),
      ('GS-RC-COMP-02', 'Compressor', 188000::numeric, 'c1000000-0000-4000-8000-000000000002'::uuid, date '2026-05-30', 6, 'Active', 'a1000000-0000-4000-8000-000000000002'::uuid, 121.4973::double precision, -30.7397::double precision),
      ('GS-RC-WAT-02', 'Water Tank', 94000::numeric, 'c1000000-0000-4000-8000-000000000002'::uuid, date '2026-06-29', 12, 'Active', 'a1000000-0000-4000-8000-000000000003'::uuid, 121.4968::double precision, -30.7398::double precision),
      ('GS-RC-GEN-02', 'Generator', 79000::numeric, 'c1000000-0000-4000-8000-000000000002'::uuid, date '2026-06-21', 6, 'Active', 'a1000000-0000-4000-8000-000000000003'::uuid, 121.4976::double precision, -30.7393::double precision),
      ('GS-WORK-01', 'Workshop Container', 126000::numeric, 'c1000000-0000-4000-8000-000000000002'::uuid, date '2026-08-11', 12, 'Active', 'a1000000-0000-4000-8000-000000000003'::uuid, 121.4969::double precision, -30.7391::double precision),
      ('GS-RC-UTE-02', 'Light Vehicle', 61500::numeric, 'c1000000-0000-4000-8000-000000000002'::uuid, date '2026-08-28', 12, 'Inactive', 'a1000000-0000-4000-8000-000000000003'::uuid, 121.4974::double precision, -30.7399::double precision),
      ('GS-HYDRO-RIG-01', 'Drill Rig', 1730000::numeric, 'c1000000-0000-4000-8000-000000000003'::uuid, date '2026-06-09', 3, 'Active', 'a1000000-0000-4000-8000-000000000004'::uuid, 121.4416::double precision, -30.7661::double precision),
      ('GS-PUMP-01', 'Pump', 42000::numeric, 'c1000000-0000-4000-8000-000000000003'::uuid, date '2026-07-25', 12, 'Active', 'a1000000-0000-4000-8000-000000000004'::uuid, 121.4412::double precision, -30.7663::double precision),
      ('GS-PUMP-02', 'Pump', 41500::numeric, 'c1000000-0000-4000-8000-000000000003'::uuid, date '2026-08-03', 12, 'Active', 'a1000000-0000-4000-8000-000000000004'::uuid, 121.4418::double precision, -30.7659::double precision),
      ('GS-HYDRO-GEN-01', 'Generator', 68500::numeric, 'c1000000-0000-4000-8000-000000000003'::uuid, date '2026-06-27', 6, 'Active', 'a1000000-0000-4000-8000-000000000004'::uuid, 121.4410::double precision, -30.7660::double precision),
      ('GS-DD-RIG-01', 'Drill Rig', 2890000::numeric, 'c1000000-0000-4000-8000-000000000004'::uuid, date '2026-05-24', 3, 'Active', 'a1000000-0000-4000-8000-000000000005'::uuid, 121.5571::double precision, -30.7267::double precision),
      ('GS-CORE-01', 'Core Shed', 97000::numeric, 'c1000000-0000-4000-8000-000000000004'::uuid, date '2026-09-18', 12, 'Active', 'a1000000-0000-4000-8000-000000000005'::uuid, 121.5568::double precision, -30.7264::double precision),
      ('GS-DD-WORK-01', 'Workshop Container', 131000::numeric, 'c1000000-0000-4000-8000-000000000004'::uuid, date '2026-08-09', 12, 'Active', 'a1000000-0000-4000-8000-000000000005'::uuid, 121.5574::double precision, -30.7263::double precision),
      ('GS-DD-FUEL-01', 'Fuel Pod', 123000::numeric, 'c1000000-0000-4000-8000-000000000004'::uuid, date '2026-08-26', 12, 'Active', 'a1000000-0000-4000-8000-000000000005'::uuid, 121.5566::double precision, -30.7268::double precision)
  ) as seed(name, asset_type_name, asset_value, location_id, next_service_date, service_interval_months, status, project_id, longitude, latitude)
  join public.asset_types asset_type
    on asset_type.name = seed.asset_type_name
  where not exists (
    select 1
    from public.assets existing
    where existing.organization_id = v_demo_org_id
      and existing.name = seed.name
  );
end;
$$;
