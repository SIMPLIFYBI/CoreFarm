with seed_user as (
  select 'c15269d9-5c20-42ea-891a-e4fdf8e42586'::uuid as user_id
),
orphan_hole_orgs as (
  select
    h.organization_id,
    coalesce(
      (array_agg(h.created_by order by h.created_at, h.id) filter (where h.created_by is not null))[1],
      (
        select (array_agg(project.created_by order by project.created_at, project.id) filter (where project.created_by is not null))[1]
        from public.projects project
        where project.organization_id = h.organization_id
      ),
      (select user_id from seed_user)
    ) as created_by
  from public.holes h
  where h.organization_id is not null
    and h.project_id is null
  group by h.organization_id
),
fallback_projects as (
  insert into public.projects (
    organization_id,
    name,
    created_by,
    cost_code,
    wbs_code
  )
  select
    orphan_hole_orgs.organization_id,
    'Legacy Unassigned Holes',
    orphan_hole_orgs.created_by,
    'LEGACY',
    'legacy_unassigned_holes'
  from orphan_hole_orgs
  where orphan_hole_orgs.created_by is not null
    and not exists (
      select 1
      from public.projects project
      where project.organization_id = orphan_hole_orgs.organization_id
        and project.wbs_code = 'legacy_unassigned_holes'
    )
  returning id, organization_id
),
resolved_fallback_projects as (
  select id, organization_id
  from fallback_projects

  union all

  select project.id, project.organization_id
  from public.projects project
  where project.wbs_code = 'legacy_unassigned_holes'
)
update public.holes hole
set project_id = fallback_project.id
from resolved_fallback_projects fallback_project
where hole.organization_id = fallback_project.organization_id
  and hole.project_id is null;

insert into public.workflow_definitions (
  organization_id,
  entity_type,
  key,
  name,
  description,
  color,
  sort_order,
  is_active
)
select
  orgs.organization_id,
  'project',
  'default_project_lifecycle',
  'Project Delivery Workflow',
  'Default project workflow for setup, mobilisation, delivery, and closeout.',
  '#22c55e',
  10,
  true
from (
  select distinct p.organization_id
  from public.projects p
  where p.organization_id is not null
) as orgs
on conflict (organization_id, entity_type, key) do update
set
  name = excluded.name,
  description = excluded.description,
  color = excluded.color,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.workflow_definitions (
  organization_id,
  entity_type,
  key,
  name,
  description,
  color,
  sort_order,
  is_active
)
select
  orgs.organization_id,
  'hole',
  'default_hole_lifecycle',
  'Hole Delivery Workflow',
  'Default hole workflow for targeting, pre-start, drilling, completion, and closeout.',
  '#f59e0b',
  10,
  true
from (
  select distinct h.organization_id
  from public.holes h
  where h.organization_id is not null
) as orgs
on conflict (organization_id, entity_type, key) do update
set
  name = excluded.name,
  description = excluded.description,
  color = excluded.color,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

with phase_seed(entity_type, workflow_key, phase_index, name, description) as (
  values
    ('project', 'default_project_lifecycle', 1, 'Discovery', 'Confirm the project scope, target rationale, and operating context.'),
    ('project', 'default_project_lifecycle', 2, 'Planning', 'Prepare collar design, approvals, budget, and execution readiness.'),
    ('project', 'default_project_lifecycle', 3, 'Mobilisation', 'Line up crews, contractors, equipment, and site readiness.'),
    ('project', 'default_project_lifecycle', 4, 'Delivery', 'Run the active drilling campaign and capture operational data.'),
    ('project', 'default_project_lifecycle', 5, 'Closeout', 'Reconcile outputs, finalise reporting, and hand the program over.'),
    ('hole', 'default_hole_lifecycle', 1, 'Targeting', 'Define and confirm the intended collar and target for the hole.'),
    ('hole', 'default_hole_lifecycle', 2, 'Pre-start', 'Complete field readiness before the drill crew starts the hole.'),
    ('hole', 'default_hole_lifecycle', 3, 'Drilling', 'Track the active drilling interval and sample capture work.'),
    ('hole', 'default_hole_lifecycle', 4, 'Completion', 'Wrap up physical hole completion tasks and field review.'),
    ('hole', 'default_hole_lifecycle', 5, 'Closeout', 'Finish downstream data, reconciliation, and administrative closure.')
)
update public.workflow_phase_definitions phase
set
  name = phase_seed.name,
  description = phase_seed.description,
  updated_at = now()
from phase_seed
join public.workflow_definitions workflow
  on workflow.entity_type = phase_seed.entity_type
 and workflow.key = phase_seed.workflow_key
where phase.workflow_id = workflow.id
  and phase.phase_index = phase_seed.phase_index;

with substage_seed(entity_type, workflow_key, phase_index, substage_index, name, description) as (
  values
    ('project', 'default_project_lifecycle', 1, 1, 'Opportunity defined', 'The project intent, target area, and initial scope are established.'),
    ('project', 'default_project_lifecycle', 1, 2, 'Access and tenure aligned', 'Tenure, stakeholder access, and operating assumptions are confirmed.'),
    ('project', 'default_project_lifecycle', 2, 1, 'Collar plan and survey design', 'Hole layout, coordinate controls, and design inputs are prepared.'),
    ('project', 'default_project_lifecycle', 2, 2, 'Budget and approvals approved', 'Commercial approvals, permits, and execution sign-off are in place.'),
    ('project', 'default_project_lifecycle', 3, 1, 'Crew and equipment booked', 'People, contractors, and equipment are allocated against the program.'),
    ('project', 'default_project_lifecycle', 3, 2, 'Site ready to start', 'Field setup is ready and the project is prepared to mobilise on site.'),
    ('project', 'default_project_lifecycle', 4, 1, 'Drilling underway', 'The project is actively drilling holes in the field.'),
    ('project', 'default_project_lifecycle', 4, 2, 'Sampling and data capture', 'Operational samples, logs, and field data are being captured and reviewed.'),
    ('project', 'default_project_lifecycle', 5, 1, 'Reporting and reconciliation', 'Project outputs are being checked, reconciled, and assembled.'),
    ('project', 'default_project_lifecycle', 5, 2, 'Final handover', 'The campaign is complete and final deliverables are signed off.'),
    ('hole', 'default_hole_lifecycle', 1, 1, 'Collar proposed', 'The hole exists as a proposed target awaiting further confirmation.'),
    ('hole', 'default_hole_lifecycle', 1, 2, 'Collar reviewed', 'The collar position and intended target have been reviewed and accepted.'),
    ('hole', 'default_hole_lifecycle', 2, 1, 'Access and pad ready', 'The field team has the access and site prep needed to start the hole.'),
    ('hole', 'default_hole_lifecycle', 2, 2, 'Rig scheduled', 'The drilling resource is lined up and the hole is queued for start.'),
    ('hole', 'default_hole_lifecycle', 3, 1, 'Drilling underway', 'The hole is currently being drilled.'),
    ('hole', 'default_hole_lifecycle', 3, 2, 'Sampling and logging underway', 'Sampling, logging, or related data capture is active while drilling progresses.'),
    ('hole', 'default_hole_lifecycle', 4, 1, 'Surveys and rehab pending', 'The hole has been physically completed and remaining field wrap-up is pending.'),
    ('hole', 'default_hole_lifecycle', 4, 2, 'Completion reviewed', 'Completion outcome has been reviewed, including non-standard end states.'),
    ('hole', 'default_hole_lifecycle', 5, 1, 'Assays and data reconciled', 'Downstream data and records are being reconciled against the hole.'),
    ('hole', 'default_hole_lifecycle', 5, 2, 'Hole closed out', 'The hole is fully closed out in the operational register.')
)
insert into public.workflow_substage_definitions (
  workflow_phase_id,
  substage_index,
  name,
  description
)
select
  phase.id,
  substage_seed.substage_index,
  substage_seed.name,
  substage_seed.description
from substage_seed
join public.workflow_definitions workflow
  on workflow.entity_type = substage_seed.entity_type
 and workflow.key = substage_seed.workflow_key
join public.workflow_phase_definitions phase
  on phase.workflow_id = workflow.id
 and phase.phase_index = substage_seed.phase_index
on conflict (workflow_phase_id, substage_index) do update
set
  name = excluded.name,
  description = excluded.description,
  updated_at = now();

delete from public.project_workflow_substage_statuses;
delete from public.project_workflow_phase_statuses;
delete from public.hole_workflow_substage_statuses;
delete from public.hole_workflow_phase_statuses;

with project_workflow_map as (
  select
    workflow.organization_id,
    workflow.id as workflow_id,
    (array_agg(phase.id order by phase.id) filter (where phase.phase_index = 1))[1] as phase_1_id,
    (array_agg(phase.id order by phase.id) filter (where phase.phase_index = 2))[1] as phase_2_id,
    (array_agg(phase.id order by phase.id) filter (where phase.phase_index = 3))[1] as phase_3_id,
    (array_agg(phase.id order by phase.id) filter (where phase.phase_index = 4))[1] as phase_4_id,
    (array_agg(phase.id order by phase.id) filter (where phase.phase_index = 5))[1] as phase_5_id,
    (array_agg(substage.id order by substage.id) filter (where phase.phase_index = 1 and substage.substage_index = 1))[1] as phase_1_substage_1_id,
    (array_agg(substage.id order by substage.id) filter (where phase.phase_index = 2 and substage.substage_index = 1))[1] as phase_2_substage_1_id,
    (array_agg(substage.id order by substage.id) filter (where phase.phase_index = 3 and substage.substage_index = 1))[1] as phase_3_substage_1_id,
    (array_agg(substage.id order by substage.id) filter (where phase.phase_index = 3 and substage.substage_index = 2))[1] as phase_3_substage_2_id,
    (array_agg(substage.id order by substage.id) filter (where phase.phase_index = 4 and substage.substage_index = 1))[1] as phase_4_substage_1_id,
    (array_agg(substage.id order by substage.id) filter (where phase.phase_index = 4 and substage.substage_index = 2))[1] as phase_4_substage_2_id,
    (array_agg(substage.id order by substage.id) filter (where phase.phase_index = 5 and substage.substage_index = 2))[1] as phase_5_substage_2_id
  from public.workflow_definitions workflow
  join public.workflow_phase_definitions phase
    on phase.workflow_id = workflow.id
  left join public.workflow_substage_definitions substage
    on substage.workflow_phase_id = phase.id
  where workflow.entity_type = 'project'
    and workflow.key = 'default_project_lifecycle'
  group by workflow.organization_id, workflow.id
),
project_rollup as (
  select
    project.id,
    project.organization_id,
    project.start_date,
    project.finish_date,
    count(hole.id)::integer as hole_count,
    count(*) filter (where hole.state = 'in_progress')::integer as in_progress_hole_count,
    count(*) filter (
      where hole.state = 'drilled'
         or hole.completed_at is not null
         or hole.completion_status = 'completed'
    )::integer as drilled_hole_count
  from public.projects project
  left join public.holes hole
    on hole.project_id = project.id
  group by project.id, project.organization_id, project.start_date, project.finish_date
)
update public.projects project
set
  current_workflow_id = workflow_map.workflow_id,
  current_workflow_stage_id = null,
  current_workflow_phase_id = case
    when (
      (project_rollup.hole_count > 0 and project_rollup.drilled_hole_count >= project_rollup.hole_count)
      or (project_rollup.finish_date is not null and project_rollup.finish_date < current_date)
    ) then workflow_map.phase_5_id
    when project_rollup.in_progress_hole_count > 0 then workflow_map.phase_4_id
    when project_rollup.drilled_hole_count > 0 then workflow_map.phase_4_id
    when project_rollup.start_date is not null and project_rollup.start_date <= current_date then workflow_map.phase_3_id
    when project_rollup.start_date is not null and project_rollup.start_date > current_date then workflow_map.phase_3_id
    when project_rollup.hole_count > 0 then workflow_map.phase_2_id
    else workflow_map.phase_1_id
  end,
  current_workflow_substage_id = case
    when (
      (project_rollup.hole_count > 0 and project_rollup.drilled_hole_count >= project_rollup.hole_count)
      or (project_rollup.finish_date is not null and project_rollup.finish_date < current_date)
    ) then workflow_map.phase_5_substage_2_id
    when project_rollup.in_progress_hole_count > 0 then workflow_map.phase_4_substage_1_id
    when project_rollup.drilled_hole_count > 0 then workflow_map.phase_4_substage_2_id
    when project_rollup.start_date is not null and project_rollup.start_date <= current_date then workflow_map.phase_3_substage_1_id
    when project_rollup.start_date is not null and project_rollup.start_date > current_date then workflow_map.phase_3_substage_1_id
    when project_rollup.hole_count > 0 then workflow_map.phase_2_substage_1_id
    else workflow_map.phase_1_substage_1_id
  end,
  current_workflow_status_key = case
    when (
      (project_rollup.hole_count > 0 and project_rollup.drilled_hole_count >= project_rollup.hole_count)
      or (project_rollup.finish_date is not null and project_rollup.finish_date < current_date)
    ) then 'complete'
    when project_rollup.in_progress_hole_count > 0 then 'in_progress'
    when project_rollup.drilled_hole_count > 0 then 'in_progress'
    when project_rollup.start_date is not null and project_rollup.start_date <= current_date then 'in_progress'
    else 'planned'
  end
from project_rollup
join project_workflow_map workflow_map
  on workflow_map.organization_id = project_rollup.organization_id
where project.id = project_rollup.id;

with hole_workflow_map as (
  select
    workflow.organization_id,
    workflow.id as workflow_id,
    (array_agg(phase.id order by phase.id) filter (where phase.phase_index = 1))[1] as phase_1_id,
    (array_agg(phase.id order by phase.id) filter (where phase.phase_index = 2))[1] as phase_2_id,
    (array_agg(phase.id order by phase.id) filter (where phase.phase_index = 3))[1] as phase_3_id,
    (array_agg(phase.id order by phase.id) filter (where phase.phase_index = 4))[1] as phase_4_id,
    (array_agg(phase.id order by phase.id) filter (where phase.phase_index = 5))[1] as phase_5_id,
    (array_agg(substage.id order by substage.id) filter (where phase.phase_index = 1 and substage.substage_index = 1))[1] as phase_1_substage_1_id,
    (array_agg(substage.id order by substage.id) filter (where phase.phase_index = 1 and substage.substage_index = 2))[1] as phase_1_substage_2_id,
    (array_agg(substage.id order by substage.id) filter (where phase.phase_index = 2 and substage.substage_index = 1))[1] as phase_2_substage_1_id,
    (array_agg(substage.id order by substage.id) filter (where phase.phase_index = 2 and substage.substage_index = 2))[1] as phase_2_substage_2_id,
    (array_agg(substage.id order by substage.id) filter (where phase.phase_index = 3 and substage.substage_index = 1))[1] as phase_3_substage_1_id,
    (array_agg(substage.id order by substage.id) filter (where phase.phase_index = 3 and substage.substage_index = 2))[1] as phase_3_substage_2_id,
    (array_agg(substage.id order by substage.id) filter (where phase.phase_index = 4 and substage.substage_index = 2))[1] as phase_4_substage_2_id,
    (array_agg(substage.id order by substage.id) filter (where phase.phase_index = 5 and substage.substage_index = 2))[1] as phase_5_substage_2_id
  from public.workflow_definitions workflow
  join public.workflow_phase_definitions phase
    on phase.workflow_id = workflow.id
  left join public.workflow_substage_definitions substage
    on substage.workflow_phase_id = phase.id
  where workflow.entity_type = 'hole'
    and workflow.key = 'default_hole_lifecycle'
  group by workflow.organization_id, workflow.id
),
hole_rollup as (
  select
    hole.id,
    hole.organization_id,
    hole.state,
    hole.depth,
    hole.planned_depth,
    hole.started_at,
    hole.completed_at,
    hole.completion_status,
    hole.collar_longitude,
    hole.collar_latitude,
    hole.collar_easting,
    hole.collar_northing,
    project.start_date as project_start_date
  from public.holes hole
  left join public.projects project
    on project.id = hole.project_id
)
update public.holes hole
set
  current_workflow_id = workflow_map.workflow_id,
  current_workflow_stage_id = null,
  current_workflow_phase_id = case
    when (
      hole_rollup.state = 'drilled'
      or hole_rollup.completed_at is not null
      or hole_rollup.completion_status = 'completed'
    ) then workflow_map.phase_5_id
    when hole_rollup.completion_status in ('abandoned', 'suspended') then workflow_map.phase_4_id
    when hole_rollup.state = 'in_progress' or hole_rollup.started_at is not null then workflow_map.phase_3_id
    when (
      hole_rollup.collar_longitude is not null
      or hole_rollup.collar_latitude is not null
      or hole_rollup.collar_easting is not null
      or hole_rollup.collar_northing is not null
    ) and hole_rollup.project_start_date is not null and hole_rollup.project_start_date <= current_date + 14 then workflow_map.phase_2_id
    when (
      hole_rollup.collar_longitude is not null
      or hole_rollup.collar_latitude is not null
      or hole_rollup.collar_easting is not null
      or hole_rollup.collar_northing is not null
    ) then workflow_map.phase_1_id
    else workflow_map.phase_1_id
  end,
  current_workflow_substage_id = case
    when (
      hole_rollup.state = 'drilled'
      or hole_rollup.completed_at is not null
      or hole_rollup.completion_status = 'completed'
    ) then workflow_map.phase_5_substage_2_id
    when hole_rollup.completion_status in ('abandoned', 'suspended') then workflow_map.phase_4_substage_2_id
    when hole_rollup.state = 'in_progress' or hole_rollup.started_at is not null then case
      when coalesce(hole_rollup.planned_depth, 0) > 0
       and coalesce(hole_rollup.depth, 0) >= hole_rollup.planned_depth * 0.75 then workflow_map.phase_3_substage_2_id
      else workflow_map.phase_3_substage_1_id
    end
    when (
      hole_rollup.collar_longitude is not null
      or hole_rollup.collar_latitude is not null
      or hole_rollup.collar_easting is not null
      or hole_rollup.collar_northing is not null
    ) and hole_rollup.project_start_date is not null and hole_rollup.project_start_date <= current_date + 14 then workflow_map.phase_2_substage_2_id
    when (
      hole_rollup.collar_longitude is not null
      or hole_rollup.collar_latitude is not null
      or hole_rollup.collar_easting is not null
      or hole_rollup.collar_northing is not null
    ) then workflow_map.phase_1_substage_2_id
    else workflow_map.phase_1_substage_1_id
  end,
  current_workflow_status_key = case
    when (
      hole_rollup.state = 'drilled'
      or hole_rollup.completed_at is not null
      or hole_rollup.completion_status = 'completed'
    ) then 'complete'
    when hole_rollup.completion_status in ('abandoned', 'suspended') then 'complete'
    when hole_rollup.state = 'in_progress' or hole_rollup.started_at is not null then 'in_progress'
    else 'planned'
  end
from hole_rollup
join hole_workflow_map workflow_map
  on workflow_map.organization_id = hole_rollup.organization_id
where hole.id = hole_rollup.id;