create or replace function public.bmg_authorize_api_request(p_key text,p_service_slug text,p_method text)
returns jsonb
language plpgsql
security definer
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
  if p_key is null or length(p_key)<40 then
    return jsonb_build_object('authorized',false,'reason','invalid_key');
  end if;

  select * into found_key
  from private.api_keys
  where key_hash=extensions.digest(p_key,'sha256')
    and revoked_at is null
    and (expires_at is null or expires_at>now())
    and scopes @> array['api:use']::text[]
  limit 1;

  if found_key.id is null then
    return jsonb_build_object('authorized',false,'reason','invalid_key');
  end if;

  select p.account_status into account_status from public.profiles p where p.id=found_key.user_id;
  if account_status is distinct from 'active' then
    return jsonb_build_object('authorized',false,'reason','account_suspended');
  end if;

  select s.id,s.status,(s.archived_at is not null),s.weight,s.category
    into service_id,service_status,service_archived,service_weight,service_category
  from public.api_services s where s.slug=p_service_slug;

  if service_status is distinct from 'active' or coalesce(service_archived,true) then
    return jsonb_build_object('authorized',false,'reason','service_unavailable');
  end if;

  if exists(select 1 from unnest(found_key.scopes) sc where sc like 'service:%')
     and not found_key.scopes @> array['service:'||p_service_slug]::text[] then
    return jsonb_build_object('authorized',false,'reason','insufficient_scope');
  end if;

  if exists(select 1 from unnest(found_key.scopes) sc where sc like 'category:%')
     and not found_key.scopes @> array['category:'||lower(coalesce(service_category,''))]::text[] then
    return jsonb_build_object('authorized',false,'reason','insufficient_scope');
  end if;

  select m.message into maintenance_message
  from public.maintenance_windows m
  where m.enabled=true
    and (m.service_id is null or m.service_id=service_id)
    and (m.starts_at is null or m.starts_at<=now())
    and (m.ends_at is null or m.ends_at>now())
  order by (m.service_id is not null) desc,m.updated_at desc
  limit 1;

  if maintenance_message is not null then
    return jsonb_build_object('authorized',false,'reason','maintenance','message',maintenance_message);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(found_key.id::text,0));
  select count(*) into recent_count from private.api_usage
  where api_key_id=found_key.id and created_at>now()-interval '1 minute';

  if recent_count>=30 then
    return jsonb_build_object('authorized',false,'reason','rate_limited');
  end if;

  if pg_try_advisory_xact_lock(hashtextextended('nox_api_usage_retention_24h',0)) then
    delete from private.api_usage
    where created_at<now()-interval '24 hours' and aggregated_at is not null;
  end if;

  update private.api_keys set last_used_at=now() where id=found_key.id;
  insert into private.api_usage(api_key_id,user_id,service_slug,request_method,service_weight)
  values(found_key.id,found_key.user_id,p_service_slug,upper(coalesce(p_method,'POST')),greatest(1,coalesce(service_weight,1)))
  returning id into usage_id;

  return jsonb_build_object('authorized',true,'usage_id',usage_id);
end;
$function$;