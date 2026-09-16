import { NextRequest, NextResponse } from "next/server";
import { getMotoboys, saveMotoboy, deleteMotoboy } from "../../../lib/motoboy-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const motoboys = await getMotoboys();
    return NextResponse.json({ ok: true, motoboys });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "Falha ao buscar motoboys" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { id?: string; name?: string; phone?: string; vehicle?: string; active?: boolean };
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ ok: false, error: "Nome do motoboy é obrigatório" }, { status: 400 });
    }
    const motoboy = await saveMotoboy({
      id: body.id,
      name: body.name.trim(),
      phone: body.phone,
      vehicle: body.vehicle,
      active: body.active,
    });
    return NextResponse.json({ ok: true, motoboy });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "Falha ao salvar motoboy" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "ID não fornecido" }, { status: 400 });
    }
    const success = await deleteMotoboy(id);
    return NextResponse.json({ ok: success });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "Falha ao deletar motoboy" }, { status: 500 });
  }
}
