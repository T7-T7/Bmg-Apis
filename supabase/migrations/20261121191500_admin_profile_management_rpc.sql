begin;

create or replace function public.bmg_admin_update_profile(
  p_user_id uuid,
  p_role text,
  p_plan text,
  p_plan_expires_at timestamptz,
  p_account_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_target_role text;
  v_old_plan text;
  v_old_status text;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select role into v_actor_role
  from public.profiles
  where id=v_actor;

  if v_actor_role not in ('admin','owner') then
    raise exception 'Administrator access required' using errcode='42501';
  end if;

  if p_role not in ('user','admin') then
    raise exception 'Invalid role' using errcode='22023';
  end if;
  if p_plan not in ('basic','pro','premium') then
    raise exception 'Invalid plan' using errcode='22023';
  end if;
  if p_account_status not in ('active','suspended') then
    raise exception 'Invalid account status' using errcode='22023';
  end if;

  select role,plan,account_status
    into v_target_role,v_old_plan,v_old_status
  from public.profiles
  where id=p_user_id
  for update;

  if not found then
    raise exception 'User not found' using errcode='P0002';
  end if;
  if v_target_role='owner' then
    raise exception 'The platform owner account is protected' using errcode='42501';
  end if;
  if v_actor_role='admin' and p_role='admin' then
    raise exception 'Only the owner can grant administrator access' using errcode='42501';
  end if;
  if p_user_id=v_actor and (p_role<>v_target_role or p_account_status<>'active') then
    raise exception 'You cannot change your own role or suspend your own account' using errcode='42501';
  end if;

  update public.profiles
  set role=p_role,
      plan=p_plan,
      plan_source='manual',
      plan_expires_at=p_plan_expires_at,
      plan_grace_until=case when p_plan_expires_at is null then null else p_plan_expires_at + interval '7 days' end,
      account_status=p_account_status,
      updated_by=v_actor,
      updated_at=now()
  where id=p_user_id;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(v_actor,'profile.admin_update','profile',p_user_id::text,
    jsonb_build_object(
      'old_role',v_target_role,'new_role',p_role,
      'old_plan',v_old_plan,'new_plan',p_plan,
      'old_status',v_old_status,'new_status',p_account_status,
      'plan_expires_at',p_plan_expires_at
    ));

  insert into public.user_notifications(user_id,title,body,type,metadata)
  values(
    p_user_id,
    'تم تحديث إعدادات حسابك',
    'تم تحديث مستوى الحساب أو صلاحياته أو حالته بواسطة إدارة المنصة.',
    case when p_account_status='suspended' then 'critical' else 'info' end,
    jsonb_build_object('plan',p_plan,'account_status',p_account_status)
  );

  return true;
end;
$$;

revoke all on function public.bmg_admin_update_profile(uuid,text,text,timestamptz,text) from public, anon;
grant execute on function public.bmg_admin_update_profile(uuid,text,text,timestamptz,text) to authenticated;

commit;