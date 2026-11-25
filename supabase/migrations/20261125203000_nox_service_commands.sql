begin;

create or replace function public.bmg_admin_create_api_service(
  p_slug text,p_name text,p_description text,p_category text,p_endpoint_path text,
  p_http_method text,p_docs_markdown text,p_status text,p_source_type text,p_weight integer
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $function$
declare
  v_actor_id uuid:=auth.uid();
  v_role text;
  v_service public.api_services%rowtype;
  v_snapshot jsonb;
begin
  if v_actor_id is null then raise exception 'يلزم تسجيل الدخول.'; end if;
  select role into v_role from public.profiles where id=v_actor_id;
  if v_role is null or v_role not in ('admin','owner') or not private.bmg_is_admin() then
    raise exception 'لا تملك صلاحية إنشاء الخدمات.';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or length(p_slug)>120 then raise exception 'معرّف الخدمة غير صالح.'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 120 then raise exception 'اسم الخدمة مطلوب وبحد أقصى 120 حرفاً.'; end if;
  if coalesce(length(p_description),0)>10000 or p_category is null or length(trim(p_category)) not between 1 and 80
    or p_endpoint_path is null or left(p_endpoint_path,1)<>'/' or length(p_endpoint_path)>500
    or coalesce(length(p_docs_markdown),0)>50000 then raise exception 'بيانات الخدمة غير صالحة أو تتجاوز الحدود المسموحة.'; end if;
  if p_http_method is null or p_http_method not in ('GET','POST','PUT','PATCH','DELETE') then raise exception 'HTTP method غير صالح.'; end if;
  if p_status is null or p_status not in ('active','maintenance','disabled') then raise exception 'حالة الخدمة غير صالحة.'; end if;
  if p_source_type is null or p_source_type not in ('official','community') then raise exception 'مصدر الخدمة غير صالح.'; end if;
  if p_weight is null or p_weight not between 1 and 100 then raise exception 'وزن الخدمة يجب أن يكون بين 1 و100.'; end if;

  insert into public.api_services(slug,name,description,category,endpoint_path,http_method,docs_markdown,status,source_type,weight,owner_id,current_version,updated_at)
  values(p_slug,trim(p_name),coalesce(p_description,''),trim(p_category),p_endpoint_path,p_http_method,
    coalesce(p_docs_markdown,''),p_status,p_source_type,p_weight,v_actor_id,1,now())
  returning * into v_service;

  v_snapshot:=jsonb_build_object(
    'slug',v_service.slug,'name',v_service.name,'description',v_service.description,'category',v_service.category,
    'endpoint_path',v_service.endpoint_path,'http_method',v_service.http_method,'docs_markdown',v_service.docs_markdown,
    'status',v_service.status,'source_type',v_service.source_type,'weight',v_service.weight,
    'healthcheck_config',v_service.healthcheck_config
  );
  insert into public.api_service_versions(service_id,version,snapshot,change_note,created_by)
  values(v_service.id,1,v_snapshot,'الإصدار الأول',v_actor_id);
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(v_actor_id,'service.create','api_service',v_service.id::text,jsonb_build_object('slug',v_service.slug,'version',1));
  return jsonb_build_object('id',v_service.id,'slug',v_service.slug,'current_version',v_service.current_version);
end;
$function$;

create or replace function public.bmg_admin_update_api_service(
  p_service_id uuid,p_slug text,p_name text,p_description text,p_category text,p_endpoint_path text,
  p_http_method text,p_docs_markdown text,p_status text,p_source_type text,p_weight integer
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $function$
declare
  v_actor_id uuid:=auth.uid();
  v_role text;
  v_service public.api_services%rowtype;
  v_snapshot jsonb;
  v_next_version integer;
begin
  if v_actor_id is null then raise exception 'يلزم تسجيل الدخول.'; end if;
  select role into v_role from public.profiles where id=v_actor_id;
  if v_role is null or v_role not in ('admin','owner') or not private.bmg_is_admin() then
    raise exception 'لا تملك صلاحية تعديل الخدمات.';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or length(p_slug)>120 then raise exception 'معرّف الخدمة غير صالح.'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 120 then raise exception 'اسم الخدمة مطلوب وبحد أقصى 120 حرفاً.'; end if;
  if coalesce(length(p_description),0)>10000 or p_category is null or length(trim(p_category)) not between 1 and 80
    or p_endpoint_path is null or left(p_endpoint_path,1)<>'/' or length(p_endpoint_path)>500
    or coalesce(length(p_docs_markdown),0)>50000 then raise exception 'بيانات الخدمة غير صالحة أو تتجاوز الحدود المسموحة.'; end if;
  if p_http_method is null or p_http_method not in ('GET','POST','PUT','PATCH','DELETE') then raise exception 'HTTP method غير صالح.'; end if;
  if p_status is null or p_status not in ('active','maintenance','disabled') then raise exception 'حالة الخدمة غير صالحة.'; end if;
  if p_source_type is null or p_source_type not in ('official','community') then raise exception 'مصدر الخدمة غير صالح.'; end if;
  if p_weight is null or p_weight not between 1 and 100 then raise exception 'وزن الخدمة يجب أن يكون بين 1 و100.'; end if;

  select * into v_service from public.api_services where id=p_service_id for update;
  if not found then raise exception 'الخدمة غير موجودة.'; end if;
  v_next_version:=coalesce(v_service.current_version,1)+1;

  update public.api_services set
    slug=p_slug,name=trim(p_name),description=coalesce(p_description,''),category=trim(p_category),
    endpoint_path=p_endpoint_path,http_method=p_http_method,docs_markdown=coalesce(p_docs_markdown,''),
    status=p_status,source_type=p_source_type,weight=p_weight,current_version=v_next_version,updated_at=now()
  where id=p_service_id returning * into v_service;

  v_snapshot:=jsonb_build_object(
    'slug',v_service.slug,'name',v_service.name,'description',v_service.description,'category',v_service.category,
    'endpoint_path',v_service.endpoint_path,'http_method',v_service.http_method,'docs_markdown',v_service.docs_markdown,
    'status',v_service.status,'source_type',v_service.source_type,'weight',v_service.weight,
    'healthcheck_config',v_service.healthcheck_config
  );
  insert into public.api_service_versions(service_id,version,snapshot,change_note,created_by)
  values(v_service.id,v_next_version,v_snapshot,'تعديل من لوحة الإدارة',v_actor_id);
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(v_actor_id,'service.version_publish','api_service',v_service.id::text,
    jsonb_build_object('slug',v_service.slug,'version',v_next_version));
  return jsonb_build_object('id',v_service.id,'slug',v_service.slug,'current_version',v_service.current_version);
end;
$function$;

revoke all on function public.bmg_admin_create_api_service(text,text,text,text,text,text,text,text,text,integer) from public,anon;
revoke all on function public.bmg_admin_update_api_service(uuid,text,text,text,text,text,text,text,text,text,integer) from public,anon;
grant execute on function public.bmg_admin_create_api_service(text,text,text,text,text,text,text,text,text,integer) to authenticated;
grant execute on function public.bmg_admin_update_api_service(uuid,text,text,text,text,text,text,text,text,text,integer) to authenticated;

commit;
