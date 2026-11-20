import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
export const runtime="nodejs";export const maxDuration=15;
const CORS_HEADERS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Authorization, Content-Type","Cache-Control":"no-store"};
function jsonError(message:string,status:number){return NextResponse.json({success:false,error:message},{status,headers:CORS_HEADERS})}
function getSupabase(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!url||!key)throw new Error("Supabase environment variables are missing.");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
function clientHash(request:NextRequest){const secret=process.env.GEMINI_SESSION_SECRET;if(!secret||secret.length<32)throw new Error("GEMINI_SESSION_SECRET is not configured.");const ip=request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()||request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";return createHmac("sha256",secret).update(ip).digest("hex")}
export async function OPTIONS(){return new NextResponse(null,{status:204,headers:CORS_HEADERS})}
export async function GET(request:NextRequest){
 const authorization=request.headers.get("authorization")??"";const match=authorization.match(/^Bearer\s+((?:nox_live_|bmg_live_)[A-Za-z0-9_-]+)$/i);
 if(authorization&&!match)return jsonError("صيغة ترويسة Authorization غير صحيحة.",401);
 const base=(request.nextUrl.searchParams.get("base")||"USD").trim().toUpperCase(),target=(request.nextUrl.searchParams.get("target")||"EUR").trim().toUpperCase();
 if(!/^[A-Z]{3}$/.test(base)||!/^[A-Z]{3}$/.test(target))return jsonError("رمزا العملتين يجب أن يتكونا من ثلاثة أحرف، مثل USD وEUR.",400);
 try{
 const supabase=getSupabase();
 if(match){const{data,error}=await supabase.rpc("bmg_authorize_api_request",{p_key:match[1],p_service_slug:"currency-rate",p_method:"GET"});if(error)throw error;const a=data as {authorized?:boolean;reason?:string}|null;if(!a?.authorized)return jsonError(a?.reason==="rate_limited"?"تجاوزت حد 30 طلبًا في الدقيقة لهذا المفتاح.":a?.reason==="service_unavailable"?"الخدمة غير متاحة حاليًا.":"مفتاح API غير صحيح أو ملغى أو منتهي الصلاحية.",a?.reason==="rate_limited"?429:a?.reason==="service_unavailable"?503:401)}
 else{const{data,error}=await supabase.rpc("bmg_authorize_demo_request",{p_client_hash:clientHash(request),p_service_slug:"currency-rate",p_method:"GET",p_server_secret:process.env.BMG_DEMO_RPC_SECRET});if(error)throw error;const a=data as {authorized?:boolean;reason?:string}|null;if(!a?.authorized)return jsonError(a?.reason==="rate_limited"?"وصلت إلى حد التجربة المجانية. سجّل الدخول لاستخدام الخدمة بمفتاحك.":"الخدمة غير متاحة حاليًا.",a?.reason==="rate_limited"?429:503)}
 if(base===target)return NextResponse.json({success:true,base,target,rate:1,date:null,source:"Frankfurter",rateType:"daily_reference"},{headers:CORS_HEADERS});
 const upstream=await fetch(`https://api.frankfurter.dev/v2/rate/${encodeURIComponent(base.toLowerCase())}/${encodeURIComponent(target.toLowerCase())}`,{signal:AbortSignal.timeout(8000),next:{revalidate:3600}});
 if([400,404,422].includes(upstream.status))return jsonError("رمز العملة غير مدعوم أو لا يتوفر له سعر مرجعي.",422);
 if(!upstream.ok)return jsonError("مصدر أسعار العملات غير متاح مؤقتًا.",502);
 const data:unknown=await upstream.json();if(!data||typeof data!=="object")return jsonError("أعاد مصدر أسعار العملات استجابة غير صالحة.",502);
 const d=data as{rate?:unknown;date?:unknown};if(typeof d.rate!=="number"||!Number.isFinite(d.rate)||d.rate<=0)return jsonError("لم يتوفر سعر صالح لزوج العملات المطلوب.",502);
 return NextResponse.json({success:true,base,target,rate:d.rate,date:typeof d.date==="string"?d.date:null,source:"Frankfurter",rateType:"daily_reference",note:"أسعار مرجعية يومية وليست أسعار تداول لحظية."},{headers:CORS_HEADERS});
 }catch(error){console.error("[Nox currency API]",error instanceof Error?error.message:error);return jsonError("تعذر جلب سعر العملة حاليًا. حاول مرة أخرى لاحقًا.",502)}
}