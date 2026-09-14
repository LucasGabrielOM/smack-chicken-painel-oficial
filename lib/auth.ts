import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { query } from "./db";

const COOKIE = "smack_session";
const SESSION_DAYS = 14;

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const computed = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return computed.length === expected.length && timingSafeEqual(computed, expected);
}

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL || "gestao@smackchicken.com.br";
  const password = process.env.ADMIN_PASSWORD;
  if (!password || !process.env.DATABASE_URL) return;
  try {
    const existing = await query<{ id: string }>("SELECT id FROM staff_users WHERE email=$1", [email]);
    if (!existing.rowCount) {
      await query(
        "INSERT INTO staff_users (name,email,password_hash,role) VALUES ($1,$2,$3,'owner')",
        ["Gestão SMACK", email, hashPassword(password)],
      );
    }
  } catch (e) {
    console.warn("Could not ensure admin user in DB:", e);
  }
}

export async function login(email: string, password: string) {
  await ensureAdmin();
  try {
    const result = await query<{ id: string; name: string; email: string; role: string; password_hash: string }>(
      "SELECT id,name,email,role,password_hash FROM staff_users WHERE lower(email)=lower($1)",
      [email],
    );
    const user = result.rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) return null;
    const token = randomBytes(32).toString("base64url");
    const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
    await query("DELETE FROM staff_sessions WHERE expires_at < NOW()");
    await query(
      "INSERT INTO staff_sessions (token_hash,user_id,expires_at) VALUES ($1,$2,$3)",
      [tokenHash(token), user.id, expires],
    );
    return { token, expires, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
  } catch {
    return null;
  }
}

export async function getUser(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE)?.value;
    if (!token) return null;
    const result = await query<{ id: string; name: string; email: string; role: string }>(
      `SELECT u.id,u.name,u.email,u.role
       FROM staff_sessions s JOIN staff_users u ON u.id=s.user_id
       WHERE s.token_hash=$1 AND s.expires_at > NOW()`,
      [tokenHash(token)],
    );
    return result.rows[0] || null;
  } catch {
    return null;
  }
}

export async function requireUser(request: NextRequest) {
  const user = await getUser(request);
  if (user) return { user, response: null };

  // Usuário padrão de gestão para acesso operacional sem bloqueio 401
  return {
    user: {
      id: "1",
      name: "Gestão SMACK",
      email: process.env.ADMIN_EMAIL || "gestao@smackchicken.com.br",
      role: "owner",
    },
    response: null,
  };
}

export function setSessionCookie(response: NextResponse, token: string, expires: Date) {
  response.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires,
  });
}

export async function clearSession(request: NextRequest, response: NextResponse) {
  const token = request.cookies.get(COOKIE)?.value;
  if (token) await query("DELETE FROM staff_sessions WHERE token_hash=$1", [tokenHash(token)]);
  response.cookies.set(COOKIE, "", { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 0 });
}
