import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../lib/auth";
import { query } from "../../../lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (process.env.SMACK_MODE !== "panel") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const result = await query(
    `SELECT id,entry_type AS "entryType",category,description,amount_cents AS "amountCents",
            payment_method AS "paymentMethod",entry_date AS "entryDate",notes,created_at AS "createdAt"
     FROM finance_entries ORDER BY entry_date DESC,created_at DESC LIMIT 500`,
  );
  return NextResponse.json({ entries: result.rows });
}

export async function POST(request: NextRequest) {
  if (process.env.SMACK_MODE !== "panel") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const body = await request.json() as {
    entryType?: string; category?: string; description?: string; amountCents?: number;
    paymentMethod?: string; entryDate?: string; notes?: string;
  };
  if (!["income", "expense"].includes(body.entryType || "") || !body.category || !body.description || !body.amountCents) {
    return NextResponse.json({ error: "Preencha tipo, categoria, descrição e valor" }, { status: 400 });
  }
  const result = await query<{ id: string }>(
    `INSERT INTO finance_entries (entry_type,category,description,amount_cents,payment_method,entry_date,notes)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6::date,CURRENT_DATE),$7) RETURNING id`,
    [body.entryType, body.category, body.description.trim(), body.amountCents, body.paymentMethod || null, body.entryDate || null, body.notes || null],
  );
  return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  if (process.env.SMACK_MODE !== "panel") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Informe o lançamento" }, { status: 400 });
  const result = await query<{ id: string }>("DELETE FROM finance_entries WHERE id=$1 RETURNING id", [id]);
  if (!result.rowCount) return NextResponse.json({ error: "Lançamento não encontrado" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
