import {NextResponse} from "next/server";
import {getHealthPayload} from "@/lib/services/health";
export const dynamic="force-dynamic";
export async function GET(){return NextResponse.json(getHealthPayload(),{headers:{"Cache-Control":"no-store"}})}