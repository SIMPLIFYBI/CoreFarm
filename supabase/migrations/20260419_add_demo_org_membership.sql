create or replace function public.ensure_demo_org_membership_for_user(
  p_user_id uuid,
  p_created_at timestamp with time zone default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    added_by,
    created_at
  )
  select
    'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid,
    p_user_id,
    'member',
    null,
    coalesce(p_created_at, now())
  where exists (
    select 1
    from public.organizations
    where id = 'd012a71c-e9e2-4cd3-a3ba-08dcef8519ec'::uuid
  )
  on conflict (organization_id, user_id) do nothing;
end;
$$;

create or replace function public.handle_new_auth_user_demo_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_demo_org_membership_for_user(new.id, new.created_at);
  return new;
end;
$$;

drop trigger if exists trg_auth_user_demo_membership on auth.users;

create trigger trg_auth_user_demo_membership
after insert on auth.users
for each row
execute function public.handle_new_auth_user_demo_membership();

select public.ensure_demo_org_membership_for_user(u.id, u.created_at)
from auth.users u;
