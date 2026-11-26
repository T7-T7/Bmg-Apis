begin;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 100),
  kind text not null check (kind in ('individual','organization','company')),
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','developer','viewer')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (organization_id,user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 100),
  slug text not null,
  description text not null default '',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,slug)
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','developer','viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id,user_id)
);

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  email text not null check (email = lower(trim(email))),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','developer','viewer')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  declined_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (project_id is null or organization_id is not null)
);

create unique index if not exists organization_invitations_pending_unique
  on public.organization_invitations (organization_id,recipient_user_id,coalesce(project_id,'00000000-0000-0000-0000-000000000000'::uuid))
  where accepted_at is null and declined_at is null and revoked_at is null;

create index if not exists organization_members_user_idx on public.organization_members(user_id,organization_id);
create index if not exists projects_org_idx on public.projects(organization_id,created_at);
create index if not exists project_members_user_idx on public.project_members(user_id,project_id);
create index if not exists organization_invitations_recipient_idx on public.organization_invitations(recipient_user_id,created_at desc);

create table if not exists public.project_service_limits (
  project_id uuid not null references public.projects(id) on delete cascade,
  service_slug text not null references public.api_services(slug) on delete cascade,
  requests_per_minute integer not null check (requests_per_minute > 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key(project_id,service_slug)
);

alter table private.api_keys
  add column if not exists organization_id uuid references public.organizations(id) on delete restrict,
  add column if not exists project_id uuid references public.projects(id) on delete restrict;

alter table private.api_usage
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create or replace function private.bmg_create_personal_workspace_for_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_org_id uuid;
  v_project_id uuid;
  v_name text;
begin
  v_name := coalesce(nullif(trim(new.display_name),''), split_part(coalesce(new.email,'developer'),'@',1));
  insert into public.organizations(name,kind,owner_id)
  values (left(v_name || ' — المساحة الشخصية',100),'individual',new.id)
  on conflict do nothing
  returning id into v_org_id;

  if v_org_id is null then
    select o.id into v_org_id from public.organizations o
    where o.owner_id=new.id and o.kind='individual'
    order by o.created_at limit 1;
  end if;

  if v_org_id is not null then
    insert into public.organization_members(organization_id,user_id,role)
    values(v_org_id,new.id,'owner') on conflict do nothing;
    insert into public.projects(organization_id,name,slug,description,created_by)
    values(v_org_id,'المشروع الافتراضي','default','المشروع الشخصي الافتراضي.',new.id)
    on conflict(organization_id,slug) do nothing;
    select p.id into v_project_id from public.projects p
    where p.organization_id=v_org_id and p.slug='default';
    if v_project_id is not null then
      insert into public.project_members(project_id,user_id,role)
      values(v_project_id,new.id,'owner') on conflict do nothing;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists profiles_create_personal_workspace on public.profiles;
create trigger profiles_create_personal_workspace
after insert on public.profiles
for each row execute function private.bmg_create_personal_workspace_for_profile();

do $backfill$
declare r record;
begin
  for r in select p.id,p.display_name,p.email from public.profiles p
           where not exists(select 1 from public.organizations o where o.owner_id=p.id and o.kind='individual')
  loop
    insert into public.organizations(name,kind,owner_id)
    values(left(coalesce(nullif(trim(r.display_name),''),split_part(coalesce(r.email,'developer'),'@',1)) || ' — المساحة الشخصية',100),'individual',r.id);
  end loop;
end;
$backfill$;

insert into public.organization_members(organization_id,user_id,role)
select o.id,o.owner_id,'owner' from public.organizations o
where o.kind='individual'
on conflict do nothing;

insert into public.projects(organization_id,name,slug,description,created_by)
select o.id,'المشروع الافتراضي','default','المشروع الشخصي الافتراضي.',o.owner_id
from public.organizations o where o.kind='individual'
on conflict(organization_id,slug) do nothing;

insert into public.project_members(project_id,user_id,role)
select p.id,o.owner_id,'owner'
from public.projects p join public.organizations o on o.id=p.organization_id
where p.slug='default' and o.kind='individual'
on conflict do nothing;

update private.api_keys k
set organization_id=o.id, project_id=p.id
from public.organizations o
join public.projects p on p.organization_id=o.id and p.slug='default'
where o.owner_id=k.user_id and o.kind='individual'
  and (k.organization_id is null or k.project_id is null);

update private.api_usage u
set organization_id=k.organization_id, project_id=k.project_id
from private.api_keys k
where u.api_key_id=k.id
  and (u.organization_id is null or u.project_id is null);

create or replace function private.bmg_is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists(
    select 1 from public.organization_members m
    where m.organization_id=p_organization_id and m.user_id=auth.uid()
  );
$function$;

create or replace function private.bmg_can_manage_org(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists(
    select 1 from public.organization_members m
    where m.organization_id=p_organization_id and m.user_id=auth.uid()
      and m.role in ('owner','admin')
  );
$function$;

create or replace function public.bmg_create_organization(p_name text,p_kind text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_org_id uuid;
  v_project_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_kind not in ('organization','company','individual') then raise exception 'Invalid organization type'; end if;
  if p_name is null or length(trim(p_name))<2 or length(trim(p_name))>100 then raise exception 'Organization name must contain 2 to 100 characters'; end if;
  insert into public.organizations(name,kind,owner_id)
  values(trim(p_name),p_kind,v_actor) returning id into v_org_id;
  insert into public.organization_members(organization_id,user_id,role) values(v_org_id,v_actor,'owner');
  insert into public.projects(organization_id,name,slug,description,created_by)
  values(v_org_id,'المشروع الافتراضي','default','المشروع الافتراضي للمؤسسة.',v_actor)
  returning id into v_project_id;
  insert into public.project_members(project_id,user_id,role) values(v_project_id,v_actor,'owner');
  return v_org_id;
end;
$function$;

create or replace function public.bmg_create_project(p_organization_id uuid,p_name text,p_description text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_project_id uuid;
  v_slug text;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not private.bmg_can_manage_org(p_organization_id)
     and not exists(select 1 from public.organization_members m where m.organization_id=p_organization_id and m.user_id=v_actor and m.role='developer') then
    raise exception 'Organization project access required' using errcode='42501';
  end if;
  if p_name is null or length(trim(p_name))<2 or length(trim(p_name))>100 then raise exception 'Project name must contain 2 to 100 characters'; end if;
  v_slug := trim(both '-' from regexp_replace(lower(trim(p_name)),'[^a-z0-9]+','-','g'));
  if v_slug='' then v_slug := 'project-'||substr(replace(gen_random_uuid()::text,'-',''),1,8); end if;
  if exists(select 1 from public.projects p where p.organization_id=p_organization_id and p.slug=v_slug) then
    v_slug := v_slug||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
  end if;
  insert into public.projects(organization_id,name,slug,description,created_by)
  values(p_organization_id,trim(p_name),v_slug,coalesce(p_description,''),v_actor)
  returning id into v_project_id;
  insert into public.project_members(project_id,user_id,role) values(v_project_id,v_actor,'owner');
  return v_project_id;
end;
$function$;

create or replace function public.bmg_invite_organization_member(
  p_organization_id uuid,p_email text,p_role text,p_project_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email,'')));
  v_recipient uuid;
  v_invitation_id uuid;
  v_project_org uuid;
  v_org_role text;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not private.bmg_can_manage_org(p_organization_id) then raise exception 'Organization invitation permission required' using errcode='42501'; end if;
  if v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then raise exception 'A valid email address is required'; end if;
  if p_role not in ('admin','developer','viewer') then raise exception 'Invalid invitation role'; end if;
  if p_role='admin' and not exists(select 1 from public.organization_members m where m.organization_id=p_organization_id and m.user_id=v_actor and m.role='owner') then
    raise exception 'Only the organization owner can invite an administrator' using errcode='42501';
  end if;
  select u.id into v_recipient from auth.users u where lower(u.email)=v_email and u.deleted_at is null limit 1;
  if v_recipient is null then raise exception 'No registered account was found for this email'; end if;
  if exists(select 1 from public.organization_members m where m.organization_id=p_organization_id and m.user_id=v_recipient) then
    raise exception 'This account is already a member of the organization';
  end if;
  if p_project_id is not null then
    select p.organization_id into v_project_org from public.projects p where p.id=p_project_id;
    if v_project_org is distinct from p_organization_id then raise exception 'Project does not belong to this organization'; end if;
    v_org_role := 'viewer';
  else
    v_org_role := p_role;
  end if;
  insert into public.organization_invitations(organization_id,project_id,email,recipient_user_id,role,invited_by)
  values(p_organization_id,p_project_id,v_email,v_recipient,p_role,v_actor)
  returning id into v_invitation_id;
  insert into public.user_notifications(user_id,title,body,type,metadata)
  values(v_recipient,'دعوة للانضمام إلى مساحة عمل',
    'تمت دعوتك للانضمام إلى '||(select o.name from public.organizations o where o.id=p_organization_id)||'. راجع الدعوة من البريد الوارد.',
    'info',jsonb_build_object('kind','organization_invitation','invitation_id',v_invitation_id));
  return v_invitation_id;
end;
$function$;

create or replace function public.bmg_respond_to_organization_invitation(p_invitation_id uuid,p_accept boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_inv public.organization_invitations%rowtype;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into v_inv from public.organization_invitations i
  where i.id=p_invitation_id and i.recipient_user_id=v_actor
  for update;
  if v_inv.id is null then raise exception 'Invitation not found' using errcode='P0002'; end if;
  if v_inv.accepted_at is not null or v_inv.declined_at is not null or v_inv.revoked_at is not null then
    raise exception 'Invitation is no longer pending';
  end if;
  if v_inv.expires_at<=now() then raise exception 'Invitation has expired'; end if;
  if p_accept then
    insert into public.organization_members(organization_id,user_id,role,invited_by)
    values(v_inv.organization_id,v_actor,case when v_inv.project_id is null then v_inv.role else 'viewer' end,v_inv.invited_by)
    on conflict(organization_id,user_id) do nothing;
    if v_inv.project_id is not null then
      insert into public.project_members(project_id,user_id,role)
      values(v_inv.project_id,v_actor,case when v_inv.role='viewer' then 'viewer' else 'developer' end)
      on conflict(project_id,user_id) do nothing;
    end if;
    update public.organization_invitations set accepted_at=now() where id=v_inv.id;
    insert into public.user_notifications(user_id,title,body,type,metadata)
    values(v_inv.invited_by,'تم قبول دعوة المؤسسة',
      (select coalesce(nullif(p.display_name,''),p.email,'عضو جديد') from public.profiles p where p.id=v_actor)||' قبل الدعوة.',
      'info',jsonb_build_object('kind','organization_invitation_accepted','invitation_id',v_inv.id));
  else
    update public.organization_invitations set declined_at=now() where id=v_inv.id;
  end if;
  update public.user_notifications n set read_at=coalesce(n.read_at,now())
  where n.user_id=v_actor and n.metadata->>'invitation_id'=v_inv.id::text;
  return true;
end;
$function$;

create or replace function public.bmg_create_api_key(
  p_key text,p_label text,p_expires_at timestamptz default null
)
returns table(id uuid,label text,key_prefix text,created_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions, auth
as $function$
declare
  uid uuid := auth.uid();
  v_jwt jsonb := auth.jwt();
  clean_label text := nullif(trim(p_label),'');
  v_role text;
  v_plan text;
  v_status text;
  v_key_limit integer;
  v_key_count integer;
  v_requires_mfa boolean;
  v_recent_totp boolean;
  v_org_id uuid;
  v_project_id uuid;
begin
  if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_key is null or length(p_key)<>56 or p_key !~ '^nox_[A-Za-z0-9_-]{52}$' then raise exception 'Invalid key'; end if;
  if clean_label is null then raise exception 'Key label is required'; end if;
  if p_expires_at is not null and p_expires_at<=now() then raise exception 'Expiration must be in the future'; end if;

  select exists(select 1 from auth.mfa_factors f where f.user_id=uid and f.factor_type='totp' and f.status='verified')
    into v_requires_mfa;
  if v_requires_mfa then
    select (v_jwt->>'aal'='aal2') and exists(
      select 1 from jsonb_array_elements(coalesce(v_jwt->'amr','[]'::jsonb)) as entry
      where entry->>'method'='totp'
        and coalesce((entry->>'timestamp')::numeric,0)>=extract(epoch from (now()-interval '2 hours'))
    ) into v_recent_totp;
    if not coalesce(v_recent_totp,false) then
      raise exception 'Recent authenticator verification required' using errcode='42501';
    end if;
  end if;

  select profiles.role,profiles.plan,profiles.account_status
    into v_role,v_plan,v_status from public.profiles profiles where profiles.id=uid;
  if v_status is distinct from 'active' then raise exception 'Account is suspended'; end if;

  select o.id,p.id into v_org_id,v_project_id
  from public.organizations o join public.projects p on p.organization_id=o.id and p.slug='default'
  where o.owner_id=uid and o.kind='individual'
  order by o.created_at limit 1;
  if v_org_id is null or v_project_id is null then raise exception 'Personal workspace is not ready'; end if;

  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  if v_role in ('admin','owner') then
    select admin_limits.max_api_keys into v_key_limit from public.api_admin_limits admin_limits where admin_limits.id=true;
  else
    select plan_limits.max_api_keys into v_key_limit from public.api_plan_limits plan_limits where plan_limits.plan=coalesce(v_plan,'basic');
  end if;
  v_key_limit:=coalesce(v_key_limit,2);
  select count(*)::integer into v_key_count from private.api_keys api_keys
  where api_keys.user_id=uid and api_keys.revoked_at is null and (api_keys.expires_at is null or api_keys.expires_at>now());
  if v_key_count>=v_key_limit then raise exception 'API key limit reached for the current account level (limit: %)',v_key_limit; end if;

  return query
  insert into private.api_keys(user_id,organization_id,project_id,label,key_prefix,key_hash,expires_at)
  values(uid,v_org_id,v_project_id,left(clean_label,64),left(p_key,18),extensions.digest(p_key,'sha256'),p_expires_at)
  returning api_keys.id,api_keys.label,api_keys.key_prefix,api_keys.created_at;
end;
$function$;

create or replace function public.bmg_update_api_key(
  p_id uuid,p_label text,p_expires_at timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_affected integer;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_label is null or length(trim(p_label))=0 or length(trim(p_label))>64 then raise exception 'Key label must contain 1 to 64 characters'; end if;
  if p_expires_at is not null and p_expires_at<=now() then raise exception 'Expiration must be in the future'; end if;
  update private.api_keys set label=trim(p_label),expires_at=p_expires_at
  where id=p_id and user_id=v_actor and revoked_at is null;
  get diagnostics v_affected=row_count;
  return v_affected=1;
end;
$function$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.project_service_limits enable row level security;

drop policy if exists organizations_read_member on public.organizations;
create policy organizations_read_member on public.organizations for select to authenticated
using(private.bmg_is_org_member(id));

drop policy if exists organization_members_read_member on public.organization_members;
create policy organization_members_read_member on public.organization_members for select to authenticated
using(private.bmg_is_org_member(organization_id));

drop policy if exists projects_read_org_member on public.projects;
create policy projects_read_org_member on public.projects for select to authenticated
using(private.bmg_is_org_member(organization_id));

drop policy if exists project_members_read_org_member on public.project_members;
create policy project_members_read_org_member on public.project_members for select to authenticated
using(private.bmg_is_org_member((select p.organization_id from public.projects p where p.id=project_id)));

drop policy if exists organization_invitations_read_recipient_or_manager on public.organization_invitations;
create policy organization_invitations_read_recipient_or_manager on public.organization_invitations for select to authenticated
using(recipient_user_id=auth.uid() or private.bmg_can_manage_org(organization_id));

drop policy if exists project_service_limits_read_org_member on public.project_service_limits;
create policy project_service_limits_read_org_member on public.project_service_limits for select to authenticated
using(private.bmg_is_org_member((select p.organization_id from public.projects p where p.id=project_id)));

grant select on public.organizations,public.organization_members,public.projects,public.project_members,public.organization_invitations,public.project_service_limits to authenticated;
revoke insert,update,delete on public.organizations,public.organization_members,public.projects,public.project_members,public.organization_invitations,public.project_service_limits from anon,authenticated;

revoke all on function private.bmg_is_org_member(uuid) from public,anon;
revoke all on function private.bmg_can_manage_org(uuid) from public,anon;
grant execute on function private.bmg_is_org_member(uuid) to authenticated;
grant execute on function private.bmg_can_manage_org(uuid) to authenticated;

revoke all on function public.bmg_create_organization(text,text) from public,anon;
grant execute on function public.bmg_create_organization(text,text) to authenticated;
revoke all on function public.bmg_create_project(uuid,text,text) from public,anon;
grant execute on function public.bmg_create_project(uuid,text,text) to authenticated;
revoke all on function public.bmg_invite_organization_member(uuid,text,text,uuid) from public,anon;
grant execute on function public.bmg_invite_organization_member(uuid,text,text,uuid) to authenticated;
revoke all on function public.bmg_respond_to_organization_invitation(uuid,boolean) from public,anon;
grant execute on function public.bmg_respond_to_organization_invitation(uuid,boolean) to authenticated;
revoke all on function public.bmg_create_api_key(text,text,timestamptz) from public,anon;
grant execute on function public.bmg_create_api_key(text,text,timestamptz) to authenticated;
revoke all on function public.bmg_update_api_key(uuid,text,timestamptz) from public,anon;
grant execute on function public.bmg_update_api_key(uuid,text,timestamptz) to authenticated;

commit;