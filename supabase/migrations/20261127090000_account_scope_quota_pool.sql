begin;

alter table public.organizations
  add column if not exists is_default_workspace boolean not null default false;

with ranked as (
  select id,row_number() over(partition by owner_id order by created_at,id) as position
  from public.organizations
  where kind='individual'
)
update public.organizations o
set is_default_workspace=(r.position=1)
from ranked r
where r.id=o.id
  and o.is_default_workspace is distinct from (r.position=1);

create unique index if not exists organizations_one_default_workspace_per_owner_uidx
  on public.organizations(owner_id)
  where is_default_workspace=true;

create index if not exists organizations_scope_pool_owner_idx
  on public.organizations(owner_id,created_at,id)
  where is_default_workspace=false;

create table if not exists private.api_scope_pool_limits (
  id boolean primary key default true check (id=true),
  requests_per_minute integer,
  daily_weighted_limit bigint,
  monthly_weighted_limit bigint,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint api_scope_pool_limits_rpm_positive check (requests_per_minute is null or requests_per_minute>0),
  constraint api_scope_pool_limits_daily_positive check (daily_weighted_limit is null or daily_weighted_limit>0),
  constraint api_scope_pool_limits_monthly_positive check (monthly_weighted_limit is null or monthly_weighted_limit>0)
);
alter table private.api_scope_pool_limits enable row level security;
revoke all on table private.api_scope_pool_limits from public,anon,authenticated;

create or replace function private.bmg_lock_scope_pool_owner()
returns trigger
language plpgsql
set search_path=''
as $function$
declare
  v_owner uuid;
begin
  if tg_op='DELETE' then
    v_owner:=old.owner_id;
  else
    v_owner:=new.owner_id;
  end if;
  if v_owner is not null then
    perform pg_advisory_xact_lock(hashtextextended('nox_scope_pool_owner:'||v_owner::text,0));
  end if;
  if tg_op='UPDATE' and old.is_default_workspace is distinct from new.is_default_workspace
     and current_user not in ('postgres','service_role') then
    raise exception 'Default workspace classification is managed by the platform' using errcode='42501';
  end if;
  if tg_op='INSERT' and new.is_default_workspace=true
     and current_user not in ('postgres','service_role') then
    raise exception 'Default workspace classification is managed by the platform' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$function$;

drop trigger if exists organizations_scope_pool_owner_lock on public.organizations;
create trigger organizations_scope_pool_owner_lock
before insert or update or delete on public.organizations
for each row execute function private.bmg_lock_scope_pool_owner();

create or replace function private.bmg_get_scope_pool_allocation(p_organization_id uuid)
returns table (
  scope_owner_id uuid,
  scope_count bigint,
  scope_position bigint,
  requests_per_minute integer,
  daily_weighted_limit bigint,
  monthly_weighted_limit bigint
)
language sql
stable
security definer
set search_path=''
as $function$
  with target as (
    select o.id,o.owner_id
    from public.organizations o
    where o.id=p_organization_id and o.is_default_workspace=false
  ),
  ranked as (
    select o.id,o.owner_id,
      row_number() over(partition by o.owner_id order by o.created_at,o.id) as position,
      count(*) over(partition by o.owner_id) as total_scopes
    from public.organizations o
    join target t on t.owner_id=o.owner_id
    where o.is_default_workspace=false
  ),
  pool as (
    select requests_per_minute,daily_weighted_limit,monthly_weighted_limit
    from private.api_scope_pool_limits where id=true
  )
  select
    r.owner_id,
    r.total_scopes,
    r.position,
    case when p.requests_per_minute is null then null
      else (p.requests_per_minute/r.total_scopes::integer)
        + case when r.position<=mod(p.requests_per_minute::bigint,r.total_scopes) then 1 else 0 end
    end,
    case when p.daily_weighted_limit is null then null
      else (p.daily_weighted_limit/r.total_scopes)
        + case when r.position<=mod(p.daily_weighted_limit,r.total_scopes) then 1 else 0 end
    end,
    case when p.monthly_weighted_limit is null then null
      else (p.monthly_weighted_limit/r.total_scopes)
        + case when r.position<=mod(p.monthly_weighted_limit,r.total_scopes) then 1 else 0 end
    end
  from ranked r
  left join pool p on true
  where r.id=p_organization_id;
$function$;

revoke all on function private.bmg_get_scope_pool_allocation(uuid) from public,anon,authenticated;
revoke all on function private.bmg_lock_scope_pool_owner() from public,anon,authenticated;

create or replace function private.bmg_create_personal_workspace_for_profile()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_org_id uuid;
  v_project_id uuid;
  v_name text;
begin
  v_name := coalesce(nullif(trim(new.display_name),''), split_part(coalesce(new.email,'developer'),'@',1));
  insert into public.organizations(name,kind,owner_id,is_default_workspace)
  values (left(v_name || ' — المساحة الشخصية',100),'individual',new.id,true)
  on conflict do nothing
  returning id into v_org_id;

  if v_org_id is null then
    select o.id into v_org_id from public.organizations o
    where o.owner_id=new.id and o.is_default_workspace=true
    order by o.created_at limit 1;
  end if;

  if v_org_id is not null then
    insert into public.organization_members(organization_id,user_id,role)
    values(v_org_id,new.id,'owner') on conflict do nothing;
    insert into public.projects(organization_id,name,slug,description,created_by)
    values(v_org_id,'المشروع الافتراضي','default','المشروع الشخصي الافتراضي.',new.id)
    on conflict(organization_id,slug) do nothing;
    select p.id into v_project_id from public.projects p
    where p.organization_id=v_org_id and p.slug='default';
    if v_project_id is not null then
      insert into public.project_members(project_id,user_id,role)
      values(v_project_id,new.id,'owner') on conflict do nothing;
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.bmg_create_project(
  p_organization_id uuid,
  p_name text,
  p_description text default ''
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_project_id uuid;
  v_slug text;
  v_is_default boolean;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not private.bmg_can_manage_org(p_organization_id)
     and not exists(
       select 1 from public.organization_members m
       where m.organization_id=p_organization_id and m.user_id=v_actor and m.role='developer'
     ) then
    raise exception 'Organization project access required' using errcode='42501';
  end if;

  select o.is_default_workspace into v_is_default
  from public.organizations o where o.id=p_organization_id;
  if not found then raise exception 'Organization not found'; end if;
  if v_is_default then
    raise exception 'The default personal workspace only supports its default project' using errcode='42501';
  end if;

  if p_name is null or length(trim(p_name))<2 or length(trim(p_name))>100 then
    raise exception 'Project name must contain 2 to 100 characters';
  end if;
  v_slug:=trim(both '-' from regexp_replace(lower(trim(p_name)),'[^a-z0-9]+','-','g'));
  if v_slug='' then v_slug:='project-'||substr(replace(gen_random_uuid()::text,'-',''),1,8); end if;
  if exists(select 1 from public.projects p where p.organization_id=p_organization_id and p.slug=v_slug) then
    v_slug:=v_slug||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
  end if;
  insert into public.projects(organization_id,name,slug,description,created_by)
  values(p_organization_id,trim(p_name),v_slug,coalesce(p_description,''),v_actor)
  returning id into v_project_id;
  insert into public.project_members(project_id,user_id,role) values(v_project_id,v_actor,'owner');
  return v_project_id;
end;
$function$;

do $migration$
declare
  v_definition text;
begin
  v_definition:=pg_get_functiondef('public.bmg_create_api_key(text,text,timestamptz,uuid)'::regprocedure);
  v_definition:=replace(v_definition,
    'where o.owner_id=uid and o.kind=''individual''',
    'where o.owner_id=uid and o.is_default_workspace=true');
  execute v_definition;

  v_definition:=pg_get_functiondef('public.bmg_list_api_keys()'::regprocedure);
  v_definition:=replace(v_definition,
    'FROM private.api_keys k WHERE k.user_id = uid ORDER BY k.created_at DESC;',
    'FROM private.api_keys k JOIN public.organizations o ON o.id=k.organization_id WHERE k.user_id = uid AND o.is_default_workspace=true ORDER BY k.created_at DESC;');
  execute v_definition;

  v_definition:=pg_get_functiondef('public.bmg_get_api_analytics(integer)'::regprocedure);
  v_definition:=replace(v_definition,
    '  v_plan text;',
    '  v_plan text;'||chr(10)||'  v_default_org_id uuid;');
  v_definition:=replace(v_definition,
    '  select role,plan into v_role,v_plan from public.profiles where id=v_user_id;',
    '  select role,plan into v_role,v_plan from public.profiles where id=v_user_id;'||chr(10)||
    '  select id into v_default_org_id from public.organizations where owner_id=v_user_id and is_default_workspace=true order by created_at limit 1;');
  v_definition:=replace(v_definition,'where user_id=v_user_id','where organization_id=v_default_org_id');
  v_definition:=replace(v_definition,'where h.user_id=v_user_id','where h.organization_id=v_default_org_id');
  v_definition:=replace(v_definition,'where u.user_id=v_user_id','where u.organization_id=v_default_org_id');
  execute v_definition;
end;
$migration$;

create or replace function public.bmg_admin_get_scope_pool_limits()
returns table (
  requests_per_minute integer,
  daily_weighted_limit bigint,
  monthly_weighted_limit bigint,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_role text;
begin
  select p.role into v_role from public.profiles p where p.id=auth.uid();
  if auth.uid() is null or v_role not in ('admin','owner') then
    raise exception 'Administrator access required' using errcode='42501';
  end if;
  return query
  select l.requests_per_minute,l.daily_weighted_limit,l.monthly_weighted_limit,l.updated_at
  from private.api_scope_pool_limits l where l.id=true
  union all
  select null::integer,null::bigint,null::bigint,null::timestamptz
  where not exists(select 1 from private.api_scope_pool_limits l where l.id=true);
end;
$function$;

create or replace function public.bmg_admin_set_scope_pool_limits(
  p_requests_per_minute integer,
  p_daily_weighted_limit bigint,
  p_monthly_weighted_limit bigint
)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_role text;
begin
  select p.role into v_role from public.profiles p where p.id=v_actor;
  if v_actor is null or v_role not in ('admin','owner') then
    raise exception 'Administrator access required' using errcode='42501';
  end if;
  if p_requests_per_minute is not null and p_requests_per_minute<=0 then raise exception 'RPM must be positive or null'; end if;
  if p_daily_weighted_limit is not null and p_daily_weighted_limit<=0 then raise exception 'Daily limit must be positive or null'; end if;
  if p_monthly_weighted_limit is not null and p_monthly_weighted_limit<=0 then raise exception 'Monthly limit must be positive or null'; end if;
  insert into private.api_scope_pool_limits(id,requests_per_minute,daily_weighted_limit,monthly_weighted_limit,updated_at,updated_by)
  values(true,p_requests_per_minute,p_daily_weighted_limit,p_monthly_weighted_limit,now(),v_actor)
  on conflict(id) do update set
    requests_per_minute=excluded.requests_per_minute,
    daily_weighted_limit=excluded.daily_weighted_limit,
    monthly_weighted_limit=excluded.monthly_weighted_limit,
    updated_at=excluded.updated_at,
    updated_by=excluded.updated_by;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(v_actor,'scope_pool_limits.update','api_scope_pool_limits','true',
    jsonb_build_object('requests_per_minute',p_requests_per_minute,'daily_weighted_limit',p_daily_weighted_limit,'monthly_weighted_limit',p_monthly_weighted_limit));
end;
$function$;

create or replace function public.bmg_get_organization_usage(
  p_organization_id uuid,
  p_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_owner uuid;
  v_is_default boolean;
  v_days integer:=greatest(1,least(coalesce(p_days,30),90));
  v_allocation record;
  v_daily_usage bigint:=0;
  v_monthly_usage bigint:=0;
  v_rpm_usage bigint:=0;
  v_result jsonb;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select o.owner_id,o.is_default_workspace into v_owner,v_is_default
  from public.organizations o where o.id=p_organization_id;
  if not found then raise exception 'Workspace not found' using errcode='P0002'; end if;
  if not exists(select 1 from public.organization_members m where m.organization_id=p_organization_id and m.user_id=v_actor)
     and v_owner<>v_actor then
    raise exception 'Workspace access required' using errcode='42501';
  end if;
  if v_is_default then raise exception 'Default personal usage is available in account usage'; end if;

  select * into v_allocation from private.bmg_get_scope_pool_allocation(p_organization_id);

  select coalesce(sum(x.weighted_usage),0)::bigint into v_daily_usage
  from (
    select h.weighted_usage from private.api_usage_hourly h
    where h.organization_id=p_organization_id and h.bucket_hour>=date_trunc('day',now())
    union all
    select greatest(1,coalesce(u.service_weight,1))::bigint from private.api_usage u
    where u.organization_id=p_organization_id and u.created_at>=date_trunc('day',now()) and u.aggregated_at is null
  ) x;

  select coalesce(sum(x.weighted_usage),0)::bigint into v_monthly_usage
  from (
    select h.weighted_usage from private.api_usage_hourly h
    where h.organization_id=p_organization_id and h.bucket_hour>=date_trunc('month',now())
    union all
    select greatest(1,coalesce(u.service_weight,1))::bigint from private.api_usage u
    where u.organization_id=p_organization_id and u.created_at>=date_trunc('month',now()) and u.aggregated_at is null
  ) x;

  select count(*)::bigint into v_rpm_usage
  from private.api_usage u
  where u.organization_id=p_organization_id and u.created_at>now()-interval '1 minute';

  with events as (
    select h.project_id,h.service_slug,h.request_count,h.weighted_usage,h.bucket_hour as created_at
    from private.api_usage_hourly h
    where h.organization_id=p_organization_id and h.bucket_hour>=now()-make_interval(days=>v_days)
    union all
    select u.project_id,u.service_slug,1::bigint,greatest(1,coalesce(u.service_weight,1))::bigint,u.created_at
    from private.api_usage u
    where u.organization_id=p_organization_id and u.created_at>=now()-make_interval(days=>v_days) and u.aggregated_at is null
  ),
  project_totals as (
    select e.project_id,coalesce(p.name,'مشروع محذوف') as name,
      sum(e.request_count)::bigint as requests,sum(e.weighted_usage)::bigint as weighted_usage
    from events e left join public.projects p on p.id=e.project_id
    group by e.project_id,p.name
  ),
  service_totals as (
    select service_slug,sum(request_count)::bigint as requests,sum(weighted_usage)::bigint as weighted_usage
    from events group by service_slug
  ),
  recent as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',u.id,'projectId',u.project_id,'service',u.service_slug,'method',u.request_method,
      'status',u.status_code,'latency',u.latency_ms,'createdAt',u.created_at
    ) order by u.created_at desc),'[]'::jsonb) as value
    from (select * from private.api_usage where organization_id=p_organization_id order by created_at desc limit 20) u
  )
  select jsonb_build_object(
    'periodDays',v_days,
    'organization',jsonb_build_object('id',p_organization_id,'ownerId',v_owner),
    'allocation',jsonb_build_object(
      'scopeCount',v_allocation.scope_count,'scopePosition',v_allocation.scope_position,
      'requestsPerMinute',v_allocation.requests_per_minute,
      'dailyWeightedLimit',v_allocation.daily_weighted_limit,
      'monthlyWeightedLimit',v_allocation.monthly_weighted_limit
    ),
    'usage',jsonb_build_object(
      'requestsPerMinute',v_rpm_usage,
      'dailyWeightedUsage',v_daily_usage,
      'monthlyWeightedUsage',v_monthly_usage,
      'dailyRemaining',case when v_allocation.daily_weighted_limit is null then null else greatest(0,v_allocation.daily_weighted_limit-v_daily_usage) end,
      'monthlyRemaining',case when v_allocation.monthly_weighted_limit is null then null else greatest(0,v_allocation.monthly_weighted_limit-v_monthly_usage) end,
      'dailyPercentage',case when v_allocation.daily_weighted_limit is null then null else round(v_daily_usage::numeric/nullif(v_allocation.daily_weighted_limit,0)*100,1) end,
      'monthlyPercentage',case when v_allocation.monthly_weighted_limit is null then null else round(v_monthly_usage::numeric/nullif(v_allocation.monthly_weighted_limit,0)*100,1) end
    ),
    'projects',(select coalesce(jsonb_agg(jsonb_build_object('id',project_id,'name',name,'requests',requests,'weightedUsage',weighted_usage) order by weighted_usage desc),'[]'::jsonb) from project_totals),
    'services',(select coalesce(jsonb_agg(jsonb_build_object('slug',service_slug,'requests',requests,'weightedUsage',weighted_usage) order by weighted_usage desc),'[]'::jsonb) from service_totals),
    'recent',recent.value
  ) into v_result
  from recent;

  return v_result;
end;
$function$;

create or replace function public.bmg_authorize_api_request(
  p_key text,
  p_service_slug text,
  p_method text,
  p_server_secret text
)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','private','extensions'
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
  v_scope_rpm integer;
  v_scope_daily bigint;
  v_scope_monthly bigint;
  v_recent_count bigint;
  v_daily_usage bigint;
  v_monthly_usage bigint;
  v_usage_weight bigint;
  v_maintenance_message text;
  v_usage_id bigint;
  v_now timestamptz:=clock_timestamp();
  v_org_id uuid;
  v_project_id uuid;
  v_project_org_id uuid;
  v_scope text;
  v_org_override boolean:=false;
  v_project_override boolean:=false;
  v_is_default boolean:=false;
  v_scope_owner_id uuid;
  v_pool_scope_count bigint;
  v_pool_scope_position bigint;
  v_pool_rpm integer;
  v_pool_daily bigint;
  v_pool_monthly bigint;
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
  if v_maintenance_message is not null then
    return jsonb_build_object('authorized',false,'reason','maintenance','message',v_maintenance_message);
  end if;

  v_project_id:=found_key.project_id;
  v_org_id:=found_key.organization_id;
  if v_project_id is not null then
    select p.organization_id into v_project_org_id from public.projects p where p.id=v_project_id;
    if not found then return jsonb_build_object('authorized',false,'reason','invalid_project'); end if;
    if v_org_id is not null and v_org_id<>v_project_org_id then
      return jsonb_build_object('authorized',false,'reason','invalid_project');
    end if;
    v_org_id:=v_project_org_id;
  end if;
  if v_org_id is null then
    select o.id into v_org_id from public.organizations o
    where o.owner_id=found_key.user_id and o.is_default_workspace=true
    order by o.created_at limit 1;
    select p.id into v_project_id from public.projects p
    where p.organization_id=v_org_id and p.slug='default';
  end if;
  if v_org_id is null then return jsonb_build_object('authorized',false,'reason','invalid_project'); end if;

  select o.is_default_workspace,o.owner_id into v_is_default,v_scope_owner_id
  from public.organizations o where o.id=v_org_id;
  if not found then return jsonb_build_object('authorized',false,'reason','invalid_project'); end if;
  v_usage_weight:=greatest(1,coalesce(v_service_weight,1));

  if v_is_default then
    if v_role in ('admin','owner') then
      select requests_per_minute,daily_weighted_limit,monthly_weighted_limit
      into v_requests_per_minute,v_daily_limit,v_monthly_limit
      from public.api_admin_limits where id=true;
    else
      select requests_per_minute,daily_weighted_limit,monthly_weighted_limit
      into v_requests_per_minute,v_daily_limit,v_monthly_limit
      from public.api_plan_limits
      where plan=case when v_plan in ('basic','pro','premium') then v_plan else 'basic' end;
    end if;
    v_requests_per_minute:=greatest(1,coalesce(v_requests_per_minute,30));
    v_daily_limit:=greatest(1,coalesce(v_daily_limit,1000));
    v_monthly_limit:=greatest(1,coalesce(v_monthly_limit,20000));

    select count(*) into v_recent_count from private.api_usage u
    where u.organization_id=v_org_id and u.created_at>v_now-interval '1 minute';
    if v_recent_count>=v_requests_per_minute then
      return jsonb_build_object('authorized',false,'reason','rate_limited','limit_scope','personal');
    end if;

    select coalesce(sum(x.weighted_usage),0)::bigint into v_daily_usage from (
      select h.weighted_usage from private.api_usage_hourly h
      where h.organization_id=v_org_id and h.bucket_hour>=date_trunc('day',v_now)
      union all select greatest(1,coalesce(u.service_weight,1))::bigint from private.api_usage u
      where u.organization_id=v_org_id and u.created_at>=date_trunc('day',v_now) and u.aggregated_at is null
    ) x;
    if v_daily_usage+v_usage_weight>v_daily_limit then
      return jsonb_build_object('authorized',false,'reason','rate_limited','limit_scope','personal');
    end if;

    select coalesce(sum(x.weighted_usage),0)::bigint into v_monthly_usage from (
      select h.weighted_usage from private.api_usage_hourly h
      where h.organization_id=v_org_id and h.bucket_hour>=date_trunc('month',v_now)
      union all select greatest(1,coalesce(u.service_weight,1))::bigint from private.api_usage u
      where u.organization_id=v_org_id and u.created_at>=date_trunc('month',v_now) and u.aggregated_at is null
    ) x;
    if v_monthly_usage+v_usage_weight>v_monthly_limit then
      return jsonb_build_object('authorized',false,'reason','rate_limited','limit_scope','personal');
    end if;
  else
    perform pg_advisory_xact_lock(hashtextextended('nox_scope_pool_owner:'||v_scope_owner_id::text,0));
    select * into v_pool_scope_count,v_pool_scope_position,v_pool_rpm,v_pool_daily,v_pool_monthly
    from private.bmg_get_scope_pool_allocation(v_org_id);

    if v_pool_rpm is not null then
      select count(*) into v_recent_count from private.api_usage u
      where u.organization_id=v_org_id and u.created_at>v_now-interval '1 minute';
      if v_recent_count>=v_pool_rpm then
        return jsonb_build_object('authorized',false,'reason','rate_limited','limit_scope','organization');
      end if;
    end if;

    if v_pool_daily is not null then
      select coalesce(sum(x.weighted_usage),0)::bigint into v_daily_usage from (
        select h.weighted_usage from private.api_usage_hourly h
        where h.organization_id=v_org_id and h.bucket_hour>=date_trunc('day',v_now)
        union all select greatest(1,coalesce(u.service_weight,1))::bigint from private.api_usage u
        where u.organization_id=v_org_id and u.created_at>=date_trunc('day',v_now) and u.aggregated_at is null
      ) x;
      if v_daily_usage+v_usage_weight>v_pool_daily then
        return jsonb_build_object('authorized',false,'reason','rate_limited','limit_scope','organization');
      end if;
    end if;

    if v_pool_monthly is not null then
      select coalesce(sum(x.weighted_usage),0)::bigint into v_monthly_usage from (
        select h.weighted_usage from private.api_usage_hourly h
        where h.organization_id=v_org_id and h.bucket_hour>=date_trunc('month',v_now)
        union all select greatest(1,coalesce(u.service_weight,1))::bigint from private.api_usage u
        where u.organization_id=v_org_id and u.created_at>=date_trunc('month',v_now) and u.aggregated_at is null
      ) x;
      if v_monthly_usage+v_usage_weight>v_pool_monthly then
        return jsonb_build_object('authorized',false,'reason','rate_limited','limit_scope','organization');
      end if;
    end if;
  end if;

  -- Service-specific administrative overrides remain stricter secondary caps.
  if not v_is_default then
    if v_project_id is not null then
      select exists(select 1 from public.project_service_limits
        where project_id=v_project_id and service_slug=p_service_slug) into v_project_override;
    end if;
    select exists(select 1 from public.organization_service_limits
      where organization_id=v_org_id and service_slug=p_service_slug) into v_org_override;

    if v_project_override then
      v_scope:='project';
      select requests_per_minute,daily_weighted_limit,monthly_weighted_limit
      into v_scope_rpm,v_scope_daily,v_scope_monthly
      from public.project_service_limits
      where project_id=v_project_id and service_slug=p_service_slug;
    elsif v_org_override then
      v_scope:='organization';
      select requests_per_minute,daily_weighted_limit,monthly_weighted_limit
      into v_scope_rpm,v_scope_daily,v_scope_monthly
      from public.organization_service_limits
      where organization_id=v_org_id and service_slug=p_service_slug;
    else
      select requests_per_minute,daily_weighted_limit,monthly_weighted_limit
      into v_scope_rpm,v_scope_daily,v_scope_monthly
      from public.api_scope_default_limits where service_slug=p_service_slug;
      if found then
        v_scope:=case when v_project_id is not null then 'project' else 'organization' end;
      end if;
    end if;

    if v_scope='project' then
      perform pg_advisory_xact_lock(hashtextextended('nox_api_project:'||v_project_id::text||':'||p_service_slug,0));
      select count(*) into v_recent_count from private.api_usage u
      where u.project_id=v_project_id and u.service_slug=p_service_slug and u.created_at>v_now-interval '1 minute';
      if v_scope_rpm is not null and v_recent_count>=v_scope_rpm then
        return jsonb_build_object('authorized',false,'reason','rate_limited','limit_scope','project');
      end if;
      if v_scope_daily is not null then
        select coalesce(sum(x.weighted_usage),0)::bigint into v_daily_usage from (
          select h.weighted_usage from private.api_usage_hourly h
          where h.project_id=v_project_id and h.service_slug=p_service_slug and h.bucket_hour>=date_trunc('day',v_now)
          union all select greatest(1,coalesce(u.service_weight,1))::bigint from private.api_usage u
          where u.project_id=v_project_id and u.service_slug=p_service_slug and u.created_at>=date_trunc('day',v_now) and u.aggregated_at is null
        ) x;
        if v_daily_usage+v_usage_weight>v_scope_daily then
          return jsonb_build_object('authorized',false,'reason','rate_limited','limit_scope','project');
        end if;
      end if;
      if v_scope_monthly is not null then
        select coalesce(sum(x.weighted_usage),0)::bigint into v_monthly_usage from (
          select h.weighted_usage from private.api_usage_hourly h
          where h.project_id=v_project_id and h.service_slug=p_service_slug and h.bucket_hour>=date_trunc('month',v_now)
          union all select greatest(1,coalesce(u.service_weight,1))::bigint from private.api_usage u
          where u.project_id=v_project_id and u.service_slug=p_service_slug and u.created_at>=date_trunc('month',v_now) and u.aggregated_at is null
        ) x;
        if v_monthly_usage+v_usage_weight>v_scope_monthly then
          return jsonb_build_object('authorized',false,'reason','rate_limited','limit_scope','project');
        end if;
      end if;
    elsif v_scope='organization' then
      perform pg_advisory_xact_lock(hashtextextended('nox_api_org_service:'||v_org_id::text||':'||p_service_slug,0));
      select count(*) into v_recent_count from private.api_usage u
      where u.organization_id=v_org_id and u.service_slug=p_service_slug and u.created_at>v_now-interval '1 minute';
      if v_scope_rpm is not null and v_recent_count>=v_scope_rpm then
        return jsonb_build_object('authorized',false,'reason','rate_limited','limit_scope','organization');
      end if;
      if v_scope_daily is not null then
        select coalesce(sum(x.weighted_usage),0)::bigint into v_daily_usage from (
          select h.weighted_usage from private.api_usage_hourly h
          where h.organization_id=v_org_id and h.service_slug=p_service_slug and h.bucket_hour>=date_trunc('day',v_now)
          union all select greatest(1,coalesce(u.service_weight,1))::bigint from private.api_usage u
          where u.organization_id=v_org_id and u.service_slug=p_service_slug and u.created_at>=date_trunc('day',v_now) and u.aggregated_at is null
        ) x;
        if v_daily_usage+v_usage_weight>v_scope_daily then
          return jsonb_build_object('authorized',false,'reason','rate_limited','limit_scope','organization');
        end if;
      end if;
      if v_scope_monthly is not null then
        select coalesce(sum(x.weighted_usage),0)::bigint into v_monthly_usage from (
          select h.weighted_usage from private.api_usage_hourly h
          where h.organization_id=v_org_id and h.service_slug=p_service_slug and h.bucket_hour>=date_trunc('month',v_now)
          union all select greatest(1,coalesce(u.service_weight,1))::bigint from private.api_usage u
          where u.organization_id=v_org_id and u.service_slug=p_service_slug and u.created_at>=date_trunc('month',v_now) and u.aggregated_at is null
        ) x;
        if v_monthly_usage+v_usage_weight>v_scope_monthly then
          return jsonb_build_object('authorized',false,'reason','rate_limited','limit_scope','organization');
        end if;
      end if;
    end if;
  end if;

  update private.api_keys set last_used_at=v_now where id=found_key.id;
  insert into private.api_usage(api_key_id,user_id,organization_id,project_id,service_slug,request_method,service_weight)
  values(found_key.id,found_key.user_id,v_org_id,v_project_id,p_service_slug,upper(coalesce(p_method,'POST')),v_usage_weight)
  returning id into v_usage_id;

  if pg_try_advisory_xact_lock(hashtextextended('nox_api_usage_retention_24h',0)) then
    delete from private.api_usage
    where created_at<v_now-interval '24 hours' and aggregated_at is not null;
  end if;

  return jsonb_build_object(
    'authorized',true,'usage_id',v_usage_id,
    'limit_scope',case when v_is_default then 'personal' else 'organization' end
  );
end;
$function$;

revoke all on function public.bmg_admin_get_scope_pool_limits() from public,anon;
revoke all on function public.bmg_admin_set_scope_pool_limits(integer,bigint,bigint) from public,anon;
revoke all on function public.bmg_get_organization_usage(uuid,integer) from public,anon;
grant execute on function public.bmg_admin_get_scope_pool_limits() to authenticated;
grant execute on function public.bmg_admin_set_scope_pool_limits(integer,bigint,bigint) to authenticated;
grant execute on function public.bmg_get_organization_usage(uuid,integer) to authenticated;

commit;
