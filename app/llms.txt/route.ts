const content = `# NOX APIS
> Nox is the API service provider for developers. It operates the unified API layer, authentication, API keys, access controls, usage quotas, request handling, and service coordination for three active AI services.

- Website: https://nox.bmg-inc.web.id
- Human-readable docs: https://nox.bmg-inc.web.id/docs
- Plain Markdown docs: https://nox.bmg-inc.web.id/docs.md
- OpenAPI 3.1 JSON: https://nox.bmg-inc.web.id/api/openapi.json
- API catalog: https://nox.bmg-inc.web.id/apis
- Service status: https://nox.bmg-inc.web.id/status

## Common request rules

- Base URL: https://nox.bmg-inc.web.id
- Method: POST
- Request Content-Type: application/json
- External authentication: Authorization: Bearer YOUR_NOX_API_KEY
- External requests require a valid Nox API key.
- Official website test pages are the only no-key exception; this exception is not for external applications.
- Usage quotas and request rates depend on account, plan, key, and service. Do not assume a universal fixed rate.
- Do not expose API keys in browser code or public repositories.

- Developers integrate with Nox directly through the Nox API; they do not need separate integrations with underlying model services.
- Nox servers operate the API layer and manage requests, authentication, quotas, and usage records. Some model execution may use specialized upstream model/runtime providers behind the Nox API.
- Nox is the service provider and API operator; this documentation does not claim that every model or inference workload is self-hosted on Nox hardware.

## Active AI APIs

### Gemini
- Endpoint: /api/v1/ai/gemini
- Required: prompt, string, 1–30000 characters.
- Optional: instruction, string.
- Optional: sessionId, string returned by a previous response to continue a conversation.
- Maximum HTTP body: 1 MB.
- Success: JSON with success, response, sessionId, method, conversationId, responseId, and access.

### GPTFree
- Endpoint: /api/v1/ai/gptfree
- Required: message, string, 1–30000 characters.
- Optional: history, array of up to 20 objects with type (user, agent, assistant) and content (string).
- Maximum HTTP body: 1 MB.
- Success: JSON with success, response, provider, and access.

### Star X
- Endpoint: /api/v1/ai/star-x
- Maximum HTTP body: 4 MB.
- Required action: edit-scene, generate-image, change-background, or improve-lighting.
- imageUrl: public HTTPS image URL required for edit-scene, change-background, and improve-lighting; omitted for generate-image.
- prompt: English text, maximum 4000 characters; required for edit-scene, change-background, and generate-image.
- improve-lighting uses the provider's aiShadows tool and does not require prompt.
- Success: binary image response (image/*), not JSON. Error responses are JSON.

## HTTP errors

- 400 invalid request.
- 401 missing or invalid API key / Authorization header.
- 403 account restriction or insufficient service scope.
- 413 request body or text limit exceeded.
- 429 rate limit or usage quota exceeded.
- 502 upstream provider failure.
- 503 service or authorization temporarily unavailable.

## Authentication note

The official website testing flow is checked using the configured website Origin. Origin is a browser-origin restriction, not cryptographic authentication; non-browser clients can forge it. External applications must use a Nox API key.

## Machine-readable contract

- OpenAPI: https://nox.bmg-inc.web.id/api/openapi.json
- Full documentation: https://nox.bmg-inc.web.id/docs.md

Only endpoints explicitly listed in the OpenAPI specification and active service documentation should be treated as available.
`;

export async function GET() {
  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
