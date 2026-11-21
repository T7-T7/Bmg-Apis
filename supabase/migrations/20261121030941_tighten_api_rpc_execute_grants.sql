begin;
-- API-key mutation must never be callable through the anonymous/public role.
revoke all on function public.bmg_update_api_key(uuid, text, timestamptz) from public, anon;
grant execute on function public.bmg_update_api_key(uuid, text, timestamptz) to authenticated;

-- Completion is an internal server callback authenticated by the stored server secret.
revoke all on function public.bmg_complete_api_request(bigint, integer, integer, text) from public, authenticated;
grant execute on function public.bmg_complete_api_request(bigint, integer, integer, text) to anon, service_role;
commit;
