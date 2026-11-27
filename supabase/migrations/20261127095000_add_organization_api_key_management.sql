begin;
create or replace function public.bmg_list_organization_api_keys(p_organization_id uuid)
returns table (
  id uuid,
  user_id uuid,
  user_name text,
  user_email text,
  label text,
  key_prefix text,
  created_at timestamptz,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  project_id uuid,
  project_name text
)
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_owner uuid;
  v_is_default boolean;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select o.owner_id,o.is_default_workspace into v_owner,v_is_default
  from public.organizations o where o.id=p_organization_id;
  if not found then raise exception 'Workspace not found' using errcode='P0002'; end if;
  if v_is_default then raise exception 'Use account API keys for the default personal workspace'; end if;
  if v_owner<>v_actor and not exists(
    select 1 from public.organization_members m
    where m.organization_id=p_organization_id and m.user_id=v_actor
  ) then
    raise exception 'Workspace access required' using errcode='42501';
  end if;
  return query
  select k.id,k.user_id,coalesce(nullif(pr.display_name,''),pr.email),pr.email,
    k.label,k.key_prefix,k.created_at,k.last_used_at,k.expires_at,k.revoked_at,
    k.project_id,projects.name
  from private.api_keys k
  left join public.profiles pr on pr.id=k.user_id
  left join public.projects on projects.id=k.project_id
  where k.organization_id=p_organization_id
  order by k.created_at desc;
end;
$function$;

create or replace function public.bmg_revoke_organization_api_key(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_jwt jsonb:=auth.jwt();
  v_key_owner uuid;
  v_organization_id uuid;
  v_is_default boolean;
  v_member_role text;
  v_requires_mfa boolean;
  v_recent_totp boolean;
  v_affected integer;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;

  select exists(
    select 1 from auth.mfa_factors f
    where f.user_id=v_actor and f.factor_type='totp' and f.status='verified'
  ) into v_requires_mfa;
  if not v_requires_mfa then raise exception 'Two-factor authentication required' using errcode='42501'; end if;

  select (v_jwt->>'aal'='aal2') and exists(
    select 1 from jsonb_array_elements(coalesce(v_jwt->'amr','[]'::jsonb)) as entry
    where entry->>'method'='totp'
      and coalesce((entry->>'timestamp')::numeric,0)>=extract(epoch from (now()-interval '2 hours'))
  ) into v_recent_totp;
  if not coalesce(v_recent_totp,false) then
    raise exception 'Recent authenticator verification required' using errcode='42501';
  end if;

  select k.user_id,k.organization_id,o.is_default_workspace
  into v_key_owner,v_organization_id,v_is_default
  from private.api_keys k
  join public.organizations o on o.id=k.organization_id
  where k.id=p_id
  for update of k;
  if not found then return false; end if;
  if v_is_default then raise exception 'Use account API key management for the default personal workspace'; end if;

  select m.role into v_member_role
  from public.organization_members m
  where m.organization_id=v_organization_id and m.user_id=v_actor;

  if v_key_owner<>v_actor and v_member_role not in ('owner','admin') then
    raise exception 'Organization key management permission required' using errcode='42501';
  end if;

  update private.api_keys
  set revoked_at=now()
  where id=p_id and revoked_at is null;
  get diagnostics v_affected=row_count;
  if v_affected=1 then
    insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
    values(v_actor,'api_key.organization_revoke','api_key',p_id::text,
      jsonb_build_object('organization_id',v_organization_id,'key_owner_id',v_key_owner));
  end if;
  return v_affected=1;
end;
$function$;

revoke all on function public.bmg_list_organization_api_keys(uuid) from public,anon;
revoke all on function public.bmg_revoke_organization_api_key(uuid) from public,anon;
grant execute on function public.bmg_list_organization_api_keys(uuid) to authenticated;
grant execute on function public.bmg_revoke_organization_api_key(uuid) to authenticated;
commit;