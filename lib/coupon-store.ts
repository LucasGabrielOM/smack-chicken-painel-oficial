import { formatPhoneNumber } from "./evolution";

export type CouponDefinition = {
  code: string;
  discountPercent: number;
  maxUsesPerPhone: number;
  description: string;
};

export const OFFICIAL_COUPONS: Record<string, CouponDefinition> = {
  VOLTA10: {
    code: "VOLTA10",
    discountPercent: 10,
    maxUsesPerPhone: 2,
    description: "10% de desconto no site de pedidos para retorno de clientes (até 2 pedidos)",
  },
};

export type PhoneUsageRecord = {
  count: number;
  orders: Array<{
    orderCode: string;
    date: string;
    discountCents: number;
  }>;
};

export type CouponStoreData = {
  [couponCode: string]: {
    [normalizedPhone: string]: PhoneUsageRecord;
  };
};

declare global {
  var __smackCouponUsages: CouponStoreData | undefined;
}

if (!globalThis.__smackCouponUsages) {
  globalThis.__smackCouponUsages = {};
}

function getKv(): {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string) => Promise<void>;
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

const KV_COUPON_KEY = "coupon_usages_v1";

/**
 * Carrega a base de dados de utilizações de cupom do KV ou memória
 */
export async function loadCouponData(): Promise<CouponStoreData> {
  const kv = getKv();
  if (kv) {
    try {
      const raw = await kv.get(KV_COUPON_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          globalThis.__smackCouponUsages = parsed;
          return parsed;
        }
      }
    } catch (err) {
      console.warn("[CouponStore] Erro ao ler KV:", err);
    }
  }

  return globalThis.__smackCouponUsages || {};
}

/**
 * Salva a base de dados de cupons no KV e na memória
 */
async function persistCouponData(data: CouponStoreData): Promise<void> {
  globalThis.__smackCouponUsages = data;
  const kv = getKv();
  if (kv) {
    try {
      await kv.put(KV_COUPON_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn("[CouponStore] Erro ao salvar KV:", err);
    }
  }
}

/**
 * Retorna a contagem de usos de um cupom para um número de telefone
 */
export async function getCouponUsage(
  couponCode: string,
  rawPhone: string
): Promise<{ count: number; record?: PhoneUsageRecord }> {
  const normalizedCode = couponCode.trim().toUpperCase();
  const normalizedPhone = formatPhoneNumber(rawPhone);

  const data = await loadCouponData();
  const couponSection = data[normalizedCode] || {};
  const record = couponSection[normalizedPhone];

  return {
    count: record?.count || 0,
    record,
  };
}

export type CouponValidationResult = {
  valid: boolean;
  code?: string;
  discountPercent?: number;
  discountCents?: number;
  currentUses?: number;
  maxUses?: number;
  remainingUses?: number;
  error?: string;
  message?: string;
};

/**
 * Valida se um cupom pode ser utilizado pelo número de WhatsApp especificado
 */
export async function validateCoupon(
  rawCode: string,
  rawPhone: string,
  subtotalCents?: number
): Promise<CouponValidationResult> {
  const code = (rawCode || "").trim().toUpperCase();
  if (!code) {
    return { valid: false, error: "Digite o código do cupom." };
  }

  const couponDef = OFFICIAL_COUPONS[code];
  if (!couponDef) {
    return { valid: false, error: "Cupom inválido ou expirado." };
  }

  const cleanPhone = (rawPhone || "").replace(/\D/g, "");
  if (cleanPhone.length < 10) {
    return {
      valid: false,
      error: "Por favor, informe seu número de WhatsApp completo com DDD para validar o cupom.",
    };
  }

  const normalizedPhone = formatPhoneNumber(rawPhone);
  const { count } = await getCouponUsage(code, normalizedPhone);

  if (count >= couponDef.maxUsesPerPhone) {
    return {
      valid: false,
      code,
      currentUses: count,
      maxUses: couponDef.maxUsesPerPhone,
      remainingUses: 0,
      error: `Este número de WhatsApp já atingiu o limite máximo de ${couponDef.maxUsesPerPhone} usos do cupom ${code}.`,
    };
  }

  const remaining = couponDef.maxUsesPerPhone - count;
  const discountPercent = couponDef.discountPercent;
  const discountCents = subtotalCents && subtotalCents > 0
    ? Math.round(subtotalCents * (discountPercent / 100))
    : 0;

  const usageDescription =
    count === 0
      ? `1º de ${couponDef.maxUsesPerPhone} usos disponíveis`
      : `${count + 1}º e último uso disponível`;

  return {
    valid: true,
    code,
    discountPercent,
    discountCents,
    currentUses: count,
    maxUses: couponDef.maxUsesPerPhone,
    remainingUses: remaining,
    message: `🎉 Cupom ${code} aplicado! ${discountPercent}% de desconto (${usageDescription}).`,
  };
}

/**
 * Registra o uso do cupom após a confirmação do pedido
 */
export async function recordCouponUsage(
  rawCode: string,
  rawPhone: string,
  orderCode: string,
  discountCents: number
): Promise<{ success: boolean; newCount: number }> {
  const code = (rawCode || "").trim().toUpperCase();
  const couponDef = OFFICIAL_COUPONS[code];
  if (!couponDef) return { success: false, newCount: 0 };

  const normalizedPhone = formatPhoneNumber(rawPhone);
  const data = await loadCouponData();

  if (!data[code]) {
    data[code] = {};
  }

  const currentRecord = data[code][normalizedPhone] || { count: 0, orders: [] };
  const newCount = currentRecord.count + 1;

  currentRecord.count = newCount;
  currentRecord.orders.unshift({
    orderCode,
    date: new Date().toISOString(),
    discountCents,
  });

  data[code][normalizedPhone] = currentRecord;
  await persistCouponData(data);

  return { success: true, newCount };
}
