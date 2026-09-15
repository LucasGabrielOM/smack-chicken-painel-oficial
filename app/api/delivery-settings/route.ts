import { NextRequest, NextResponse } from "next/server";
import { loadDeliverySettings, saveDeliverySettings } from "../../../lib/product-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await loadDeliverySettings();
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao carregar taxas de entrega" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Parameters<typeof saveDeliverySettings>[0];
    const settings = await saveDeliverySettings(body);
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao salvar taxas de entrega" },
      { status: 400 }
    );
  }
}
