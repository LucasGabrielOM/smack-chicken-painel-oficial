import { NextRequest, NextResponse } from "next/server";
import {
  loadProductsStore,
  saveProduct,
  deleteProduct,
  toggleProductActive,
} from "../../../lib/product-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await loadProductsStore();
    return NextResponse.json({ products });
  } catch (error) {
    console.error("Erro ao listar produtos:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao carregar produtos" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Parameters<typeof saveProduct>[0];
    const product = await saveProduct(body);
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao criar produto" },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as { id?: string | number; toggleActive?: boolean } & Parameters<typeof saveProduct>[0];
    if (!body.id) {
      return NextResponse.json({ error: "ID do produto é obrigatório" }, { status: 400 });
    }

    if (body.toggleActive) {
      const product = await toggleProductActive(body.id);
      if (!product) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
      return NextResponse.json({ product });
    }

    const product = await saveProduct(body);
    return NextResponse.json({ product });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao atualizar produto" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID do produto é obrigatório" }, { status: 400 });
    }

    const ok = await deleteProduct(id);
    return NextResponse.json({ ok });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao excluir produto" },
      { status: 400 }
    );
  }
}
