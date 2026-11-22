-- Hard-delete API keys instead of retaining revoked rows.
-- Raw request rows tied to a deleted key are removed; aggregate hourly analytics
-- are retained because they are grouped by user/service/hour, not by key.

create or replace function private.bmg_delete_api_key_internal(
  p_id uuid,
  p_owner_id uuid,
  p_actor uuid,
  p_is_admin boolean
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_label text;
begin
  if p_id is null then
    return false;
  end if;

  -- Use the same per-key advisory lock as API authorization so a delete
  -- cannot race a new authorization transaction.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_id::text, 0)
  );

  if p_is_admin then
    select k.user_id, k.label
      into v_user_id, v_label
    from private.api_keys k
    where k.id = p_id
    for update;
  else
    select k.user_id, k.label
      into v_user_id, v_label
    from private.api_keys k
    where k.id = p_id
      and k.user_id = p_owner_id
    for update;
  end if;

  if not found then
    return false;
  end if;

  -- Remove request-level records that directly identify this key.
  delete from private.api_usage
  where api_key_id = p_id;

  delete from private.api_keys
  where id = p_id;

  -- Keep only a non-secret audit event; never store the key or its hash.
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (
    p_actor,
    case when p_is_admin then 'api_key.admin_delete' else 'api_key.delete' end,
    'api_key',
    p_id::text,
    pg_catalog.jsonb_build_object('user_id', v_user_id, 'label', v_label)
  );

  return true;
end;
$$;

revoke all on function private.bmg_delete_api_key_internal(uuid, uuid, uuid, boolean)
  from public, anon, authenticated;

create or replace function public.bmg_delete_api_key(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_jwt jsonb := auth.jwt();
  v_requires_mfa boolean;
  v_recent_totp boolean;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select exists (
    select 1
    from auth.mfa_factors f
    where f.user_id = v_actor
      and f.factor_type = 'totp'
      and f.status = 'verified'
  ) into v_requires_mfa;

  if v_requires_mfa then
    select
      (v_jwt->>'aal' = 'aal2')
      and exists (
        select 1
        from jsonb_array_elements(coalesce(v_jwt->'amr', '[]'::jsonb)) as entry
        where entry->>'method' = 'totp'
          and coalesce((entry->>'timestamp')::numeric, 0)
            >= extract(epoch from (now() - interval '2 hours'))
      )
    into v_recent_totp;

    if not coalesce(v_recent_totp, false) then
      raise exception 'Recent authenticator verification required'
        using errcode = '42501';
    end if;
  end if;

  return private.bmg_delete_api_key_internal(p_id, v_actor, v_actor, false);
end;
$$;

create or replace function public.bmg_admin_delete_api_key(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not private.bmg_is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  return private.bmg_delete_api_key_internal(p_id, null, v_actor, true);
end;
$$;

-- Keep the old RPC names as compatibility wrappers, but make them hard-delete too.
create or replace function public.bmg_revoke_api_key(p_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select public.bmg_delete_api_key(p_id);
$$;

create or replace function public.bmg_admin_revoke_api_key(p_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select public.bmg_admin_delete_api_key(p_id);
$$;

revoke all on function public.bmg_delete_api_key(uuid) from public, anon;
revoke all on function public.bmg_admin_delete_api_key(uuid) from public, anon;
revoke all on function public.bmg_revoke_api_key(uuid) from public, anon;
revoke all on function public.bmg_admin_revoke_api_key(uuid) from public, anon;

grant execute on function public.bmg_delete_api_key(uuid) to authenticated;
grant execute on function public.bmg_admin_delete_api_key(uuid) to authenticated;
grant execute on function public.bmg_revoke_api_key(uuid) to authenticated;
grant execute on function public.bmg_admin_revoke_api_key(uuid) to authenticated;

-- Clean up keys already marked as revoked by the old soft-delete implementation.
delete from private.api_usage
where api_key_id in (
  select id from private.api_keys where revoked_at is not null
);

delete from public.user_notifications
where metadata ? 'key_id'
  and metadata->>'key_id' in (
    select id::text from private.api_keys where revoked_at is not null
  );

delete from private.api_keys
where revoked_at is not null;
