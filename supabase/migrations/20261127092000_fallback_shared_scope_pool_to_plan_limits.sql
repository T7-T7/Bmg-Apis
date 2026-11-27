begin;
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
  owner_plan as (
    select p.role,p.plan
    from public.profiles p
    join target t on t.owner_id=p.id
  ),
  effective_limits as (
    select
      case when custom.id is not null then custom.requests_per_minute
        when owner_plan.role in ('admin','owner') then admin_limits.requests_per_minute
        else plan_limits.requests_per_minute end as rpm,
      case when custom.id is not null then custom.daily_weighted_limit
        when owner_plan.role in ('admin','owner') then admin_limits.daily_weighted_limit
        else plan_limits.daily_weighted_limit end as daily_limit,
      case when custom.id is not null then custom.monthly_weighted_limit
        when owner_plan.role in ('admin','owner') then admin_limits.monthly_weighted_limit
        else plan_limits.monthly_weighted_limit end as monthly_limit
    from owner_plan
    left join private.api_scope_pool_limits custom on custom.id=true
    left join public.api_admin_limits admin_limits on admin_limits.id=true
    left join public.api_plan_limits plan_limits
      on plan_limits.plan=case when owner_plan.plan in ('basic','pro','premium') then owner_plan.plan else 'basic' end
  )
  select
    r.owner_id,
    r.total_scopes,
    r.position,
    case when e.rpm is null then null
      else (e.rpm/r.total_scopes::integer)
        + case when r.position<=mod(e.rpm::bigint,r.total_scopes) then 1 else 0 end
    end,
    case when e.daily_limit is null then null
      else (e.daily_limit/r.total_scopes)
        + case when r.position<=mod(e.daily_limit,r.total_scopes) then 1 else 0 end
    end,
    case when e.monthly_limit is null then null
      else (e.monthly_limit/r.total_scopes)
        + case when r.position<=mod(e.monthly_limit,r.total_scopes) then 1 else 0 end
    end
  from ranked r cross join effective_limits e
  where r.id=p_organization_id;
$function$;
commit;