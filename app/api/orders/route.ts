import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../lib/auth";
import { query, transaction } from "../../../lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type NewOrder = {
  customerName?: string;
  paymentMethod?: string;
  cashReceivedCents?: number | null;
  channel?: string;
  notes?: string;
  discountCents?: number;
  splitCount?: number;
  items?: Array<{ productId: number | string; quantity: number | string }>;
};

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const result = await query(
    `SELECT o.id,o.code,o.customer_name AS "customerName",o.status,
            o.payment_method AS "paymentMethod",o.cash_received_cents AS "cashReceivedCents",
            o.total_cents AS "totalCents",o.discount_cents AS "discountCents",o.split_count AS "splitCount",
            o.channel,o.notes,o.created_at AS "createdAt",
            o.ready_at AS "readyAt",o.completed_at AS "completedAt",
            COALESCE(json_agg(json_build_object(
              'id',oi.id,'productId',oi.product_id,'name',oi.product_name,
              'quantity',oi.quantity,'unitPriceCents',oi.unit_price_cents
            ) ORDER BY oi.id) FILTER (WHERE oi.id IS NOT NULL),'[]') AS items
     FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id
     WHERE o.created_at >= NOW() - INTERVAL '30 days'
     GROUP BY o.id ORDER BY o.created_at DESC LIMIT 300`,
  );
  return NextResponse.json({ orders: result.rows });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const body = await request.json() as NewOrder;
  if (!body.customerName?.trim() || !body.paymentMethod || !body.items?.length) {
    return NextResponse.json({ error: "Cliente, pagamento e itens são obrigatórios" }, { status: 400 });
  }
  try {
    const order = await transaction(async (client) => {
      const items = body.items!.map((item) => ({
        productId: Number(item.productId),
        quantity: Number(item.quantity),
      }));
      if (items.some((item) => !Number.isSafeInteger(item.productId) || !Number.isSafeInteger(item.quantity) || item.quantity < 1)) {
        throw new Error("Item inválido no pedido");
      }
      const productIds = items.map((item) => item.productId);
      const products = await client.query<{ id: string; name: string; price_cents: number }>(
        "SELECT id,name,price_cents FROM products WHERE id=ANY($1::bigint[]) AND active=true",
        [productIds],
      );
      const byId = new Map(products.rows.map((product) => [Number(product.id), product]));
      let itemsTotalCents = 0;
      for (const item of items) {
        const product = byId.get(item.productId);
        if (!product || item.quantity < 1) throw new Error("Item inválido no pedido");
        itemsTotalCents += product.price_cents * item.quantity;
      }
      const discountCents = Math.min(Math.max(0, Math.round(Number(body.discountCents) || 0)), itemsTotalCents);
      const totalCents = itemsTotalCents - discountCents;
      const splitCount = Math.min(20, Math.max(1, Math.round(Number(body.splitCount) || 1)));
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO orders (customer_name,payment_method,cash_received_cents,total_cents,discount_cents,split_count,channel,notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [
          body.customerName!.trim(),
          body.paymentMethod,
          body.cashReceivedCents || null,
          totalCents,
          discountCents,
          splitCount,
          body.channel || "Balcão",
          body.notes?.trim() || null,
        ],
      );
      const id = inserted.rows[0].id;
      const code = `#${String(1000 + Number(id)).padStart(4, "0")}`;
      await client.query("UPDATE orders SET code=$1 WHERE id=$2", [code, id]);
      for (const item of items) {
        const product = byId.get(item.productId)!;
        await client.query(
          `INSERT INTO order_items (order_id,product_id,product_name,quantity,unit_price_cents)
           VALUES ($1,$2,$3,$4,$5)`,
          [id, item.productId, product.name, item.quantity, product.price_cents],
        );
      }
      return { id, code, totalCents, discountCents, splitCount };
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao criar pedido" }, { status: 400 });
  }
}
