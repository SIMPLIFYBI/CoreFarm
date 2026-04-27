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

  insert into public.plod_types (
    organization_id,
    code,
    name,
    description,
    is_active,
    sort_order
  )
  values
    (v_demo_org_id, 'drilling_geology', 'Drilling And Geology', 'Operational drilling and geology field activities tied to holes and shifts.', true, 10),
    (v_demo_org_id, 'general_works', 'General Works', 'General field support, water, logistics, and ancillary operational work.', true, 20),
    (v_demo_org_id, 'load_haul', 'Load And Haul', 'Bulk material movement and support earthworks activities.', true, 30)
  on conflict do nothing;

  with activity_seed as (
    select *
    from (
      values
        ('drill_rig_operation', 'Drill Rig Operation', 'Drilling', 'Active rig drilling time charged while the rig is advancing the hole.', '{drilling_geology}'::text[], true, 325::numeric, 'hourly'::text, 'time'::text, null::text, null::numeric),
        ('drill_crew_support', 'Drill Crew Support', 'Drilling', 'Driller offsider and helper support time attributed to the active shift.', '{drilling_geology}'::text[], true, 128::numeric, 'hourly'::text, 'time'::text, null::text, null::numeric),
        ('geologist_logging', 'Geologist Logging', 'Geology', 'Geologist logging, markup, and sampling supervision against active holes.', '{drilling_geology}'::text[], true, 165::numeric, 'hourly'::text, 'time'::text, null::text, null::numeric),
        ('field_supervision', 'Field Supervision', 'Supervision', 'Weekly field supervision and coordination cost spread across active work.', '{drilling_geology,general_works}'::text[], true, 5400::numeric, 'weekly'::text, 'time'::text, null::text, null::numeric),
        ('rig_mobilisation', 'Rig Mobilisation', 'Drilling', 'Rig mobilisation or demobilisation day including permits, convoy, and setup.', '{drilling_geology}'::text[], true, 9800::numeric, 'daily'::text, 'time'::text, null::text, null::numeric),
        ('rig_standby', 'Rig Standby', 'Drilling', 'Weather, access, or safety standby day charged to the field program.', '{drilling_geology}'::text[], true, 6200::numeric, 'daily'::text, 'time'::text, null::text, null::numeric),
        ('water_cart_support', 'Water Cart Support', 'Support', 'Water cart and operator support for drilling and dust suppression.', '{drilling_geology,general_works}'::text[], true, 205::numeric, 'hourly'::text, 'time'::text, null::text, null::numeric),
        ('sample_dispatch', 'Sample Dispatch', 'Sampling', 'Packaging, manifests, and sample dispatch run charged per dispatch day.', '{drilling_geology}'::text[], true, 860::numeric, 'daily'::text, 'time'::text, null::text, null::numeric),
        ('core_processing', 'Core Processing', 'Geology', 'Core handling, tray layout, photography prep, and cutting support.', '{drilling_geology}'::text[], true, 118::numeric, 'hourly'::text, 'time'::text, null::text, null::numeric),
        ('consumables_restock', 'Consumables Restock', 'Support', 'Site restock and laydown replenishment run billed per restock event.', '{general_works}'::text[], true, 420::numeric, null::text, 'unit'::text, 'restock run'::text, 1::numeric)
    ) as seed(activity_type, label, group_name, description, plod_type_scope, billable, rate, rate_period, rate_mode, rate_unit_name, rate_unit_interval)
  )
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
    v_demo_org_id,
    seed.activity_type,
    seed.description,
    v_demo_owner_id,
    seed.group_name,
    seed.label,
    seed.plod_type_scope,
    seed.billable,
    seed.rate,
    seed.rate_period,
    seed.rate_mode,
    seed.rate_unit_name,
    seed.rate_unit_interval
  from activity_seed seed
  where not exists (
    select 1
    from public.plod_activity_types existing
    where existing.organization_id = v_demo_org_id
      and existing.activity_type = seed.activity_type
  );

  with activity_seed as (
    select *
    from (
      values
        ('drill_rig_operation', 'Drill Rig Operation', 'Drilling', 'Active rig drilling time charged while the rig is advancing the hole.', '{drilling_geology}'::text[], true, 325::numeric, 'hourly'::text, 'time'::text, null::text, null::numeric),
        ('drill_crew_support', 'Drill Crew Support', 'Drilling', 'Driller offsider and helper support time attributed to the active shift.', '{drilling_geology}'::text[], true, 128::numeric, 'hourly'::text, 'time'::text, null::text, null::numeric),
        ('geologist_logging', 'Geologist Logging', 'Geology', 'Geologist logging, markup, and sampling supervision against active holes.', '{drilling_geology}'::text[], true, 165::numeric, 'hourly'::text, 'time'::text, null::text, null::numeric),
        ('field_supervision', 'Field Supervision', 'Supervision', 'Weekly field supervision and coordination cost spread across active work.', '{drilling_geology,general_works}'::text[], true, 5400::numeric, 'weekly'::text, 'time'::text, null::text, null::numeric),
        ('rig_mobilisation', 'Rig Mobilisation', 'Drilling', 'Rig mobilisation or demobilisation day including permits, convoy, and setup.', '{drilling_geology}'::text[], true, 9800::numeric, 'daily'::text, 'time'::text, null::text, null::numeric),
        ('rig_standby', 'Rig Standby', 'Drilling', 'Weather, access, or safety standby day charged to the field program.', '{drilling_geology}'::text[], true, 6200::numeric, 'daily'::text, 'time'::text, null::text, null::numeric),
        ('water_cart_support', 'Water Cart Support', 'Support', 'Water cart and operator support for drilling and dust suppression.', '{drilling_geology,general_works}'::text[], true, 205::numeric, 'hourly'::text, 'time'::text, null::text, null::numeric),
        ('sample_dispatch', 'Sample Dispatch', 'Sampling', 'Packaging, manifests, and sample dispatch run charged per dispatch day.', '{drilling_geology}'::text[], true, 860::numeric, 'daily'::text, 'time'::text, null::text, null::numeric),
        ('core_processing', 'Core Processing', 'Geology', 'Core handling, tray layout, photography prep, and cutting support.', '{drilling_geology}'::text[], true, 118::numeric, 'hourly'::text, 'time'::text, null::text, null::numeric),
        ('consumables_restock', 'Consumables Restock', 'Support', 'Site restock and laydown replenishment run billed per restock event.', '{general_works}'::text[], true, 420::numeric, null::text, 'unit'::text, 'restock run'::text, 1::numeric)
    ) as seed(activity_type, label, group_name, description, plod_type_scope, billable, rate, rate_period, rate_mode, rate_unit_name, rate_unit_interval)
  )
  update public.plod_activity_types existing
  set description = seed.description,
      created_by = v_demo_owner_id,
      "group" = seed.group_name,
      label = seed.label,
      plod_type_scope = seed.plod_type_scope,
      billable = seed.billable,
      rate = seed.rate,
      rate_period = seed.rate_period,
      rate_mode = seed.rate_mode,
      rate_unit_name = seed.rate_unit_name,
      rate_unit_interval = seed.rate_unit_interval
  from activity_seed seed
  where existing.organization_id = v_demo_org_id
    and existing.activity_type = seed.activity_type;

  delete from public.plod_activity_type_rates r
  using public.plod_activity_types t
  where r.plod_activity_type_id = t.id
    and t.organization_id = v_demo_org_id
    and t.activity_type in (
      'drill_rig_operation',
      'drill_crew_support',
      'geologist_logging',
      'field_supervision',
      'rig_mobilisation',
      'rig_standby',
      'water_cart_support',
      'sample_dispatch',
      'core_processing',
      'consumables_restock'
    );

  insert into public.plod_activity_type_rates (
    organization_id,
    plod_activity_type_id,
    effective_from,
    effective_to,
    rate,
    rate_period,
    billable,
    created_by
  )
  select
    v_demo_org_id,
    t.id,
    date '2026-01-01',
    null,
    case t.activity_type
      when 'drill_rig_operation' then 325::numeric
      when 'drill_crew_support' then 128::numeric
      when 'geologist_logging' then 165::numeric
      when 'field_supervision' then 5400::numeric
      when 'rig_mobilisation' then 9800::numeric
      when 'rig_standby' then 6200::numeric
      when 'water_cart_support' then 205::numeric
      when 'sample_dispatch' then 860::numeric
      when 'core_processing' then 118::numeric
      when 'consumables_restock' then 420::numeric
    end,
    case t.activity_type
      when 'field_supervision' then 'weekly'::text
      when 'rig_mobilisation' then 'daily'::text
      when 'rig_standby' then 'daily'::text
      when 'sample_dispatch' then 'daily'::text
      when 'consumables_restock' then 'daily'::text
      else 'hourly'::text
    end,
    true,
    v_demo_owner_id
  from public.plod_activity_types t
  where t.organization_id = v_demo_org_id
    and t.activity_type in (
      'drill_rig_operation',
      'drill_crew_support',
      'geologist_logging',
      'field_supervision',
      'rig_mobilisation',
      'rig_standby',
      'water_cart_support',
      'sample_dispatch',
      'core_processing',
      'consumables_restock'
    );

  with consumable_seed as (
    select *
    from (
      values
        ('core_trays_nq', 'Core Trays (NQ)', 0, false, 120, 9.50::numeric, 1),
        ('core_trays_hq', 'Core Trays (HQ)', 0, false, 120, 11.80::numeric, 1),
        ('core_trays_pq', 'Core Trays (PQ)', 0, false, 80, 15.40::numeric, 1),
        ('core_blocks_nq', 'Core Blocks (NQ)', 0, true, 800, 0.42::numeric, 1),
        ('core_blocks_hq', 'Core Blocks (HQ)', 0, true, 800, 0.46::numeric, 1),
        ('core_blocks_pq', 'Core Blocks (PQ)', 0, true, 500, 0.52::numeric, 1),
        ('layflat_nq', 'Layflat (NQ)', 0, true, 40, 28.00::numeric, 1),
        ('layflat_hq', 'Layflat (HQ)', 0, true, 40, 31.00::numeric, 1),
        ('layflat_pq', 'Layflat (PQ)', 0, true, 30, 35.00::numeric, 1),
        ('core_blades_yellow', 'Core Blades (Yellow)', 0, true, 60, 14.50::numeric, 1),
        ('core_blades_orange', 'Core Blades (Orange)', 0, true, 60, 14.50::numeric, 1),
        ('core_blades_green', 'Core Blades (Green)', 0, true, 60, 14.50::numeric, 1),
        ('core_blades_black', 'Core Blades (Black)', 0, true, 60, 14.50::numeric, 1),
        ('pallets_plastic', 'Pallets (Plastic)', 0, false, 40, 78.00::numeric, 1),
        ('pallets_wood', 'Pallets (Wood)', 0, false, 60, 24.00::numeric, 1),
        ('bulk_bags', 'Bulk Bags', 0, true, 100, 18.00::numeric, 1),
        ('calico_bags', 'Calico Bags', 0, true, 2500, 0.68::numeric, 1),
        ('green_sample_bags', 'Green Sample Bags', 0, true, 3000, 0.39::numeric, 1),
        ('sample_tags', 'Sample Tags', 0, true, 5000, 0.09::numeric, 1),
        ('rod_grease', 'Rod Grease', 0, true, 24, 22.00::numeric, 1),
        ('thread_compound', 'Thread Compound', 0, true, 20, 26.50::numeric, 1),
        ('bentonite_bags', 'Bentonite Bags (25kg)', 0, true, 60, 18.50::numeric, 1),
        ('drill_bit_rc_5_5', 'RC Drill Bit 5.5 in', 0, false, 6, 1480.00::numeric, 1),
        ('drill_bit_nq', 'Diamond Bit (NQ)', 0, false, 6, 640.00::numeric, 1),
        ('drill_bit_hq', 'Diamond Bit (HQ)', 0, false, 4, 780.00::numeric, 1),
        ('pvc_casing_50mm', 'PVC Casing 50 mm', 0, true, 90, 21.50::numeric, 1),
        ('screen_pipe_50mm', 'Screen Pipe 50 mm', 0, true, 90, 26.00::numeric, 1),
        ('cement_20kg', 'Cement Bags (20kg)', 0, true, 80, 12.90::numeric, 1)
    ) as seed(key, label, count, include_in_report, reorder_value, cost_per_unit, unit_size)
  )
  insert into public.consumable_items (
    organization_id,
    key,
    label,
    count,
    updated_at,
    include_in_report,
    reorder_value,
    cost_per_unit,
    unit_size
  )
  select
    v_demo_org_id,
    seed.key,
    seed.label,
    seed.count,
    now(),
    seed.include_in_report,
    seed.reorder_value,
    seed.cost_per_unit,
    seed.unit_size
  from consumable_seed seed
  where not exists (
    select 1
    from public.consumable_items existing
    where existing.organization_id = v_demo_org_id
      and existing.key = seed.key
  );

  with consumable_seed as (
    select *
    from (
      values
        ('core_trays_nq', 'Core Trays (NQ)', 0, false, 120, 9.50::numeric, 1),
        ('core_trays_hq', 'Core Trays (HQ)', 0, false, 120, 11.80::numeric, 1),
        ('core_trays_pq', 'Core Trays (PQ)', 0, false, 80, 15.40::numeric, 1),
        ('core_blocks_nq', 'Core Blocks (NQ)', 0, true, 800, 0.42::numeric, 1),
        ('core_blocks_hq', 'Core Blocks (HQ)', 0, true, 800, 0.46::numeric, 1),
        ('core_blocks_pq', 'Core Blocks (PQ)', 0, true, 500, 0.52::numeric, 1),
        ('layflat_nq', 'Layflat (NQ)', 0, true, 40, 28.00::numeric, 1),
        ('layflat_hq', 'Layflat (HQ)', 0, true, 40, 31.00::numeric, 1),
        ('layflat_pq', 'Layflat (PQ)', 0, true, 30, 35.00::numeric, 1),
        ('core_blades_yellow', 'Core Blades (Yellow)', 0, true, 60, 14.50::numeric, 1),
        ('core_blades_orange', 'Core Blades (Orange)', 0, true, 60, 14.50::numeric, 1),
        ('core_blades_green', 'Core Blades (Green)', 0, true, 60, 14.50::numeric, 1),
        ('core_blades_black', 'Core Blades (Black)', 0, true, 60, 14.50::numeric, 1),
        ('pallets_plastic', 'Pallets (Plastic)', 0, false, 40, 78.00::numeric, 1),
        ('pallets_wood', 'Pallets (Wood)', 0, false, 60, 24.00::numeric, 1),
        ('bulk_bags', 'Bulk Bags', 0, true, 100, 18.00::numeric, 1),
        ('calico_bags', 'Calico Bags', 0, true, 2500, 0.68::numeric, 1),
        ('green_sample_bags', 'Green Sample Bags', 0, true, 3000, 0.39::numeric, 1),
        ('sample_tags', 'Sample Tags', 0, true, 5000, 0.09::numeric, 1),
        ('rod_grease', 'Rod Grease', 0, true, 24, 22.00::numeric, 1),
        ('thread_compound', 'Thread Compound', 0, true, 20, 26.50::numeric, 1),
        ('bentonite_bags', 'Bentonite Bags (25kg)', 0, true, 60, 18.50::numeric, 1),
        ('drill_bit_rc_5_5', 'RC Drill Bit 5.5 in', 0, false, 6, 1480.00::numeric, 1),
        ('drill_bit_nq', 'Diamond Bit (NQ)', 0, false, 6, 640.00::numeric, 1),
        ('drill_bit_hq', 'Diamond Bit (HQ)', 0, false, 4, 780.00::numeric, 1),
        ('pvc_casing_50mm', 'PVC Casing 50 mm', 0, true, 90, 21.50::numeric, 1),
        ('screen_pipe_50mm', 'Screen Pipe 50 mm', 0, true, 90, 26.00::numeric, 1),
        ('cement_20kg', 'Cement Bags (20kg)', 0, true, 80, 12.90::numeric, 1)
    ) as seed(key, label, count, include_in_report, reorder_value, cost_per_unit, unit_size)
  )
  update public.consumable_items existing
  set label = seed.label,
      count = seed.count,
      updated_at = now(),
      include_in_report = seed.include_in_report,
      reorder_value = seed.reorder_value,
      cost_per_unit = seed.cost_per_unit,
      unit_size = seed.unit_size
  from consumable_seed seed
  where existing.organization_id = v_demo_org_id
    and existing.key = seed.key;
end;
$$;