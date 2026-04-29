alter table public.hole_workflow_substage_statuses
  add column if not exists signed_off_by uuid references auth.users(id),
  add column if not exists signed_off_at timestamp with time zone,
  add column if not exists signoff_note text;

create index if not exists hole_workflow_substage_statuses_signed_off_by_idx
  on public.hole_workflow_substage_statuses (signed_off_by)
  where signed_off_by is not null;