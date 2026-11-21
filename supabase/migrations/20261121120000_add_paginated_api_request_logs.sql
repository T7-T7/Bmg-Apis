begin;
create or replace function public.bmg_get_api_request_logs(p_page integer default 1,p_page_size integer default 25,p_service text default null,p_status text default 'all')
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $function$
declare v_user_id uuid:=auth.uid(); v_page integer:=greatest(coalesce(p_page,1),1); v_page_size integer:=least(greatest(coalesce(p_page_size,25),1),100); v_total bigint; v_items jsonb;
begin
 if v_user_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if p_status not in ('all','success','error') then raise exception 'invalid_status_filter' using errcode='22023'; end if;
 with filtered as (select u.id,u.service_slug as service,u.request_method as method,u.status_code as status,u.latency_ms as latency,u.created_at as "createdAt",k.label as key_label,k.key_prefix from private.api_usage u left join private.api_keys k on k.id=u.api_key_id where u.user_id=v_user_id and u.created_at>=now()-interval '30 days' and (p_service is null or p_service='all' or u.service_slug=p_service) and (p_status='all' or (p_status='success' and u.status_code>=200 and u.status_code<400) or (p_status='error' and (u.status_code is null or u.status_code>=400)))) select count(*) into v_total from filtered;
 with filtered as (select u.id,u.service_slug as service,u.request_method as method,u.status_code as status,u.latency_ms as latency,u.created_at as "createdAt",k.label as key_label,k.key_prefix from private.api_usage u left join private.api_keys k on k.id=u.api_key_id where u.user_id=v_user_id and u.created_at>=now()-interval '30 days' and (p_service is null or p_service='all' or u.service_slug=p_service) and (p_status='all' or (p_status='success' and u.status_code>=200 and u.status_code<400) or (p_status='error' and (u.status_code is null or u.status_code>=400))) order by u.created_at desc,u.id desc offset (v_page-1)*v_page_size limit v_page_size) select coalesce(jsonb_agg(to_jsonb(filtered)),'[]'::jsonb) into v_items from filtered;
 return jsonb_build_object('items',v_items,'total',v_total,'page',v_page,'pageSize',v_page_size,'totalPages',greatest(1,ceil(v_total::numeric/v_page_size)::integer));
end;$function$;
revoke all on function public.bmg_get_api_request_logs(integer,integer,text,text) from public;
grant execute on function public.bmg_get_api_request_logs(integer,integer,text,text) to authenticated;
commit;