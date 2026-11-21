begin;

create or replace function public.bmg_admin_get_service_versions(p_service_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth'
as $function$
declare v_result jsonb;
begin
  if not private.bmg_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  if not exists(select 1 from public.api_services where id=p_service_id) then raise exception 'Service not found'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',v.id,'version',v.version,'snapshot',v.snapshot,'changeNote',v.change_note,
    'createdBy',v.created_by,'createdAt',v.created_at
  ) order by v.version desc),'[]'::jsonb)
  into v_result
  from public.api_service_versions v where v.service_id=p_service_id;
  return v_result;
end;
$function$;

create or replace function public.bmg_admin_rollback_api_service(p_service_id uuid,p_version integer)
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_snapshot jsonb;
  v_new_version integer;
  v_slug text;
begin
  if not private.bmg_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  select snapshot into v_snapshot
  from public.api_service_versions
  where service_id=p_service_id and version=p_version;
  if v_snapshot is null then raise exception 'Requested service version was not found'; end if;

  select current_version,slug into v_new_version,v_slug
  from public.api_services where id=p_service_id for update;
  if not found then raise exception 'Service not found'; end if;
  v_new_version:=coalesce(v_new_version,1)+1;

  update public.api_services
  set slug=v_snapshot->>'slug',
      name=v_snapshot->>'name',
      description=coalesce(v_snapshot->>'description',''),
      category=coalesce(v_snapshot->>'category','Tools'),
      endpoint_path=v_snapshot->>'endpoint_path',
      http_method=coalesce(v_snapshot->>'http_method','POST'),
      docs_markdown=coalesce(v_snapshot->>'docs_markdown',''),
      status=coalesce(v_snapshot->>'status','active'),
      source_type=coalesce(v_snapshot->>'source_type','official'),
      weight=greatest(1,least(100,coalesce((v_snapshot->>'weight')::integer,1))),
      healthcheck_config=coalesce(v_snapshot->'healthcheck_config','{}'::jsonb),
      current_version=v_new_version,
      updated_at=now()
  where id=p_service_id;

  insert into public.api_service_versions(service_id,version,snapshot,change_note,created_by)
  values(p_service_id,v_new_version,v_snapshot,'Rollback to v'||p_version,v_actor);

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(v_actor,'service.rollback','api_service',p_service_id::text,jsonb_build_object('from_version',p_version,'new_version',v_new_version,'slug',v_slug));

  return v_new_version;
end;
$function$;

revoke all on function public.bmg_admin_get_service_versions(uuid) from public,anon;
revoke all on function public.bmg_admin_rollback_api_service(uuid,integer) from public,anon;
grant execute on function public.bmg_admin_get_service_versions(uuid) to authenticated;
grant execute on function public.bmg_admin_rollback_api_service(uuid,integer) to authenticated;

commit;