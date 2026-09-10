import { catalog, formatMoney, CatalogProduct } from "./catalog";
import {
  sendEvolutionText,
  sendEvolutionButtons,
  sendEvolutionList,
} from "./evolution";
import { transaction } from "./db";

type UserState = {
  step:
    | "IDLE"
    | "CHOOSING_CATEGORY"
    | "CHOOSING_ITEM"
    | "WAITING_QUANTITY"
    | "CHOOSING_DELIVERY"
    | "WAITING_ADDRESS"
    | "CHOOSING_PAYMENT"
    | "HUMAN_ATTENDANT";
  currentProduct?: CatalogProduct;
  cart: Array<{ product: CatalogProduct; quantity: number }>;
  deliveryType?: "RETIRADA" | "ENTREGA";
  address?: string;
  paymentMethod?: string;
  lastActive: number;
};

// Armazenamento em memória do estado dos clientes
const userSessions = new Map<string, UserState>();

function getOrCreateState(phone: string): UserState {
  const existing = userSessions.get(phone);
  if (existing) {
    existing.lastActive = Date.now();
    return existing;
  }
  const newState: UserState = {
    step: "IDLE",
    cart: [],
    lastActive: Date.now(),
  };
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

  // Extrai o texto ou ação do botão/lista
  let textInput = "";
  let actionId = "";

  if (messageObj.conversation) {
    textInput = messageObj.conversation;
  } else if (messageObj.extendedTextMessage?.text) {
    textInput = messageObj.extendedTextMessage.text;
  } else if (messageObj.buttonsResponseMessage?.selectedButtonId) {
    actionId = messageObj.buttonsResponseMessage.selectedButtonId;
    textInput = messageObj.buttonsResponseMessage.selectedDisplayText || "";
  } else if (messageObj.listResponseMessage?.singleSelectReply?.selectedRowId) {
    actionId = messageObj.listResponseMessage.singleSelectReply.selectedRowId;
    textInput = messageObj.listResponseMessage.title || "";
  }

  const textClean = textInput.trim().toLowerCase();
  console.log(`[Evolution Bot] De: ${phone} (${customerName}) | Texto: "${textClean}" | Action: "${actionId}"`);

  const state = getOrCreateState(phone);

  // Comandos de atalho global
  if (
    textClean === "menu" ||
    textClean === "inicio" ||
    textClean === "início" ||
    textClean === "oi" ||
    textClean === "olá" ||
    textClean === "ola" ||
    actionId === "btn_menu_principal"
  ) {
    state.step = "IDLE";
    state.cart = [];
    return sendWelcomeMenu(phone, customerName);
  }

  if (actionId === "btn_atendente" || textClean === "atendente" || textClean === "humano") {
    state.step = "HUMAN_ATTENDANT";
    return sendEvolutionText(
      phone,
      `👨‍🍳 *Atendimento Humano — Smack Chicken*\n\nJá notifiquei nossa equipe! Um de nossos atendentes entrará em contato com você neste número em instantes.\n\nPara voltar ao atendimento automático a qualquer momento, digite *MENU*.`
    );
  }

  if (
    actionId === "btn_loja_info" ||
    textClean === "endereço" ||
    textClean === "endereco" ||
    textClean === "horario" ||
    textClean === "horário"
  ) {
    return sendStoreInfo(phone);
  }

  if (
    actionId === "btn_cardapio" ||
    actionId === "btn_pedido" ||
    textClean === "cardapio" ||
    textClean === "cardápio" ||
    textClean === "pedido"
  ) {
    state.step = "CHOOSING_CATEGORY";
    return sendCategoryList(phone);
  }

  // --- FLUXO DA MÁQUINA DE ESTADOS ---
  switch (state.step) {
    case "IDLE": {
      if (actionId.startsWith("cat_")) {
        const categoryName = actionId.replace("cat_", "");
        return sendItemsOfCategory(phone, categoryName, state);
      }
      return sendWelcomeMenu(phone, customerName);
    }

    case "CHOOSING_CATEGORY": {
      if (actionId.startsWith("cat_")) {
        const categoryName = actionId.replace("cat_", "");
        return sendItemsOfCategory(phone, categoryName, state);
      }
      if (textClean.includes("balde")) return sendItemsOfCategory(phone, "Baldes", state);
      if (textClean.includes("combo")) return sendItemsOfCategory(phone, "Combos", state);
      if (textClean.includes("marmita")) return sendItemsOfCategory(phone, "Marmitas", state);
      if (textClean.includes("lanche")) return sendItemsOfCategory(phone, "Lanches", state);
      if (textClean.includes("porção") || textClean.includes("porcao")) return sendItemsOfCategory(phone, "Porções", state);
      if (textClean.includes("bebida")) return sendItemsOfCategory(phone, "Bebidas", state);

      return sendCategoryList(phone);
    }

    case "CHOOSING_ITEM": {
      if (actionId.startsWith("prod_")) {
        const prodId = Number(actionId.replace("prod_", ""));
        const product = catalog.find((p) => p.id === prodId);
        if (product) {
          state.currentProduct = product;
          state.step = "WAITING_QUANTITY";
          return sendEvolutionText(
            phone,
            `🍗 *${product.name}*\n💰 Valor: *${formatMoney(product.priceCents)}*\n\n📝 ${product.description}\n\nQuantas unidades você deseja pedir? (Digite apenas o número, ex: *1*, *2*, *3*)`
          );
        }
      }
      return sendCategoryList(phone);
    }

    case "WAITING_QUANTITY": {
      const qty = parseInt(textClean, 10);
      if (isNaN(qty) || qty <= 0) {
        return sendEvolutionText(phone, "⚠️ Por favor, digite um número válido de unidades (ex: 1, 2, 3).");
      }
      if (state.currentProduct) {
        state.cart.push({ product: state.currentProduct, quantity: qty });
      }

      state.step = "IDLE";
      const cartSummary = formatCartSummary(state.cart);

      return sendEvolutionButtons(
        phone,
        "Smack Chicken — Carrinho",
        `✅ *Item adicionado!*\n\n${cartSummary}\n\nO que deseja fazer agora?`,
        [
          { id: "btn_cardapio", label: "➕ Adicionar Mais" },
          { id: "btn_finalizar_pedido", label: "🛒 Finalizar Pedido" },
          { id: "btn_menu_principal", label: "🏠 Menu Inicial" },
        ]
      );
    }

    case "CHOOSING_DELIVERY": {
      if (actionId === "delivery_retirada" || textClean.includes("retirada") || textClean.includes("buscar")) {
        state.deliveryType = "RETIRADA";
        state.address = "Retirada no Balcão (Estreito)";
        state.step = "CHOOSING_PAYMENT";
        return sendPaymentOptions(phone);
      }
      if (actionId === "delivery_entrega" || textClean.includes("entrega") || textClean.includes("tele")) {
        state.deliveryType = "ENTREGA";
        state.step = "WAITING_ADDRESS";
        return sendEvolutionText(
          phone,
          "🛵 *Tele-Entrega Smack Chicken*\n\nPor favor, informe seu *Endereço Completo de Entrega* (Rua, Número, Bairro e Ponto de Referência):"
        );
      }
      return sendDeliveryOptions(phone);
    }

    case "WAITING_ADDRESS": {
      if (textClean.length < 5) {
        return sendEvolutionText(phone, "⚠️ Por favor, digite o endereço completo com rua e número.");
      }
      state.address = textInput.trim();
      state.step = "CHOOSING_PAYMENT";
      return sendPaymentOptions(phone);
    }

    case "CHOOSING_PAYMENT": {
      let selectedPayment = "";
      if (actionId === "pay_pix" || textClean.includes("pix")) selectedPayment = "PIX";
      if (actionId === "pay_card" || textClean.includes("cartão") || textClean.includes("cartao")) selectedPayment = "Cartão (Entrega)";
      if (actionId === "pay_cash" || textClean.includes("dinheiro")) selectedPayment = "Dinheiro";

      if (!selectedPayment) {
        return sendPaymentOptions(phone);
      }

      state.paymentMethod = selectedPayment;
      return createAndConfirmOrder(phone, customerName, state);
    }

    default:
      return sendWelcomeMenu(phone, customerName);
  }
}

// --- MENSAGENS AUXILIARES ---

export async function sendWelcomeMenu(phone: string, name: string) {
  return sendEvolutionButtons(
    phone,
    "Smack Chicken — Atendimento Oficial",
    `Olá, *${name}*! 👋 Seja muito bem-vindo(a) à *SMACK CHICKEN* — Frango Frito no Balde crocante no Estreito (Florianópolis)! 🍗🔥\n\nComo podemos te atender hoje?`,
    [
      { id: "btn_cardapio", label: "📜 Ver Cardápio" },
      { id: "btn_loja_info", label: "📍 Endereço/Horário" },
      { id: "btn_atendente", label: "👤 Atendente Humano" },
    ]
  );
}

export async function sendCategoryList(phone: string) {
  return sendEvolutionList(
    phone,
    "Cardápio Smack Chicken",
    "Selecione uma categoria abaixo para visualizar os itens:",
    "Ver Categoria",
    [
      {
        title: "Categorias do Cardápio",
        rows: [
          { id: "cat_Baldes", title: "🍗 Baldes de Frango", description: "Baldes P, M e G (Tiras ou Coxinhas crocantes)" },
          { id: "cat_Combos", title: "🔥 Combos Especiais", description: "Combos para 2 pessoas, Galera ou Família" },
          { id: "cat_Marmitas", title: "🍱 Marmita Smack 600g", description: "Almoço completo bem servido com sassami crocante" },
          { id: "cat_Lanches", title: "🍔 Lanches Crocantes", description: "Smack Original, Fresh, Power e Kids" },
          { id: "cat_Porções", title: "🍟 Porções e Molhos", description: "Batatas, Polentas e Molhos da Casa" },
          { id: "cat_Bebidas", title: "🥤 Bebidas & Energéticos", description: "Refrigerantes, Cervejas Long Neck e Energéticos" },
        ],
      },
    ]
  );
}

export async function sendItemsOfCategory(phone: string, category: string, state: UserState) {
  state.step = "CHOOSING_ITEM";
  const items = catalog.filter((p) => p.category.toLowerCase() === category.toLowerCase());

  if (!items.length) {
    return sendEvolutionText(phone, "Nenhum item encontrado nesta categoria.");
  }

  const rows = items.map((p) => ({
    id: `prod_${p.id}`,
    title: p.name,
    description: `${formatMoney(p.priceCents)} — ${p.description}`,
  }));

  return sendEvolutionList(
    phone,
    `Smack Chicken — ${category}`,
    `Confira os itens da categoria *${category}*:`,
    "Escolher Item",
    [{ title: category, rows }]
  );
}

export async function sendDeliveryOptions(phone: string) {
  return sendEvolutionButtons(
    phone,
    "Forma de Entrega",
    "Como você prefere receber o seu pedido?",
    [
      { id: "delivery_retirada", label: "🛍️ Retirada Balcão" },
      { id: "delivery_entrega", label: "🛵 Tele-Entrega" },
    ]
  );
}

export async function sendPaymentOptions(phone: string) {
  return sendEvolutionButtons(
    phone,
    "Forma de Pagamento",
    "Qual será a sua forma de pagamento?",
    [
      { id: "pay_pix", label: "⚡ PIX" },
      { id: "pay_card", label: "💳 Cartão na Entrega" },
      { id: "pay_cash", label: "💵 Dinheiro" },
    ]
  );
}

export async function sendStoreInfo(phone: string) {
  const text =
    `📍 *SMACK CHICKEN — Endereço & Horários*\n\n` +
    `🏢 *Localização:* Rua General Liberato Bittencourt, Estreito, Florianópolis - SC\n` +
    `🗺️ *Google Maps:* https://maps.app.goo.gl/f6Rk7JtTgcCMzCSr9\n` +
    `🛵 *iFood:* https://www.ifood.com.br/delivery/florianopolis-sc/smack-chicken-frango-frito-no-balde-estreito/93484d61-4553-4caf-b136-d1a0f5e73ecf\n` +
    `📸 *Instagram:* @smack.chicken\n\n` +
    `⏰ *Horário de Funcionamento:* Todos os dias das 11:00 às 23:00\n\n` +
    `Digite *MENU* a qualquer momento para voltar ao atendimento inicial.`;

  return sendEvolutionText(phone, text);
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

async function createAndConfirmOrder(phone: string, customerName: string, state: UserState) {
  if (!state.cart.length) {
    state.step = "IDLE";
    return sendEvolutionText(phone, "⚠️ Seu carrinho está vazio. Adicione itens antes de finalizar.");
  }

  let totalCents = 0;
  const dbItems = state.cart.map((item) => {
    totalCents += item.product.priceCents * item.quantity;
    return {
      productId: item.product.id,
      name: item.product.name,
      quantity: item.quantity,
      unitPriceCents: item.product.priceCents,
    };
  });

  const orderCode = `EVO-${Math.floor(1000 + Math.random() * 9000)}`;
  const notes = `[Evolution Bot] Entrega: ${state.deliveryType || "N/I"} | Endereço: ${state.address || "Balcão"} | Tel: ${phone}`;

  try {
    await transaction(async (client) => {
      const insertedOrder = await client.query<{ id: string }>(
        `INSERT INTO orders (code, customer_name, status, payment_method, total_cents, channel, notes)
         VALUES ($1, $2, 'preparing', $3, $4, 'WHATSAPP_EVOLUTION', $5) RETURNING id`,
        [orderCode, customerName, state.paymentMethod || "PIX", totalCents, notes]
      );
      const orderId = insertedOrder.rows[0].id;

      for (const item of dbItems) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price_cents)
           VALUES ($1, $2, $3, $4, $5)`,
          [orderId, item.productId, item.name, item.quantity, item.unitPriceCents]
        );
      }
    });

    const summaryText =
      `🎉 *PEDIDO CONFIRMADO COM SUCESSO!*\n\n` +
      `📌 *Código do Pedido:* #${orderCode}\n` +
      `👤 *Cliente:* ${customerName}\n` +
      `🛵 *Tipo:* ${state.deliveryType === "ENTREGA" ? "Tele-Entrega" : "Retirada no Balcão"}\n` +
      `📍 *Endereço:* ${state.address || "Balcão - Estreito"}\n` +
      `💳 *Pagamento:* ${state.paymentMethod}\n\n` +
      `${formatCartSummary(state.cart)}\n\n` +
      `⏱️ *Tempo estimado de preparo:* 20 a 35 minutos.\n\n` +
      `Muito obrigado por pedir na *Smack Chicken*! Bom apetite! 🍗✨`;

    state.step = "IDLE";
    state.cart = [];

    return sendEvolutionText(phone, summaryText);
  } catch (err) {
    console.error("Erro ao criar pedido via Evolution Bot:", err);
    state.step = "IDLE";
    state.cart = [];
    return sendEvolutionText(phone, `🎉 *PEDIDO REGISTRADO!* Código: #${orderCode}. Agradecemos o seu pedido! 🍗`);
  }
}
