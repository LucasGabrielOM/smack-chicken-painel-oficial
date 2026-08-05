import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../lib/auth";
import { query } from "../../../lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const result = await query(
    `SELECT id,title,target_cents AS "targetCents",current_cents AS "currentCents",
            due_date AS "dueDate",status,notes FROM financial_plans
     ORDER BY status='active' DESC,due_date NULLS LAST`,
  );
  return NextResponse.json({ plans: result.rows });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const body = await request.json() as { title?: string; targetCents?: number; currentCents?: number; dueDate?: string; notes?: string };
  if (!body.title?.trim() || !body.targetCents) return NextResponse.json({ error: "Informe título e meta" }, { status: 400 });
  const result = await query<{ id: string }>(
    `INSERT INTO financial_plans (title,target_cents,current_cents,due_date,notes)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [body.title.trim(), body.targetCents, body.currentCents || 0, body.dueDate || null, body.notes || null],
  );
  return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Informe a meta" }, { status: 400 });
  const result = await query<{ id: string }>("DELETE FROM financial_plans WHERE id=$1 RETURNING id", [id]);
  if (!result.rowCount) return NextResponse.json({ error: "Meta não encontrada" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
