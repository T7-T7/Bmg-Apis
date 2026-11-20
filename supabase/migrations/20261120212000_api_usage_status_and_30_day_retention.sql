-- Keep API request analytics bounded to the latest 30 days.
create index if not exists api_usage_created_at_idx
  on private.api_usage (created_at);

create or replace function public.bmg_authorize_api_request(
  p_key text, p_service_slug text, p_method text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','extensions'
as $function$
declare
  found_key private.api_keys%rowtype;
  service_status text;
  recent_count integer;
  usage_id bigint;
begin
  if p_key is null or length(p_key) < 40 then
    return jsonb_build_object('authorized', false, 'reason', 'invalid_key');
  end if;
  select * into found_key
  from private.api_keys
  where key_hash = extensions.digest(p_key, 'sha256')
    and revoked_at is null
    and (expires_at is null or expires_at > now())
    and scopes @> array['api:use']::text[]
  limit 1;
  if found_key.id is null then
    return jsonb_build_object('authorized', false, 'reason', 'invalid_key');
  end if;
  select status into service_status from public.api_services where slug = p_service_slug;
  if service_status is distinct from 'active' then
    return jsonb_build_object('authorized', false, 'reason', 'service_unavailable');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(found_key.id::text, 0));
  select count(*) into recent_count
  from private.api_usage
  where api_key_id = found_key.id and created_at > now() - interval '1 minute';
  if recent_count >= 30 then
    return jsonb_build_object('authorized', false, 'reason', 'rate_limited');
  end if;
  if pg_try_advisory_xact_lock(hashtextextended('nox_api_usage_retention_30d', 0)) then
    delete from private.api_usage where created_at < now() - interval '30 days';
  end if;
  update private.api_keys set last_used_at = now() where id = found_key.id;
  insert into private.api_usage(api_key_id, user_id, service_slug, request_method)
  values (found_key.id, found_key.user_id, p_service_slug, upper(coalesce(p_method, 'POST')))
  returning id into usage_id;
  return jsonb_build_object('authorized', true, 'usage_id', usage_id);
end;
$function$;

create or replace function public.bmg_authorize_demo_request(
  p_client_hash text, p_service_slug text, p_method text, p_server_secret text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','extensions'
as $function$
declare
  v_status text;
  v_limit integer;
  v_count integer;
  v_secret_hash bytea;
  v_usage_id bigint;
begin
  if p_server_secret is null then
    return jsonb_build_object('authorized',false,'reason','invalid_server');
  end if;
  select secret_hash into v_secret_hash from private.api_demo_config where id=true;
  if v_secret_hash is null or v_secret_hash<>extensions.digest(convert_to(p_server_secret,'UTF8'),'sha256') then
    return jsonb_build_object('authorized',false,'reason','invalid_server');
  end if;
  if p_client_hash is null or p_client_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('authorized',false,'reason','invalid_client');
  end if;
  select status into v_status from public.api_services where slug=p_service_slug;
  if v_status is distinct from 'active' then
    return jsonb_build_object('authorized',false,'reason','service_unavailable');
  end if;
  v_limit:=case when p_service_slug='aql-gemini' then 4 else 20 end;
  perform pg_advisory_xact_lock(hashtextextended(p_client_hash||':'||p_service_slug,0));
  delete from private.api_demo_usage where created_at<now()-interval '24 hours';
  select count(*) into v_count from private.api_demo_usage
  where client_hash=p_client_hash and service_slug=p_service_slug and created_at>now()-interval '1 minute';
  if v_count>=v_limit then
    return jsonb_build_object('authorized',false,'reason','rate_limited','limit',v_limit);
  end if;
  insert into private.api_demo_usage(client_hash,service_slug,request_method)
  values(p_client_hash,p_service_slug,upper(coalesce(p_method,'GET')));
  if pg_try_advisory_xact_lock(hashtextextended('nox_api_usage_retention_30d',0)) then
    delete from private.api_usage where created_at<now()-interval '30 days';
  end if;
  insert into private.api_usage(api_key_id,user_id,service_slug,request_method)
  values(null,null,p_service_slug,upper(coalesce(p_method,'GET')))
  returning id into v_usage_id;
  return jsonb_build_object('authorized',true,'limit',v_limit,'window_seconds',60,'usage_id',v_usage_id);
end;
$function$;

create or replace function public.bmg_complete_api_request(
  p_usage_id bigint,
  p_status_code integer,
  p_latency_ms integer,
  p_server_secret text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','private','extensions'
as $function$
declare
  v_secret_hash bytea;
  v_updated bigint;
begin
  if p_server_secret is null or p_usage_id is null
     or p_status_code < 100 or p_status_code > 599
     or p_latency_ms < 0 or p_latency_ms > 120000 then
    return jsonb_build_object('completed', false, 'reason', 'invalid_input');
  end if;
  select secret_hash into v_secret_hash from private.api_demo_config where id = true;
  if v_secret_hash is null
     or v_secret_hash <> extensions.digest(convert_to(p_server_secret, 'UTF8'), 'sha256') then
    return jsonb_build_object('completed', false, 'reason', 'invalid_server');
  end if;
  update private.api_usage
  set status_code = p_status_code, latency_ms = p_latency_ms
  where id = p_usage_id and status_code is null and created_at >= now() - interval '30 days';
  get diagnostics v_updated = row_count;
  return jsonb_build_object('completed', v_updated = 1);
end;
$function$;

revoke all on function public.bmg_complete_api_request(bigint,integer,integer,text) from public;
grant execute on function public.bmg_complete_api_request(bigint,integer,integer,text) to anon, authenticated, service_role;
