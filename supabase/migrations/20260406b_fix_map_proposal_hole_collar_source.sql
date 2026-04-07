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
