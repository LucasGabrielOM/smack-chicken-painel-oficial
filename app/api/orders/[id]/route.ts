import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../../lib/auth";
import { deleteOrder, updateOrderStatus } from "../../../../lib/order-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAYMENTS = ["Pix", "Dinheiro", "Crédito", "Débito", "Cartão de Crédito na Entrega", "Cartão de Débito na Entrega"];

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const body = (await request.json()) as {
    status?: "preparing" | "ready" | "completed" | "cancelled";
    customerName?: string;
    notes?: string;
    paymentMethod?: string;
    cashSettled?: boolean;
    cashSettledAt?: string | null;
  };

  if (body.customerName !== undefined && !body.customerName.trim()) {
    return NextResponse.json({ error: "Nome do cliente não pode ficar vazio" }, { status: 400 });
  }

  if (body.status !== undefined && !["preparing", "ready", "completed", "cancelled"].includes(body.status)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  const updated = await updateOrderStatus(id, {
    status: body.status,
    customerName: body.customerName,
    notes: body.notes,
    paymentMethod: body.paymentMethod,
    cashSettled: body.cashSettled,
    cashSettledAt: body.cashSettledAt,
  });

  if (!updated) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, order: updated });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;

  const deleted = await deleteOrder(id);
  if (!deleted) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

