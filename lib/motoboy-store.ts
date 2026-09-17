export type Motoboy = {
  id: string;
  name: string;
  phone?: string;
  vehicle?: string;
  active: boolean;
  rateType?: "fixed" | "order_fee";
  rateFeeCents?: number; // Valor fixo por entrega em centavos (ex: 700 = R$ 7,00)
  dailyAllowanceCents?: number; // Diária fixa em centavos (ex: 5000 = R$ 50,00)
  createdAt: string;
};

declare global {
  var __smackMotoboys: Motoboy[] | undefined;
}

const DEFAULT_MOTOBOYS: Motoboy[] = [
  {
    id: "mb-lucas",
    name: "Lucas",
    phone: "",
    vehicle: "Moto",
    active: true,
    rateType: "fixed",
    rateFeeCents: 700,
    dailyAllowanceCents: 0,
    createdAt: new Date().toISOString(),
  },
];

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

export async function getMotoboys(): Promise<Motoboy[]> {
  const kv = getKv();
  if (kv) {
    try {
      const raw = await kv.get("motoboys_list");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalized: Motoboy[] = parsed.map((m: any) => ({
            ...m,
            rateType: m.rateType || "fixed",
            rateFeeCents: typeof m.rateFeeCents === "number" ? m.rateFeeCents : 700,
            dailyAllowanceCents: typeof m.dailyAllowanceCents === "number" ? m.dailyAllowanceCents : 0,
          }));
          globalThis.__smackMotoboys = normalized;
          return normalized;
        }
      }
    } catch (e) {
      console.warn("Erro ao buscar motoboys no KV:", e);
    }
  }

  if (globalThis.__smackMotoboys && globalThis.__smackMotoboys.length > 0) {
    return globalThis.__smackMotoboys;
  }

  globalThis.__smackMotoboys = DEFAULT_MOTOBOYS;
  if (kv) {
    try {
      await kv.put("motoboys_list", JSON.stringify(DEFAULT_MOTOBOYS));
    } catch {}
  }
  return DEFAULT_MOTOBOYS;
}

export async function saveMotoboy(input: {
  id?: string;
  name: string;
  phone?: string;
  vehicle?: string;
  active?: boolean;
  rateType?: "fixed" | "order_fee";
  rateFeeCents?: number;
  dailyAllowanceCents?: number;
}): Promise<Motoboy> {
  const current = await getMotoboys();
  let updated: Motoboy;

  if (input.id) {
    const idx = current.findIndex((m) => m.id === input.id);
    if (idx >= 0) {
      updated = {
        ...current[idx],
        name: input.name.trim(),
        phone: input.phone?.trim() || "",
        vehicle: input.vehicle?.trim() || "Moto",
        active: input.active !== undefined ? input.active : current[idx].active,
        rateType: input.rateType !== undefined ? input.rateType : current[idx].rateType || "fixed",
        rateFeeCents: input.rateFeeCents !== undefined ? input.rateFeeCents : current[idx].rateFeeCents ?? 700,
        dailyAllowanceCents: input.dailyAllowanceCents !== undefined ? input.dailyAllowanceCents : current[idx].dailyAllowanceCents ?? 0,
      };
      current[idx] = updated;
    } else {
      updated = {
        id: input.id,
        name: input.name.trim(),
        phone: input.phone?.trim() || "",
        vehicle: input.vehicle?.trim() || "Moto",
        active: input.active !== undefined ? input.active : true,
        rateType: input.rateType || "fixed",
        rateFeeCents: input.rateFeeCents ?? 700,
        dailyAllowanceCents: input.dailyAllowanceCents ?? 0,
        createdAt: new Date().toISOString(),
      };
      current.push(updated);
    }
  } else {
    updated = {
      id: `mb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: input.name.trim(),
      phone: input.phone?.trim() || "",
      vehicle: input.vehicle?.trim() || "Moto",
      active: true,
      rateType: input.rateType || "fixed",
      rateFeeCents: input.rateFeeCents ?? 700,
      dailyAllowanceCents: input.dailyAllowanceCents ?? 0,
      createdAt: new Date().toISOString(),
    };
    current.push(updated);
  }

  globalThis.__smackMotoboys = current;
  const kv = getKv();
  if (kv) {
    try {
      await kv.put("motoboys_list", JSON.stringify(current));
    } catch (e) {
      console.warn("Erro ao salvar motoboy no KV:", e);
    }
  }

  return updated;
}

export async function deleteMotoboy(id: string): Promise<boolean> {
  const current = await getMotoboys();
  const filtered = current.filter((m) => m.id !== id);
  if (filtered.length === current.length) return false;

  const finalList = filtered.length > 0 ? filtered : DEFAULT_MOTOBOYS;
  globalThis.__smackMotoboys = finalList;

  const kv = getKv();
  if (kv) {
    try {
      await kv.put("motoboys_list", JSON.stringify(finalList));
    } catch {}
  }
  return true;
}
