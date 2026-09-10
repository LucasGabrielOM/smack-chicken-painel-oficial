import { NextRequest, NextResponse } from "next/server";
import { WHATSAPP_VERIFY_TOKEN } from "@/lib/whatsapp";
import { handleWhatsAppMessage } from "@/lib/whatsapp-bot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET Handler para validação do Webhook pela Meta
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
    console.log("[WhatsApp Webhook Verified]");
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Token de verificação inválido" }, { status: 403 });
}

/**
 * POST Handler para receber mensagens e interações de clientes no WhatsApp
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as any;

    if (body.object === "whatsapp_business_account") {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value;
          if (value && value.messages && value.messages.length > 0) {
            const message = value.messages[0];
            const from = message.from; // Número do cliente

            // Pega o nome do contato se disponível
            const contact = value.contacts && value.contacts[0];
            const customerName = contact?.profile?.name || "Cliente";

            let messageType = message.type;
            let textBody = "";
            let buttonId = "";
            let listId = "";

            if (messageType === "text") {
              textBody = message.text?.body || "";
            } else if (messageType === "interactive") {
              const interactive = message.interactive;
              if (interactive?.type === "button_reply") {
                buttonId = interactive.button_reply?.id || "";
                textBody = interactive.button_reply?.title || "";
              } else if (interactive?.type === "list_reply") {
                listId = interactive.list_reply?.id || "";
                textBody = interactive.list_reply?.title || "";
              }
            }

            console.log(`[WhatsApp Webhook] De: ${from} (${customerName}) | Tipo: ${messageType} | Texto: ${textBody} | Button: ${buttonId} | List: ${listId}`);

            // Processa a mensagem de forma assíncrona
            await handleWhatsAppMessage({
              from,
              name: customerName,
              type: messageType,
              text: textBody,
              buttonId,
              listId,
            });
          }
        }
      }
    }

    return NextResponse.json({ status: "EVENT_RECEIVED" }, { status: 200 });
  } catch (error) {
    console.error("[WhatsApp Webhook Error]", error);
    return NextResponse.json({ status: "ERROR", error: String(error) }, { status: 500 });
  }
}
