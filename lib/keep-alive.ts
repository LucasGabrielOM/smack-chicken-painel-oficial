const RENDER_URL = process.env.EVOLUTION_API_URL || "https://smack-evolution.onrender.com";

let pingInterval: NodeJS.Timeout | null = null;

export function startKeepAlivePing(intervalMinutes: number = 4) {
  if (pingInterval) return;

  const ms = intervalMinutes * 60 * 1000;
  console.log(`[Keep-Alive] Serviço de Anti-Sleep ativado. Pingando ${RENDER_URL} a cada ${intervalMinutes} minutos.`);

  // Executa o primeiro ping imediatamente
  pingServer();

  pingInterval = setInterval(() => {
    pingServer();
  }, ms);
}

async function pingServer() {
  try {
    const res = await fetch(RENDER_URL, {
      method: "GET",
      headers: { "User-Agent": "SmackChickenKeepAlive/1.0" },
    });
    const status = res.status;
    console.log(`[Keep-Alive Ping] ${new Date().toISOString()} | URL: ${RENDER_URL} | Status: ${status}`);
  } catch (err: any) {
    console.warn(`[Keep-Alive Warning] Falha no ping para ${RENDER_URL}:`, err?.message || err);
  }
}
