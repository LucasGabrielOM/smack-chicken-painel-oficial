import { NextRequest, NextResponse } from "next/server";
import { validateCoupon } from "@/lib/coupon-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      code?: string;
      phone?: string;
      subtotalCents?: number;
    };

    const code = (body.code || "").trim();
    const phone = (body.phone || "").trim();
    const subtotalCents = typeof body.subtotalCents === "number" ? body.subtotalCents : 0;

    const result = await validateCoupon(code, phone, subtotalCents);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[CouponValidate Error]", error);
    return NextResponse.json(
      { valid: false, error: "Erro interno ao validar cupom." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code")?.trim() || "";
    const phone = searchParams.get("phone")?.trim() || "";
    const subtotalCents = Number(searchParams.get("subtotalCents")) || 0;

    const result = await validateCoupon(code, phone, subtotalCents);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[CouponValidate GET Error]", error);
    return NextResponse.json(
      { valid: false, error: "Erro interno ao validar cupom." },
      { status: 500 }
    );
  }
}
