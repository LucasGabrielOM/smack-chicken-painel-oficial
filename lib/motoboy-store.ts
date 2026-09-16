export type Motoboy = {
  id: string;
  name: string;
  phone?: string;
  vehicle?: string;
  active: boolean;
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
          globalThis.__smackMotoboys = parsed;
          return parsed;
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
      };
      current[idx] = updated;
    } else {
      updated = {
        id: input.id,
        name: input.name.trim(),
        phone: input.phone?.trim() || "",
        vehicle: input.vehicle?.trim() || "Moto",
        active: input.active !== undefined ? input.active : true,
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
