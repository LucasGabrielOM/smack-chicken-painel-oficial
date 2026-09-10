import { sendEvolutionText } from "./evolution";

/**
 * Bot de triagem do WhatsApp (Evolution API).
 *
 * Não faz mais pedido dentro do chat — só direciona o cliente:
 * 1) link do site de pedidos online, 2) horário/endereço, 3) atendente humano.
 * O pedido em si acontece no site (`smack-chicken-pedidos`), que fica separado.
 */

const ORDER_LINK = "https://smack-chicken-pedidos.lucasgabrielwww2218.workers.dev/";
const MAPS_LINK =
  "https://www.google.com/maps/place/SMACK+CHIKEN/@-27.5879265,-48.5799352,17z/data=!4m6!3m5!1s0x9527379af9edc3fd:0x2a9689e00f3ff563!8m2!3d-27.5879265!4d-48.5773603!16s%2Fg%2F11ntnfqg6n";
const STORE_HOURS = "Todos os dias das 11:00 às 23:00";

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
    return sendOrderLink(phone);
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
      `👨‍🍳 *Atendimento Humano — Smack Chicken*\n\nJá notifiquei nossa equipe! Um de nossos atendentes entrará em contato com você neste número em instantes.\n\nPara voltar ao atendimento automático a qualquer momento, digite *MENU*.`,
    );
  }

  // Enquanto está com atendente humano, o bot fica quieto (não interrompe a conversa).
  if (state.step === "HUMAN_ATTENDANT") return;

  return sendWelcomeMenu(phone, customerName);
}

export async function sendWelcomeMenu(phone: string, name: string) {
  return sendEvolutionText(
    phone,
    `Olá, *${name}*! 👋 Seja muito bem-vindo(a) à *SMACK CHICKEN* — Frango Frito no Balde crocante no Estreito (Florianópolis)! 🍗🔥\n\n` +
      `Digite o *número* da opção que deseja:\n\n` +
      `1️⃣ Ver cardápio e fazer pedido\n` +
      `2️⃣ Horário de funcionamento e endereço\n` +
      `3️⃣ Falar com atendente`,
  );
}

export async function sendOrderLink(phone: string) {
  return sendEvolutionText(
    phone,
    `🍗 *Cardápio & Pedidos — Smack Chicken*\n\nFaça seu pedido direto pelo nosso site, é rápido e você acompanha tudo por lá:\n\n${ORDER_LINK}\n\nDigite *MENU* pra voltar às opções.`,
  );
}

export async function sendStoreInfo(phone: string) {
  const text =
    `📍 *SMACK CHICKEN — Endereço & Horários*\n\n` +
    `🏢 *Localização:* Rua General Liberato Bittencourt, Estreito, Florianópolis - SC\n` +
    `🗺️ *Google Maps:* ${MAPS_LINK}\n\n` +
    `⏰ *Horário de Funcionamento:* ${STORE_HOURS}\n\n` +
    `Digite *MENU* a qualquer momento para voltar ao atendimento inicial.`;

  return sendEvolutionText(phone, text);
}
