begin;

create or replace function public.bmg_admin_update_plan_limits(
  p_plan text,p_requests_per_minute integer,p_max_api_keys integer,
  p_daily_weighted_limit bigint,p_monthly_weighted_limit bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $function$
declare
  v_actor_id uuid:=auth.uid();
  v_role text;
  v_row public.api_plan_limits%rowtype;
begin
  if v_actor_id is null then raise exception 'يلزم تسجيل الدخول.'; end if;
  select role into v_role from public.profiles where id=v_actor_id;
  if v_role is null or v_role not in ('admin','owner') or not private.bmg_is_admin() then
    raise exception 'لا تملك صلاحية تعديل حدود الخطط.';
  end if;
  if p_plan is null or p_plan not in ('basic','pro','premium') then raise exception 'المستوى غير صالح.'; end if;
  if p_requests_per_minute is null or p_requests_per_minute<=0
    or p_max_api_keys is null or p_max_api_keys<=0
    or p_daily_weighted_limit is null or p_daily_weighted_limit<=0
    or p_monthly_weighted_limit is null or p_monthly_weighted_limit<=0 then
    raise exception 'يجب أن تكون جميع الحدود أعداداً موجبة.';
  end if;

  insert into public.api_plan_limits(plan,requests_per_minute,max_api_keys,daily_weighted_limit,monthly_weighted_limit,updated_by,updated_at)
  values(p_plan,p_requests_per_minute,p_max_api_keys,p_daily_weighted_limit,p_monthly_weighted_limit,v_actor_id,now())
  on conflict (plan) do update set
    requests_per_minute=excluded.requests_per_minute,
    max_api_keys=excluded.max_api_keys,
    daily_weighted_limit=excluded.daily_weighted_limit,
    monthly_weighted_limit=excluded.monthly_weighted_limit,
    updated_by=excluded.updated_by,
    updated_at=excluded.updated_at
  returning * into v_row;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(v_actor_id,'plan_limits.update','api_plan_limits',v_row.plan,
    jsonb_build_object('requests_per_minute',v_row.requests_per_minute,'max_api_keys',v_row.max_api_keys,
      'daily_weighted_limit',v_row.daily_weighted_limit,'monthly_weighted_limit',v_row.monthly_weighted_limit));

  return jsonb_build_object('plan',v_row.plan,'requests_per_minute',v_row.requests_per_minute,
    'max_api_keys',v_row.max_api_keys,'daily_weighted_limit',v_row.daily_weighted_limit,
    'monthly_weighted_limit',v_row.monthly_weighted_limit);
end;
$function$;

create or replace function public.bmg_admin_update_limits(
  p_requests_per_minute integer,p_max_api_keys integer,
  p_daily_weighted_limit bigint,p_monthly_weighted_limit bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $function$
declare
  v_actor_id uuid:=auth.uid();
  v_role text;
  v_row public.api_admin_limits%rowtype;
begin
  if v_actor_id is null then raise exception 'يلزم تسجيل الدخول.'; end if;
  select role into v_role from public.profiles where id=v_actor_id;
  if v_role is null or v_role not in ('admin','owner') or not private.bmg_is_admin() then
    raise exception 'لا تملك صلاحية تعديل حدود الإدارة.';
  end if;
  if p_requests_per_minute is null or p_requests_per_minute<=0
    or p_max_api_keys is null or p_max_api_keys<=0
    or p_daily_weighted_limit is null or p_daily_weighted_limit<=0
    or p_monthly_weighted_limit is null or p_monthly_weighted_limit<=0 then
    raise exception 'يجب أن تكون جميع الحدود أعداداً موجبة.';
  end if;

  insert into public.api_admin_limits(id,requests_per_minute,max_api_keys,daily_weighted_limit,monthly_weighted_limit,updated_by,updated_at)
  values(true,p_requests_per_minute,p_max_api_keys,p_daily_weighted_limit,p_monthly_weighted_limit,v_actor_id,now())
  on conflict (id) do update set
    requests_per_minute=excluded.requests_per_minute,
    max_api_keys=excluded.max_api_keys,
    daily_weighted_limit=excluded.daily_weighted_limit,
    monthly_weighted_limit=excluded.monthly_weighted_limit,
    updated_by=excluded.updated_by,
    updated_at=excluded.updated_at
  returning * into v_row;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(v_actor_id,'admin_limits.update','api_admin_limits','true',
    jsonb_build_object('requests_per_minute',v_row.requests_per_minute,'max_api_keys',v_row.max_api_keys,
      'daily_weighted_limit',v_row.daily_weighted_limit,'monthly_weighted_limit',v_row.monthly_weighted_limit));

  return jsonb_build_object('id',v_row.id,'requests_per_minute',v_row.requests_per_minute,
    'max_api_keys',v_row.max_api_keys,'daily_weighted_limit',v_row.daily_weighted_limit,
    'monthly_weighted_limit',v_row.monthly_weighted_limit);
end;
$function$;

revoke all on function public.bmg_admin_update_plan_limits(text,integer,integer,bigint,bigint) from public,anon;
revoke all on function public.bmg_admin_update_limits(integer,integer,bigint,bigint) from public,anon;
grant execute on function public.bmg_admin_update_plan_limits(text,integer,integer,bigint,bigint) to authenticated;
grant execute on function public.bmg_admin_update_limits(integer,integer,bigint,bigint) to authenticated;

commit;
