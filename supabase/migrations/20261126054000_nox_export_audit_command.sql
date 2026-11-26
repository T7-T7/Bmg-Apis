begin;

create or replace function public.bmg_admin_record_export(
  p_dataset text,
  p_format text,
  p_rows integer
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null or not private.bmg_is_admin() then
    raise exception 'لا تملك صلاحية تسجيل عملية التصدير.';
  end if;
  if p_dataset not in ('audit','requests','users','services','keys','incidents','maintenance')
     or p_format not in ('json','csv')
     or p_rows is null or p_rows < 0 or p_rows > 100000 then
    raise exception 'بيانات التصدير غير صالحة.';
  end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values(v_actor_id, 'export.create', 'export', p_dataset,
    jsonb_build_object('format', p_format, 'rows', p_rows));
  return jsonb_build_object('recorded', true, 'dataset', p_dataset, 'format', p_format, 'rows', p_rows);
end;
$function$;

revoke all on function public.bmg_admin_record_export(text, text, integer) from public, anon;
grant execute on function public.bmg_admin_record_export(text, text, integer) to authenticated;

commit;
