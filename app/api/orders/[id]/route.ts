import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../../lib/auth";
import { query } from "../../../../lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (process.env.SMACK_MODE !== "panel") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const body = await request.json() as { status?: string };
  if (!["preparing", "ready", "completed", "cancelled"].includes(body.status || "")) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }
  const result = await query(
    `UPDATE orders SET status=$1,
       ready_at=CASE WHEN $1='ready' THEN NOW() ELSE ready_at END,
       completed_at=CASE WHEN $1='completed' THEN NOW() ELSE completed_at END
     WHERE id=$2 RETURNING id`,
    [body.status, id],
  );
  if (!result.rowCount) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
