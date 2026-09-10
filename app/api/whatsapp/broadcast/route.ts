import { NextRequest, NextResponse } from "next/server";
import { sendBroadcastMessage } from "@/lib/baileys-service";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET: Obtém a lista de números de clientes cadastrados nos pedidos anteriores
 */
export async function GET(request: NextRequest) {
  try {
    const result = await query<{ notes: string; customer_name: string }>(
      `SELECT DISTINCT notes, customer_name FROM orders WHERE notes LIKE '%Tel:%' LIMIT 500`
    );

    const contacts: Array<{ phone: string; name: string }> = [];
    const seen = new Set<string>();

    for (const row of result.rows) {
      const match = row.notes?.match(/Tel:\s*(\d+)/);
      if (match && match[1]) {
        const phone = match[1];
        if (!seen.has(phone)) {
          seen.add(phone);
          contacts.push({ phone, name: row.customer_name });
        }
      }
    }

    return NextResponse.json({ total: contacts.length, contacts });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/**
 * POST: Executa o disparo em massa para uma lista de números
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      numbers: string[];
      message: string;
      delaySeconds?: number;
    };

    if (!body.numbers || !Array.isArray(body.numbers) || !body.numbers.length) {
      return NextResponse.json({ error: "É necessário fornecer ao menos 1 número para o disparo." }, { status: 400 });
    }

    if (!body.message || !body.message.trim()) {
      return NextResponse.json({ error: "O texto da mensagem de disparo não pode estar vazio." }, { status: 400 });
    }

    const delayMs = (body.delaySeconds || 3) * 1000;
    console.log(`[Broadcast Init] Iniciando disparo em massa para ${body.numbers.length} contatos com intervalo de ${delayMs}ms...`);

    const results = await sendBroadcastMessage(body.numbers, body.message.trim(), delayMs);
    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      totalSent: body.numbers.length,
      successCount,
      failCount: body.numbers.length - successCount,
      results,
    });
  } catch (error: any) {
    console.error("[Broadcast API Error]", error);
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
  }
}
