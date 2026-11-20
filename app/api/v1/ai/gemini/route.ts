import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { askGemini } from "@/lib/server/gemini";
export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_PROMPT_CHARS = 30_000;
const MAX_BODY_BYTES = 1_048_576;
class PayloadTooLargeError extends Error {}
async function readJsonBody(request: NextRequest): Promise<unknown> {
 const length=Number(request.headers.get("content-length")??0);
 if(Number.isFinite(length)&&length>MAX_BODY_BYTES)throw new PayloadTooLargeError();
 const reader=request.body?.getReader();if(!reader)throw new SyntaxError("Request body is empty.");
 const chunks:Uint8Array[]=[];let total=0;
 try{while(true){const{done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_BODY_BYTES){await reader.cancel();throw new PayloadTooLargeError()}chunks.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}return JSON.parse(new TextDecoder().decode(bytes));
}
function jsonError(message:string,status:number){return NextResponse.json({success:false,error:message},{status,headers:{"Access-Control-Allow-Origin":"*","Cache-Control":"no-store"}})}
async function completeUsage(id:number|null,status:number,startedAt:number){if(!id)return;try{const db=getSupabase();await db.rpc("bmg_complete_api_request",{p_usage_id:id,p_status_code:status,p_latency_ms:Math.max(0,Date.now()-startedAt),p_server_secret:process.env.BMG_DEMO_RPC_SECRET})}catch(error){console.error("[Nox usage completion]",error instanceof Error?error.message:error)}}
function getSupabase(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!url||!key)throw new Error("Supabase environment variables are missing.");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
function clientHash(request:NextRequest){const secret=process.env.GEMINI_SESSION_SECRET;if(!secret||secret.length<32)throw new Error("GEMINI_SESSION_SECRET is not configured.");const ip=request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()||request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";return createHmac("sha256",secret).update(ip).digest("hex")}
async function authorize(request:NextRequest,token:string|null){
 const supabase=getSupabase();
 if(token){const{data,error}=await supabase.rpc("bmg_authorize_api_request",{p_key:token,p_service_slug:"aql-gemini",p_method:"POST"});if(error)throw error;const result=data as {authorized?:boolean;reason?:string;usage_id?:number}|null;if(!result?.authorized)return result?.reason==="rate_limited"?{ok:false,response:jsonError("تجاوزت حد 30 طلبًا في الدقيقة لهذا المفتاح.",429)}:{ok:false,response:jsonError(result?.reason==="service_unavailable"?"الخدمة غير متاحة حاليًا.":"مفتاح API غير صحيح أو ملغى أو منتهي الصلاحية.",result?.reason==="service_unavailable"?503:401)};return{ok:true,usageId:Number(result.usage_id)||null}}
 const{data,error}=await supabase.rpc("bmg_authorize_demo_request",{p_client_hash:clientHash(request),p_service_slug:"aql-gemini",p_method:"POST",p_server_secret:process.env.BMG_DEMO_RPC_SECRET});
 if(error)throw error;const result=data as {authorized?:boolean;reason?:string;usage_id?:number}|null;
 if(!result?.authorized)return{ok:false,response:jsonError(result?.reason==="rate_limited"?"وصلت إلى حد التجربة المجانية. سجّل الدخول لاستخدام الخدمة بمفتاحك.":"الخدمة غير متاحة حاليًا.",result?.reason==="rate_limited"?429:503)};
 return{ok:true,usageId:Number(result.usage_id)||null};
}
export async function OPTIONS(){return new NextResponse(null,{status:204,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Max-Age":"86400"}})}
export async function POST(request:NextRequest){
 const authorization=request.headers.get("authorization")??"";
 const match=authorization.match(/^Bearer\s+((?:nox_live_|bmg_live_)[A-Za-z0-9_-]+)$/i);
 if(authorization&&!match)return jsonError("صيغة ترويسة Authorization غير صحيحة.",401);
 let body:unknown;try{body=await readJsonBody(request)}catch(cause){if(cause instanceof PayloadTooLargeError)return jsonError("حجم الطلب يتجاوز الحد الأقصى المسموح (1 MB).",413);if(cause instanceof SyntaxError)return jsonError("يجب إرسال جسم الطلب بصيغة JSON صحيحة.",400);return jsonError("تعذر قراءة جسم الطلب.",400)}
 if(!body||typeof body!=="object"||Array.isArray(body))return jsonError("يجب أن يكون جسم الطلب كائن JSON.",400);
 const data=body as Record<string,unknown>;
 if(typeof data.prompt!=="string"||!data.prompt.trim())return jsonError("الحقل prompt مطلوب ويجب أن يحتوي على نص.",400);
 if(data.prompt.length>MAX_PROMPT_CHARS)return jsonError("تجاوز النص الحد الأقصى المسموح وهو 30000 حرف.",413);
 if(data.instruction!==undefined&&typeof data.instruction!=="string")return jsonError("الحقل instruction يجب أن يكون نصًا.",400);
 if(data.sessionId!==undefined&&typeof data.sessionId!=="string")return jsonError("الحقل sessionId يجب أن يكون نصًا.",400);
 let usageId:number|null=null;const startedAt=Date.now();try{const access=await authorize(request,match?.[1]??null);if(!access.ok)return access.response;usageId=access.usageId??null;
 const response=await askGemini({prompt:data.prompt,instruction:typeof data.instruction==="string"?data.instruction:undefined,sessionId:typeof data.sessionId==="string"?data.sessionId:undefined});
 await completeUsage(usageId,200,startedAt);
 return NextResponse.json({...response,access:match?"api_key":"demo"},{headers:{"Access-Control-Allow-Origin":"*","Cache-Control":"no-store","X-Max-Prompt-Length":String(MAX_PROMPT_CHARS)}})
 }catch(error){await completeUsage(usageId,502,startedAt);console.error("[Nox Gemini API]",error instanceof Error?error.message:error);return jsonError("تعذر تنفيذ الخدمة حاليًا. حاول مرة أخرى لاحقًا.",502)}
}