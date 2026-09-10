import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  WASocket,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import path from "path";
import fs from "fs";

const dummyLogger = {
  level: "silent",
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => dummyLogger,
} as any;
import { catalog, formatMoney, CatalogProduct } from "./catalog";
import { transaction } from "./db";

type BaileysSessionState = {
  socket: WASocket | null;
  qrCodeBase64: string | null;
  connectionState: "DISCONNECTED" | "CONNECTING" | "CONNECTED";
  connecting: boolean;
};

const globalState: BaileysSessionState = {
  socket: null,
  qrCodeBase64: null,
  connectionState: "DISCONNECTED",
  connecting: false,
};

const AUTH_DIR = path.join(process.cwd(), "auth_info_baileys");

export function getBaileysStatus() {
  return {
    connectionState: globalState.connectionState,
    qrCodeBase64: globalState.qrCodeBase64,
  };
}

/**
 * Disparo em Massa (Broadcast) para lista de números de WhatsApp
 */
export async function sendBroadcastMessage(numbers: string[], text: string, delayMs: number = 3000) {
  if (!globalState.socket || globalState.connectionState !== "CONNECTED") {
    throw new Error("O robô do WhatsApp não está conectado no momento. Por favor, conecte via QR Code primeiro.");
  }

  const results: Array<{ phone: string; success: boolean; error?: string }> = [];

  for (const phone of numbers) {
    let cleaned = phone.replace(/\D/g, "");
    if (!cleaned.startsWith("55") && (cleaned.length === 10 || cleaned.length === 11)) {
      cleaned = `55${cleaned}`;
    }
    const jid = `${cleaned}@s.whatsapp.net`;

    try {
      await globalState.socket.sendMessage(jid, { text });
      results.push({ phone: cleaned, success: true });
      console.log(`[Broadcast] Mensagem enviada para ${cleaned}`);
    } catch (err: any) {
      console.error(`[Broadcast Error] Falha ao enviar para ${cleaned}:`, err);
      results.push({ phone: cleaned, success: false, error: err?.message || String(err) });
    }

    // Intervalo de segurança anti-spam entre os disparos
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return results;
}

export async function initBaileysService() {
  if (globalState.socket || globalState.connecting) {
    return globalState;
  }

  globalState.connecting = true;
  globalState.connectionState = "CONNECTING";

  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] as [number, number, number] }));

  const sock = makeWASocket({
    version,
    logger: dummyLogger,
    printQRInTerminal: true,
    auth: state,
    browser: ["Smack Chicken Bot", "Chrome", "1.0.0"],
  });

  globalState.socket = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("[Baileys Engine] Novo QR Code gerado!");
      globalState.qrCodeBase64 = await QRCode.toDataURL(qr).catch(() => null);
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[Baileys Engine] Conexão fechada. Reconectar: ${shouldReconnect} (Motivo: ${statusCode})`);

      globalState.socket = null;
      globalState.connecting = false;
      globalState.connectionState = "DISCONNECTED";
      globalState.qrCodeBase64 = null;

      if (shouldReconnect) {
        setTimeout(() => initBaileysService(), 3000);
      }
    } else if (connection === "open") {
      console.log("==========================================");
      console.log("[Baileys Engine] 🎉 BOT CONECTADO COM SUCESSO AO WHATSAPP!");
      console.log("==========================================");
      globalState.connecting = false;
      globalState.connectionState = "CONNECTED";
      globalState.qrCodeBase64 = null;
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    if (m.type !== "notify") return;

    for (const msg of m.messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const remoteJid = msg.key.remoteJid || "";
      const phone = remoteJid.replace(/@.*$/, "").replace(/\D/g, "");
      const customerName = msg.pushName || "Cliente";

      let textInput =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.buttonsResponseMessage?.selectedDisplayText ||
        msg.message.listResponseMessage?.title ||
        "";

      let actionId =
        msg.message.buttonsResponseMessage?.selectedButtonId ||
        msg.message.listResponseMessage?.singleSelectReply?.selectedRowId ||
        "";

      console.log(`[Baileys Bot] De: ${phone} (${customerName}) | Mensagem: "${textInput}" | Action: "${actionId}"`);

      await processUserMessage(sock, remoteJid, phone, customerName, textInput, actionId);
    }
  });

  return globalState;
}

// Estágios das conversas dos clientes em memória
type CustomerState = {
  step: "IDLE" | "CHOOSING_CATEGORY" | "CHOOSING_ITEM" | "WAITING_QUANTITY" | "CHOOSING_DELIVERY" | "WAITING_ADDRESS" | "CHOOSING_PAYMENT";
  currentProduct?: CatalogProduct;
  cart: Array<{ product: CatalogProduct; quantity: number }>;
  deliveryType?: "RETIRADA" | "ENTREGA";
  address?: string;
  paymentMethod?: string;
};

const customerSessions = new Map<string, CustomerState>();

function getCustomerSession(phone: string): CustomerState {
  let session = customerSessions.get(phone);
  if (!session) {
    session = { step: "IDLE", cart: [] };
    customerSessions.set(phone, session);
  }
  return session;
}

async function processUserMessage(
  sock: WASocket,
  remoteJid: string,
  phone: string,
  customerName: string,
  textInput: string,
  actionId: string
) {
  const textClean = textInput.trim().toLowerCase();
  const session = getCustomerSession(phone);

  if (
    textClean === "menu" ||
    textClean === "inicio" ||
    textClean === "início" ||
    textClean === "oi" ||
    textClean === "olá" ||
    textClean === "ola" ||
    actionId === "btn_menu"
  ) {
    session.step = "IDLE";
    session.cart = [];
    return sendWelcomeMenu(sock, remoteJid, customerName);
  }

  if (actionId === "btn_cardapio" || textClean === "cardapio" || textClean === "cardápio" || textClean === "pedido") {
    session.step = "CHOOSING_CATEGORY";
    return sendCategories(sock, remoteJid);
  }

  if (actionId === "btn_info" || textClean.includes("endereço") || textClean.includes("horario")) {
    return sendStoreInfo(sock, remoteJid);
  }

  switch (session.step) {
    case "IDLE": {
      if (actionId.startsWith("cat_") || textClean.includes("balde") || textClean.includes("combo") || textClean.includes("marmita") || textClean.includes("lanche")) {
        const cat = actionId.replace("cat_", "") || "Baldes";
        return sendItemsOfCategory(sock, remoteJid, cat, session);
      }
      return sendWelcomeMenu(sock, remoteJid, customerName);
    }

    case "CHOOSING_CATEGORY": {
      if (actionId.startsWith("cat_")) {
        const cat = actionId.replace("cat_", "");
        return sendItemsOfCategory(sock, remoteJid, cat, session);
      }
      if (textClean.includes("balde")) return sendItemsOfCategory(sock, remoteJid, "Baldes", session);
      if (textClean.includes("combo")) return sendItemsOfCategory(sock, remoteJid, "Combos", session);
      if (textClean.includes("marmita")) return sendItemsOfCategory(sock, remoteJid, "Marmitas", session);
      if (textClean.includes("lanche")) return sendItemsOfCategory(sock, remoteJid, "Lanches", session);
      if (textClean.includes("porção") || textClean.includes("porcao")) return sendItemsOfCategory(sock, remoteJid, "Porções", session);
      if (textClean.includes("bebida")) return sendItemsOfCategory(sock, remoteJid, "Bebidas", session);

      return sendCategories(sock, remoteJid);
    }

    case "CHOOSING_ITEM": {
      if (actionId.startsWith("prod_")) {
        const prodId = Number(actionId.replace("prod_", ""));
        const product = catalog.find((p) => p.id === prodId);
        if (product) {
          session.currentProduct = product;
          session.step = "WAITING_QUANTITY";
          return sock.sendMessage(remoteJid, {
            text: `🍗 *${product.name}*\n💰 Valor: *${formatMoney(product.priceCents)}*\n\n📝 ${product.description}\n\nQuantas unidades deseja pedir? (Digite apenas o número, ex: *1*, *2*, *3*)`,
          });
        }
      }
      return sendCategories(sock, remoteJid);
    }

    case "WAITING_QUANTITY": {
      const qty = parseInt(textClean, 10);
      if (isNaN(qty) || qty <= 0) {
        return sock.sendMessage(remoteJid, { text: "⚠️ Por favor, informe um número válido de unidades (ex: 1, 2, 3)." });
      }
      if (session.currentProduct) {
        session.cart.push({ product: session.currentProduct, quantity: qty });
      }
      session.step = "IDLE";
      const summary = formatCartSummary(session.cart);
      return sock.sendMessage(remoteJid, {
        text: `✅ *Item adicionado com sucesso!*\n\n${summary}\n\nDigite *CARDAPIO* para adicionar mais itens ou *FINALIZAR* para concluir seu pedido.`,
      });
    }

    default:
      return sendWelcomeMenu(sock, remoteJid, customerName);
  }
}

async function sendWelcomeMenu(sock: WASocket, remoteJid: string, name: string) {
  const text =
    `Olá, *${name}*! 👋 Seja muito bem-vindo(a) à *SMACK CHICKEN* — Frango Frito no Balde crocante no Estreito (Florianópolis)! 🍗🔥\n\n` +
    `Escolha como deseja ser atendido(a):\n\n` +
    `1️⃣ Digite *CARDAPIO* para ver o cardápio e fazer pedidos\n` +
    `2️⃣ Digite *LOJA* para ver endereço e horários de funcionamento\n` +
    `3️⃣ Digite *ATENDENTE* para falar com nossa equipe`;

  return sock.sendMessage(remoteJid, { text });
}

async function sendCategories(sock: WASocket, remoteJid: string) {
  const text =
    `📜 *CARDÁPIO SMACK CHICKEN*\n\n` +
    `Digite o nome ou o número da categoria desejada:\n\n` +
    `1. *BALDES* — Baldes P, M e G (Tiras ou Coxinhas crocantes)\n` +
    `2. *COMBOS* — Combos para 2 pessoas, Galera ou Família\n` +
    `3. *MARMITAS* — Marmita Smack 600g completa\n` +
    `4. *LANCHES* — Smack Original, Fresh, Power e Kids\n` +
    `5. *PORÇÕES* — Batatas Fritas e Polentas Fritas\n` +
    `6. *BEBIDAS* — Refrigerantes, Cervejas e Energéticos`;

  return sock.sendMessage(remoteJid, { text });
}

async function sendItemsOfCategory(sock: WASocket, remoteJid: string, category: string, session: CustomerState) {
  session.step = "CHOOSING_ITEM";
  const items = catalog.filter((p) => p.category.toLowerCase() === category.toLowerCase());

  if (!items.length) {
    return sock.sendMessage(remoteJid, { text: "Nenhum item encontrado nesta categoria." });
  }

  const lines = items.map((p) => `*#${p.id}* — ${p.name} (*${formatMoney(p.priceCents)}*)\n_${p.description}_`);
  const text = `🍗 *${category.toUpperCase()} — SMACK CHICKEN*\n\n${lines.join("\n\n")}\n\nPara escolher um item, digite o número da tag (ex: *#1*, *#2*, *#52*):`;

  return sock.sendMessage(remoteJid, { text });
}

async function sendStoreInfo(sock: WASocket, remoteJid: string) {
  const text =
    `📍 *SMACK CHICKEN — Endereço & Horários*\n\n` +
    `🏢 *Localização:* Rua General Liberato Bittencourt, Estreito, Florianópolis - SC\n` +
    `🗺️ *Google Maps:* https://maps.app.goo.gl/f6Rk7JtTgcCMzCSr9\n` +
    `🛵 *iFood:* https://www.ifood.com.br/delivery/florianopolis-sc/smack-chicken-frango-frito-no-balde-estreito/93484d61-4553-4caf-b136-d1a0f5e73ecf\n` +
    `📸 *Instagram:* @smack.chicken\n\n` +
    `⏰ *Horário:* Todos os dias das 11:00 às 23:00\n\n` +
    `Digite *MENU* para voltar ao início.`;

  return sock.sendMessage(remoteJid, { text });
}

function formatCartSummary(cart: Array<{ product: CatalogProduct; quantity: number }>) {
  if (!cart.length) return "Seu carrinho está vazio.";
  let totalCents = 0;
  const lines = cart.map((item, idx) => {
    const itemTotal = item.product.priceCents * item.quantity;
    totalCents += itemTotal;
    return `${idx + 1}. *${item.quantity}x ${item.product.name}* — ${formatMoney(itemTotal)}`;
  });
  return `🛍️ *Resumo do Carrinho:*\n${lines.join("\n")}\n\n💰 *Total: ${formatMoney(totalCents)}*`;
}
