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
      enabled: true,
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
      enabled: true,
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
    text,
    delay: 1200,
  });
}

/**
 * Envia mensagem com botões de resposta rápida.
 * Formato exigido por esta versão da Evolution API: cada botão precisa de
 * `type: "reply"` (não o formato `quick_reply`/`buttonParamsJson` da API oficial).
 */
type EvolutionButton =
  | { type: "reply"; id: string; label: string }
  | { type: "url"; label: string; url: string };

export async function sendEvolutionButtons(
  number: string,
  title: string,
  description: string,
  buttons: Array<EvolutionButton>,
  footerText?: string,
  instanceName: string = INSTANCE_NAME,
  thumbnailUrl?: string
) {
  const formattedNumber = formatPhoneNumber(number);
  const formattedButtons = buttons.map((b) =>
    b.type === "url"
      ? { type: "url", displayText: b.label, url: b.url }
      : { type: "reply", displayText: b.label, id: b.id },
  );

  return callEvolutionAPI(`/message/sendButtons/${instanceName}`, "POST", {
    number: formattedNumber,
    title,
    description,
    footer: footerText || "Smack Chicken",
    buttons: formattedButtons,
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
  });
}

/**
 * Envia uma mensagem "estilo template" com um botão de link (URL) —
 * igual ao rodapé com botão que a Meta usa em mensagens de template,
 * mas aqui via botão nativo do WhatsApp (sem link cru no corpo do texto).
 * `imageUrl` opcional adiciona um cabeçalho de imagem (precisa ser uma URL
 * pública, ex: a própria imagem hospedada em /public no site).
 */
export async function sendEvolutionLinkButton(
  number: string,
  title: string,
  description: string,
  buttonLabel: string,
  url: string,
  footerText?: string,
  instanceName: string = INSTANCE_NAME,
  imageUrl?: string
) {
  return sendEvolutionButtons(
    number,
    title,
    description,
    [{ type: "url", label: buttonLabel, url }],
    footerText,
    instanceName,
    imageUrl,
  );
}

/**
 * Envia mensagem de lista interativa (Menu do Cardápio).
 * Cada linha precisa de `rowId` (não `id`), conforme o DTO desta versão.
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
    sections: sections.map((s) => ({
      title: s.title,
      rows: s.rows.map((r) => ({
        rowId: r.id,
        title: r.title,
        description: r.description || "",
      })),
    })),
  });
}

/**
 * Envia um pino de localização nativo do WhatsApp (sem mostrar link nenhum
 * na mensagem — aparece como o cartão de mapa que o WhatsApp já entende).
 */
export async function sendEvolutionLocation(
  number: string,
  latitude: number,
  longitude: number,
  name?: string,
  address?: string,
  instanceName: string = INSTANCE_NAME
) {
  const formattedNumber = formatPhoneNumber(number);
  return callEvolutionAPI(`/message/sendLocation/${instanceName}`, "POST", {
    number: formattedNumber,
    latitude,
    longitude,
    name,
    address,
  });
}
