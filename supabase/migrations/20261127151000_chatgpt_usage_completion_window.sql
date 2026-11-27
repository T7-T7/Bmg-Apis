begin;

-- ChatGPT may use the full 300-second route window. Keep usage completion
-- able to record the request without changing the RPC signature or grants.
create or replace function public.bmg_complete_api_request(
  p_usage_id bigint,
  p_status_code integer,
  p_latency_ms integer,
  p_server_secret text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'private', 'extensions'
as $function$
declare
  v_secret_hash bytea;
  v_updated bigint;
  v_already_completed boolean;
begin
  if p_server_secret is null or p_usage_id is null
     or p_status_code < 100 or p_status_code > 599
     or p_latency_ms < 0 or p_latency_ms > 300000 then
    return jsonb_build_object('completed', false, 'reason', 'invalid_input');
  end if;

  select secret_hash into v_secret_hash
  from private.api_demo_config
  where id = true;

  if v_secret_hash is null
     or v_secret_hash <> extensions.digest(convert_to(p_server_secret, 'UTF8'), 'sha256') then
    return jsonb_build_object('completed', false, 'reason', 'invalid_server');
  end if;

  update private.api_usage
  set status_code = p_status_code, latency_ms = p_latency_ms
  where id = p_usage_id
    and status_code is null
    and created_at >= now() - interval '24 hours';

  get diagnostics v_updated = row_count;
  if v_updated = 1 then
    return jsonb_build_object('completed', true, 'already_completed', false);
  end if;

  select exists(
    select 1 from private.api_usage
    where id = p_usage_id and status_code is not null
  ) into v_already_completed;

  return jsonb_build_object(
    'completed', v_already_completed,
    'already_completed', v_already_completed
  );
end;
$function$;

commit;
