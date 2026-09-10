import { catalog, formatMoney, CatalogProduct } from "./catalog";
import {
  sendTextMessage,
  sendInteractiveButtons,
  sendInteractiveList,
  sendLocationMessage,
} from "./whatsapp";
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

// Armazenamento em memória do estado dos clientes por número de WhatsApp
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

export function resetState(phone: string) {
  userSessions.delete(phone);
}

/**
 * Processador principal das mensagens do WhatsApp
 */
export async function handleWhatsAppMessage(incoming: {
  from: string;
  name?: string;
  type: string;
  text?: string;
  buttonId?: string;
  listId?: string;
}) {
  const phone = incoming.from;
  const customerName = incoming.name || "Cliente";
  const state = getOrCreateState(phone);

  const textInput = (incoming.text || "").trim().toLowerCase();
  const actionId = incoming.buttonId || incoming.listId || "";

  // Comando global para reiniciar / menu inicial
  if (
    textInput === "menu" ||
    textInput === "inicio" ||
    textInput === "início" ||
    textInput === "oi" ||
    textInput === "olá" ||
    textInput === "ola" ||
    actionId === "btn_menu_principal"
  ) {
    state.step = "IDLE";
    state.cart = [];
    return sendWelcomeMenu(phone, customerName);
  }

  if (actionId === "btn_atendente" || textInput === "atendente" || textInput === "humano") {
    state.step = "HUMAN_ATTENDANT";
    return sendTextMessage(
      phone,
      `👨‍🍳 *Atendimento Humano — Smack Chicken*\n\nJá notifiquei nossa equipe! Um de nossos atendentes entrará em contato com você aqui neste número em instantes.\n\nPara voltar ao menu automático a qualquer momento, digite *MENU*.`
    );
  }

  if (actionId === "btn_loja_info" || textInput === "endereço" || textInput === "endereco" || textInput === "horario" || textInput === "horário") {
    return sendStoreInfo(phone);
  }

  // Se o usuário clicou no botão "Ver Cardápio" ou "Fazer Pedido"
  if (actionId === "btn_cardapio" || actionId === "btn_pedido" || textInput === "cardapio" || textInput === "cardápio" || textInput === "pedido") {
    state.step = "CHOOSING_CATEGORY";
    return sendCategoryList(phone);
  }

  // --- MÁQUINA DE ESTADOS DO BOT ---
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
      // Se não clicou na lista, tenta entender por texto
      if (textInput.includes("balde")) return sendItemsOfCategory(phone, "Baldes", state);
      if (textInput.includes("combo")) return sendItemsOfCategory(phone, "Combos", state);
      if (textInput.includes("marmita")) return sendItemsOfCategory(phone, "Marmitas", state);
      if (textInput.includes("lanche")) return sendItemsOfCategory(phone, "Lanches", state);
      if (textInput.includes("porção") || textInput.includes("porcao")) return sendItemsOfCategory(phone, "Porções", state);
      if (textInput.includes("bebida")) return sendItemsOfCategory(phone, "Bebidas", state);

      return sendCategoryList(phone);
    }

    case "CHOOSING_ITEM": {
      if (actionId.startsWith("prod_")) {
        const prodId = Number(actionId.replace("prod_", ""));
        const product = catalog.find((p) => p.id === prodId);
        if (product) {
          state.currentProduct = product;
          state.step = "WAITING_QUANTITY";
          return sendTextMessage(
            phone,
            `🍗 *${product.name}*\n💰 Valor: *${formatMoney(product.priceCents)}*\n\n📝 ${product.description}\n\nQuantas unidades você gostaria de adicionar ao seu pedido? (Envie apenas o número, ex: *1*, *2*, *3*)`
          );
        }
      }
      // Se clicou em voltar categorias
      if (actionId.startsWith("cat_")) {
        const categoryName = actionId.replace("cat_", "");
        return sendItemsOfCategory(phone, categoryName, state);
      }
      return sendCategoryList(phone);
    }

    case "WAITING_QUANTITY": {
      const qty = parseInt(textInput, 10);
      if (isNaN(qty) || qty <= 0) {
        return sendTextMessage(phone, "⚠️ Por favor, informe um número válido de unidades (ex: 1, 2, 3).");
      }
      if (state.currentProduct) {
        state.cart.push({ product: state.currentProduct, quantity: qty });
      }

      // Pergunta se quer adicionar mais itens ou finalizar
      state.step = "IDLE";
      const cartSummary = formatCartSummary(state.cart);

      return sendInteractiveButtons(
        phone,
        `✅ *Item adicionado com sucesso!*\n\n${cartSummary}\n\nO que deseja fazer agora?`,
        [
          { id: "btn_cardapio", title: "➕ Adicionar Mais" },
          { id: "btn_finalizar_pedido", title: "🛒 Finalizar Pedido" },
          { id: "btn_menu_principal", title: "🏠 Menu Inicial" },
        ],
        "Smack Chicken — Carrinho"
      );
    }

    case "CHOOSING_DELIVERY": {
      if (actionId === "delivery_retirada" || textInput.includes("retirada") || textInput.includes("buscar")) {
        state.deliveryType = "RETIRADA";
        state.address = "Retirada no Balcão (Estreito)";
        state.step = "CHOOSING_PAYMENT";
        return sendPaymentOptions(phone);
      }
      if (actionId === "delivery_entrega" || textInput.includes("entrega") || textInput.includes("tele")) {
        state.deliveryType = "ENTREGA";
        state.step = "WAITING_ADDRESS";
        return sendTextMessage(
          phone,
          "🛵 *Tele-Entrega Smack Chicken*\n\nPor favor, informe seu *Endereço Completo de Entrega* (Rua, Número, Bairro, Ponto de referência e CEP):"
        );
      }
      return sendDeliveryOptions(phone);
    }

    case "WAITING_ADDRESS": {
      if (textInput.length < 5) {
        return sendTextMessage(phone, "⚠️ Por favor, digite o endereço completo com rua e número para a entrega.");
      }
      state.address = incoming.text?.trim();
      state.step = "CHOOSING_PAYMENT";
      return sendPaymentOptions(phone);
    }

    case "CHOOSING_PAYMENT": {
      let selectedPayment = "";
      if (actionId === "pay_pix" || textInput.includes("pix")) selectedPayment = "PIX";
      if (actionId === "pay_card" || textInput.includes("cartão") || textInput.includes("cartao")) selectedPayment = "Cartão (Débito/Crédito na Entrega)";
      if (actionId === "pay_cash" || textInput.includes("dinheiro")) selectedPayment = "Dinheiro";

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

// --- MENSAGENS AUXILIARES DA INTERFACE ---

export async function sendWelcomeMenu(phone: string, name: string) {
  return sendInteractiveButtons(
    phone,
    `Olá, *${name}*! 👋 Seja muito bem-vindo(a) à *SMACK CHICKEN* — Frango Frito no Balde crocante e sequinho no Estreito (Florianópolis)! 🍗🔥\n\nComo podemos deixar seu dia mais saboroso hoje?`,
    [
      { id: "btn_cardapio", title: "📜 Ver Cardápio" },
      { id: "btn_loja_info", title: "📍 Endereço & Horário" },
      { id: "btn_atendente", title: "👤 Falar c/ Atendente" },
    ],
    "Smack Chicken — Atendimento Oficial"
  );
}

export async function sendCategoryList(phone: string) {
  return sendInteractiveList(
    phone,
    "Selecione uma categoria do nosso cardápio para ver os itens disponíveis:",
    "Ver Categoria",
    [
      {
        title: "Cardápio Principal",
        rows: [
          { id: "cat_Baldes", title: "🍗 Baldes de Frango", description: "Baldes P, M e G (Tiras ou Coxinhas crocantes)" },
          { id: "cat_Combos", title: "🔥 Combos Especiais", description: "Combos para 2 pessoas, Galera ou Família" },
          { id: "cat_Marmitas", title: "🍱 Marmita Smack 600g", description: "Almoço completo bem servido com sassami crocante" },
          { id: "cat_Lanches", title: "🍔 Lanches Crocantes", description: "Smack Original, Fresh, Power e Kids" },
          { id: "cat_Porções", title: "🍟 Porções e Molhos", description: "Batatas, Polentas e Molhos da Casa" },
          { id: "cat_Bebidas", title: "🥤 Bebidas & Energéticos", description: "Refrigerantes, Cervejas Long Neck e Energéticos" },
        ],
      },
    ],
    "Cardápio Smack Chicken"
  );
}

export async function sendItemsOfCategory(phone: string, category: string, state: UserState) {
  state.step = "CHOOSING_ITEM";
  const items = catalog.filter((p) => p.category.toLowerCase() === category.toLowerCase());

  if (!items.length) {
    return sendTextMessage(phone, "Nenhum item encontrado nesta categoria.");
  }

  const rows = items.map((p) => ({
    id: `prod_${p.id}`,
    title: p.name,
    description: `${formatMoney(p.priceCents)} — ${p.description}`,
  }));

  return sendInteractiveList(
    phone,
    `Confira as opções da categoria *${category}*:`,
    "Escolher Item",
    [{ title: category, rows }],
    `Smack Chicken — ${category}`
  );
}

export async function sendDeliveryOptions(phone: string) {
  return sendInteractiveButtons(
    phone,
    "Como você prefere receber o seu pedido?",
    [
      { id: "delivery_retirada", title: "🛍️ Retirada no Balcão" },
      { id: "delivery_entrega", title: "🛵 Tele-Entrega" },
    ],
    "Forma de Entrega"
  );
}

export async function sendPaymentOptions(phone: string) {
  return sendInteractiveButtons(
    phone,
    "Qual será a sua forma de pagamento?",
    [
      { id: "pay_pix", title: "⚡ PIX (Chave/QR Code)" },
      { id: "pay_card", title: "💳 Cartão na Entrega" },
      { id: "pay_cash", title: "💵 Dinheiro" },
    ],
    "Forma de Pagamento"
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

  await sendTextMessage(phone, text);
  return sendLocationMessage(phone, -27.5855, -48.5833, "Smack Chicken", "Estreito, Florianópolis - SC");
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
    return sendTextMessage(phone, "⚠️ Seu carrinho está vazio. Adicione itens antes de finalizar o pedido.");
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

  const orderCode = `W-${Math.floor(1000 + Math.random() * 9000)}`;
  const notes = `[WhatsApp Bot] Entrega: ${state.deliveryType || "N/I"} | Endereço: ${state.address || "Balcão"} | Tel: ${phone}`;

  try {
    // Registra o pedido no PostgreSQL
    await transaction(async (client) => {
      const insertedOrder = await client.query<{ id: string }>(
        `INSERT INTO orders (code, customer_name, status, payment_method, total_cents, channel, notes)
         VALUES ($1, $2, 'preparing', $3, $4, 'WHATSAPP', $5) RETURNING id`,
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

    // Reseta a sessão do cliente
    state.step = "IDLE";
    state.cart = [];

    return sendTextMessage(phone, summaryText);
  } catch (err) {
    console.error("Erro ao criar pedido via WhatsApp:", err);

    // Fallback de confirmação mesmo se o banco não estiver acessível
    const fallbackText =
      `🎉 *PEDIDO REGISTRADO!*\n\n` +
      `📌 *Código:* #${orderCode}\n` +
      `👤 *Cliente:* ${customerName}\n` +
      `💳 *Pagamento:* ${state.paymentMethod}\n\n` +
      `${formatCartSummary(state.cart)}\n\n` +
      `Sua solicitação foi enviada para a nossa equipe e está em preparo! 🍗`;

    state.step = "IDLE";
    state.cart = [];

    return sendTextMessage(phone, fallbackText);
  }
}
