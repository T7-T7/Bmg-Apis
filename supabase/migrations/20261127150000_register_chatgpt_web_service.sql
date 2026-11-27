begin;

with inserted as (
  insert into public.api_services (
    slug, name, description, category, endpoint_path, http_method,
    docs_markdown, status, source_type, weight, current_version, updated_at
  )
  values (
    'chatgpt',
    'ChatGPT',
    'محادثات نصية مستمرة عبر واجهة ChatGPT Web داخلية غير رسمية. قد تتغير واجهة المزود أو تتوقف دون إشعار.',
    'ai',
    '/api/v1/ai/chatgpt',
    'POST',
    E'# ChatGPT API\n\nPOST /api/v1/ai/chatgpt\n\nRequired: message (1–30000 characters). Optional: model (default, auto, gpt-4, gpt-3.5) and encrypted sessionId. Maximum request body: 1 MB. The implementation uses an unofficial internal ChatGPT Web endpoint, not the official OpenAI API. Provider timeout is configured to 300 seconds, subject to Vercel function-duration limits.',
    'active',
    'community',
    1,
    1,
    now()
  )
  on conflict (slug) do nothing
  returning *
)
insert into public.api_service_versions (service_id, version, snapshot, change_note)
select
  id,
  1,
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
  'إضافة خدمة ChatGPT Web غير الرسمية إلى كتالوج Nox'
from inserted;

commit;
