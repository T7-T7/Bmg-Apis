create or replace function public.bmg_create_api_key(
  p_key text,
  p_label text,
  p_expires_at timestamp with time zone default null
)
returns table(id uuid, label text, key_prefix text, created_at timestamp with time zone)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private', 'extensions', 'auth'
as $function$
declare
  uid uuid := auth.uid();
  clean_label text := nullif(trim(p_label), '');
  v_role text;
  v_plan text;
  v_status text;
  v_key_limit integer;
  v_key_count integer;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_key is null or length(p_key) <> 56 or p_key !~ '^nox_[A-Za-z0-9_-]{52}$' then
    raise exception 'Invalid key';
  end if;
  if clean_label is null then raise exception 'Key label is required'; end if;
  if p_expires_at is not null and p_expires_at <= now() then raise exception 'Expiration must be in the future'; end if;

  select profiles.role, profiles.plan, profiles.account_status
  into v_role, v_plan, v_status
  from public.profiles as profiles where profiles.id = uid;
  if v_status is distinct from 'active' then raise exception 'Account is suspended'; end if;

  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  if v_role in ('admin', 'owner') then
    select admin_limits.max_api_keys into v_key_limit
    from public.api_admin_limits as admin_limits where admin_limits.id = true;
  else
    select plan_limits.max_api_keys into v_key_limit
    from public.api_plan_limits as plan_limits where plan_limits.plan = coalesce(v_plan, 'basic');
  end if;
  v_key_limit := coalesce(v_key_limit, 2);

  select count(*)::integer into v_key_count
  from private.api_keys as api_keys
  where api_keys.user_id = uid and api_keys.revoked_at is null
    and (api_keys.expires_at is null or api_keys.expires_at > now());
  if v_key_count >= v_key_limit then
    raise exception 'API key limit reached for the current account level (limit: %)', v_key_limit;
  end if;

  return query
  insert into private.api_keys(user_id, label, key_prefix, key_hash, expires_at)
  values (uid, left(clean_label, 64), left(p_key, 18), extensions.digest(p_key, 'sha256'), p_expires_at)
  returning api_keys.id, api_keys.label, api_keys.key_prefix, api_keys.created_at;
end;
$function$;