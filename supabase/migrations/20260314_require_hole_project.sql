alter table public.holes
  drop constraint if exists holes_project_required_check;

alter table public.holes
  add constraint holes_project_required_check
  check (project_id is not null) not valid;