begin;

create or replace function public.bmg_admin_configure_maintenance(
  p_service_id uuid,
  p_message text,
  p_enabled boolean,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_window public.maintenance_windows%rowtype;
begin
  if v_actor_id is null then
    raise exception 'يلزم تسجيل الدخول.';
  end if;

  select p.role into v_actor_role
  from public.profiles p
  where p.id = v_actor_id;

  if v_actor_role is null or v_actor_role not in ('admin', 'owner') then
    raise exception 'لا تملك صلاحية إعداد الصيانة.';
  end if;

  if p_enabled is null then
    raise exception 'حالة الصيانة مطلوبة.';
  end if;

  if p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception 'وقت نهاية الصيانة يجب أن يكون بعد وقت البداية.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('nox_maintenance:' || coalesce(p_service_id::text, 'global'), 0)
  );

  update public.maintenance_windows
  set enabled = false,
      updated_by = v_actor_id,
      updated_at = now()
  where service_id is not distinct from p_service_id;

  insert into public.maintenance_windows (
    service_id, enabled, message, starts_at, ends_at, updated_by, updated_at
  )
  values (
    p_service_id, p_enabled, coalesce(p_message, 'الخدمة تحت الصيانة مؤقتاً.'),
    p_starts_at, p_ends_at, v_actor_id, now()
  )
  returning * into v_window;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, details
  )
  values (
    v_actor_id,
    'maintenance.configure',
    'maintenance_window',
    v_window.id::text,
    jsonb_build_object(
      'service_id', v_window.service_id,
      'enabled', v_window.enabled,
      'starts_at', v_window.starts_at,
      'ends_at', v_window.ends_at
    )
  );

  return jsonb_build_object(
    'id', v_window.id,
    'service_id', v_window.service_id,
    'enabled', v_window.enabled,
    'message', v_window.message,
    'starts_at', v_window.starts_at,
    'ends_at', v_window.ends_at
  );
end;
$function$;

revoke all on function public.bmg_admin_configure_maintenance(uuid, text, boolean, timestamptz, timestamptz) from public, anon;
grant execute on function public.bmg_admin_configure_maintenance(uuid, text, boolean, timestamptz, timestamptz) to authenticated;

commit;
