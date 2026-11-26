begin;

create or replace function public.bmg_list_organization_members(p_organization_id uuid)
returns table(user_id uuid,email text,display_name text,role text,created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not private.bmg_is_org_member(p_organization_id) then
    raise exception 'Organization membership required' using errcode='42501';
  end if;
  return query
  select m.user_id,coalesce(p.email,u.email),p.display_name,m.role,m.created_at
  from public.organization_members m
  join auth.users u on u.id=m.user_id
  left join public.profiles p on p.id=m.user_id
  where m.organization_id=p_organization_id
  order by case m.role when 'owner' then 0 when 'admin' then 1 when 'developer' then 2 else 3 end,m.created_at;
end;
$function$;

revoke all on function public.bmg_list_organization_members(uuid) from public,anon;
grant execute on function public.bmg_list_organization_members(uuid) to authenticated;

commit;