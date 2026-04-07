create table if not exists public.map_location_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  entity_type text not null check (entity_type in ('hole', 'asset')),
  entity_id uuid not null,
  proposed_longitude numeric not null,
  proposed_latitude numeric not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text
);

create index if not exists idx_map_location_proposals_org_status
  on public.map_location_proposals (organization_id, status, created_at desc);

create index if not exists idx_map_location_proposals_entity
  on public.map_location_proposals (entity_type, entity_id, created_at desc);

create unique index if not exists idx_map_location_proposals_pending_entity
  on public.map_location_proposals (entity_type, entity_id)
  where status = 'pending';

create or replace function public.sync_map_location_proposal_entity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_project_id uuid;
begin
  if new.entity_type = 'hole' then
    select h.organization_id, h.project_id
      into v_org_id, v_project_id
    from public.holes h
    where h.id = new.entity_id;
  elsif new.entity_type = 'asset' then
    select a.organization_id, a.project_id
      into v_org_id, v_project_id
    from public.assets a
    where a.id = new.entity_id;
  else
    raise exception 'Unsupported entity type %', new.entity_type using errcode = '23514';
  end if;

  if v_org_id is null then
    raise exception 'Map proposal target % (%) does not exist', new.entity_type, new.entity_id using errcode = '23503';
  end if;

  if new.organization_id is not null and new.organization_id <> v_org_id then
    raise exception 'Entity % (%) does not belong to organization %', new.entity_type, new.entity_id, new.organization_id using errcode = '23514';
  end if;

  new.organization_id := v_org_id;
  new.project_id := v_project_id;
  new.updated_at := now();

  if new.status = 'pending' then
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.review_note := null;
  elsif new.reviewed_at is null then
    new.reviewed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_map_location_proposal_entity on public.map_location_proposals;
create trigger trg_sync_map_location_proposal_entity
before insert or update of organization_id, project_id, entity_type, entity_id, status, proposed_longitude, proposed_latitude, note, review_note
on public.map_location_proposals
for each row
execute function public.sync_map_location_proposal_entity();

create or replace function public.cleanup_hole_map_location_proposals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.map_location_proposals
  where entity_type = 'hole'
    and entity_id = old.id;

  return old;
end;
$$;

create or replace function public.cleanup_asset_map_location_proposals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.map_location_proposals
  where entity_type = 'asset'
    and entity_id = old.id;

  return old;
end;
$$;

drop trigger if exists trg_cleanup_hole_map_location_proposals on public.holes;
create trigger trg_cleanup_hole_map_location_proposals
after delete on public.holes
for each row
execute function public.cleanup_hole_map_location_proposals();

drop trigger if exists trg_cleanup_asset_map_location_proposals on public.assets;
create trigger trg_cleanup_asset_map_location_proposals
after delete on public.assets
for each row
execute function public.cleanup_asset_map_location_proposals();

create or replace function public.review_map_location_proposal(
  p_proposal_id uuid,
  p_decision text,
  p_review_note text default null
)
returns public.map_location_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.map_location_proposals%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  select *
    into v_proposal
  from public.map_location_proposals
  where id = p_proposal_id
  for update;

  if v_proposal.id is null then
    raise exception 'Map location proposal % not found', p_proposal_id using errcode = '23503';
  end if;

  if v_proposal.status <> 'pending' then
    raise exception 'Map location proposal % is already %', p_proposal_id, v_proposal.status using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.organization_members m
    where m.organization_id = v_proposal.organization_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
  ) then
    raise exception 'Only organization admins can review map location proposals';
  end if;

  if p_decision = 'approved' then
    if v_proposal.entity_type = 'hole' then
      update public.holes
      set collar_longitude = v_proposal.proposed_longitude,
          collar_latitude = v_proposal.proposed_latitude,
          collar_source = 'estimated'
      where id = v_proposal.entity_id
        and organization_id = v_proposal.organization_id;

      if not found then
        raise exception 'Hole % could not be updated from proposal %', v_proposal.entity_id, v_proposal.id using errcode = '23503';
      end if;
    else
      update public.assets
      set longitude = v_proposal.proposed_longitude,
          latitude = v_proposal.proposed_latitude,
          coordinate_source = 'proposal_approved'
      where id = v_proposal.entity_id
        and organization_id = v_proposal.organization_id;

      if not found then
        raise exception 'Asset % could not be updated from proposal %', v_proposal.entity_id, v_proposal.id using errcode = '23503';
      end if;
    end if;
  end if;

  update public.map_location_proposals
  set status = p_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = nullif(trim(coalesce(p_review_note, '')), ''),
      updated_at = now()
  where id = v_proposal.id
  returning * into v_proposal;

  return v_proposal;
end;
$$;

alter table public.map_location_proposals enable row level security;

drop policy if exists map_location_proposals_org_read on public.map_location_proposals;
create policy map_location_proposals_org_read on public.map_location_proposals
  for select
  using (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = map_location_proposals.organization_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists map_location_proposals_org_insert on public.map_location_proposals;
create policy map_location_proposals_org_insert on public.map_location_proposals
  for insert
  with check (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = map_location_proposals.organization_id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  );

drop policy if exists map_location_proposals_org_update on public.map_location_proposals;
create policy map_location_proposals_org_update on public.map_location_proposals
  for update
  using (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = map_location_proposals.organization_id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = map_location_proposals.organization_id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  );

drop policy if exists map_location_proposals_org_delete on public.map_location_proposals;
create policy map_location_proposals_org_delete on public.map_location_proposals
  for delete
  using (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = map_location_proposals.organization_id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  );