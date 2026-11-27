begin;
do $migration$
declare
  v_definition text;
begin
  v_definition:=pg_get_functiondef('public.bmg_create_api_key(text,text,timestamptz,uuid)'::regprocedure);
  if position('and exists(select 1 from public.organizations o where o.id=p.organization_id and o.archived_at is null)' in v_definition)>0 then
    return;
  end if;
  v_definition:=replace(v_definition,
    'where p.id=p_project_id',
    'where p.id=p_project_id'||chr(10)||
    '      and exists(select 1 from public.organizations o where o.id=p.organization_id and o.archived_at is null)');
  if position('o.archived_at is null' in v_definition)=0 then
    raise exception 'Could not add archived workspace guard to API key creation';
  end if;
  execute v_definition;
end;
$migration$;
commit;