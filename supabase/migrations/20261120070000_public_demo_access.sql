begin;
create table if not exists private.api_demo_usage(
 id bigint generated always as identity primary key,
 client_hash text not null,
 service_slug text not null,
 request_method text not null,
 created_at timestamptz not null default now()
);
create index if not exists api_demo_usage_client_service_created_idx
 on private.api_demo_usage(client_hash,service_slug,created_at desc);
revoke all on private.api_demo_usage from anon,authenticated,public;
create or replace function public.bmg_authorize_demo_request(
 p_client_hash text,
 p_service_slug text,
 p_method text
) returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,private
as $function$
declare
 v_status text;
 v_limit integer;
 v_count integer;
begin
 if p_client_hash is null or p_client_hash !~ '^[a-f0-9]{64}$' then
  return jsonb_build_object('authorized',false,'reason','invalid_client');
 end if;
 select status into v_status from public.api_services where slug=p_service_slug;
 if v_status is distinct from 'active' then
  return jsonb_build_object('authorized',false,'reason','service_unavailable');
 end if;
 -- Public demos have lower per-minute quotas than authenticated API keys.
 v_limit:=case when p_service_slug='aql-gemini' then 4 else 20 end;
 perform pg_advisory_xact_lock(hashtextextended(p_client_hash||':'||p_service_slug,0));
 delete from private.api_demo_usage where created_at < now()-interval '24 hours';
 select count(*) into v_count from private.api_demo_usage
  where client_hash=p_client_hash and service_slug=p_service_slug
  and created_at>now()-interval '1 minute';
 if v_count>=v_limit then
  return jsonb_build_object('authorized',false,'reason','rate_limited','limit',v_limit);
 end if;
 insert into private.api_demo_usage(client_hash,service_slug,request_method)
 values(p_client_hash,p_service_slug,upper(coalesce(p_method,'GET')));
 return jsonb_build_object('authorized',true,'limit',v_limit,'window_seconds',60);
end;
$function$;
revoke all on function public.bmg_authorize_demo_request(text,text,text) from public,authenticated;
grant execute on function public.bmg_authorize_demo_request(text,text,text) to anon,service_role;
commit;
