const content = "# BMG APIs\n> Official developer platform and API reference.\n\n- Website: https://bmg-apis.vercel.app\n- Human-readable docs: https://bmg-apis.vercel.app/docs\n- Plain Markdown docs: https://bmg-apis.vercel.app/docs.md\n- OpenAPI 3.1 JSON: https://bmg-apis.vercel.app/api/openapi.json\n- API catalog: https://bmg-apis.vercel.app/apis\n- Service status: https://bmg-apis.vercel.app/status\n\n## Active API\n- POST https://bmg-apis.vercel.app/api/v1/ai/gemini\n- Authentication: Bearer BMG API key\n- Content-Type: application/json\n- Required body field: prompt (string, 1–30000 characters)\n- Optional body fields: instruction (string), sessionId (string)\n- Rate limit: 30 requests per minute per key\n- Full contract: https://bmg-apis.vercel.app/docs.md\n- Machine-readable contract: https://bmg-apis.vercel.app/api/openapi.json\n\nOnly endpoints explicitly listed in the OpenAPI specification should be treated as available.\n";

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
