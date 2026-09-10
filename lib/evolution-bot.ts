import { sendEvolutionText, sendEvolutionLocation, sendEvolutionImage } from "./evolution";

/**
 * Bot de triagem do WhatsApp (Evolution API).
 *
 * Não faz mais pedido dentro do chat — só direciona o cliente:
 * 1) link do site de pedidos online, 2) horário/endereço (com pino de
 *    localização nativo do WhatsApp, sem link cru), 3) atendente humano.
 * O pedido em si acontece no site (`smack-chicken-pedidos`), que fica separado.
 */

const SITE_URL = process.env.SITE_URL || "https://smack-chicken.vercel.app";
// Link curto e com a cara da marca (redireciona pro site de pedidos) em vez
// do endereço bruto do workers.dev na legenda da mensagem.
const ORDER_LINK = `${SITE_URL}/pedido`;
const HEADER_IMAGE_URL = `${SITE_URL}/lanches-destaque.jpg`;
const STORE_NAME = "Smack Chicken";
const STORE_ADDRESS = "R. Fúlvio Aducci, 1074 - Estreito, Florianópolis - SC, 88075-000";
const STORE_LAT = -27.5879265;
const STORE_LNG = -48.5773603;
const STORE_HOURS = "Todos os dias das 17:00 às 23:00";

type UserState = { step: "IDLE" | "HUMAN_ATTENDANT"; lastActive: number };

// Armazenamento em memória do estado dos clientes (só controla o modo atendente humano).
const userSessions = new Map<string, UserState>();

function getOrCreateState(phone: string): UserState {
  const existing = userSessions.get(phone);
  if (existing) {
    existing.lastActive = Date.now();
    return existing;
  }
  const newState: UserState = { step: "IDLE", lastActive: Date.now() };
  userSessions.set(phone, newState);
  return newState;
}

export async function handleEvolutionWebhook(webhookBody: any) {
  const event = webhookBody?.event;
  if (event !== "messages.upsert" && event !== "MESSAGES_UPSERT") {
    return;
  }

  const data = webhookBody?.data;
  if (!data || data.key?.fromMe) {
    return; // Ignora mensagens enviadas pelo próprio bot
  }

  const remoteJid = data.key?.remoteJid || "";
  const phone = remoteJid.replace(/@.*$/, "").replace(/\D/g, "");
  if (!phone) return;

  const customerName = data.pushName || "Cliente";
  const messageObj = data.message || {};

  const textInput: string =
    messageObj.conversation || messageObj.extendedTextMessage?.text || "";
  const textClean = textInput.trim().toLowerCase();
  console.log(`[Evolution Bot] De: ${phone} (${customerName}) | Texto: "${textClean}"`);

  const state = getOrCreateState(phone);

  const isGreeting = ["oi", "olá", "ola", "menu", "inicio", "início", "oii", "ei"].includes(
    textClean,
  );

  if (isGreeting) {
    state.step = "IDLE";
    return sendWelcomeMenu(phone, customerName);
  }

  if (textClean === "1" || textClean.includes("cardap") || textClean.includes("pedido")) {
    state.step = "IDLE";
    return sendOrderLink(phone, customerName);
  }

  if (
    textClean === "2" ||
    textClean.includes("horario") ||
    textClean.includes("horário") ||
    textClean.includes("endereco") ||
    textClean.includes("endereço") ||
    textClean.includes("mapa") ||
    textClean.includes("localiza")
  ) {
    state.step = "IDLE";
    return sendStoreInfo(phone);
  }

  if (textClean === "3" || textClean.includes("atendente") || textClean.includes("humano")) {
    state.step = "HUMAN_ATTENDANT";
    return sendEvolutionText(
      phone,
      `👩‍🍳 *Falar com um atendente*\n\n` +
        `Perfeito! Já avisamos nossa equipe por aqui — em instantes alguém vai continuar seu atendimento neste mesmo número. 💬\n\n` +
        `_Digite *MENU* a qualquer momento para voltar ao atendimento automático._`,
    );
  }

  // Enquanto está com atendente humano, o bot fica quieto (não interrompe a conversa).
  if (state.step === "HUMAN_ATTENDANT") return;

  return sendWelcomeMenu(phone, customerName);
}

export async function sendWelcomeMenu(phone: string, name: string) {
  return sendEvolutionText(
    phone,
    `🍗 *Bem-vindo(a) à Smack Chicken, ${name}!*\n\n` +
      `Frango crocante feito na hora, do nosso jeito. Como podemos te ajudar hoje?\n\n` +
      `Digite o *número* da opção desejada:\n\n` +
      `1️⃣ Ver cardápio e fazer pedido\n` +
      `2️⃣ Horário de funcionamento e endereço\n` +
      `3️⃣ Falar com um atendente`,
  );
}

export async function sendOrderLink(phone: string, name: string = "Cliente") {
  const caption =
    `🍗 *Cardápio & Pedidos*\n\n` +
    `Oi, *${name}*! Agora dá pra pedir seu Smack Chicken direto pelo nosso site — rápido, sem intermediários e você acompanha tudo em tempo real.\n\n` +
    `Baldes crocantes, lanches, marmitas e muito mais esperando por você. 🔥\n\n` +
    `👉 *Faça seu pedido:*\n${ORDER_LINK}\n\n` +
    `_Digite *MENU* a qualquer momento para voltar às opções._`;

  return sendEvolutionImage(phone, HEADER_IMAGE_URL, caption);
}

export async function sendStoreInfo(phone: string) {
  // Pino de localização nativo (o WhatsApp já mostra o mapa, sem link cru).
  await sendEvolutionLocation(phone, STORE_LAT, STORE_LNG, STORE_NAME, STORE_ADDRESS);

  const text =
    `📍 *Endereço & Horários — Smack Chicken*\n\n` +
    `🏠 ${STORE_ADDRESS}\n` +
    `⏰ ${STORE_HOURS}\n\n` +
    `Te esperamos por lá! 🍗\n\n` +
    `_Digite *MENU* a qualquer momento para voltar às opções._`;

  return sendEvolutionText(phone, text);
}
