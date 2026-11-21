begin;

create table if not exists public.api_admin_limits (
  id boolean primary key default true check (id=true),
  requests_per_minute integer not null check (requests_per_minute>0),
  max_api_keys integer not null check (max_api_keys>0),
  daily_weighted_limit bigint not null check (daily_weighted_limit>0),
  monthly_weighted_limit bigint not null check (monthly_weighted_limit>0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.api_admin_limits(id,requests_per_minute,max_api_keys,daily_weighted_limit,monthly_weighted_limit)
values(true,200,100,1000000,20000000)
on conflict(id) do nothing;

alter table public.api_admin_limits enable row level security;
create policy api_admin_limits_manage on public.api_admin_limits
for all to authenticated
using (private.bmg_is_admin())
with check (private.bmg_is_admin());
grant select,insert,update on public.api_admin_limits to authenticated;

create or replace function public.bmg_create_api_key(p_key text,p_label text,p_expires_at timestamptz default null)
returns table(id uuid,label text,key_prefix text,created_at timestamptz)
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','extensions','auth'
as $function$
declare
  uid uuid := auth.uid();
  clean_label text := nullif(trim(p_label),'');
  v_role text;
  v_plan text;
  v_status text;
  v_key_limit integer;
  v_key_count integer;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_key is null or length(p_key)<40 or p_key !~ '^nox_live_[A-Za-z0-9_-]+$' then
    raise exception 'Invalid key';
  end if;
  if clean_label is null then raise exception 'Key label is required'; end if;
  if p_expires_at is not null and p_expires_at<=now() then raise exception 'Expiration must be in the future'; end if;

  select role,plan,account_status into v_role,v_plan,v_status
  from public.profiles where profiles.id=uid;
  if v_status is distinct from 'active' then raise exception 'Account is suspended'; end if;

  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));

  if v_role in ('admin','owner') then
    select max_api_keys into v_key_limit from public.api_admin_limits where id=true;
  else
    select max_api_keys into v_key_limit from public.api_plan_limits where plan=coalesce(v_plan,'basic');
  end if;
  v_key_limit:=coalesce(v_key_limit,2);

  select count(*)::integer into v_key_count
  from private.api_keys
  where user_id=uid and revoked_at is null and (expires_at is null or expires_at>now());

  if v_key_count>=v_key_limit then
    raise exception 'API key limit reached for the current account level (limit: %)',v_key_limit;
  end if;

  return query
  insert into private.api_keys(user_id,label,key_prefix,key_hash,expires_at)
  values(uid,left(clean_label,64),left(p_key,18),extensions.digest(p_key,'sha256'),p_expires_at)
  returning private.api_keys.id,private.api_keys.label,private.api_keys.key_prefix,private.api_keys.created_at;
end;
$function$;

create or replace function public.bmg_admin_list_api_keys(p_user_id uuid default null,p_status text default 'all')
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth'
as $function$
declare
  v_result jsonb;
begin
  if not private.bmg_is_admin() then
    raise exception 'Administrator access required' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',k.id,'userId',k.user_id,'displayName',p.display_name,'email',p.email,
    'label',k.label,'keyPrefix',k.key_prefix,'scopes',k.scopes,
    'createdAt',k.created_at,'lastUsedAt',k.last_used_at,'expiresAt',k.expires_at,'revokedAt',k.revoked_at
  ) order by k.created_at desc),'[]'::jsonb)
  into v_result
  from private.api_keys k
  left join public.profiles p on p.id=k.user_id
  where (p_user_id is null or k.user_id=p_user_id)
    and (p_status='all'
      or (p_status='active' and k.revoked_at is null and (k.expires_at is null or k.expires_at>now()))
      or (p_status='revoked' and k.revoked_at is not null)
      or (p_status='expired' and k.revoked_at is null and k.expires_at<=now()));
  return v_result;
end;
$function$;

create or replace function public.bmg_admin_revoke_api_key(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_user_id uuid;
  v_label text;
begin
  if not private.bmg_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  update private.api_keys
  set revoked_at=now()
  where id=p_id and revoked_at is null
  returning user_id,label into v_user_id,v_label;
  if not found then return false; end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(v_actor,'api_key.admin_revoke','api_key',p_id::text,jsonb_build_object('user_id',v_user_id,'label',v_label));
  insert into public.user_notifications(user_id,title,body,type,metadata)
  values(v_user_id,'تم إلغاء مفتاح API','قامت إدارة المنصة بإلغاء مفتاح API: '||v_label,'warning',jsonb_build_object('key_id',p_id));
  return true;
end;
$function$;

create or replace function public.bmg_admin_update_api_key(
  p_id uuid,
  p_label text,
  p_expires_at timestamptz,
  p_scopes text[]
)
returns boolean
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_user_id uuid;
  v_old_label text;
begin
  if not private.bmg_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  if nullif(trim(p_label),'') is null then raise exception 'Key label is required'; end if;
  if p_expires_at is not null and p_expires_at<=now() then raise exception 'Expiration must be in the future'; end if;
  if p_scopes is null or not (p_scopes @> array['api:use']::text[]) then raise exception 'api:use scope is required'; end if;
  if exists(select 1 from unnest(p_scopes) scope where scope !~ '^(api:(use|read|write)|service:[a-z0-9-]+|category:[a-z0-9-]+)$') then
    raise exception 'Invalid API scope';
  end if;

  update private.api_keys
  set label=left(trim(p_label),64),expires_at=p_expires_at,scopes=p_scopes
  where id=p_id and revoked_at is null
  returning user_id,label into v_user_id,v_old_label;
  if not found then return false; end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(v_actor,'api_key.admin_update','api_key',p_id::text,jsonb_build_object('user_id',v_user_id,'label',v_old_label,'scopes',p_scopes,'expires_at',p_expires_at));
  insert into public.user_notifications(user_id,title,body,type,metadata)
  values(v_user_id,'تم تحديث إعدادات مفتاح API','تم تعديل اسم المفتاح أو صلاحياته أو تاريخ انتهائه بواسطة الإدارة.','info',jsonb_build_object('key_id',p_id));
  return true;
end;
$function$;

revoke all on function public.bmg_admin_list_api_keys(uuid,text) from public,anon;
revoke all on function public.bmg_admin_revoke_api_key(uuid) from public,anon;
revoke all on function public.bmg_admin_update_api_key(uuid,text,timestamptz,text[]) from public,anon;
grant execute on function public.bmg_admin_list_api_keys(uuid,text) to authenticated;
grant execute on function public.bmg_admin_revoke_api_key(uuid) to authenticated;
grant execute on function public.bmg_admin_update_api_key(uuid,text,timestamptz,text[]) to authenticated;

commit;