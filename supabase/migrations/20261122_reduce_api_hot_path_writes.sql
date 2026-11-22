-- BMG API hot-path optimization
create index if not exists api_service_dependencies_created_by_idx on public.api_service_dependencies (created_by) where created_by is not null;
create index if not exists api_webhooks_created_by_idx on public.api_webhooks (created_by) where created_by is not null;
create index if not exists incident_updates_created_by_idx on public.incident_updates (created_by) where created_by is not null;
drop index if exists private.api_usage_api_key_id_idx;
create index if not exists api_usage_api_key_created_idx on private.api_usage (api_key_id, created_at desc);
create index if not exists api_demo_usage_client_service_created_idx on private.api_demo_usage (client_hash, service_slug, created_at desc);

create or replace function public.bmg_authorize_api_request(p_key text,p_service_slug text,p_method text)
returns jsonb language plpgsql security definer
set search_path to 'pg_catalog','public','private','extensions'
as $function$
declare
  found_key private.api_keys%rowtype;
  service_status text;
  service_id uuid;
  service_archived boolean;
  service_weight integer;
  service_category text;
  account_status text;
  maintenance_message text;
  recent_count integer;
  usage_id bigint;
begin
  if p_key is null or length(p_key)<40 then return jsonb_build_object('authorized',false,'reason','invalid_key'); end if;
  select * into found_key from private.api_keys
  where key_hash=extensions.digest(p_key,'sha256') and revoked_at is null
    and (expires_at is null or expires_at>now()) and scopes @> array['api:use']::text[] limit 1;
  if found_key.id is null then return jsonb_build_object('authorized',false,'reason','invalid_key'); end if;
  select p.account_status into account_status from public.profiles p where p.id=found_key.user_id;
  if account_status is distinct from 'active' then return jsonb_build_object('authorized',false,'reason','account_suspended'); end if;
  select s.id,s.status,(s.archived_at is not null),s.weight,s.category
    into service_id,service_status,service_archived,service_weight,service_category
  from public.api_services s where s.slug=p_service_slug;
  if service_status is distinct from 'active' or coalesce(service_archived,true) then return jsonb_build_object('authorized',false,'reason','service_unavailable'); end if;
  if exists(select 1 from unnest(found_key.scopes) sc where sc like 'service:%')
     and not found_key.scopes @> array['service:'||p_service_slug]::text[] then return jsonb_build_object('authorized',false,'reason','insufficient_scope'); end if;
  if exists(select 1 from unnest(found_key.scopes) sc where sc like 'category:%')
     and not found_key.scopes @> array['category:'||lower(coalesce(service_category,''))]::text[] then return jsonb_build_object('authorized',false,'reason','insufficient_scope'); end if;
  select m.message into maintenance_message from public.maintenance_windows m
  where m.enabled=true and (m.service_id is null or m.service_id=service_id)
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
  order by (m.service_id is not null) desc,m.updated_at desc limit 1;
  if maintenance_message is not null then return jsonb_build_object('authorized',false,'reason','maintenance','message',maintenance_message); end if;
  perform pg_advisory_xact_lock(hashtextextended(found_key.id::text,0));
  select count(*) into recent_count from private.api_usage
  where api_key_id=found_key.id and created_at>now()-interval '1 minute';
  if recent_count>=30 then return jsonb_build_object('authorized',false,'reason','rate_limited'); end if;
  update private.api_keys set last_used_at=now()
  where id=found_key.id and (last_used_at is null or last_used_at<now()-interval '5 minutes');
  insert into private.api_usage(api_key_id,user_id,service_slug,request_method,service_weight)
  values(found_key.id,found_key.user_id,p_service_slug,upper(coalesce(p_method,'POST')),greatest(1,coalesce(service_weight,1)))
  returning id into usage_id;
  return jsonb_build_object('authorized',true,'usage_id',usage_id);
end;
$function$;

create or replace function public.bmg_authorize_demo_request(p_client_hash text,p_service_slug text,p_method text,p_server_secret text)
returns jsonb language plpgsql security definer
set search_path to 'pg_catalog','public','private','extensions'
as $function$
declare
  v_status text;
  v_service_id uuid;
  v_archived boolean;
  v_maintenance_message text;
  v_limit integer;
  v_count integer;
  v_secret_hash bytea;
begin
  if p_server_secret is null then return jsonb_build_object('authorized',false,'reason','invalid_server'); end if;
  select secret_hash into v_secret_hash from private.api_demo_config where id=true;
  if v_secret_hash is null or v_secret_hash<>extensions.digest(convert_to(p_server_secret,'UTF8'),'sha256') then
    return jsonb_build_object('authorized',false,'reason','invalid_server');
  end if;
  if p_client_hash is null or p_client_hash !~ '^[a-f0-9]{64}$' then return jsonb_build_object('authorized',false,'reason','invalid_client'); end if;
  select s.id,s.status,(s.archived_at is not null) into v_service_id,v_status,v_archived
  from public.api_services s where s.slug=p_service_slug;
  if v_status is distinct from 'active' or coalesce(v_archived,true) then return jsonb_build_object('authorized',false,'reason','service_unavailable'); end if;
  select m.message into v_maintenance_message from public.maintenance_windows m
  where m.enabled=true and (m.service_id is null or m.service_id=v_service_id)
    and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
  order by (m.service_id is not null) desc,m.updated_at desc limit 1;
  if v_maintenance_message is not null then return jsonb_build_object('authorized',false,'reason','maintenance','message',v_maintenance_message); end if;
  v_limit:=case when p_service_slug='aql-gemini' then 4 else 20 end;
  perform pg_advisory_xact_lock(hashtextextended(p_client_hash||':'||p_service_slug,0));
  select count(*) into v_count from private.api_demo_usage
  where client_hash=p_client_hash and service_slug=p_service_slug and created_at>now()-interval '1 minute';
  if v_count>=v_limit then return jsonb_build_object('authorized',false,'reason','rate_limited','limit',v_limit); end if;
  insert into private.api_demo_usage(client_hash,service_slug,request_method)
  values(p_client_hash,p_service_slug,upper(coalesce(p_method,'GET')));
  return jsonb_build_object('authorized',true,'limit',v_limit,'window_seconds',60);
end;
$function$;

do $$
begin
  if not exists(select 1 from cron.job where jobname='nox-demo-usage-retention') then
    perform cron.schedule('nox-demo-usage-retention','*/15 * * * *',
      $job$delete from private.api_demo_usage where created_at < now() - interval '24 hours'$job$);
  end if;
end $$;
