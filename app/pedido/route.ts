import { NextResponse } from "next/server";

const ORDER_LINK = "https://smack-chicken-pedidos.lucasgabrielwww2218.workers.dev/";

export async function GET() {
  return NextResponse.redirect(ORDER_LINK);
}
