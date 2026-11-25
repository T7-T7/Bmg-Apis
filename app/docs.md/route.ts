const documentation = `# NOX APIS — توثيق المطورين

Official API reference: https://nox.bmg-inc.web.id

تضم المنصة حاليًا ثلاث واجهات API تشغيلية للذكاء الاصطناعي. يتطلب الاستخدام الخارجي مفتاح API صالحًا في ترويسة Authorization. صفحات الاختبار الرسمية داخل الموقع تستخدم استثناء الاختبار ولا تعرض حقل API Key.

## Gemini text generation

- Method: POST
- Endpoint: https://nox.bmg-inc.web.id/api/v1/ai/gemini
- Content-Type: application/json
- External authentication: Authorization: Bearer YOUR_NOX_API_KEY
- Rate limit: 30 requests per minute per API key.
- prompt: required string, 1–30000 characters.
- instruction: optional string.
- sessionId: optional string returned by a previous response to continue a conversation.

### Request body

\`\`\`json
{
  "prompt": "اشرح الفرق بين let و const",
  "instruction": "أجب باللغة العربية"
}
\`\`\`

### cURL

\`\`\`bash
curl -X POST "https://nox.bmg-inc.web.id/api/v1/ai/gemini" \
  -H "Authorization: Bearer YOUR_NOX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Explain let vs const","instruction":"Answer in Arabic"}'
\`\`\`

## GPTFree text generation

- Method: POST
- Endpoint: https://nox.bmg-inc.web.id/api/v1/ai/gptfree
- Content-Type: application/json
- External authentication: Authorization: Bearer YOUR_NOX_API_KEY
- message: required string, 1–30000 characters.
- history: optional array, maximum 20 messages. Each item contains type (user, agent, or assistant) and content.

### Request body

\`\`\`json
{
  "message": "اشرح REST API",
  "history": []
}
\`\`\`

## Star X image tools

- Method: POST
- Endpoint: https://nox.bmg-inc.web.id/api/v1/ai/star-x
- Content-Type: application/json
- External authentication: Authorization: Bearer YOUR_NOX_API_KEY
- Actions: edit-scene, generate-image, change-background, improve-lighting.
- imageUrl: HTTPS image URL, required except for generate-image.
- prompt: English only, up to 4000 characters.
- Success response: binary image data (image/*), not JSON.
- improve-lighting uses the provider's aiShadows / tool:ai-shadows function; the source has no separate native lighting function.

### Request body

\`\`\`json
{
  "action": "generate-image",
  "prompt": "A cinematic photograph of a modern glass house beside a lake at sunset"
}
\`\`\`

## Authentication policy

All external requests to the three API endpoints require a valid API key in the Authorization: Bearer header. The only no-key exception is the official website testing flow, which is checked using the configured website Origin. Website test pages must not display an API-key input.

The Origin check is a browser-origin restriction, not cryptographic client authentication. Non-browser HTTP clients can forge an Origin header.

## HTTP errors

- 400: invalid request or missing required field.
- 401: missing, invalid, or revoked API key.
- 403: account or permission restriction.
- 413: payload exceeds the endpoint limit.
- 429: rate limit or quota exceeded.
- 502: upstream provider did not return a valid response.
- 503: service or API-key authorization is temporarily unavailable.

## Machine-readable resources

- OpenAPI JSON: https://nox.bmg-inc.web.id/api/openapi.json
- Markdown documentation: https://nox.bmg-inc.web.id/docs.md
- LLM index: https://nox.bmg-inc.web.id/llms.txt

Only the three endpoints listed in this document are currently registered as active AI API services.
`;

export async function GET() {
  return new Response(documentation, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
