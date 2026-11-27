begin;
do $migration$
declare
  v_definition text;
begin
  v_definition:=pg_get_functiondef('public.bmg_archive_organization(uuid)'::regprocedure);
  if position('update public.organization_invitations' in v_definition)=0 then
    v_definition:=replace(v_definition,
      '  update public.organizations'||chr(10)||'  set archived_at=now(),updated_at=now()',
      '  update public.organization_invitations'||chr(10)||
      '  set revoked_at=now()'||chr(10)||
      '  where organization_id=p_organization_id and accepted_at is null and declined_at is null and revoked_at is null;'||chr(10)||chr(10)||
      '  update public.organizations'||chr(10)||'  set archived_at=now(),updated_at=now()');
  end if;
  if position('update public.organization_invitations' in v_definition)=0 then
    raise exception 'Could not add invitation revocation to workspace archive';
  end if;
  execute v_definition;

  v_definition:=pg_get_functiondef('public.bmg_respond_to_organization_invitation(uuid,boolean)'::regprocedure);
  v_definition:=replace(v_definition,
    '  if v_inv.expires_at<=now() then raise exception ''Invitation has expired''; end if;',
    '  if v_inv.expires_at<=now() then raise exception ''Invitation has expired''; end if;'||chr(10)||
    '  if exists(select 1 from public.organizations o where o.id=v_inv.organization_id and o.archived_at is not null) then'||chr(10)||
    '    raise exception ''Workspace is archived'' using errcode=''42501'';'||chr(10)||
    '  end if;');
  if position('Workspace is archived' in v_definition)=0 then
    raise exception 'Could not add archived workspace invitation guard';
  end if;
  execute v_definition;
end;
$migration$;
commit;