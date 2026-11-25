create or replace function public.bmg_admin_broadcast_notification(
  p_user_id uuid,p_title text,p_body text,p_type text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $function$
declare
  v_actor_id uuid:=auth.uid();
  v_recipient_count integer:=0;
begin
  if v_actor_id is null then raise exception 'يلزم تسجيل الدخول.'; end if;
  if not private.bmg_is_admin() then raise exception 'لا تملك صلاحية إرسال الإشعارات.'; end if;
  if p_title is null or length(trim(p_title)) not between 1 and 200 then raise exception 'عنوان الإشعار مطلوب وبحد أقصى 200 حرف.'; end if;
  if coalesce(length(p_body),0)>5000 then raise exception 'نص الإشعار يتجاوز 5000 حرف.'; end if;
  if p_type is null or p_type not in ('info','warning','critical') then raise exception 'نوع الإشعار غير صالح.'; end if;

  insert into public.user_notifications(user_id,title,body,type)
  select p.id,trim(p_title),coalesce(p_body,''),p_type
  from public.profiles p
  where p_user_id is null or p.id=p_user_id;
  get diagnostics v_recipient_count = row_count;

  if v_recipient_count=0 then raise exception 'لم يتم العثور على مستلمين للإشعار.'; end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(v_actor_id,'notification.broadcast','user_notification',coalesce(p_user_id::text,'all'),
    jsonb_build_object('recipient_count',v_recipient_count,'type',p_type));

  return jsonb_build_object('recipient_count',v_recipient_count,'type',p_type);
end;
$function$;

revoke all on function public.bmg_admin_broadcast_notification(uuid,text,text,text) from public,anon;
grant execute on function public.bmg_admin_broadcast_notification(uuid,text,text,text) to authenticated;
