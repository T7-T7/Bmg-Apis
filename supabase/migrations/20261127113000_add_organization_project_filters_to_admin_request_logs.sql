CREATE OR REPLACE FUNCTION public.bmg_admin_get_request_logs(
 p_page integer DEFAULT 1,
 p_page_size integer DEFAULT 25,
 p_service text DEFAULT NULL,
 p_user_id uuid DEFAULT NULL,
 p_result text DEFAULT 'all',
 p_status_code integer DEFAULT NULL,
 p_hours integer DEFAULT 24,
 p_organization_id uuid DEFAULT NULL,
 p_project_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare
 v_page integer:=greatest(coalesce(p_page,1),1);
 v_page_size integer:=least(greatest(coalesce(p_page_size,25),1),100);
 v_hours integer:=coalesce(p_hours,24);
 v_total bigint;
 v_items jsonb;
begin
 if not private.bmg_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_result not in ('all','success','error') then raise exception 'Invalid result filter' using errcode='22023'; end if;
 if v_hours not in (1,6,24) then raise exception 'Invalid time window' using errcode='22023'; end if;
 if p_status_code is not null and (p_status_code<100 or p_status_code>599) then raise exception 'Invalid HTTP status code' using errcode='22023'; end if;
 if p_project_id is not null and p_organization_id is not null and not exists(select 1 from public.projects p where p.id=p_project_id and p.organization_id=p_organization_id) then raise exception 'Project does not belong to organization' using errcode='22023'; end if;
 with filtered as (
  select u.id,u.user_id,p.display_name,p.email,k.label as key_label,u.service_slug,u.request_method,u.status_code,u.latency_ms,u.service_weight,u.created_at,u.organization_id,u.project_id
  from private.api_usage u
  left join public.profiles p on p.id=u.user_id
  left join private.api_keys k on k.id=u.api_key_id
  where u.created_at>=now()-make_interval(hours=>v_hours)
   and (p_service is null or p_service='all' or u.service_slug=p_service)
   and (p_user_id is null or u.user_id=p_user_id)
   and (p_status_code is null or u.status_code=p_status_code)
   and (p_organization_id is null or u.organization_id=p_organization_id)
   and (p_project_id is null or u.project_id=p_project_id)
   and (p_result='all' or (p_result='success' and u.status_code>=200 and u.status_code<400) or (p_result='error' and (u.status_code is null or u.status_code>=400)))
 )
 select count(*) into v_total from filtered;
 with filtered as (
  select u.id,u.user_id,p.display_name,p.email,k.label as key_label,u.service_slug,u.request_method,u.status_code,u.latency_ms,u.service_weight,u.created_at,u.organization_id,u.project_id
  from private.api_usage u
  left join public.profiles p on p.id=u.user_id
  left join private.api_keys k on k.id=u.api_key_id
  where u.created_at>=now()-make_interval(hours=>v_hours)
   and (p_service is null or p_service='all' or u.service_slug=p_service)
   and (p_user_id is null or u.user_id=p_user_id)
   and (p_status_code is null or u.status_code=p_status_code)
   and (p_organization_id is null or u.organization_id=p_organization_id)
   and (p_project_id is null or u.project_id=p_project_id)
   and (p_result='all' or (p_result='success' and u.status_code>=200 and u.status_code<400) or (p_result='error' and (u.status_code is null or u.status_code>=400)))
  order by u.created_at desc,u.id desc offset (v_page-1)*v_page_size limit v_page_size
 )
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',id,'userId',user_id,'displayName',display_name,'email',email,'keyLabel',key_label,
  'service',service_slug,'method',request_method,'status',status_code,'latency',latency_ms,
  'weight',service_weight,'createdAt',created_at,'organizationId',organization_id,'projectId',project_id
 ) order by created_at desc,id desc),'[]'::jsonb) into v_items from filtered;
 return jsonb_build_object('items',v_items,'total',v_total,'page',v_page,'pageSize',v_page_size,
  'totalPages',greatest(1,ceil(v_total::numeric/v_page_size)::integer),'hours',v_hours);
end;
$function$;
REVOKE ALL ON FUNCTION public.bmg_admin_get_request_logs(integer,integer,text,uuid,text,integer,integer,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bmg_admin_get_request_logs(integer,integer,text,uuid,text,integer,integer,uuid,uuid) TO authenticated;