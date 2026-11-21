create or replace function public.bmg_admin_get_audit_logs(
  p_page integer default 1,
  p_page_size integer default 25,
  p_actor_id uuid default null,
  p_action text default null,
  p_entity_type text default null,
  p_query text default null,
  p_hours integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_page integer := greatest(coalesce(p_page,1),1);
  v_page_size integer := least(greatest(coalesce(p_page_size,25),1),100);
  v_hours integer := coalesce(p_hours,0);
  v_query text := nullif(trim(p_query),'');
  v_total bigint;
  v_items jsonb;
begin
  if not private.bmg_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  if v_hours not in (0,24,168,720) then raise exception 'Invalid time window' using errcode='22023'; end if;

  with filtered as (
    select a.id,a.actor_id,p.display_name,p.email,a.action,a.entity_type,a.entity_id,a.details,a.created_at
    from public.audit_logs a left join public.profiles p on p.id=a.actor_id
    where (p_actor_id is null or a.actor_id=p_actor_id)
      and (p_action is null or p_action='all' or a.action=p_action)
      and (p_entity_type is null or p_entity_type='all' or a.entity_type=p_entity_type)
      and (v_hours=0 or a.created_at>=now()-make_interval(hours=>v_hours))
      and (v_query is null or concat_ws(' ',a.action,a.entity_type,a.entity_id,p.display_name,p.email,a.details::text) ilike '%'||v_query||'%')
  )
  select count(*) into v_total from filtered;

  with filtered as (
    select a.id,a.actor_id,p.display_name,p.email,a.action,a.entity_type,a.entity_id,a.details,a.created_at
    from public.audit_logs a left join public.profiles p on p.id=a.actor_id
    where (p_actor_id is null or a.actor_id=p_actor_id)
      and (p_action is null or p_action='all' or a.action=p_action)
      and (p_entity_type is null or p_entity_type='all' or a.entity_type=p_entity_type)
      and (v_hours=0 or a.created_at>=now()-make_interval(hours=>v_hours))
      and (v_query is null or concat_ws(' ',a.action,a.entity_type,a.entity_id,p.display_name,p.email,a.details::text) ilike '%'||v_query||'%')
    order by a.created_at desc,a.id desc offset (v_page-1)*v_page_size limit v_page_size
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'actorId',actor_id,'actorName',display_name,'actorEmail',email,
    'action',action,'entityType',entity_type,'entityId',entity_id,'details',details,'createdAt',created_at
  ) order by created_at desc,id desc),'[]'::jsonb) into v_items from filtered;

  return jsonb_build_object('items',v_items,'total',v_total,'page',v_page,
    'pageSize',v_page_size,'totalPages',greatest(1,ceil(v_total::numeric/v_page_size)::integer),'hours',v_hours);
end;
$$;

revoke all on function public.bmg_admin_get_audit_logs(integer,integer,uuid,text,text,text,integer) from public,anon;
grant execute on function public.bmg_admin_get_audit_logs(integer,integer,uuid,text,text,text,integer) to authenticated;
