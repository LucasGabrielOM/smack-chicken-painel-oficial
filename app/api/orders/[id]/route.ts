import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../../lib/auth";
import { query } from "../../../../lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAYMENTS = ["Pix", "Dinheiro", "Crédito", "Débito"];

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (process.env.SMACK_MODE !== "panel") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const body = await request.json() as { status?: string; customerName?: string; notes?: string; paymentMethod?: string };

  const fields: string[] = [];
  const values: unknown[] = [];
  let n = 1;

  if (typeof body.customerName === "string") {
    if (!body.customerName.trim()) return NextResponse.json({ error: "Nome do cliente não pode ficar vazio" }, { status: 400 });
    fields.push(`customer_name=$${n++}`);
    values.push(body.customerName.trim());
  }
  if (body.notes !== undefined) {
    fields.push(`notes=$${n++}`);
    values.push((body.notes ?? "").trim() || null);
  }
  if (typeof body.paymentMethod === "string") {
    if (!PAYMENTS.includes(body.paymentMethod)) return NextResponse.json({ error: "Forma de pagamento inválida" }, { status: 400 });
    fields.push(`payment_method=$${n++}`);
    values.push(body.paymentMethod);
  }
  if (body.status !== undefined) {
    if (!["preparing", "ready", "completed", "cancelled"].includes(body.status)) {
      return NextResponse.json({ error: "Status inválido" }, { status: 400 });
    }
    const p = n++;
    fields.push(`status=$${p}`);
    fields.push(`ready_at=CASE WHEN $${p}='ready' THEN NOW() ELSE ready_at END`);
    fields.push(`completed_at=CASE WHEN $${p}='completed' THEN NOW() ELSE completed_at END`);
    values.push(body.status);
  }

  if (!fields.length) return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });

  values.push(id);
  const result = await query(`UPDATE orders SET ${fields.join(",")} WHERE id=$${n} RETURNING id`, values);
  if (!result.rowCount) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (process.env.SMACK_MODE !== "panel") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;

  const result = await query("DELETE FROM orders WHERE id=$1 RETURNING id", [id]);
  if (!result.rowCount) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
