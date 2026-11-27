do $migration$
declare
  v_definition text;
  v_old text:= $old$
  delete from private.api_usage_hourly
  where bucket_hour < now()-interval '3 days 23 hours 50 minutes';
  get diagnostics v_hourly_deleted=row_count;
$old$;
  v_new text:= $new$
  -- Keep monthly quota source rows until compact monthly counters are implemented.
  v_hourly_deleted:=0;
$new$;
begin
  v_definition:=pg_get_functiondef('private.bmg_cleanup_expired_platform_data()'::regprocedure);
  if position(v_old in v_definition)=0 then
    raise exception 'Could not locate hourly history cleanup block';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);
  execute v_definition;
end;
$migration$;