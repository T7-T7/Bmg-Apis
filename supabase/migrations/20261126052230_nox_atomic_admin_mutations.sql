begin;

create or replace function public.bmg_admin_set_service_archived(p_service_id uuid, p_archived boolean)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_service public.api_services%rowtype;
begin
  if v_actor_id is null then raise exception 'يلزم تسجيل الدخول.'; end if;
  select role into v_actor_role from public.profiles where id = v_actor_id;
  if v_actor_role is distinct from 'admin' then raise exception 'لا تملك صلاحية تغيير أرشفة الخدمات.'; end if;
  if p_service_id is null or p_archived is null then raise exception 'بيانات الأرشفة غير مكتملة.'; end if;
  update public.api_services
  set archived_at = case when p_archived then now() else null end, updated_at = now()
  where id = p_service_id returning * into v_service;
  if not found then raise exception 'الخدمة غير موجودة.'; end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values(v_actor_id, case when p_archived then 'service.archive' else 'service.restore' end,
    'api_service', v_service.id::text, jsonb_build_object('slug', v_service.slug, 'archived_at', v_service.archived_at));
  return jsonb_build_object('serviceId', v_service.id, 'slug', v_service.slug, 'archived', v_service.archived_at is not null);
end;
$function$;

create or replace function public.bmg_admin_create_service_dependency(p_service_id uuid, p_depends_on_service_id uuid, p_dependency_type text, p_description text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_dependency public.api_service_dependencies%rowtype;
begin
  if v_actor_id is null then raise exception 'يلزم تسجيل الدخول.'; end if;
  select role into v_actor_role from public.profiles where id = v_actor_id;
  if v_actor_role is distinct from 'admin' then raise exception 'لا تملك صلاحية إدارة اعتماديات الخدمات.'; end if;
  if p_service_id is null or p_depends_on_service_id is null or p_service_id = p_depends_on_service_id then raise exception 'معرّفات الخدمات غير صالحة.'; end if;
  if p_dependency_type not in ('required','optional') or p_dependency_type is null then raise exception 'نوع الاعتمادية غير صالح.'; end if;
  if length(coalesce(p_description,'')) > 1000 then raise exception 'وصف الاعتمادية يتجاوز 1000 حرف.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('nox_service_dependency_graph', 0));
  insert into public.api_service_dependencies(service_id, depends_on_service_id, dependency_type, description, created_by)
  values(p_service_id, p_depends_on_service_id, p_dependency_type, coalesce(p_description,''), v_actor_id)
  returning * into v_dependency;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values(v_actor_id, 'service_dependency.create', 'api_service_dependency', v_dependency.id::text,
    jsonb_build_object('service_id', v_dependency.service_id, 'depends_on_service_id', v_dependency.depends_on_service_id, 'dependency_type', v_dependency.dependency_type));
  return jsonb_build_object('id', v_dependency.id, 'service_id', v_dependency.service_id, 'depends_on_service_id', v_dependency.depends_on_service_id, 'dependency_type', v_dependency.dependency_type);
end;
$function$;

create or replace function public.bmg_admin_delete_service_dependency(p_id uuid)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_dependency public.api_service_dependencies%rowtype;
begin
  if v_actor_id is null then raise exception 'يلزم تسجيل الدخول.'; end if;
  select role into v_actor_role from public.profiles where id = v_actor_id;
  if v_actor_role is distinct from 'admin' then raise exception 'لا تملك صلاحية إدارة اعتماديات الخدمات.'; end if;
  if p_id is null then raise exception 'معرّف الاعتمادية غير صالح.'; end if;
  delete from public.api_service_dependencies where id = p_id returning * into v_dependency;
  if not found then raise exception 'الاعتمادية غير موجودة.'; end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values(v_actor_id, 'service_dependency.delete', 'api_service_dependency', v_dependency.id::text,
    jsonb_build_object('service_id', v_dependency.service_id, 'depends_on_service_id', v_dependency.depends_on_service_id));
  return jsonb_build_object('deleted', true, 'id', v_dependency.id);
end;
$function$;

create or replace function public.bmg_admin_toggle_maintenance(p_id uuid, p_enabled boolean)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_window public.maintenance_windows%rowtype;
begin
  if v_actor_id is null or not private.bmg_is_admin() then raise exception 'لا تملك صلاحية إدارة الصيانة.'; end if;
  if p_id is null or p_enabled is null then raise exception 'بيانات الصيانة غير مكتملة.'; end if;
  update public.maintenance_windows set enabled = p_enabled, updated_at = now(), updated_by = v_actor_id
  where id = p_id returning * into v_window;
  if not found then raise exception 'نافذة الصيانة غير موجودة.'; end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values(v_actor_id, 'maintenance.toggle', 'maintenance_window', v_window.id::text,
    jsonb_build_object('service_id', v_window.service_id, 'enabled', v_window.enabled));
  return jsonb_build_object('id', v_window.id, 'service_id', v_window.service_id, 'enabled', v_window.enabled);
end;
$function$;

revoke all on function public.bmg_admin_set_service_archived(uuid, boolean) from public, anon;
revoke all on function public.bmg_admin_create_service_dependency(uuid, uuid, text, text) from public, anon;
revoke all on function public.bmg_admin_delete_service_dependency(uuid) from public, anon;
revoke all on function public.bmg_admin_toggle_maintenance(uuid, boolean) from public, anon;
grant execute on function public.bmg_admin_set_service_archived(uuid, boolean) to authenticated;
grant execute on function public.bmg_admin_create_service_dependency(uuid, uuid, text, text) to authenticated;
grant execute on function public.bmg_admin_delete_service_dependency(uuid) to authenticated;
grant execute on function public.bmg_admin_toggle_maintenance(uuid, boolean) to authenticated;

commit;
