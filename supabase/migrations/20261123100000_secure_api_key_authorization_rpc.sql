do $migration$
declare
  v_definition text;
  v_old_header text := 'FUNCTION public.bmg_authorize_api_request(p_key text, p_service_slug text, p_method text)';
  v_new_header text := 'FUNCTION public.bmg_authorize_api_request(p_key text, p_service_slug text, p_method text, p_server_secret text)';
  v_old_declare text := '  usage_id bigint;';
  v_new_declare text := '  usage_id bigint;
  v_secret_hash bytea;';
  v_old_body text := E'begin\n  if p_key is null or length(p_key)<40 then';
  v_new_body text := E'begin
  if p_server_secret is null then
    return jsonb_build_object(''authorized'',false,''reason'',''invalid_server'');
  end if;

  select secret_hash into v_secret_hash
  from private.api_demo_config where id=true;

  if v_secret_hash is null
     or v_secret_hash<>extensions.digest(convert_to(p_server_secret,''UTF8''),''sha256'') then
    return jsonb_build_object(''authorized'',false,''reason'',''invalid_server'');
  end if;

  if p_key is null or length(p_key)<40 then';
begin
  v_definition := pg_get_functiondef('public.bmg_authorize_api_request(text,text,text)'::regprocedure);
  if position(v_old_header in v_definition)=0
     or position(v_old_declare in v_definition)=0
     or position(v_old_body in v_definition)=0 then
    raise exception 'Unexpected bmg_authorize_api_request definition; migration stopped safely';
  end if;
  v_definition := replace(v_definition,v_old_header,v_new_header);
  v_definition := replace(v_definition,v_old_declare,v_new_declare);
  v_definition := replace(v_definition,v_old_body,v_new_body);
  execute v_definition;
  revoke all on function public.bmg_authorize_api_request(text,text,text) from public, anon, authenticated;
  drop function public.bmg_authorize_api_request(text,text,text);
  revoke all on function public.bmg_authorize_api_request(text,text,text,text) from public;
  grant execute on function public.bmg_authorize_api_request(text,text,text,text) to anon, authenticated;
end
$migration$;
