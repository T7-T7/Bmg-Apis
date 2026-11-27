begin;
create table if not exists public.organization_service_limits (
 organization_id uuid not null references public.organizations(id) on delete cascade,
 service_slug text not null references public.api_services(slug) on delete cascade,
 requests_per_minute integer not null check(requests_per_minute>0),
 daily_weighted_limit bigint check(daily_weighted_limit is null or daily_weighted_limit>0),
 monthly_weighted_limit bigint check(monthly_weighted_limit is null or monthly_weighted_limit>0),
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now(),
 primary key(organization_id,service_slug)
);
alter table public.project_service_limits
 add column if not exists daily_weighted_limit bigint check(daily_weighted_limit is null or daily_weighted_limit>0),
 add column if not exists monthly_weighted_limit bigint check(monthly_weighted_limit is null or monthly_weighted_limit>0);
create index if not exists organization_service_limits_service_idx on public.organization_service_limits(service_slug,organization_id);
create index if not exists project_service_limits_service_idx on public.project_service_limits(service_slug,project_id);
alter table public.organization_service_limits enable row level security;
drop policy if exists organization_service_limits_read_org_member on public.organization_service_limits;
create policy organization_service_limits_read_org_member on public.organization_service_limits for select to authenticated using(private.bmg_is_org_member(organization_id));
grant select on public.organization_service_limits to authenticated;
revoke insert,update,delete on public.organization_service_limits from anon,authenticated;
revoke insert,update,delete on public.project_service_limits from anon,authenticated;

create or replace function public.bmg_admin_set_organization_service_limits(p_organization_id uuid,p_service_slug text,p_requests_per_minute integer,p_daily_weighted_limit bigint default null,p_monthly_weighted_limit bigint default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,private
as $function$
declare v_actor uuid:=auth.uid(); v_row public.organization_service_limits%rowtype;
begin
 if v_actor is null or not private.bmg_is_admin() then raise exception 'لا تملك صلاحية تعديل حدود المؤسسات.' using errcode='42501'; end if;
 if p_organization_id is null or p_service_slug is null or p_requests_per_minute is null or p_requests_per_minute<=0
 or (p_daily_weighted_limit is not null and p_daily_weighted_limit<=0) or (p_monthly_weighted_limit is not null and p_monthly_weighted_limit<=0)
 then raise exception 'قيم الحدود غير صالحة.'; end if;
 if not exists(select 1 from public.api_services where slug=p_service_slug) then raise exception 'الخدمة غير موجودة.'; end if;
 insert into public.organization_service_limits(organization_id,service_slug,requests_per_minute,daily_weighted_limit,monthly_weighted_limit,updated_by,updated_at)
 values(p_organization_id,p_service_slug,p_requests_per_minute,p_daily_weighted_limit,p_monthly_weighted_limit,v_actor,now())
 on conflict(organization_id,service_slug) do update set requests_per_minute=excluded.requests_per_minute,daily_weighted_limit=excluded.daily_weighted_limit,monthly_weighted_limit=excluded.monthly_weighted_limit,updated_by=excluded.updated_by,updated_at=excluded.updated_at returning * into v_row;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details) values(v_actor,'organization_service_limits.upsert','organization_service_limits',v_row.organization_id::text,jsonb_build_object('service_slug',v_row.service_slug,'requests_per_minute',v_row.requests_per_minute,'daily_weighted_limit',v_row.daily_weighted_limit,'monthly_weighted_limit',v_row.monthly_weighted_limit));
 return jsonb_build_object('organization_id',v_row.organization_id,'service_slug',v_row.service_slug,'requests_per_minute',v_row.requests_per_minute,'daily_weighted_limit',v_row.daily_weighted_limit,'monthly_weighted_limit',v_row.monthly_weighted_limit,'updated_at',v_row.updated_at);
end;$function$;

create or replace function public.bmg_admin_set_project_service_limits(p_project_id uuid,p_service_slug text,p_requests_per_minute integer,p_daily_weighted_limit bigint default null,p_monthly_weighted_limit bigint default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,private
as $function$
declare v_actor uuid:=auth.uid(); v_row public.project_service_limits%rowtype;
begin
 if v_actor is null or not private.bmg_is_admin() then raise exception 'لا تملك صلاحية تعديل حدود المشاريع.' using errcode='42501'; end if;
 if p_project_id is null or p_service_slug is null or p_requests_per_minute is null or p_requests_per_minute<=0
 or (p_daily_weighted_limit is not null and p_daily_weighted_limit<=0) or (p_monthly_weighted_limit is not null and p_monthly_weighted_limit<=0)
 then raise exception 'قيم الحدود غير صالحة.'; end if;
 if not exists(select 1 from public.api_services where slug=p_service_slug) then raise exception 'الخدمة غير موجودة.'; end if;
 insert into public.project_service_limits(project_id,service_slug,requests_per_minute,daily_weighted_limit,monthly_weighted_limit,updated_by,updated_at)
 values(p_project_id,p_service_slug,p_requests_per_minute,p_daily_weighted_limit,p_monthly_weighted_limit,v_actor,now())
 on conflict(project_id,service_slug) do update set requests_per_minute=excluded.requests_per_minute,daily_weighted_limit=excluded.daily_weighted_limit,monthly_weighted_limit=excluded.monthly_weighted_limit,updated_by=excluded.updated_by,updated_at=excluded.updated_at returning * into v_row;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details) values(v_actor,'project_service_limits.upsert','project_service_limits',v_row.project_id::text,jsonb_build_object('service_slug',v_row.service_slug,'requests_per_minute',v_row.requests_per_minute,'daily_weighted_limit',v_row.daily_weighted_limit,'monthly_weighted_limit',v_row.monthly_weighted_limit));
 return jsonb_build_object('project_id',v_row.project_id,'service_slug',v_row.service_slug,'requests_per_minute',v_row.requests_per_minute,'daily_weighted_limit',v_row.daily_weighted_limit,'monthly_weighted_limit',v_row.monthly_weighted_limit,'updated_at',v_row.updated_at);
end;$function$;

revoke all on function public.bmg_admin_set_organization_service_limits(uuid,text,integer,bigint,bigint) from public,anon;
revoke all on function public.bmg_admin_set_project_service_limits(uuid,text,integer,bigint,bigint) from public,anon;
grant execute on function public.bmg_admin_set_organization_service_limits(uuid,text,integer,bigint,bigint) to authenticated;
grant execute on function public.bmg_admin_set_project_service_limits(uuid,text,integer,bigint,bigint) to authenticated;
commit;