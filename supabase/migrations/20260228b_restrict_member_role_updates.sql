begin;

create or replace function public.enforce_org_member_role_change_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is null then
      raise exception 'Not authenticated';
    end if;

    if not exists (
      select 1
      from public.organization_members m
      where m.organization_id = old.organization_id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    ) then
      raise exception 'Only organization admins can change member roles';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_org_member_role_change_admin on public.organization_members;

create trigger trg_enforce_org_member_role_change_admin
before update on public.organization_members
for each row
execute function public.enforce_org_member_role_change_admin();

commit;
