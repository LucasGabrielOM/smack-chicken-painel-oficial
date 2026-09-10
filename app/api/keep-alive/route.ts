import { NextRequest, NextResponse } from "next/server";
import { startKeepAlivePing } from "@/lib/keep-alive";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  startKeepAlivePing(4); // Inicia ping a cada 4 minutos

  const targetUrl = process.env.EVOLUTION_API_URL || "https://smack-evolution.onrender.com";

  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: { "User-Agent": "SmackChickenKeepAlive/1.0" },
    });
    const data = await res.json().catch(() => ({}));

    return NextResponse.json({
      status: "KEEP_ALIVE_ACTIVE",
      targetUrl,
      httpStatus: res.status,
      response: data,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({
      status: "KEEP_ALIVE_ACTIVE",
      targetUrl,
      error: String(err),
      timestamp: new Date().toISOString(),
    });
  }
}
