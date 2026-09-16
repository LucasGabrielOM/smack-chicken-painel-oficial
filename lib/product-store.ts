import { catalog, CatalogProduct } from "./catalog";
import { DELIVERY_TIERS, DeliveryTier } from "./delivery";

export interface DeliverySettings {
  maxRadiusKm: number;
  tiers: DeliveryTier[];
}

declare global {
  var __smackProducts: CatalogProduct[] | undefined;
  var __smackDeliverySettings: DeliverySettings | undefined;
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

function getInitialCatalog(): CatalogProduct[] {
  return catalog.map((p) => ({
    ...p,
    active: p.active !== false,
  }));
}

function sanitizeProductCatalog(list: CatalogProduct[]): CatalogProduct[] {
  const map = new Map<number, CatalogProduct>();
  for (const item of getInitialCatalog()) map.set(item.id, item);
  for (const item of list) {
    if (item.category === "Doces" || [47, 48, 49, 50, 51].includes(item.id)) continue;
    if (item.id === 56 && item.name.toLowerCase().includes("original")) continue;
    if (item.id === 57 && item.name.toLowerCase().includes("power")) continue;
    if (item.id === 58) continue;
    map.set(item.id, item);
  }
  const merged = Array.from(map.values())
    .filter((p) => p.category !== "Doces" && ![47, 48, 49, 50, 51].includes(p.id))
    .filter((p) => !(p.id !== 53 && p.name.trim().toLowerCase() === "smack original"))
    .filter((p) => !(p.id !== 56 && p.name.trim().toLowerCase() === "smack power"));

  for (const p of merged) {
    if (p.id === 53 || p.name.trim().toLowerCase() === "smack original") {
      p.id = 53;
      p.name = "Smack Original";
      p.priceCents = 1999;
      p.category = "Lanches";
    } else if (p.id === 56 || p.name.trim().toLowerCase() === "smack power") {
      p.id = 56;
      p.name = "Smack Power";
      p.priceCents = 3999;
      p.category = "Lanches";
    } else if (p.id === 54 || p.name.trim().toLowerCase().includes("smack kids")) {
      p.id = 54;
      p.name = "Smack Kids + Batata Smile";
      p.priceCents = 2499;
      p.category = "Lanches";
    } else if (p.id === 55 || p.name.trim().toLowerCase() === "smack fresh") {
      p.id = 55;
      p.name = "Smack Fresh";
      p.priceCents = 2990;
      p.category = "Lanches";
    } else if (p.id === 52 || p.name.trim().toLowerCase().includes("marmita")) {
      p.id = 52;
      p.name = "MARMITA SMACK 600g";
      p.priceCents = 2390;
      p.category = "Marmitas";
    } else if (p.id === 3) {
      p.priceCents = 7999;
    } else if (p.id === 19) {
      p.priceCents = 8499;
    } else if (p.id === 102) {
      p.priceCents = 2499;
    } else if (p.id === 103) {
      p.priceCents = 2999;
    }
  }

  return merged;
}

/**
 * Carrega a lista de produtos (KV -> DB -> Catálogo base)
 */
export async function loadProductsStore(): Promise<CatalogProduct[]> {
  const kv = getKv();
  if (kv) {
    try {
      const raw = await kv.get("products_list");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sanitized = sanitizeProductCatalog(parsed);
          globalThis.__smackProducts = sanitized;
          return sanitized;
        }
      }
    } catch (e) {
      console.warn("KV get error for products:", e);
    }
  }

  if (process.env.DATABASE_URL) {
    try {
      const { query } = await import("./db");
      const res = await query<{
        id: string;
        name: string;
        description: string;
        price_cents: number;
        category: string;
        image: string;
        active: boolean;
        featured: boolean;
      }>(`SELECT id, name, description, price_cents, category, image, active, featured FROM products ORDER BY category, name`);

      if (res.rows && res.rows.length > 0) {
        const dbItems: CatalogProduct[] = res.rows.map((r) => ({
          id: Number(r.id),
          name: r.name,
          description: r.description,
          priceCents: Number(r.price_cents),
          category: r.category,
          image: r.image,
          active: r.active !== false,
          featured: Boolean(r.featured),
        }));

        const merged = sanitizeProductCatalog(dbItems);
        globalThis.__smackProducts = merged;
        return merged;
      }
    } catch (e) {
      console.warn("DB query error for products:", e);
    }
  }

  if (globalThis.__smackProducts && globalThis.__smackProducts.length > 0) {
    return globalThis.__smackProducts;
  }

  const initial = getInitialCatalog();
  globalThis.__smackProducts = initial;
  if (kv) {
    try {
      await kv.put("products_list", JSON.stringify(initial));
    } catch {}
  }
  return initial;
}

/**
 * Salva a lista inteira de produtos no KV e DB
 */
async function persistProducts(list: CatalogProduct[]): Promise<void> {
  globalThis.__smackProducts = list;
  const kv = getKv();
  if (kv) {
    try {
      await kv.put("products_list", JSON.stringify(list));
    } catch (e) {
      console.warn("KV put error for products:", e);
    }
  }

  if (process.env.DATABASE_URL) {
    try {
      const { query } = await import("./db");
      for (const p of list) {
        await query(
          `INSERT INTO products (id, name, description, price_cents, category, image, active, featured)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
             name=EXCLUDED.name, description=EXCLUDED.description, price_cents=EXCLUDED.price_cents,
             category=EXCLUDED.category, image=EXCLUDED.image, active=EXCLUDED.active, featured=EXCLUDED.featured`,
          [p.id, p.name, p.description, p.priceCents, p.category, p.image, p.active !== false, Boolean(p.featured)]
        ).catch(() => {});
      }
    } catch (e) {
      console.warn("DB persist error for products:", e);
    }
  }
}

export type SaveProductInput = {
  id?: number | string;
  name: string;
  description?: string;
  priceCents: number | string;
  category: string;
  image?: string;
  featured?: boolean;
  active?: boolean;
};

/**
 * Cria ou edita um produto
 */
export async function saveProduct(input: SaveProductInput): Promise<CatalogProduct> {
  const list = await loadProductsStore();
  const name = input.name.trim();
  const category = input.category.trim();
  const priceCents = Math.round(Number(input.priceCents));
  const description = (input.description || "").trim();
  const image = (input.image || "").trim() || "/balde-tiras.jpeg";
  const active = input.active !== false;
  const featured = Boolean(input.featured);

  if (!name) throw new Error("Nome do produto é obrigatório");
  if (!category) throw new Error("Categoria é obrigatória");
  if (isNaN(priceCents) || priceCents < 0) throw new Error("Preço inválido");

  let product: CatalogProduct;
  const existingId = input.id !== undefined && input.id !== null ? Number(input.id) : null;

  if (existingId !== null && !isNaN(existingId)) {
    const idx = list.findIndex((p) => p.id === existingId);
    if (idx >= 0) {
      product = {
        ...list[idx],
        name,
        category,
        priceCents,
        description,
        image,
        active,
        featured,
      };
      list[idx] = product;
    } else {
      product = {
        id: existingId,
        name,
        category,
        priceCents,
        description,
        image,
        active,
        featured,
      };
      list.push(product);
    }
  } else {
    // Gerar próximo ID
    const maxId = list.reduce((max, p) => (p.id > max ? p.id : max), 100);
    const newId = maxId + 1;
    product = {
      id: newId,
      name,
      category,
      priceCents,
      description,
      image,
      active,
      featured,
    };
    list.push(product);
  }

  await persistProducts(list);
  return product;
}

/**
 * Alterna a disponibilidade de um produto
 */
export async function toggleProductActive(id: number | string): Promise<CatalogProduct | null> {
  const numId = Number(id);
  const list = await loadProductsStore();
  const product = list.find((p) => p.id === numId);
  if (!product) return null;

  product.active = !product.active;
  await persistProducts(list);
  return product;
}

/**
 * Exclui um produto do catálogo
 */
export async function deleteProduct(id: number | string): Promise<boolean> {
  const numId = Number(id);
  const list = await loadProductsStore();
  const filtered = list.filter((p) => p.id !== numId);
  if (filtered.length === list.length) return false;

  await persistProducts(filtered);
  if (process.env.DATABASE_URL) {
    try {
      const { query } = await import("./db");
      await query("DELETE FROM products WHERE id=$1", [numId]);
    } catch {}
  }
  return true;
}

/**
 * Configurações de entrega e taxas por raio
 */
export async function loadDeliverySettings(): Promise<DeliverySettings> {
  const kv = getKv();
  if (kv) {
    try {
      const raw = await kv.get("delivery_settings");
      if (raw) {
        const parsed = JSON.parse(raw) as DeliverySettings;
        if (parsed && Array.isArray(parsed.tiers) && parsed.tiers.length > 0) {
          globalThis.__smackDeliverySettings = parsed;
          return parsed;
        }
      }
    } catch (e) {
      console.warn("KV get error for delivery settings:", e);
    }
  }

  if (globalThis.__smackDeliverySettings) {
    return globalThis.__smackDeliverySettings;
  }

  const defaultSettings: DeliverySettings = {
    maxRadiusKm: 6.0,
    tiers: DELIVERY_TIERS,
  };

  globalThis.__smackDeliverySettings = defaultSettings;
  if (kv) {
    try {
      await kv.put("delivery_settings", JSON.stringify(defaultSettings));
    } catch {}
  }
  return defaultSettings;
}

export async function saveDeliverySettings(settings: DeliverySettings): Promise<DeliverySettings> {
  if (!settings.tiers || !Array.isArray(settings.tiers) || settings.tiers.length === 0) {
    throw new Error("Pelo menos uma faixa de entrega deve ser informada.");
  }

  // Ordenar as faixas por raio crescente
  const sortedTiers = [...settings.tiers].sort((a, b) => a.maxKm - b.maxKm);
  const maxRadiusKm = Number(settings.maxRadiusKm) || sortedTiers[sortedTiers.length - 1].maxKm;

  const sanitized: DeliverySettings = {
    maxRadiusKm,
    tiers: sortedTiers.map((t) => ({
      maxKm: Number(t.maxKm),
      timeMinutes: Math.round(Number(t.timeMinutes)),
      feeCents: Math.round(Number(t.feeCents)),
      feeFormatted: t.feeFormatted || `R$ ${(Number(t.feeCents) / 100).toFixed(2).replace(".", ",")}`,
    })),
  };

  globalThis.__smackDeliverySettings = sanitized;
  const kv = getKv();
  if (kv) {
    try {
      await kv.put("delivery_settings", JSON.stringify(sanitized));
    } catch (e) {
      console.warn("KV put error for delivery settings:", e);
    }
  }

  return sanitized;
}
