const EVOLUTION_API_URL =
  process.env.EVOLUTION_API_URL || "https://smack-evolution.onrender.com";

const EVOLUTION_API_KEY =
  process.env.EVOLUTION_API_KEY || "c18ee9d461f8cbe87885585a06d3d680514f314aa8b11cb1";

const INSTANCE_NAME =
  process.env.EVOLUTION_INSTANCE || "smack-chicken";

function siteUrl() {
  return (
    process.env.SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "https://smack-chicken.vercel.app"
  );
}

function webhookUrl() {
  return `${siteUrl().replace(/\/$/, "")}/api/webhook/evolution`;
}

/**
 * Chamador genérico para a Evolution API
 */
export async function callEvolutionAPI(
  endpoint: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: Record<string, unknown>
) {
  const url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("[Evolution API Error]", response.status, data);
    }
    return data;
  } catch (error) {
    console.warn("[Evolution API Exception — Servidor pode estar offline]", (error as any)?.message || error);
    return { error: true, details: String(error) };
  }
}

/**
 * Cria a instância do WhatsApp na Evolution API se ela não existir, já
 * configurando o webhook pra este site receber as mensagens.
 */
export async function createEvolutionInstance(instanceName: string = INSTANCE_NAME) {
  return callEvolutionAPI("/instance/create", "POST", {
    instanceName,
    qrcode: true,
    integration: "WHATSAPP-BAILEYS",
    webhook: {
      url: webhookUrl(),
      byEvents: false,
      base64: true,
      events: ["MESSAGES_UPSERT"],
    },
  });
}

/**
 * Configura (ou reconfigura) o webhook de uma instância já existente.
 * Chamado sempre que conectamos, pra garantir que aponta pro site certo
 * mesmo que a instância já existisse antes com outra URL.
 */
export async function setEvolutionWebhook(instanceName: string = INSTANCE_NAME) {
  return callEvolutionAPI(`/webhook/set/${instanceName}`, "POST", {
    webhook: {
      url: webhookUrl(),
      byEvents: false,
      base64: true,
      events: ["MESSAGES_UPSERT"],
    },
  });
}

/**
 * Obtém o QR Code ou Estado de Conexão da instância
 */
export async function getEvolutionQRCode(instanceName: string = INSTANCE_NAME) {
  return callEvolutionAPI(`/instance/connect/${instanceName}`, "GET");
}

/**
 * Verifica o status de conexão da instância
 */
export async function getEvolutionState(instanceName: string = INSTANCE_NAME) {
  return callEvolutionAPI(`/instance/connectionState/${instanceName}`, "GET");
}

/**
 * Formata o número para o padrão internacional do WhatsApp (e.g., 5548999999999)
 */
export function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (!cleaned.startsWith("55") && (cleaned.length === 10 || cleaned.length === 11)) {
    cleaned = `55${cleaned}`;
  }
  return cleaned;
}

/**
 * Envia uma mensagem de texto simples
 */
export async function sendEvolutionText(
  number: string,
  text: string,
  instanceName: string = INSTANCE_NAME
) {
  const formattedNumber = formatPhoneNumber(number);
  return callEvolutionAPI(`/message/sendText/${instanceName}`, "POST", {
    number: formattedNumber,
    options: {
      delay: 1200,
      presence: "composing",
    },
    text,
  });
}

/**
 * Envia mensagem com botões de resposta rápida
 */
export async function sendEvolutionButtons(
  number: string,
  title: string,
  description: string,
  buttons: Array<{ id: string; label: string }>,
  footerText?: string,
  instanceName: string = INSTANCE_NAME
) {
  const formattedNumber = formatPhoneNumber(number);
  const formattedButtons = buttons.map((b) => ({
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: b.label,
      id: b.id,
    }),
  }));

  return callEvolutionAPI(`/message/sendButtons/${instanceName}`, "POST", {
    number: formattedNumber,
    title,
    description,
    footer: footerText || "Smack Chicken",
    buttons: formattedButtons,
  });
}

/**
 * Envia mensagem de lista interativa (Menu do Cardápio)
 */
export async function sendEvolutionList(
  number: string,
  title: string,
  description: string,
  buttonText: string,
  sections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>,
  footerText?: string,
  instanceName: string = INSTANCE_NAME
) {
  const formattedNumber = formatPhoneNumber(number);
  return callEvolutionAPI(`/message/sendList/${instanceName}`, "POST", {
    number: formattedNumber,
    title,
    description,
    buttonText,
    footerText: footerText || "Smack Chicken",
    sections,
  });
}
