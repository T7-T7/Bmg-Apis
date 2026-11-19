begin;

-- Users may edit only their public profile fields, never their privilege level.
revoke update on table public.profiles from anon, authenticated;
grant update (display_name, avatar_url) on table public.profiles to authenticated;

-- Serialize requests per API key before counting usage to prevent concurrent
-- requests from racing past the per-minute limit.
create or replace function public.bmg_authorize_api_request(
  p_key text,
  p_service_slug text,
  p_method text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $function$
declare
  found_key private.api_keys%rowtype;
  service_status text;
  recent_count integer;
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

  select status into service_status
  from public.api_services
  where slug = p_service_slug;

  if service_status is distinct from 'active' then
    return jsonb_build_object('authorized', false, 'reason', 'service_unavailable');
  end if;

  -- A transaction-scoped advisory lock makes count + insert atomic per key.
  perform pg_advisory_xact_lock(hashtextextended(found_key.id::text, 0));

  select count(*) into recent_count
  from private.api_usage
  where api_key_id = found_key.id
    and created_at > now() - interval '1 minute';

  if recent_count >= 30 then
    return jsonb_build_object('authorized', false, 'reason', 'rate_limited');
  end if;

  update private.api_keys
  set last_used_at = now()
  where id = found_key.id;

  insert into private.api_usage(api_key_id, user_id, service_slug, request_method)
  values (found_key.id, found_key.user_id, p_service_slug, upper(coalesce(p_method, 'POST')));

  -- Do not disclose internal key, user, or scope identifiers to callers.
  return jsonb_build_object('authorized', true);
end;
$function$;

revoke execute on function public.bmg_authorize_api_request(text, text, text) from authenticated;
grant execute on function public.bmg_authorize_api_request(text, text, text) to anon, service_role;

commit;
