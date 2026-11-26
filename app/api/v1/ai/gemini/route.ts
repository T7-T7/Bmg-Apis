import { NextRequest, NextResponse } from "next/server";
import { executeManagedService, isWebsiteTestRequest, managedServiceOptions } from "@/lib/server/service-manager";
import { createClient } from "@supabase/supabase-js";
import { askGemini } from "@/lib/server/gemini";
import { parseApiKeyAuthorization, createDemoClientHash } from "@/lib/core/managers/auth-manager";
import { completeUsageTracking } from "@/lib/core/managers/usage-manager";
import { PayloadTooLargeError, readJsonRequestBody } from "@/lib/core/managers/request-manager";
export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_PROMPT_CHARS = 30_000;
const MAX_BODY_BYTES = 1_048_576;
function jsonError(message:string,status:number){
 const code=status===400?"INVALID_REQUEST":status===401?"UNAUTHORIZED":status===413?"PAYLOAD_TOO_LARGE":status===429?"RATE_LIMITED":status===503?"SERVICE_UNAVAILABLE":status===403?"FORBIDDEN":"UPSTREAM_ERROR";
 const headers:Record<string,string>={"Access-Control-Allow-Origin":"*","Cache-Control":"no-store"};
 if(status===429)headers["Retry-After"]="60";
 return NextResponse.json({success:false,error:message,code},{status,headers});
}
async function completeUsage(id: number | null, status: number, startedAt: number) {
  return completeUsageTracking({
    usageId: id,
    complete: async () => {
      const { data, error } = await getSupabase().rpc("bmg_complete_api_request", {
        p_usage_id: id as number, p_status_code: status,
        p_latency_ms: Math.max(0, Date.now() - startedAt),
        p_server_secret: process.env.BMG_DEMO_RPC_SECRET
      });
      if (error) throw error;
      return data;
    },
    onError: (cause) => console.error("[Nox usage completion]", cause instanceof Error ? cause.message : cause)
  });
}
function getSupabase(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!url||!key)throw new Error("Supabase environment variables are missing.");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
function clientHash(request: NextRequest) { return createDemoClientHash(request, process.env.GEMINI_SESSION_SECRET, "GEMINI_SESSION_SECRET is not configured."); }
async function authorize(request:NextRequest,token:string|null){
  if (!token && !isWebsiteTestRequest(request)) return { ok: false as const, response: jsonError("يلزم إرسال API Key صالح للطلبات الخارجية.", 401) };
 const supabase=getSupabase();
 if(token){const{data,error}=await supabase.rpc("bmg_authorize_api_request",{p_key:token,p_service_slug:"aql-gemini",p_method:"POST",p_server_secret:process.env.BMG_DEMO_RPC_SECRET});if(error)throw error;const result=data as {authorized?:boolean;reason?:string;usage_id?:number;message?:string}|null;if(!result?.authorized){if(result?.reason==="rate_limited")return{ok:false,response:jsonError("تجاوزت حدود الاستخدام المسموح بها لحسابك أو مفتاحك.",429)};if(result?.reason==="maintenance")return{ok:false,response:jsonError(result.message||"الخدمة تحت الصيانة مؤقتًا.",503)};if(result?.reason==="account_suspended")return{ok:false,response:jsonError("تم إيقاف الحساب مؤقتًا. تواصل مع الإدارة.",403)};if(result?.reason==="insufficient_scope")return{ok:false,response:jsonError("مفتاح API لا يملك صلاحية استخدام هذه الخدمة.",403)};return{ok:false,response:jsonError(result?.reason==="service_unavailable"?"الخدمة غير متاحة حاليًا.":"مفتاح API غير صحيح أو ملغى أو منتهي الصلاحية.",result?.reason==="service_unavailable"?503:401)}}return{ok:true,usageId:Number(result.usage_id)||null}}
 const{data,error}=await supabase.rpc("bmg_authorize_demo_request",{p_client_hash:clientHash(request),p_service_slug:"aql-gemini",p_method:"POST",p_server_secret:process.env.BMG_DEMO_RPC_SECRET});
 if(error)throw error;const result=data as {authorized?:boolean;reason?:string;usage_id?:number;message?:string}|null;
 if(!result?.authorized)return{ok:false,response:jsonError(result?.reason==="rate_limited"?"وصلت إلى حد التجربة المجانية. سجّل الدخول لاستخدام الخدمة بمفتاحك.":result?.reason==="maintenance"?(result.message||"الخدمة تحت الصيانة مؤقتًا."):"الخدمة غير متاحة حاليًا.",result?.reason==="rate_limited"?429:503)};
 return{ok:true,usageId:Number(result.usage_id)||null};
}
export async function OPTIONS() {
  return managedServiceOptions();
}
async function handlePost(request: NextRequest) {
 const authorization=request.headers.get("authorization")??"";
  const apiKey = parseApiKeyAuthorization(authorization);
 if (!apiKey.valid) return jsonError("صيغة ترويسة Authorization غير صحيحة.", 401);
 let body:unknown;try{body=await readJsonRequestBody(request, MAX_BODY_BYTES)}catch(cause){if(cause instanceof PayloadTooLargeError)return jsonError("حجم الطلب يتجاوز الحد الأقصى المسموح (1 MB).",413);if(cause instanceof SyntaxError)return jsonError("يجب إرسال جسم الطلب بصيغة JSON صحيحة.",400);return jsonError("تعذر قراءة جسم الطلب.",400)}
 if(!body||typeof body!=="object"||Array.isArray(body))return jsonError("يجب أن يكون جسم الطلب كائن JSON.",400);
 const data=body as Record<string,unknown>;
 if(typeof data.prompt!=="string"||!data.prompt.trim())return jsonError("الحقل prompt مطلوب ويجب أن يحتوي على نص.",400);
 if(data.prompt.length>MAX_PROMPT_CHARS)return jsonError("تجاوز النص الحد الأقصى المسموح وهو 30000 حرف.",413);
 if(data.instruction!==undefined&&typeof data.instruction!=="string")return jsonError("الحقل instruction يجب أن يكون نصًا.",400);
 if(data.sessionId!==undefined&&typeof data.sessionId!=="string")return jsonError("الحقل sessionId يجب أن يكون نصًا.",400);
 let usageId:number|null=null;const startedAt=Date.now();try{const access=await authorize(request,apiKey.token);if(!access.ok)return access.response??jsonError("الخدمة غير متاحة حاليًا.",503);usageId=access.usageId??null;
 const response=await askGemini({prompt:data.prompt,instruction:typeof data.instruction==="string"?data.instruction:undefined,sessionId:typeof data.sessionId==="string"?data.sessionId:undefined});
 await completeUsage(usageId,200,startedAt);
 return NextResponse.json({...response,access:apiKey.token ? "api_key" : "demo"},{headers:{"Access-Control-Allow-Origin":"*","Cache-Control":"no-store","X-Max-Prompt-Length":String(MAX_PROMPT_CHARS)}})
 }catch(error){await completeUsage(usageId,502,startedAt);console.error("[Nox Gemini API]",error instanceof Error?error.message:error);return jsonError("تعذر تنفيذ الخدمة حاليًا. حاول مرة أخرى لاحقًا.",502)}
}

export async function POST(request: NextRequest) {
  return executeManagedService("aql-gemini", request, () => handlePost(request));
}
