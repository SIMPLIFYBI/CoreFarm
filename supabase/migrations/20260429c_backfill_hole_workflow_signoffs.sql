with hole_position as (
  select
    h.id as hole_id,
    h.current_workflow_id as workflow_id,
    h.current_workflow_status_key,
    h.started_at,
    h.completed_at,
    h.created_at,
    current_phase.phase_index as current_phase_index,
    current_substage.substage_index as current_substage_index
  from public.holes h
  left join public.workflow_phase_definitions current_phase
    on current_phase.id = h.current_workflow_phase_id
  left join public.workflow_substage_definitions current_substage
    on current_substage.id = h.current_workflow_substage_id
  where h.current_workflow_id is not null
),
completed_targets as (
  select
    hole_position.hole_id,
    hole_position.workflow_id,
    phase.id as workflow_phase_id,
    phase.phase_index,
    substage.id as workflow_substage_id,
    substage.substage_index,
    hole_position.started_at,
    hole_position.completed_at,
    hole_position.created_at,
    row_number() over (
      partition by hole_position.hole_id
      order by phase.phase_index, substage.substage_index
    ) as completed_step_order,
    count(*) over (partition by hole_position.hole_id) as completed_step_count
  from hole_position
  join public.workflow_phase_definitions phase
    on phase.workflow_id = hole_position.workflow_id
  join public.workflow_substage_definitions substage
    on substage.workflow_phase_id = phase.id
  where phase.phase_index < coalesce(hole_position.current_phase_index, 0)
     or (
       phase.phase_index = hole_position.current_phase_index
       and substage.substage_index <= case
         when hole_position.current_workflow_status_key = 'complete' then coalesce(hole_position.current_substage_index, 0)
         else greatest(coalesce(hole_position.current_substage_index, 1) - 1, 0)
       end
     )
),
completed_targets_with_dates as (
  select
    completed_targets.hole_id,
    completed_targets.workflow_id,
    completed_targets.workflow_phase_id,
    completed_targets.workflow_substage_id,
    case
      when completed_targets.completed_step_count <= 1 then coalesce(completed_targets.completed_at, completed_targets.started_at, completed_targets.created_at, now())
      else coalesce(completed_targets.started_at, completed_targets.created_at, now() - interval '14 days')
        + (
          ((completed_targets.completed_step_order - 1)::numeric / greatest(completed_targets.completed_step_count - 1, 1)::numeric)
          * (
            coalesce(completed_targets.completed_at, completed_targets.started_at, completed_targets.created_at, now())
            - coalesce(completed_targets.started_at, completed_targets.created_at, now() - interval '14 days')
          )
        )
    end as logical_signed_off_at
  from completed_targets
)
insert into public.hole_workflow_substage_statuses (
  hole_id,
  workflow_id,
  workflow_phase_id,
  workflow_substage_id,
  status_key,
  signed_off_by,
  signed_off_at,
  signoff_note
)
select
  target.hole_id,
  target.workflow_id,
  target.workflow_phase_id,
  target.workflow_substage_id,
  'complete',
  'ea8d9db4-3750-4382-88b4-51009650c91c'::uuid,
  target.logical_signed_off_at,
  'Backfilled sign-off for existing completed workflow step.'
from completed_targets_with_dates target
on conflict (hole_id, workflow_substage_id) do update
set
  workflow_id = excluded.workflow_id,
  workflow_phase_id = excluded.workflow_phase_id,
  status_key = 'complete',
  signed_off_by = 'ea8d9db4-3750-4382-88b4-51009650c91c'::uuid,
  signed_off_at = coalesce(public.hole_workflow_substage_statuses.signed_off_at, excluded.signed_off_at),
  signoff_note = case
    when coalesce(btrim(public.hole_workflow_substage_statuses.signoff_note), '') <> '' then public.hole_workflow_substage_statuses.signoff_note
    else excluded.signoff_note
  end,
  updated_at = greatest(public.hole_workflow_substage_statuses.updated_at, excluded.signed_off_at);

update public.hole_workflow_substage_statuses
set
  signed_off_by = 'ea8d9db4-3750-4382-88b4-51009650c91c'::uuid,
  signed_off_at = coalesce(signed_off_at, updated_at, now()),
  signoff_note = case
    when coalesce(btrim(signoff_note), '') <> '' then signoff_note
    else 'Backfilled sign-off for existing completed workflow step.'
  end
where status_key = 'complete';