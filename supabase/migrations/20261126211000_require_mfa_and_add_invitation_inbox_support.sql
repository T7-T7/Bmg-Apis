begin;

alter table public.organization_invitations
  add column if not exists organization_name text;

update public.organization_invitations i
set organization_name=o.name
from public.organizations o
where o.id=i.organization_id and i.organization_name is null;

alter table public.organization_invitations
  alter column organization_name set not null;

create or replace function public.bmg_invite_organization_member(
  p_organization_id uuid,p_email text,p_role text,p_project_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email,'')));
  v_recipient uuid;
  v_invitation_id uuid;
  v_project_org uuid;
  v_org_role text;
  v_org_name text;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not private.bmg_can_manage_org(p_organization_id) then raise exception 'Organization invitation permission required' using errcode='42501'; end if;
  if v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then raise exception 'A valid email address is required'; end if;
  if p_role not in ('admin','developer','viewer') then raise exception 'Invalid invitation role'; end if;
  if p_role='admin' and not exists(select 1 from public.organization_members m where m.organization_id=p_organization_id and m.user_id=v_actor and m.role='owner') then
    raise exception 'Only the organization owner can invite an administrator' using errcode='42501';
  end if;
  select u.id into v_recipient from auth.users u where lower(u.email)=v_email and u.deleted_at is null limit 1;
  if v_recipient is null then raise exception 'No registered account was found for this email'; end if;
  select o.name into v_org_name from public.organizations o where o.id=p_organization_id;
  if p_project_id is null then
    if exists(select 1 from public.organization_members m where m.organization_id=p_organization_id and m.user_id=v_recipient) then
      raise exception 'This account is already a member of the organization';
    end if;
    v_org_role := p_role;
  else
    select p.organization_id into v_project_org from public.projects p where p.id=p_project_id;
    if v_project_org is distinct from p_organization_id then raise exception 'Project does not belong to this organization'; end if;
    if exists(select 1 from public.project_members m where m.project_id=p_project_id and m.user_id=v_recipient) then
      raise exception 'This account is already a member of the project';
    end if;
    v_org_role := 'viewer';
  end if;
  insert into public.organization_invitations(organization_id,project_id,email,recipient_user_id,role,invited_by,organization_name)
  values(p_organization_id,p_project_id,v_email,v_recipient,p_role,v_actor,v_org_name)
  returning id into v_invitation_id;
  insert into public.user_notifications(user_id,title,body,type,metadata)
  values(v_recipient,'دعوة للانضمام إلى مساحة عمل',
    'تمت دعوتك للانضمام إلى '||v_org_name||'. راجع الدعوة من البريد الوارد.',
    'info',jsonb_build_object('kind','organization_invitation','invitation_id',v_invitation_id));
  return v_invitation_id;
end;
$function$;

create or replace function public.bmg_create_api_key(
  p_key text,p_label text,p_expires_at timestamptz default null
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
  if not v_requires_mfa then
    raise exception 'Two-factor authentication required' using errcode='42501';
  end if;
  select (v_jwt->>'aal'='aal2') and exists(
    select 1 from jsonb_array_elements(coalesce(v_jwt->'amr','[]'::jsonb)) as entry
    where entry->>'method'='totp'
      and coalesce((entry->>'timestamp')::numeric,0)>=extract(epoch from (now()-interval '2 hours'))
  ) into v_recent_totp;
  if not coalesce(v_recent_totp,false) then
    raise exception 'Recent authenticator verification required' using errcode='42501';
  end if;

  select profiles.role,profiles.plan,profiles.account_status
    into v_role,v_plan,v_status from public.profiles profiles where profiles.id=uid;
  if v_status is distinct from 'active' then raise exception 'Account is suspended'; end if;

  select o.id,p.id into v_org_id,v_project_id
  from public.organizations o join public.projects p on p.organization_id=o.id and p.slug='default'
  where o.owner_id=uid and o.kind='individual'
  order by o.created_at limit 1;
  if v_org_id is null or v_project_id is null then raise exception 'Personal workspace is not ready'; end if;

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

create or replace function public.bmg_delete_api_key(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_jwt jsonb := auth.jwt();
  v_requires_mfa boolean;
  v_recent_totp boolean;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select exists (
    select 1 from auth.mfa_factors f
    where f.user_id=v_actor and f.factor_type='totp' and f.status='verified'
  ) into v_requires_mfa;

  if not v_requires_mfa then
    raise exception 'Two-factor authentication required' using errcode='42501';
  end if;

  select
    (v_jwt->>'aal'='aal2')
    and exists (
      select 1 from jsonb_array_elements(coalesce(v_jwt->'amr','[]'::jsonb)) as entry
      where entry->>'method'='totp'
        and coalesce((entry->>'timestamp')::numeric,0)>=extract(epoch from (now()-interval '2 hours'))
    )
  into v_recent_totp;

  if not coalesce(v_recent_totp,false) then
    raise exception 'Recent authenticator verification required' using errcode='42501';
  end if;

  return private.bmg_delete_api_key_internal(p_id,v_actor,v_actor,false);
end;
$function$;

create or replace function public.bmg_authorize_api_request(
  p_key text,p_service_slug text,p_method text,p_server_secret text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','extensions'
as $function$
declare
  found_key private.api_keys%rowtype;
  v_secret_hash bytea;
  v_service_status text;
  v_service_id uuid;
  v_service_archived boolean;
  v_service_weight integer;
  v_service_category text;
  v_account_status text;
  v_role text;
  v_plan text;
  v_requests_per_minute integer;
  v_daily_limit bigint;
  v_monthly_limit bigint;
  v_recent_count bigint;
  v_daily_usage bigint;
  v_monthly_usage bigint;
  v_usage_weight bigint;
  v_maintenance_message text;
  v_usage_id bigint;
  v_now timestamptz := clock_timestamp();
begin
  if p_server_secret is null then return jsonb_build_object('authorized',false,'reason','invalid_server'); end if;
  select secret_hash into v_secret_hash from private.api_demo_config where id=true;
  if v_secret_hash is null or v_secret_hash<>extensions.digest(convert_to(p_server_secret,'UTF8'),'sha256') then
    return jsonb_build_object('authorized',false,'reason','invalid_server');
  end if;
  if p_key is null or length(p_key)<40 then return jsonb_build_object('authorized',false,'reason','invalid_key'); end if;

  select * into found_key from private.api_keys
  where key_hash=extensions.digest(p_key,'sha256') and revoked_at is null
    and (expires_at is null or expires_at>v_now) and scopes @> array['api:use']::text[]
  limit 1 for update;
  if found_key.id is null then return jsonb_build_object('authorized',false,'reason','invalid_key'); end if;

  perform pg_advisory_xact_lock(hashtextextended('nox_api_account:'||found_key.user_id::text,0));
  select p.account_status,p.role,p.plan into v_account_status,v_role,v_plan
  from public.profiles p where p.id=found_key.user_id;
  if v_account_status is distinct from 'active' then return jsonb_build_object('authorized',false,'reason','account_suspended'); end if;

  select s.id,s.status,(s.archived_at is not null),s.weight,s.category
  into v_service_id,v_service_status,v_service_archived,v_service_weight,v_service_category
  from public.api_services s where s.slug=p_service_slug;
  if v_service_status is distinct from 'active' or coalesce(v_service_archived,true) then
    return jsonb_build_object('authorized',false,'reason','service_unavailable');
  end if;

  if exists(select 1 from unnest(found_key.scopes) sc where sc like 'service:%')
     and not found_key.scopes @> array['service:'||p_service_slug]::text[] then
    return jsonb_build_object('authorized',false,'reason','insufficient_scope');
  end if;
  if exists(select 1 from unnest(found_key.scopes) sc where sc like 'category:%')
     and not found_key.scopes @> array['category:'||lower(coalesce(v_service_category,''))]::text[] then
    return jsonb_build_object('authorized',false,'reason','insufficient_scope');
  end if;

  select m.message into v_maintenance_message from public.maintenance_windows m
  where m.enabled=true and (m.service_id is null or m.service_id=v_service_id)
    and (m.starts_at is null or m.starts_at<=v_now) and (m.ends_at is null or m.ends_at>v_now)
  order by (m.service_id is not null) desc,m.updated_at desc limit 1;
  if v_maintenance_message is not null then return jsonb_build_object('authorized',false,'reason','maintenance','message',v_maintenance_message); end if;

  if v_role in ('admin','owner') then
    select requests_per_minute,daily_weighted_limit,monthly_weighted_limit into v_requests_per_minute,v_daily_limit,v_monthly_limit
    from public.api_admin_limits where id=true;
  else
    select requests_per_minute,daily_weighted_limit,monthly_weighted_limit into v_requests_per_minute,v_daily_limit,v_monthly_limit
    from public.api_plan_limits where plan=case when v_plan in ('basic','pro','premium') then v_plan else 'basic' end;
  end if;
  v_requests_per_minute:=greatest(1,coalesce(v_requests_per_minute,30));
  v_daily_limit:=greatest(1,coalesce(v_daily_limit,1000));
  v_monthly_limit:=greatest(1,coalesce(v_monthly_limit,20000));
  v_usage_weight:=greatest(1,coalesce(v_service_weight,1));

  select count(*) into v_recent_count from private.api_usage u
  where u.user_id=found_key.user_id and u.created_at>v_now-interval '1 minute';
  if v_recent_count>=v_requests_per_minute then return jsonb_build_object('authorized',false,'reason','rate_limited'); end if;

  select coalesce(sum(q.weighted_usage),0)::bigint into v_daily_usage from (
    select h.weighted_usage from private.api_usage_hourly h
    where h.user_id=found_key.user_id and h.bucket_hour>=date_trunc('day',v_now)
    union all
    select greatest(1,coalesce(u.service_weight,1))::bigint from private.api_usage u
    where u.user_id=found_key.user_id and u.created_at>=date_trunc('day',v_now) and u.aggregated_at is null
  ) q;
  if v_daily_usage+v_usage_weight>v_daily_limit then return jsonb_build_object('authorized',false,'reason','rate_limited'); end if;

  select coalesce(sum(q.weighted_usage),0)::bigint into v_monthly_usage from (
    select h.weighted_usage from private.api_usage_hourly h
    where h.user_id=found_key.user_id and h.bucket_hour>=date_trunc('month',v_now)
    union all
    select greatest(1,coalesce(u.service_weight,1))::bigint from private.api_usage u
    where u.user_id=found_key.user_id and u.created_at>=date_trunc('month',v_now) and u.aggregated_at is null
  ) q;
  if v_monthly_usage+v_usage_weight>v_monthly_limit then return jsonb_build_object('authorized',false,'reason','rate_limited'); end if;

  update private.api_keys set last_used_at=v_now where id=found_key.id;
  insert into private.api_usage(api_key_id,user_id,organization_id,project_id,service_slug,request_method,service_weight)
  values(found_key.id,found_key.user_id,found_key.organization_id,found_key.project_id,p_service_slug,upper(coalesce(p_method,'POST')),v_usage_weight)
  returning id into v_usage_id;

  if pg_try_advisory_xact_lock(hashtextextended('nox_api_usage_retention_24h',0)) then
    delete from private.api_usage where created_at<v_now-interval '24 hours' and aggregated_at is not null;
  end if;
  return jsonb_build_object('authorized',true,'usage_id',v_usage_id);
end;
$function$;

commit;