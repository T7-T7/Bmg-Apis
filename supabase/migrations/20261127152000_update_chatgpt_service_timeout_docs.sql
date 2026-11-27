begin;

with updated as (
  update public.api_services
  set
    description = 'محادثات نصية مستمرة عبر واجهة ChatGPT Web داخلية غير رسمية؛ قد تتغير واجهة المزود أو تتوقف دون إشعار.',
    docs_markdown = E'# ChatGPT API\n\nPOST /api/v1/ai/chatgpt\n\nRequired: message (1–30000 characters). Optional: model (default, auto, gpt-4, gpt-3.5) and encrypted sessionId. Maximum request body: 1 MB. The implementation uses an unofficial internal ChatGPT Web endpoint, not the official OpenAI API. Vercel route duration is 300 seconds; the upstream stream timeout is 260 seconds to reserve time for authorization, session bootstrap, and usage completion.',
    current_version = current_version + 1,
    updated_at = now()
  where slug = 'chatgpt'
  returning *
)
insert into public.api_service_versions (service_id, version, snapshot, change_note)
select
  id,
  current_version,
  jsonb_build_object(
    'slug', slug,
    'name', name,
    'description', description,
    'category', category,
    'endpoint_path', endpoint_path,
    'http_method', http_method,
    'docs_markdown', docs_markdown,
    'status', status,
    'source_type', source_type,
    'weight', weight,
    'healthcheck_config', healthcheck_config
  ),
  'تحديث مهلة ChatGPT وتوثيق وقت تنفيذ Vercel'
from updated;

commit;
