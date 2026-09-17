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

    if (body.discountCents && body.discountCents > 0) {
      const couponCode = body.couponCode || (/VOLTA10/i.test(body.notes || "") ? "VOLTA10" : null);
      if (couponCode) {
        const { extractCustomerPhone } = await import("../../../lib/order-store");
        const phone = extractCustomerPhone(body.notes);
        if (phone) {
          const { validateCoupon } = await import("../../../lib/coupon-store");
          const validation = await validateCoupon(couponCode, phone);
          if (!validation.valid) {
            return NextResponse.json(
              { error: validation.error || "Cupom inválido ou limite de usos excedido para este WhatsApp." },
              { status: 400 }
            );
          }
        }
      }
    }

    const order = await createOrder({
      customerName: body.customerName,
      paymentMethod: body.paymentMethod,
      cashReceivedCents: body.cashReceivedCents,
      channel: body.channel || "SITE_ONLINE",
      notes: body.notes,
      discountCents: body.discountCents,
      couponCode: body.couponCode,
      deliveryFeeCents: body.deliveryFeeCents,
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

export async function DELETE(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  const { clearAllOrders } = await import("../../../lib/order-store");
  await clearAllOrders();
  return NextResponse.json({ ok: true, message: "Todos os pedidos foram limpos com sucesso" });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  try {
    const body = (await request.json()) as {
      orderIds?: string[];
      motoboyName?: string;
      settled?: boolean;
    };

    const { settleOrdersCash } = await import("../../../lib/order-store");
    const result = await settleOrdersCash({
      orderIds: Array.isArray(body.orderIds) ? body.orderIds : undefined,
      motoboyName: body.motoboyName?.trim() || undefined,
      settled: body.settled !== false,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao registrar acerto de caixa" },
      { status: 400 }
    );
  }
}



