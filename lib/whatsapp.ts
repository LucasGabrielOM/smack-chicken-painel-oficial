const WHATSAPP_TOKEN =
  process.env.WHATSAPP_TOKEN ||
  "EAAPqgo9gKJEBSUPjq2NTyUhoVxWUpXstfVba6TqpfKZBit5IBjCLiK6PSia4KvNnBtI5V5MNQZAUQJrcM7mCN6WYz6VKw9yDZCpgcv2O1YCiYDzOPuG55jUcQOvDfxQZATxkqPbQltHkLy7FoagDm348cy2VTcZBpxSuBOBfCdQM3J8tIORg5kfcldglASZCoe7AZDZD";

const WHATSAPP_PHONE_NUMBER_ID =
  process.env.WHATSAPP_PHONE_NUMBER_ID || "1293771987145705";

export const WHATSAPP_VERIFY_TOKEN =
  process.env.WHATSAPP_VERIFY_TOKEN || "smack_chicken_secret_verify_token_2026";

const GRAPH_API_URL = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

export async function callWhatsAppAPI(payload: Record<string, unknown>) {
  try {
    const response = await fetch(GRAPH_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("[WhatsApp API Error]", response.status, data);
    }
    return data;
  } catch (error) {
    console.error("[WhatsApp API Exception]", error);
    throw error;
  }
}

/**
 * Envia uma mensagem simples de texto formatada
 */
export async function sendTextMessage(to: string, text: string) {
  return callWhatsAppAPI({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { preview_url: true, body: text },
  });
}

/**
 * Envia mensagem interativa com até 3 botões (Quick Replies)
 */
export async function sendInteractiveButtons(
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
  headerText?: string,
  footerText?: string
) {
  const interactivePayload: Record<string, unknown> = {
    type: "button",
    body: { text: bodyText },
    action: {
      buttons: buttons.slice(0, 3).map((b) => ({
        type: "reply",
        reply: {
          id: b.id,
          title: b.title.slice(0, 20), // Limite de 20 caracteres por botão na Meta
        },
      })),
    },
  };

  if (headerText) {
    interactivePayload.header = { type: "text", text: headerText };
  }
  if (footerText) {
    interactivePayload.footer = { text: footerText };
  }

  return callWhatsAppAPI({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: interactivePayload,
  });
}

/**
 * Envia mensagem de Lista Interativa (Menu de Categorias / Produtos)
 */
export async function sendInteractiveList(
  to: string,
  bodyText: string,
  buttonText: string,
  sections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>,
  headerText?: string,
  footerText?: string
) {
  const formattedSections = sections.map((sec) => ({
    title: sec.title.slice(0, 24),
    rows: sec.rows.slice(0, 10).map((row) => ({
      id: row.id,
      title: row.title.slice(0, 24),
      description: row.description ? row.description.slice(0, 72) : undefined,
    })),
  }));

  const interactivePayload: Record<string, unknown> = {
    type: "list",
    body: { text: bodyText },
    action: {
      button: buttonText.slice(0, 20),
      sections: formattedSections,
    },
  };

  if (headerText) {
    interactivePayload.header = { type: "text", text: headerText };
  }
  if (footerText) {
    interactivePayload.footer = { text: footerText };
  }

  return callWhatsAppAPI({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: interactivePayload,
  });
}

/**
 * Envia localização geográfica da loja (Estreito - Florianópolis)
 */
export async function sendLocationMessage(
  to: string,
  latitude: number = -27.5855,
  longitude: number = -48.5833,
  name: string = "Smack Chicken",
  address: string = "Estreito, Florianópolis - SC"
) {
  return callWhatsAppAPI({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "location",
    location: {
      latitude,
      longitude,
      name,
      address,
    },
  });
}
