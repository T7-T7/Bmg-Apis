create or replace function public.bmg_get_public_status()
returns jsonb language sql stable security definer set search_path = ''
as $function$
  select jsonb_build_object(
    'incidents',
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',i.id,'title',i.title,'severity',i.severity,'status',i.status,
        'affected_services',i.affected_services,'started_at',i.started_at,
        'resolved_at',i.resolved_at,'updated_at',i.updated_at,
        'updates',coalesce((
          select jsonb_agg(jsonb_build_object('id',u.id,'status',u.status,'message',u.message,'created_at',u.created_at) order by u.created_at desc)
          from (select id,status,message,created_at from public.incident_updates where incident_id=i.id order by created_at desc limit 20) u
        ),'[]'::jsonb)
      ) order by i.started_at desc)
      from public.incidents i
      where i.status <> 'resolved' or i.resolved_at >= now()-interval '30 days'
    ),'[]'::jsonb),
    'maintenance',
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',m.id,'service_name',coalesce(s.name,'كل الخدمات'),
        'message',m.message,'starts_at',m.starts_at,'ends_at',m.ends_at,'updated_at',m.updated_at
      ) order by m.updated_at desc)
      from public.maintenance_windows m
      left join public.api_services s on s.id=m.service_id
      where m.enabled=true and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now())
    ),'[]'::jsonb)
  );
$function$;
revoke all on function public.bmg_get_public_status() from public;
grant execute on function public.bmg_get_public_status() to anon,authenticated;
