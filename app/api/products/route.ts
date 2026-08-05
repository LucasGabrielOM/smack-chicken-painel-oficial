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

  // 1. Populate all 46 products from catalog
  for (const item of catalog) {
    mergedMap.set(item.id, {
      ...item,
      active: true,
      image: getProductImage(item),
    });
  }

  // 2. Merge database rows over catalog items
  for (const item of dbProducts) {
    const numId = Number(item.id);
    const catalogItem = catalogMap.get(numId);
    mergedMap.set(numId, {
      ...catalogItem,
      ...item,
      id: numId,
      priceCents: Number(item.priceCents),
      active: item.active !== false,
      image: getProductImage({ ...catalogItem, ...item }),
    });
  }

  const products = Array.from(mergedMap.values());

  return NextResponse.json({ products });
}
