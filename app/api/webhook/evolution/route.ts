import { NextRequest, NextResponse } from "next/server";
import { handleEvolutionWebhook } from "@/lib/evolution-bot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Webhook POST Handler para a Evolution API
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as any;
    console.log("[Evolution Webhook Event]", body?.event || "UNKNOWN");

    // Processa a mensagem do Evolution Bot
    await handleEvolutionWebhook(body);

    return NextResponse.json({ status: "SUCCESS" }, { status: 200 });
  } catch (error) {
    console.error("[Evolution Webhook Error]", error);
    return NextResponse.json({ status: "ERROR", error: String(error) }, { status: 500 });
  }
}
