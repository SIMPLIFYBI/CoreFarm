do $$
begin
  if to_regclass('public.hole_descriptors') is not null then
    execute 'grant select on table public.hole_descriptors to anon, authenticated';

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'hole_descriptors'
        and policyname = 'hole_descriptors_demo_anon_read'
    ) then
      execute $sql$
        create policy hole_descriptors_demo_anon_read
          on public.hole_descriptors
          for select
          to anon
          using (hole_descriptors.organization_id = 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid)
      $sql$;
    end if;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.hole_descriptor_assignments') is not null then
    execute 'grant select on table public.hole_descriptor_assignments to anon, authenticated';

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'hole_descriptor_assignments'
        and policyname = 'hole_descriptor_assignments_demo_anon_read'
    ) then
      execute $sql$
        create policy hole_descriptor_assignments_demo_anon_read
          on public.hole_descriptor_assignments
          for select
          to anon
          using (hole_descriptor_assignments.organization_id = 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid)
      $sql$;
    end if;
  end if;
end
$$;