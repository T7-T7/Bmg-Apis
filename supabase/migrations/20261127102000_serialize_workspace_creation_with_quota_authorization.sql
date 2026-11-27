begin;
create or replace function public.bmg_create_organization(p_name text,p_kind text)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_org_id uuid;
  v_project_id uuid;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if p_kind not in ('organization','company','individual') then
    raise exception 'Invalid organization type';
  end if;
  if p_name is null or length(trim(p_name))<2 or length(trim(p_name))>100 then
    raise exception 'Organization name must contain 2 to 100 characters';
  end if;

  -- Keep scope creation in the same serialization domain as API quota checks and deletion.
  perform pg_advisory_xact_lock(hashtextextended('nox_scope_pool_owner:'||v_actor::text,0));

  insert into public.organizations(name,kind,owner_id)
  values(trim(p_name),p_kind,v_actor)
  returning id into v_org_id;

  insert into public.organization_members(organization_id,user_id,role)
  values(v_org_id,v_actor,'owner');

  insert into public.projects(organization_id,name,slug,description,created_by)
  values(v_org_id,'المشروع الافتراضي','default','المشروع الافتراضي للمؤسسة.',v_actor)
  returning id into v_project_id;

  insert into public.project_members(project_id,user_id,role)
  values(v_project_id,v_actor,'owner');

  return v_org_id;
end;
$function$;
commit;