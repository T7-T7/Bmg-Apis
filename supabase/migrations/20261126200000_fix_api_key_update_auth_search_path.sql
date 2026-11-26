begin;

-- The restricted search_path excludes auth, so qualify both auth helpers.
create or replace function public.bmg_update_api_key(
  p_id uuid,
  p_label text,
  p_expires_at timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_jwt jsonb := auth.jwt();
  v_requires_mfa boolean;
  v_recent_totp boolean;
  v_affected integer;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select exists (
    select 1 from auth.mfa_factors f
    where f.user_id = v_actor and f.factor_type = 'totp' and f.status = 'verified'
  ) into v_requires_mfa;

  if v_requires_mfa then
    select
      (v_jwt->>'aal' = 'aal2')
      and exists (
        select 1 from jsonb_array_elements(coalesce(v_jwt->'amr', '[]'::jsonb)) as entry
        where entry->>'method' = 'totp'
          and coalesce((entry->>'timestamp')::numeric, 0)
            >= extract(epoch from (now() - interval '2 hours'))
      )
    into v_recent_totp;

    if not coalesce(v_recent_totp, false) then
      raise exception 'Recent authenticator verification required' using errcode = '42501';
    end if;
  end if;

  if p_label is null or length(trim(p_label)) = 0 or length(trim(p_label)) > 64 then
    raise exception 'Key label must contain 1 to 64 characters';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'Expiration must be in the future';
  end if;

  update private.api_keys
  set label = trim(p_label), expires_at = p_expires_at
  where id = p_id and user_id = v_actor and revoked_at is null;

  get diagnostics v_affected = row_count;
  return v_affected = 1;
end;
$function$;

revoke all on function public.bmg_update_api_key(uuid, text, timestamptz) from public, anon;
grant execute on function public.bmg_update_api_key(uuid, text, timestamptz) to authenticated;

commit;
