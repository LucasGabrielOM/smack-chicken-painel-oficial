import { NextRequest, NextResponse } from "next/server";
import { clearSession, getUser, login, setSessionCookie } from "../../../lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    return user
      ? NextResponse.json({ user })
      : NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao autenticar" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { email?: string; password?: string };
    if (!body.email || !body.password) {
      return NextResponse.json({ error: "Informe e-mail e senha" }, { status: 400 });
    }
    const session = await login(body.email, body.password);
    if (!session) return NextResponse.json({ error: "E-mail ou senha inválidos" }, { status: 401 });
    const response = NextResponse.json({ user: session.user });
    setSessionCookie(response, session.token, session.expires);
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao entrar" }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  await clearSession(request, response);
  return response;
}
