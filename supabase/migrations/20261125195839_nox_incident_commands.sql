begin;

create or replace function public.bmg_admin_create_incident(
  p_title text,p_description text,p_severity text,p_status text,p_affected_services text[]
) returns jsonb language plpgsql security invoker
set search_path = pg_catalog, public as $function$
declare v_actor_id uuid:=auth.uid(); v_actor_role text; v_incident public.incidents%rowtype;
begin
  if v_actor_id is null then raise exception 'يلزم تسجيل الدخول.'; end if;
  select p.role into v_actor_role from public.profiles p where p.id=v_actor_id;
  if v_actor_role is null or v_actor_role not in ('admin','owner') then raise exception 'لا تملك صلاحية إدارة الحوادث.'; end if;
  if p_title is null or length(trim(p_title)) not between 1 and 200 then raise exception 'عنوان الحادث مطلوب وبحد أقصى 200 حرف.'; end if;
  if coalesce(length(p_description),0)>10000 then raise exception 'وصف الحادث يتجاوز 10000 حرف.'; end if;
  if p_severity is null or p_severity not in ('minor','major','critical') then raise exception 'درجة خطورة الحادث غير صالحة.'; end if;
  if p_status is null or p_status not in ('investigating','identified','monitoring','resolved') then raise exception 'حالة الحادث غير صالحة.'; end if;
  if coalesce(cardinality(p_affected_services),0)>50 then raise exception 'عدد الخدمات المتأثرة يتجاوز الحد المسموح.'; end if;
  if exists(select 1 from unnest(coalesce(p_affected_services,'{}'::text[])) as services(service_slug)
    where length(trim(service_slug))=0 or length(service_slug)>120) then raise exception 'قائمة الخدمات المتأثرة غير صالحة.'; end if;
  insert into public.incidents(title,description,severity,status,affected_services,created_by,resolved_at,updated_at)
  values(trim(p_title),coalesce(p_description,''),p_severity,p_status,coalesce(p_affected_services,'{}'::text[]),v_actor_id,
    case when p_status='resolved' then now() else null end,now()) returning * into v_incident;
  insert into public.incident_updates(incident_id,status,message,created_by)
  values(v_incident.id,v_incident.status,coalesce(nullif(trim(v_incident.description),''),'تم تسجيل الحادث.'),v_actor_id);
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(v_actor_id,'incident.create','incident',v_incident.id::text,
    jsonb_build_object('severity',v_incident.severity,'status',v_incident.status,'affected_services',v_incident.affected_services));
  return jsonb_build_object('id',v_incident.id,'status',v_incident.status,'severity',v_incident.severity);
end;
$function$;

create or replace function public.bmg_admin_change_incident_status(p_incident_id uuid,p_status text,p_message text)
returns jsonb language plpgsql security invoker
set search_path = pg_catalog, public as $function$
declare v_actor_id uuid:=auth.uid(); v_actor_role text; v_incident public.incidents%rowtype;
begin
  if v_actor_id is null then raise exception 'يلزم تسجيل الدخول.'; end if;
  select p.role into v_actor_role from public.profiles p where p.id=v_actor_id;
  if v_actor_role is null or v_actor_role not in ('admin','owner') then raise exception 'لا تملك صلاحية إدارة الحوادث.'; end if;
  if p_status is null or p_status not in ('investigating','identified','monitoring','resolved') then raise exception 'حالة الحادث غير صالحة.'; end if;
  if p_message is null or length(trim(p_message)) not between 1 and 5000 then raise exception 'نص تحديث الحادث مطلوب وبحد أقصى 5000 حرف.'; end if;
  update public.incidents set status=p_status,resolved_at=case when p_status='resolved' then now() else null end,updated_at=now()
  where id=p_incident_id returning * into v_incident;
  if not found then raise exception 'الحادث غير موجود.'; end if;
  insert into public.incident_updates(incident_id,status,message,created_by)
  values(v_incident.id,v_incident.status,trim(p_message),v_actor_id);
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(v_actor_id,'incident.status_change','incident',v_incident.id::text,jsonb_build_object('status',v_incident.status));
  return jsonb_build_object('id',v_incident.id,'status',v_incident.status,'resolved_at',v_incident.resolved_at);
end;
$function$;

create or replace function public.bmg_admin_add_incident_update(p_incident_id uuid,p_message text)
returns jsonb language plpgsql security invoker
set search_path = pg_catalog, public as $function$
declare v_actor_id uuid:=auth.uid(); v_actor_role text; v_update public.incident_updates%rowtype;
begin
  if v_actor_id is null then raise exception 'يلزم تسجيل الدخول.'; end if;
  select p.role into v_actor_role from public.profiles p where p.id=v_actor_id;
  if v_actor_role is null or v_actor_role not in ('admin','owner') then raise exception 'لا تملك صلاحية إدارة الحوادث.'; end if;
  if p_message is null or length(trim(p_message)) not between 1 and 5000 then raise exception 'نص التحديث مطلوب وبحد أقصى 5000 حرف.'; end if;
  if not exists(select 1 from public.incidents where id=p_incident_id) then raise exception 'الحادث غير موجود.'; end if;
  insert into public.incident_updates(incident_id,message,created_by)
  values(p_incident_id,trim(p_message),v_actor_id) returning * into v_update;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(v_actor_id,'incident.update','incident',p_incident_id::text,jsonb_build_object('message',trim(p_message)));
  return jsonb_build_object('id',v_update.id,'incident_id',v_update.incident_id,'created_at',v_update.created_at);
end;
$function$;

revoke all on function public.bmg_admin_create_incident(text,text,text,text,text[]) from public,anon;
revoke all on function public.bmg_admin_change_incident_status(uuid,text,text) from public,anon;
revoke all on function public.bmg_admin_add_incident_update(uuid,text) from public,anon;
grant execute on function public.bmg_admin_create_incident(text,text,text,text,text[]) to authenticated;
grant execute on function public.bmg_admin_change_incident_status(uuid,text,text) to authenticated;
grant execute on function public.bmg_admin_add_incident_update(uuid,text) to authenticated;
commit;
