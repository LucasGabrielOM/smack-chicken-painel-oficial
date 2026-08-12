import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../lib/auth";
import { query } from "../../../lib/db";
import { catalog } from "../../../lib/catalog";
import { getProductImage } from "../../store-panel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  let dbProducts: any[] = [];
  try {
    const result = await query(
      `SELECT id,name,description,price_cents AS "priceCents",category,image,active,featured
       FROM products ORDER BY category,name`,
    );
    dbProducts = result.rows || [];
  } catch (err) {
    console.error("Failed to query products from database:", err);
  }

  const catalogMap = new Map(catalog.map((c) => [c.id, c]));
  const mergedMap = new Map<number, any>();

  // 1. Populate all products from the built-in catalog
  for (const item of catalog) {
    mergedMap.set(item.id, {
      ...item,
      active: true,
      image: getProductImage(item),
    });
  }

  // 2. Merge database rows over catalog items. Items that only exist in the
  // database (created through the Cardápio admin screen) keep their own
  // stored image instead of being re-guessed by getProductImage().
  for (const item of dbProducts) {
    const numId = Number(item.id);
    const catalogItem = catalogMap.get(numId);
    const merged = {
      ...catalogItem,
      ...item,
      id: numId,
      priceCents: Number(item.priceCents),
      active: item.active !== false,
    };
    merged.image = catalogItem ? getProductImage(merged) : (item.image || "");
    mergedMap.set(numId, merged);
  }

  const products = Array.from(mergedMap.values());

  return NextResponse.json({ products });
}

type ProductInput = {
  name?: string;
  description?: string;
  priceCents?: number | string;
  category?: string;
  image?: string;
};

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const body = await request.json() as ProductInput;
  const name = body.name?.trim();
  const category = body.category?.trim();
  const priceCents = Math.round(Number(body.priceCents));
  if (!name || !category || !Number.isFinite(priceCents) || priceCents < 0) {
    return NextResponse.json({ error: "Nome, categoria e preço válido são obrigatórios" }, { status: 400 });
  }
  if (typeof body.image === "string" && body.image.length > 2_000_000) {
    return NextResponse.json({ error: "Imagem muito grande. Envie uma foto menor." }, { status: 400 });
  }
  try {
    const nextId = await query<{ next_id: string }>("SELECT COALESCE(MAX(id),0)+1 AS next_id FROM products");
    const id = Number(nextId.rows[0].next_id);
    await query(
      `INSERT INTO products (id,name,description,price_cents,category,image,active,featured)
       VALUES ($1,$2,$3,$4,$5,$6,true,false)`,
      [id, name, body.description?.trim() || "", priceCents, category, body.image?.trim() || ""],
    );
    return NextResponse.json({ product: { id, name, description: body.description?.trim() || "", priceCents, category, image: body.image?.trim() || "", active: true } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao criar produto" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const body = await request.json() as ProductInput & { id?: number | string; active?: boolean };
  const id = Number(body.id);
  if (!Number.isSafeInteger(id)) {
    return NextResponse.json({ error: "Produto inválido" }, { status: 400 });
  }
  if (typeof body.image === "string" && body.image.length > 2_000_000) {
    return NextResponse.json({ error: "Imagem muito grande. Envie uma foto menor." }, { status: 400 });
  }
  const sourceItem = catalog.find((item) => item.id === id);
  const existing = await query<{ id: string; name: string; description: string; price_cents: number; category: string; image: string; active: boolean }>(
    "SELECT id,name,description,price_cents,category,image,active FROM products WHERE id=$1",
    [id],
  );
  const current = existing.rows[0] || (sourceItem ? {
    id: String(sourceItem.id), name: sourceItem.name, description: sourceItem.description,
    price_cents: sourceItem.priceCents, category: sourceItem.category, image: sourceItem.image, active: true,
  } : null);
  if (!current) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

  const name = body.name?.trim() ?? current.name;
  const description = body.description !== undefined ? body.description.trim() : current.description;
  const category = body.category?.trim() || current.category;
  const priceCents = body.priceCents !== undefined ? Math.round(Number(body.priceCents)) : current.price_cents;
  const image = body.image !== undefined ? body.image.trim() : current.image;
  const active = body.active !== undefined ? Boolean(body.active) : current.active;
  if (!name || !category || !Number.isFinite(priceCents) || priceCents < 0) {
    return NextResponse.json({ error: "Nome, categoria e preço válido são obrigatórios" }, { status: 400 });
  }
  try {
    await query(
      `INSERT INTO products (id,name,description,price_cents,category,image,active)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET
         name=EXCLUDED.name, description=EXCLUDED.description, price_cents=EXCLUDED.price_cents,
         category=EXCLUDED.category, image=EXCLUDED.image, active=EXCLUDED.active`,
      [id, name, description, priceCents, category, image, active],
    );
    return NextResponse.json({ product: { id, name, description, priceCents, category, image, active } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao atualizar produto" }, { status: 400 });
  }
}
