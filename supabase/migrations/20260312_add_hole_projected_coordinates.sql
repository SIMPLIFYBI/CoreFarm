alter table public.holes
  add column if not exists collar_easting numeric,
  add column if not exists collar_northing numeric;

alter table public.holes
  drop constraint if exists holes_collar_projected_coordinates_pair_check;

alter table public.holes
  add constraint holes_collar_projected_coordinates_pair_check
  check (
    (collar_easting is null and collar_northing is null)
    or (collar_easting is not null and collar_northing is not null)
  );

alter table public.holes
  drop constraint if exists holes_collar_projected_coordinates_require_project_check;

alter table public.holes
  add constraint holes_collar_projected_coordinates_require_project_check
  check (
    (collar_easting is null and collar_northing is null)
    or project_id is not null
  );
