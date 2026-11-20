create or replace function public.bmg_create_api_key(
  p_key text,
  p_label text default 'Default key'
)
returns table(
  id uuid,
  label text,
  key_prefix text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  if p_key is null
    or length(p_key) < 40
    or p_key !~ '^nox_live_[A-Za-z0-9_-]+$'
  then
    raise exception 'Invalid key';
  end if;

  return query
  insert into private.api_keys(user_id, label, key_prefix, key_hash)
  values (
    uid,
    left(coalesce(nullif(trim(p_label), ''), 'Default key'), 64),
    left(p_key, 18),
    extensions.digest(p_key, 'sha256')
  )
  returning
    private.api_keys.id,
    private.api_keys.label,
    private.api_keys.key_prefix,
    private.api_keys.created_at;
end;
$function$;
