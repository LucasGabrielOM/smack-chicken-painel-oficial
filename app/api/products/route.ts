import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../lib/auth";
import { query } from "../../../lib/db";
import { getProductImage } from "../../store-panel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (process.env.SMACK_MODE !== "panel") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const result = await query(
    `SELECT id,name,description,price_cents AS "priceCents",category,image,active,featured
     FROM products ORDER BY category,name`,
  );

  const products = result.rows.map((product) => ({
    ...product,
    image: getProductImage(product),
  }));

  return NextResponse.json({ products });
}
