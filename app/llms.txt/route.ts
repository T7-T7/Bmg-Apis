const content = `# NOX APIS
> Official developer platform and API reference.

- Website: https://nox.bmg-inc.web.id
- Human-readable docs: https://nox.bmg-inc.web.id/docs
- Plain Markdown docs: https://nox.bmg-inc.web.id/docs.md
- OpenAPI 3.1 JSON: https://nox.bmg-inc.web.id/api/openapi.json
- API catalog: https://nox.bmg-inc.web.id/apis
- Service status: https://nox.bmg-inc.web.id/status

## Active AI APIs

### Gemini
- Method: POST
- Endpoint: https://nox.bmg-inc.web.id/api/v1/ai/gemini
- External authentication: Authorization: Bearer YOUR_NOX_API_KEY
- Required body field: prompt (string, 1–30000 characters)
- Optional body fields: instruction (string), sessionId (string)
- Rate limit: 30 requests per minute per API key

### GPTFree
- Method: POST
- Endpoint: https://nox.bmg-inc.web.id/api/v1/ai/gptfree
- External authentication: Authorization: Bearer YOUR_NOX_API_KEY
- Required body field: message (string, 1–30000 characters)
- Optional body field: history (array, maximum 20 messages)

### Star X
- Method: POST
- Endpoint: https://nox.bmg-inc.web.id/api/v1/ai/star-x
- External authentication: Authorization: Bearer YOUR_NOX_API_KEY
- Actions: edit-scene, generate-image, change-background, improve-lighting
- HTTPS imageUrl required except for image generation
- Prompt language: English only; maximum 4000 characters
- Success response: binary image data
- improve-lighting uses the provider's aiShadows / tool:ai-shadows function

## Authentication

External requests require a valid Bearer API key. The official website testing flow is the only no-key exception and is checked using the configured website Origin. Website test pages must not show an API-key input. Origin is not cryptographic authentication; non-browser clients can forge it.

## Machine-readable contract
- OpenAPI: https://nox.bmg-inc.web.id/api/openapi.json
- Full documentation: https://nox.bmg-inc.web.id/docs.md

Only endpoints explicitly listed in the OpenAPI specification and the active service documentation should be treated as available.
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
