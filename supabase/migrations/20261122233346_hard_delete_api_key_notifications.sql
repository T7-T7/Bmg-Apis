-- Remove notification rows that reference a key as part of every hard delete.
-- The audit event remains, but it contains no key secret or hash.

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
  if p_id is null then return false; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_id::text, 0)
  );

  if p_is_admin then
    select k.user_id, k.label into v_user_id, v_label
    from private.api_keys k where k.id = p_id for update;
  else
    select k.user_id, k.label into v_user_id, v_label
    from private.api_keys k
    where k.id = p_id and k.user_id = p_owner_id
    for update;
  end if;

  if not found then return false; end if;

  delete from private.api_usage where api_key_id = p_id;
  delete from public.user_notifications
  where metadata ? 'key_id' and metadata->>'key_id' = p_id::text;
  delete from private.api_keys where id = p_id;

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