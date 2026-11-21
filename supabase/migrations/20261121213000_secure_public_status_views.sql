begin;
drop policy if exists incidents_public_read on public.incidents;
drop policy if exists maintenance_public_read_enabled on public.maintenance_windows;

create or replace view public.public_status_incidents
with (security_barrier=true)
as
select id,title,severity,status,affected_services,started_at,resolved_at,updated_at
from public.incidents
where status <> 'resolved'
   or resolved_at >= now() - interval '30 days';

create or replace view public.public_status_maintenance
with (security_barrier=true)
as
select m.id,
       coalesce(s.name,'كل الخدمات') as service_name,
       m.message,
       m.starts_at,
       m.ends_at,
       m.updated_at
from public.maintenance_windows m
left join public.api_services s on s.id=m.service_id
where m.enabled=true
  and (m.starts_at is null or m.starts_at<=now())
  and (m.ends_at is null or m.ends_at>now());

grant select on public.public_status_incidents to anon,authenticated;
grant select on public.public_status_maintenance to anon,authenticated;
commit;