import { catalog } from "./catalog";

export type StoredOrderItem = {
  id: string;
  productId: number;
  name: string;
  quantity: number;
  unitPriceCents: number;
};

export type StoredOrder = {
  id: string;
  code: string;
  customerName: string;
  status: "preparing" | "ready" | "completed" | "cancelled";
  paymentMethod: string;
  cashReceivedCents?: number | null;
  totalCents: number;
  discountCents: number;
  deliveryFeeCents?: number;
  splitCount: number;
  channel: string;
  notes: string | null;
  createdAt: string;
  readyAt?: string | null;
  completedAt?: string | null;
  items: StoredOrderItem[];
  cashSettled?: boolean;
  cashSettledAt?: string | null;
  cashSettledBy?: string | null;
};

declare global {
  var __smackOrders: StoredOrder[] | undefined;
  var __smackOrderSeq: number | undefined;
  var __smackNotificationHistory: Map<string, number> | undefined;
}

if (!globalThis.__smackNotificationHistory) {
  globalThis.__smackNotificationHistory = new Map<string, number>();
}

function getInitialOrders(): StoredOrder[] {
  return [];
}

export async function clearAllOrders(): Promise<void> {
  globalThis.__smackOrders = [];
  globalThis.__smackOrderSeq = 1000;
  await persistOrders([]);
  if (process.env.DATABASE_URL) {
    try {
      const { query } = await import("./db");
      await query("DELETE FROM order_items");
      await query("DELETE FROM orders");
    } catch {}
  }
}

function getKv(): {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string) => Promise<void>;
  delete: (key: string) => Promise<void>;
} | null {
  const g = globalThis as any;
  if (g.smack_orders && typeof g.smack_orders.get === "function") return g.smack_orders;
  if (g.env?.smack_orders && typeof g.env.smack_orders.get === "function") return g.env.smack_orders;
  if (g.__env__?.smack_orders && typeof g.__env__.smack_orders.get === "function") return g.__env__.smack_orders;
  if (typeof process !== "undefined" && (process.env as any)?.smack_orders && typeof (process.env as any).smack_orders.get === "function") {
    return (process.env as any).smack_orders;
  }
  return null;
}

async function loadOrdersStore(): Promise<StoredOrder[]> {
  const kv = getKv();
  if (kv) {
    try {
      const raw = await kv.get("orders_list");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          globalThis.__smackOrders = parsed;
          return parsed;
        }
      } else {
        const initial = getInitialOrders();
        globalThis.__smackOrders = initial;
        await kv.put("orders_list", JSON.stringify(initial));
        return initial;
      }
    } catch (e) {
      console.warn("KV get error:", e);
    }
    return globalThis.__smackOrders || [];
  }

  // Ambiente da Loja Interna com Neon PostgreSQL (Render / Node.js)
  if (process.env.DATABASE_URL) {
    try {
      const { query } = await import("./db");
      const res = await query<any>(`
        SELECT o.id, o.code, o.customer_name AS "customerName", o.status,
               o.payment_method AS "paymentMethod", o.cash_received_cents AS "cashReceivedCents",
               o.total_cents AS "totalCents", o.discount_cents AS "discountCents",
               o.split_count AS "splitCount", o.channel, o.notes,
               o.created_at AS "createdAt", o.ready_at AS "readyAt", o.completed_at AS "completedAt",
               COALESCE(
                 json_agg(
                   json_build_object(
                     'id', oi.id,
                     'productId', oi.product_id,
                     'name', oi.product_name,
                     'quantity', oi.quantity,
                     'unitPriceCents', oi.unit_price_cents
                   )
                 ) FILTER (WHERE oi.id IS NOT NULL),
                 '[]'
               ) AS items
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        GROUP BY o.id
        ORDER BY o.created_at DESC
      `);

      if (res.rows) {
        const dbOrders: StoredOrder[] = res.rows.map((r: any) => ({
          id: String(r.id),
          code: r.code || `#${r.id}`,
          customerName: r.customerName || "Cliente",
          status: r.status || "preparing",
          paymentMethod: r.paymentMethod || "Dinheiro",
          cashReceivedCents: r.cashReceivedCents ?? null,
          totalCents: Number(r.totalCents) || 0,
          discountCents: Number(r.discountCents) || 0,
          splitCount: Number(r.splitCount) || 1,
          channel: r.channel || "Balcão",
          notes: r.notes ?? null,
          createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
          readyAt: r.readyAt ? new Date(r.readyAt).toISOString() : null,
          completedAt: r.completedAt ? new Date(r.completedAt).toISOString() : null,
          items: Array.isArray(r.items) ? r.items : JSON.parse(r.items || "[]"),
        }));
        globalThis.__smackOrders = dbOrders;
        return dbOrders;
      }
    } catch (e) {
      console.error("Erro ao carregar pedidos do Neon PostgreSQL:", e);
    }
  }

  if (!globalThis.__smackOrders) {
    globalThis.__smackOrders = getInitialOrders();
    globalThis.__smackOrderSeq = 1041;
  }
  return globalThis.__smackOrders;
}

async function persistOrders(orders: StoredOrder[]): Promise<void> {
  globalThis.__smackOrders = orders;
  const kv = getKv();
  if (kv) {
    try {
      await kv.put("orders_list", JSON.stringify(orders));
    } catch (e) {
      console.warn("KV put error:", e);
    }
  }
}

export type NewOrderInput = {
  customerName: string;
  paymentMethod: string;
  cashReceivedCents?: number | null;
  channel?: string;
  notes?: string;
  discountCents?: number;
  deliveryFeeCents?: number;
  splitCount?: number;
  items: Array<{
    productId: number | string;
    quantity: number | string;
    name?: string;
    unitPriceCents?: number | string;
  }>;
};

export async function createOrder(input: NewOrderInput): Promise<StoredOrder> {
  const store = await loadOrdersStore();

  const customerName = input.customerName.trim();
  if (!customerName) throw new Error("Nome do cliente é obrigatório");
  if (!input.paymentMethod) throw new Error("Forma de pagamento é obrigatória");
  if (!input.items || input.items.length === 0) throw new Error("Nenhum item informado");

  // Lookup products in catalog & product store for fallback prices and names
  const catalogMap = new Map(catalog.map((p) => [p.id, p]));
  let currentProducts = catalog;
  try {
    const { loadProductsStore } = await import("./product-store");
    currentProducts = await loadProductsStore();
  } catch {}
  const productStoreMap = new Map(currentProducts.map((p) => [p.id, p]));

  let itemsTotalCents = 0;
  const processedItems: StoredOrderItem[] = [];

  for (let i = 0; i < input.items.length; i++) {
    const it = input.items[i];
    const pid = Number(it.productId);
    const qty = Math.max(1, Math.round(Number(it.quantity) || 1));
    const prod = productStoreMap.get(pid) || catalogMap.get(pid);

    const unitPrice =
      it.unitPriceCents !== undefined && Number(it.unitPriceCents) >= 0
        ? Math.round(Number(it.unitPriceCents))
        : prod?.priceCents || 0;

    const itemName = it.name?.trim() || prod?.name || `Produto #${pid}`;

    itemsTotalCents += unitPrice * qty;

    processedItems.push({
      id: `oi-${Date.now()}-${i + 1}`,
      productId: pid,
      name: itemName,
      quantity: qty,
      unitPriceCents: unitPrice,
    });
  }

  const deliveryFeeCents = Math.max(0, Math.round(Number(input.deliveryFeeCents) || 0));
  const discountCents = Math.min(Math.max(0, Math.round(Number(input.discountCents) || 0)), itemsTotalCents + deliveryFeeCents);
  const totalCents = itemsTotalCents + deliveryFeeCents - discountCents;
  const splitCount = Math.min(20, Math.max(1, Math.round(Number(input.splitCount) || 1)));

  // Generate sequential code e.g. #1042
  const nextSeq = Math.max(
    (globalThis.__smackOrderSeq || 1041) + 1,
    ...store.map((o) => {
      const num = parseInt(o.id.replace(/\D/g, ""), 10);
      return Number.isFinite(num) ? num + 1 : 1042;
    })
  );
  globalThis.__smackOrderSeq = nextSeq;

  const orderId = String(nextSeq);
  const orderCode = `#${orderId}`;

  const newOrder: StoredOrder = {
    id: orderId,
    code: orderCode,
    customerName,
    status: "preparing",
    paymentMethod: input.paymentMethod,
    cashReceivedCents: input.cashReceivedCents || null,
    totalCents,
    discountCents,
    deliveryFeeCents: deliveryFeeCents > 0 ? deliveryFeeCents : undefined,
    splitCount,
    channel: input.channel || "Balcão",
    notes: input.notes?.trim() || null,
    createdAt: new Date().toISOString(),
    readyAt: null,
    completedAt: null,
    items: processedItems,
  };

  store.unshift(newOrder);
  await persistOrders(store);

  // If external postgres is configured, also persist in background
  if (process.env.DATABASE_URL) {
    try {
      const { query } = await import("./db");
      const inserted = await query<{ id: string }>(
        `INSERT INTO orders (customer_name, payment_method, cash_received_cents, total_cents, discount_cents, split_count, channel, notes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'preparing') RETURNING id`,
        [
          newOrder.customerName,
          newOrder.paymentMethod,
          newOrder.cashReceivedCents,
          newOrder.totalCents,
          newOrder.discountCents,
          newOrder.splitCount,
          newOrder.channel,
          newOrder.notes,
        ]
      );
      if (inserted.rows?.[0]?.id) {
        const dbId = inserted.rows[0].id;
        await query("UPDATE orders SET code=$1 WHERE id=$2", [orderCode, dbId]);
        for (const it of processedItems) {
          await query(
            `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price_cents)
             VALUES ($1,$2,$3,$4,$5)`,
            [dbId, it.productId, it.name, it.quantity, it.unitPriceCents]
          ).catch(() => {});
        }
      }
    } catch (e) {
      console.warn("Could not sync to Postgres (memory store active):", e);
    }
  }

  return newOrder;
}

export async function getOrders(filter?: { code?: string | null; phone?: string | null }): Promise<StoredOrder[]> {
  const store = await loadOrdersStore();

  const codeParam = filter?.code?.trim();
  const phoneParam = filter?.phone?.trim();

  // If searching by code or phone
  if (codeParam || phoneParam) {
    const cleanCode = codeParam ? (codeParam.startsWith("#") ? codeParam.toLowerCase() : `#${codeParam.toLowerCase()}`) : null;
    const cleanPhone = phoneParam ? phoneParam.replace(/\D/g, "") : null;

    const filtered = store.filter((o) => {
      if (cleanCode && o.code.toLowerCase() === cleanCode) return true;
      if (cleanCode && o.id.toLowerCase() === cleanCode.replace("#", "")) return true;
      if (cleanPhone && o.notes && o.notes.replace(/\D/g, "").includes(cleanPhone)) return true;
      return false;
    });

    return filtered;
  }

  // Return all active / recent orders sorted descending by date
  return [...store].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function updateOrderStatus(
  idOrCode: string,
  patch: {
    status?: "preparing" | "ready" | "completed" | "cancelled";
    customerName?: string;
    notes?: string;
    paymentMethod?: string;
    cashSettled?: boolean;
    cashSettledAt?: string | null;
  }
): Promise<StoredOrder | null> {
  const store = await loadOrdersStore();
  const cleanKey = idOrCode.trim().toLowerCase();

  const order = store.find(
    (o) =>
      o.id.toLowerCase() === cleanKey ||
      o.id.toLowerCase() === cleanKey.replace("#", "") ||
      o.code.toLowerCase() === cleanKey ||
      o.code.toLowerCase() === (cleanKey.startsWith("#") ? cleanKey : `#${cleanKey}`)
  );

  if (!order) return null;

  const isStatusChanging = Boolean(patch.status && patch.status !== order.status);

  if (patch.customerName?.trim()) {
    order.customerName = patch.customerName.trim();
  }
  if (patch.notes !== undefined) {
    order.notes = patch.notes.trim() || null;
  }
  if (patch.paymentMethod) {
    order.paymentMethod = patch.paymentMethod;
  }
  if (patch.cashSettled !== undefined) {
    order.cashSettled = patch.cashSettled;
    order.cashSettledAt = patch.cashSettled
      ? (patch.cashSettledAt || new Date().toISOString())
      : null;
    let notes = order.notes || "";
    notes = notes.replace(/\s*\|\s*dinheiro repassado:\s*sim(\s*\([^)]*\))?/gi, "").trim();
    notes = notes.replace(/\s*\|\s*dinheiro repassado:\s*n[ãa]o/gi, "").trim();
    if (patch.cashSettled) {
      const timeStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      notes += ` | Dinheiro Repassado: Sim (às ${timeStr})`;
    }
    order.notes = notes;
  }
  if (patch.status) {
    order.status = patch.status;
    if (patch.status === "ready" && !order.readyAt) {
      order.readyAt = new Date().toISOString();
    }
    if (patch.status === "completed" && !order.completedAt) {
      order.completedAt = new Date().toISOString();
    }

    // Dispara notificacao por WhatsApp APENAS se o status mudou e sem disparos repetidos
    if (order.notes && isStatusChanging) {
      const dedupeKey = `${order.code || order.id}:${patch.status}`;
      const history = globalThis.__smackNotificationHistory!;
      const lastSent = history.get(dedupeKey) || 0;
      const now = Date.now();

      // Bloqueia envios duplicados no intervalo de 30 segundos
      if (now - lastSent > 30000) {
        history.set(dedupeKey, now);

        try {
          const phoneMatch = order.notes.match(/(?:Tel:|\b55\d{10,11}|\b\d{10,11}\b)/i);
          if (phoneMatch) {
            const phone = phoneMatch[0].replace(/\D/g, "");
            if (phone.length >= 10) {
              const { sendEvolutionText } = await import("./evolution");
              let msg = "";
              if (patch.status === "preparing") {
                msg = `🍗 *Smack Chicken*: Olá, ${order.customerName}! Seu pedido *${order.code}* entrou em preparo na cozinha!`;
              } else if (patch.status === "ready") {
                msg = `🛵 *Smack Chicken*: Olá, ${order.customerName}! Seu pedido *${order.code}* ficou pronto e já saiu para entrega/retirada!`;
              } else if (patch.status === "completed") {
                msg = `🎉 *Smack Chicken*: Seu pedido *${order.code}* foi entregue! Agradecemos a preferência e bom apetite! 🍗✨`;
              } else if (patch.status === "cancelled") {
                msg = `⚠️ *Smack Chicken*: Seu pedido *${order.code}* foi cancelado. Se tiver dúvidas, fale conosco.`;
              }
              if (msg) await sendEvolutionText(phone, msg).catch(() => {});
            }
          }
        } catch (e) {
          console.warn("Falha ao enviar WhatsApp:", e);
        }
      }
    }
  }

  await persistOrders(store);

  // Also try updating Postgres if configured
  if (process.env.DATABASE_URL) {
    try {
      const { query } = await import("./db");
      await query(
        `UPDATE orders SET status=COALESCE($1,status), notes=COALESCE($2,notes),
                ready_at=CASE WHEN $1='ready' THEN NOW() ELSE ready_at END,
                completed_at=CASE WHEN $1='completed' THEN NOW() ELSE completed_at END
         WHERE code=$3 OR id=$4`,
        [patch.status || null, patch.notes || null, order.code, order.id]
      );
    } catch {}
  }

  return order;
}

export async function deleteOrder(idOrCode: string): Promise<boolean> {
  const store = await loadOrdersStore();
  const cleanKey = idOrCode.trim().toLowerCase();

  const idx = store.findIndex(
    (o) =>
      o.id.toLowerCase() === cleanKey ||
      o.id.toLowerCase() === cleanKey.replace("#", "") ||
      o.code.toLowerCase() === cleanKey ||
      o.code.toLowerCase() === (cleanKey.startsWith("#") ? cleanKey : `#${cleanKey}`)
  );

  if (idx === -1) return false;
  const [removed] = store.splice(idx, 1);
  await persistOrders(store);

  if (process.env.DATABASE_URL && removed) {
    try {
      const { query } = await import("./db");
      await query("DELETE FROM orders WHERE code=$1 OR id=$2", [removed.code, removed.id]);
    } catch {}
  }

  return true;
}

export async function settleOrdersCash(params: {
  orderIds?: string[];
  motoboyName?: string;
  settled?: boolean;
}): Promise<{ updatedCount: number; orders: StoredOrder[] }> {
  const store = await loadOrdersStore();
  const now = new Date();
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const isSettled = params.settled !== false;
  let updatedCount = 0;
  const updatedOrders: StoredOrder[] = [];

  for (const order of store) {
    let match = false;
    if (params.orderIds && params.orderIds.length > 0) {
      if (
        params.orderIds.includes(order.id) ||
        params.orderIds.includes(order.code) ||
        params.orderIds.includes(order.code.replace("#", ""))
      ) {
        match = true;
      }
    } else if (params.motoboyName) {
      const notes = (order.notes || "").toLowerCase();
      const mbLower = params.motoboyName.toLowerCase();
      if (
        notes.includes(`motoboy: ${mbLower}`) ||
        notes.includes(`entregador: ${mbLower}`) ||
        notes.includes(mbLower)
      ) {
        match = true;
      }
    }

    if (match) {
      order.cashSettled = isSettled;
      order.cashSettledAt = isSettled ? now.toISOString() : null;
      let notes = order.notes || "";
      notes = notes.replace(/\s*\|\s*dinheiro repassado:\s*sim(\s*\([^)]*\))?/gi, "").trim();
      notes = notes.replace(/\s*\|\s*dinheiro repassado:\s*n[ãa]o/gi, "").trim();
      if (isSettled) {
        notes += ` | Dinheiro Repassado: Sim (às ${timeStr})`;
      }
      order.notes = notes;
      updatedCount++;
      updatedOrders.push(order);
    }
  }

  if (updatedCount > 0) {
    await persistOrders(store);
  }

  return { updatedCount, orders: updatedOrders };
}

