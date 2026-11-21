begin;

create or replace function private.bmg_expire_user_plans()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_profile record;
begin
  for v_profile in
    select id,plan,plan_source,plan_expires_at,plan_grace_until
    from public.profiles
    where plan <> 'basic'
      and plan_source in ('manual','subscription')
      and plan_expires_at is not null
      and plan_grace_until is not null
      and plan_grace_until <= now()
    for update skip locked
  loop
    update public.profiles
    set plan='basic',
        plan_source='default',
        plan_expires_at=null,
        plan_grace_until=null,
        updated_at=now(),
        updated_by=null
    where id=v_profile.id;

    insert into public.user_notifications(user_id,title,body,type,metadata)
    values(
      v_profile.id,
      'عاد حسابك إلى Basic',
      'انتهت مدة المستوى السابق ومهلة السماح البالغة 7 أيام. تم تطبيق حدود Basic.',
      'warning',
      jsonb_build_object('previous_plan',v_profile.plan,'expired_at',v_profile.plan_expires_at)
    );

    insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
    values(
      null,
      'plan.expired',
      'profile',
      v_profile.id::text,
      jsonb_build_object('previous_plan',v_profile.plan,'previous_source',v_profile.plan_source)
    );

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function private.bmg_expire_user_plans() from public,anon,authenticated;
select cron.schedule(
  'bmg-plan-expiration',
  '0 * * * *',
  'select private.bmg_expire_user_plans()'
);

commit;