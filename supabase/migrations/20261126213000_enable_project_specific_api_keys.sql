begin;

drop function if exists public.bmg_create_api_key(text,text,timestamptz);

create function public.bmg_create_api_key(
  p_key text,p_label text,p_expires_at timestamptz default null,p_project_id uuid default null
)
returns table(id uuid,label text,key_prefix text,created_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions, auth
as $function$
declare
  uid uuid := auth.uid();
  v_jwt jsonb := auth.jwt();
  clean_label text := nullif(trim(p_label),'');
  v_role text;
  v_plan text;
  v_status text;
  v_key_limit integer;
  v_key_count integer;
  v_requires_mfa boolean;
  v_recent_totp boolean;
  v_org_id uuid;
  v_project_id uuid;
begin
  if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_key is null or length(p_key)<>56 or p_key !~ '^nox_[A-Za-z0-9_-]{52}$' then raise exception 'Invalid key'; end if;
  if clean_label is null then raise exception 'Key label is required'; end if;
  if p_expires_at is not null and p_expires_at<=now() then raise exception 'Expiration must be in the future'; end if;

  select exists(select 1 from auth.mfa_factors f where f.user_id=uid and f.factor_type='totp' and f.status='verified')
    into v_requires_mfa;
  if not v_requires_mfa then raise exception 'Two-factor authentication required' using errcode='42501'; end if;
  select (v_jwt->>'aal'='aal2') and exists(
    select 1 from jsonb_array_elements(coalesce(v_jwt->'amr','[]'::jsonb)) as entry
    where entry->>'method'='totp'
      and coalesce((entry->>'timestamp')::numeric,0)>=extract(epoch from (now()-interval '2 hours'))
  ) into v_recent_totp;
  if not coalesce(v_recent_totp,false) then raise exception 'Recent authenticator verification required' using errcode='42501'; end if;

  select profiles.role,profiles.plan,profiles.account_status
    into v_role,v_plan,v_status from public.profiles profiles where profiles.id=uid;
  if v_status is distinct from 'active' then raise exception 'Account is suspended'; end if;

  if p_project_id is null then
    select o.id,p.id into v_org_id,v_project_id
    from public.organizations o join public.projects p on p.organization_id=o.id and p.slug='default'
    where o.owner_id=uid and o.kind='individual'
    order by o.created_at limit 1;
  else
    select p.organization_id,p.id into v_org_id,v_project_id
    from public.projects p
    where p.id=p_project_id
      and (
        exists(select 1 from public.organization_members m
          where m.organization_id=p.organization_id and m.user_id=uid and m.role in ('owner','admin'))
        or exists(select 1 from public.project_members pm
          where pm.project_id=p.id and pm.user_id=uid and pm.role in ('owner','developer'))
      );
  end if;
  if v_org_id is null or v_project_id is null then raise exception 'Project key creation permission required' using errcode='42501'; end if;

  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  if v_role in ('admin','owner') then
    select admin_limits.max_api_keys into v_key_limit from public.api_admin_limits admin_limits where admin_limits.id=true;
  else
    select plan_limits.max_api_keys into v_key_limit from public.api_plan_limits plan_limits where plan_limits.plan=coalesce(v_plan,'basic');
  end if;
  v_key_limit:=coalesce(v_key_limit,2);
  select count(*)::integer into v_key_count from private.api_keys api_keys
  where api_keys.user_id=uid and api_keys.revoked_at is null and (api_keys.expires_at is null or api_keys.expires_at>now());
  if v_key_count>=v_key_limit then raise exception 'API key limit reached for the current account level (limit: %)',v_key_limit; end if;

  return query
  insert into private.api_keys(user_id,organization_id,project_id,label,key_prefix,key_hash,expires_at)
  values(uid,v_org_id,v_project_id,left(clean_label,64),left(p_key,18),extensions.digest(p_key,'sha256'),p_expires_at)
  returning api_keys.id,api_keys.label,api_keys.key_prefix,api_keys.created_at;
end;
$function$;

revoke all on function public.bmg_create_api_key(text,text,timestamptz,uuid) from public,anon;
grant execute on function public.bmg_create_api_key(text,text,timestamptz,uuid) to authenticated;

commit;