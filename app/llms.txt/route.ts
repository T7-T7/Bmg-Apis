const content = "# Nox Apis\n> Official developer platform and API reference.\n\n- Website: https://bmg-apis-b2-902b.vercel.app\n- Human-readable docs: https://bmg-apis-b2-902b.vercel.app/docs\n- Plain Markdown docs: https://bmg-apis-b2-902b.vercel.app/docs.md\n- OpenAPI 3.1 JSON: https://bmg-apis-b2-902b.vercel.app/api/openapi.json\n- API catalog: https://bmg-apis-b2-902b.vercel.app/apis\n- Service status: https://bmg-apis-b2-902b.vercel.app/status\n\n## Active API\n- POST https://nox.bmg-inc.web.id/api/v1/ai/star-x\n- Actions: edit-scene, generate-image, change-background, improve-lighting\n- HTTPS imageUrl required except image generation\n- Prompt language: English only; the model does not understand Arabic\n- Success response: binary image data\n- Logo: https://starx.bmg-inc.web.id/1795458731193.jpg\n- POST https://bmg-apis-b2-902b.vercel.app/api/v1/ai/gemini\n- Authentication: Bearer Nox Apis API key\n- Content-Type: application/json\n- Required body field: prompt (string, 1–30000 characters)\n- Optional body fields: instruction (string), sessionId (string)\n- Rate limit: 30 requests per minute per key\\n- GET https://bmg-apis-b2-902b.vercel.app/api/v1/currency/rate?base=USD&target=EUR\n- Currency authentication: Bearer Nox Apis API key\n- Currency source: Frankfurter daily reference rates, not live trading quotes\n- Full contract: https://bmg-apis-b2-902b.vercel.app/docs.md\n- Machine-readable contract: https://bmg-apis-b2-902b.vercel.app/api/openapi.json\n\nOnly endpoints explicitly listed in the OpenAPI specification should be treated as available.\n";

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
