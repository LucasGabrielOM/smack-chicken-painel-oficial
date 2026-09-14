import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../lib/auth";
import { createOrder, getOrders, NewOrderInput } from "../../../lib/order-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const codeParam = searchParams.get("code")?.trim();
  const phoneParam = searchParams.get("phone")?.trim();

  // Public customer order tracking by order code or phone
  if (codeParam || phoneParam) {
    const orders = await getOrders({ code: codeParam, phone: phoneParam });
    return NextResponse.json({ orders });
  }

  // Admin orders listing
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  const orders = await getOrders();
  return NextResponse.json({ orders });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as NewOrderInput;
    const isOnlinePublic = body.channel === "SITE_ONLINE";

    if (!isOnlinePublic) {
      const auth = await requireUser(request);
      if (auth.response) return auth.response;
    }

    if (!body.customerName?.trim() || !body.paymentMethod || !body.items?.length) {
      return NextResponse.json({ error: "Cliente, pagamento e itens são obrigatórios" }, { status: 400 });
    }

    const order = await createOrder({
      customerName: body.customerName,
      paymentMethod: body.paymentMethod,
      cashReceivedCents: body.cashReceivedCents,
      channel: body.channel || "SITE_ONLINE",
      notes: body.notes,
      discountCents: body.discountCents,
      splitCount: body.splitCount,
      items: body.items,
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar pedido:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao criar pedido" },
      { status: 400 }
    );
  }
}

