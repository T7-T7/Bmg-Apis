begin;

-- Keep the function search_path empty and schema-qualify auth helpers.
-- With an empty search_path, unqualified auth.uid()/auth.jwt() cannot resolve.
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

revoke all on function public.bmg_delete_api_key(uuid) from public, anon;
revoke all on function public.bmg_admin_delete_api_key(uuid) from public, anon;
grant execute on function public.bmg_delete_api_key(uuid) to authenticated;
grant execute on function public.bmg_admin_delete_api_key(uuid) to authenticated;

commit;
