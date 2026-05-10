alter table if exists public.workflow_status_catalog enable row level security;

grant select on table public.workflow_status_catalog to anon, authenticated;

do $$
begin
  if to_regclass('public.workflow_status_catalog') is not null then
    if exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'workflow_status_catalog'
        and policyname = 'workflow_status_catalog_public_read'
    ) then
      execute 'drop policy workflow_status_catalog_public_read on public.workflow_status_catalog';
    end if;

    execute $sql$
      create policy workflow_status_catalog_public_read
        on public.workflow_status_catalog
        for select
        to anon, authenticated
        using (true)
    $sql$;
  end if;
end
$$;

alter view if exists public.contract_activity_rates set (security_invoker = true);
alter view if exists public.v_plod_latest_pricing set (security_invoker = true);
alter view if exists public.hole_task_completion set (security_invoker = true);
alter view if exists public.hole_completion_summary set (security_invoker = true);