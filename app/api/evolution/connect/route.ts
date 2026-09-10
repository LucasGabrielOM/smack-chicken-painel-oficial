import { NextRequest, NextResponse } from "next/server";
import { initBaileysService, getBaileysStatus } from "@/lib/baileys-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // Inicializa o motor Baileys embutido no Node.js
  await initBaileysService().catch((err) => console.error("Erro Baileys:", err));

  const status = getBaileysStatus();
  const isJson =
    request.nextUrl.searchParams.get("format") === "json" ||
    request.headers.get("accept")?.includes("application/json");

  if (isJson) {
    return NextResponse.json(status);
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhatsApp Web Admin — Smack Chicken 🍗</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: #e5ddd5; background-image: radial-gradient(#cbd5e1 1px, transparent 1px); background-size: 20px 20px; min-height: 100vh; display: flex; flex-direction: column; color: #111b21; }
    
    /* WhatsApp Header */
    .app-header { background: #008069; color: #ffffff; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 5px rgba(0,0,0,0.15); }
    .app-header .brand { display: flex; align-items: center; gap: 12px; font-size: 20px; font-weight: 700; }
    .app-header .brand svg { width: 32px; height: 32px; fill: currentColor; }
    .app-header .status-pill { font-size: 13px; font-weight: 600; padding: 6px 14px; border-radius: 20px; background: rgba(255,255,255,0.2); backdrop-filter: blur(4px); display: flex; align-items: center; gap: 8px; }
    .status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .status-dot.connected { background: #22c55e; box-shadow: 0 0 8px #22c55e; }
    .status-dot.connecting { background: #eab308; box-shadow: 0 0 8px #eab308; }
    .status-dot.disconnected { background: #ef4444; box-shadow: 0 0 8px #ef4444; }

    /* Layout Wrapper */
    .container { max-width: 1100px; width: 100%; margin: 24px auto; padding: 0 16px; flex: 1; }
    
    /* WhatsApp Card Container */
    .wa-card { background: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; overflow: hidden; display: flex; flex-direction: column; }
    
    /* Tab Navigation */
    .tabs { display: flex; background: #f0f2f5; border-bottom: 1px solid #e2e8f0; }
    .tab-btn { flex: 1; padding: 16px; border: none; background: transparent; font-size: 15px; font-weight: 600; color: #54656f; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; border-bottom: 3px solid transparent; }
    .tab-btn:hover { background: #e9edef; color: #111b21; }
    .tab-btn.active { color: #008069; border-bottom-color: #008069; background: #ffffff; }

    /* Tab Contents */
    .tab-content { padding: 32px; display: none; }
    .tab-content.active { display: block; }

    /* Connect Tab */
    .qr-section { text-align: center; max-width: 480px; margin: 0 auto; }
    .qr-box { background: #ffffff; padding: 20px; border-radius: 16px; border: 2px dashed #008069; display: inline-block; box-shadow: 0 8px 25px rgba(0,128,105,0.1); margin: 20px 0; }
    .qr-box img { width: 260px; height: 260px; display: block; border-radius: 8px; }
    .instructions { background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; text-align: left; font-size: 14px; line-height: 1.6; color: #334155; }
    .instructions ol { padding-left: 20px; }
    .instructions li { margin-bottom: 8px; }

    /* Broadcast Tab */
    .broadcast-grid { display: grid; grid-template-columns: 1fr 340px; gap: 24px; }
    @media (max-width: 850px) { .broadcast-grid { grid-template-columns: 1fr; } }
    
    .form-group { margin-bottom: 20px; }
    label { display: block; font-size: 14px; font-weight: 700; color: #111b21; margin-bottom: 8px; }
    textarea, input, select { width: 100%; padding: 14px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; color: #111b21; outline: none; transition: 0.2s; }
    textarea:focus, input:focus { border-color: #008069; background: #ffffff; box-shadow: 0 0 0 3px rgba(0,128,105,0.15); }
    textarea { height: 120px; resize: vertical; }
    .hint { font-size: 12px; color: #64748b; margin-top: 6px; }
    
    .btn-send { width: 100%; padding: 16px; background: #008069; border: none; border-radius: 10px; color: #ffffff; font-size: 16px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: 0.2s; box-shadow: 0 4px 12px rgba(0,128,105,0.3); }
    .btn-send:hover { background: #006e5a; }
    .btn-send:disabled { background: #94a3b8; cursor: not-allowed; box-shadow: none; }

    /* WhatsApp Live Chat Preview Box */
    .wa-preview { background: #e5ddd5; background-image: radial-gradient(#cbd5e1 1px, transparent 1px); background-size: 14px 14px; border-radius: 12px; padding: 16px; border: 1px solid #cbd5e1; display: flex; flex-direction: column; justify-content: flex-end; min-height: 320px; }
    .wa-message-bubble { background: #d9fdd3; color: #111b21; padding: 12px 14px; border-radius: 12px 0 12px 12px; font-size: 14px; line-height: 1.5; box-shadow: 0 1px 2px rgba(0,0,0,0.15); max-width: 90%; align-self: flex-end; position: relative; word-wrap: break-word; white-space: pre-wrap; }
    .wa-message-bubble .time { font-size: 11px; color: #667781; text-align: right; margin-top: 4px; display: flex; align-items: center; justify-content: flex-end; gap: 4px; }
    .wa-message-bubble .ticks { color: #53bdeb; font-weight: bold; }

    /* Log Box */
    #logBox { margin-top: 20px; background: #1e293b; color: #f8fafc; padding: 16px; border-radius: 8px; font-family: monospace; font-size: 13px; max-height: 180px; overflow-y: auto; display: none; }
    .log-success { color: #4ade80; }
    .log-error { color: #f87171; }
    .log-info { color: #38bdf8; }
  </style>
</head>
<body>

  <!-- Header Estilo WhatsApp Web -->
  <header class="app-header">
    <div class="brand">
      <svg viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
      <span>Smack Chicken — Painel WhatsApp</span>
    </div>

    <div class="status-pill">
      <span class="status-dot ${status.connectionState.toLowerCase()}"></span>
      <span id="headerStatusText">${status.connectionState === "CONNECTED" ? "BOT ON-LINE" : status.connectionState}</span>
    </div>
  </header>

  <!-- Main Layout Container -->
  <div class="container">
    <div class="wa-card">
      
      <!-- Tabs Navigation -->
      <nav class="tabs">
        <button class="tab-btn active" onclick="switchTab('connectTab', this)">
          📱 <span>Aparelho & QR Code</span>
        </button>
        <button class="tab-btn" onclick="switchTab('broadcastTab', this)">
          🚀 <span>Disparo em Massa</span>
        </button>
        <button class="tab-btn" onclick="switchTab('templateTab', this)">
          💡 <span>Modelos de Promoção</span>
        </button>
      </nav>

      <!-- TAB 1: Conectar QR Code -->
      <div id="connectTab" class="tab-content active">
        <div class="qr-section">
          <h2 style="font-size: 22px; color: #111b21; margin-bottom: 8px;">Conecte o seu WhatsApp</h2>
          <p style="color: #667781; font-size: 14px;">Escaneie o QR Code abaixo com a câmera do aplicativo WhatsApp do seu celular.</p>

          <div id="qrBoxContainer">
            ${
              status.connectionState === "CONNECTED"
                ? `
                <div style="background: rgba(34,197,94,0.1); border: 2px solid #22c55e; color: #15803d; padding: 24px; border-radius: 16px; margin: 24px 0; font-size: 16px; font-weight: 700;">
                  🎉 BOT CONECTADO E FUNCIONANDO!
                  <p style="font-size: 14px; font-weight: normal; margin-top: 8px; color: #334155;">
                    O robô da Smack Chicken está ativo e respondendo aos clientes no seu número de WhatsApp.
                  </p>
                </div>
              `
                : status.qrCodeBase64
                ? `
                <div class="qr-box">
                  <img src="${status.qrCodeBase64}" alt="QR Code WhatsApp">
                </div>
              `
                : `
                <div class="qr-box" style="padding: 40px; color: #64748b;">
                  ⏳ <strong>Gerando QR Code...</strong>
                </div>
              `
            }
          </div>

          <div class="instructions">
            <strong>📱 Passo a passo para conectar:</strong>
            <ol>
              <li>Abra o <strong>WhatsApp</strong> no seu celular.</li>
              <li>Toque em <strong>Mais opções</strong> (no Android) ou <strong>Configurações</strong> (no iPhone).</li>
              <li>Toque em <strong>Aparelhos Conectados</strong> e depois em <strong>Conectar um Aparelho</strong>.</li>
              <li>Aponte o celular para esta tela para capturar o <strong>QR Code</strong>.</li>
            </ol>
          </div>
        </div>
      </div>

      <!-- TAB 2: Disparo em Massa -->
      <div id="broadcastTab" class="tab-content">
        <div class="broadcast-grid">
          
          <!-- Formulário -->
          <div>
            <h2 style="font-size: 20px; color: #111b21; margin-bottom: 6px;">Nova Campanha de Disparo</h2>
            <p style="color: #667781; font-size: 14px; margin-bottom: 20px;">Envie ofertas e cupons para a sua lista de contatos sem limites da Meta.</p>

            <form id="broadcastForm">
              <div class="form-group">
                <label>Lista de Telefones (1 por linha ou separados por vírgula)</label>
                <textarea id="numbersInput" placeholder="Ex: 5548996116327&#10;5548988888888" required></textarea>
                <div class="hint">Adicione o DDD + número (ex: 48996116327).</div>
              </div>

              <div class="form-group">
                <label>Mensagem da Promoção</label>
                <textarea id="messageInput" placeholder="🔥 PROMOÇÃO SMACK CHICKEN!&#10;&#10;Na compra de qualquer Balde G, leve 1 Guaraná 1L grátis! 🍗🥤&#10;&#10;Responda CARDAPIO para pedir!" oninput="updatePreview(this.value)" required></textarea>
              </div>

              <div class="form-group">
                <label>Intervalo Anti-Spam (Segundos entre disparos)</label>
                <input type="number" id="delayInput" value="3" min="1" max="30">
                <div class="hint">Intervalo de segurança recomendado: 3 a 5 segundos.</div>
              </div>

              <button type="submit" class="btn-send" id="btnBroadcast">
                🚀 Iniciar Disparo em Massa
              </button>
            </form>

            <div id="logBox"></div>
          </div>

          <!-- Live WhatsApp Preview Box -->
          <div>
            <label style="margin-bottom: 12px;">📱 Pré-visualização no Celular</label>
            <div class="wa-preview">
              <div class="wa-message-bubble">
                <span id="previewText">🔥 PROMOÇÃO SMACK CHICKEN!&#10;&#10;Na compra de qualquer Balde G, leve 1 Guaraná 1L grátis! 🍗🥤</span>
                <div class="time">
                  <span id="previewTime">12:00</span>
                  <span class="ticks">✓✓</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- TAB 3: Modelos de Promoção Prontos -->
      <div id="templateTab" class="tab-content">
        <h2 style="font-size: 20px; color: #111b21; margin-bottom: 16px;">Modelos de Promoção Prontos</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
          
          <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 18px;">
            <h3 style="font-size: 16px; color: #008069; margin-bottom: 8px;">🔥 Promoção de Sexta-Feira</h3>
            <p style="font-size: 13px; color: #334155; line-height: 1.5; white-space: pre-wrap; margin-bottom: 14px;">🔥 SEXTOU NA SMACK CHICKEN! 🍗🔥&#10;&#10;Peça hoje qualquer Balde M ou G e leve 1 Porção de Batata Frita por nossa conta!&#10;&#10;Responda *CARDAPIO* para fazer o seu pedido!</p>
            <button onclick="useTemplate(this)" style="background: #008069; color: #fff; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer;">Usar Este Modelo</button>
          </div>

          <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 18px;">
            <h3 style="font-size: 16px; color: #008069; margin-bottom: 8px;">🍱 Almoço Executivo — Marmita 600g</h3>
            <p style="font-size: 13px; color: #334155; line-height: 1.5; white-space: pre-wrap; margin-bottom: 14px;">🍱 HORA DO ALMOÇO NA SMACK! 😋&#10;&#10;Marmita completa de 600g com filé de sassami crocante, arroz, feijão e batata frita por apenas R$ 29,90!&#10;&#10;Responda *PEDIDO* para receber quente na sua casa!</p>
            <button onclick="useTemplate(this)" style="background: #008069; color: #fff; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer;">Usar Este Modelo</button>
          </div>

        </div>
      </div>

    </div>
  </div>

  <script>
    function switchTab(tabId, btn) {
      document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
      document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));
      document.getElementById(tabId).classList.add("active");
      btn.classList.add("active");
    }

    function updatePreview(val) {
      document.getElementById("previewText").innerText = val || "Sua mensagem aparecerá aqui...";
      const now = new Date();
      document.getElementById("previewTime").innerText = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    }

    function useTemplate(btnEl) {
      const text = btnEl.previousElementSibling.innerText;
      document.getElementById("messageInput").value = text;
      updatePreview(text);
      switchTab("broadcastTab", document.querySelectorAll(".tab-btn")[1]);
    }

    // Live Polling do QR Code e Conexão
    setInterval(async () => {
      try {
        const res = await fetch("/api/evolution/connect?format=json");
        const data = await res.json();
        
        const dot = document.querySelector(".status-dot");
        const statusText = document.getElementById("headerStatusText");
        
        dot.className = "status-dot " + data.connectionState.toLowerCase();
        statusText.innerText = data.connectionState === "CONNECTED" ? "BOT ON-LINE" : data.connectionState;

        const qrBox = document.getElementById("qrBoxContainer");
        if (data.connectionState === "CONNECTED") {
          qrBox.innerHTML = \`<div style="background: rgba(34,197,94,0.1); border: 2px solid #22c55e; color: #15803d; padding: 24px; border-radius: 16px; margin: 24px 0; font-size: 16px; font-weight: 700;">
            🎉 BOT CONECTADO E FUNCIONANDO!
            <p style="font-size: 14px; font-weight: normal; margin-top: 8px; color: #334155;">
              O robô da Smack Chicken está ativo e respondendo aos clientes no seu número de WhatsApp.
            </p>
          </div>\`;
        } else if (data.qrCodeBase64) {
          qrBox.innerHTML = \`<div class="qr-box"><img src="\${data.qrCodeBase64}" alt="QR Code WhatsApp"></div>\`;
        }
      } catch (err) {}
    }, 4000);

    // Form Disparo Submit
    document.getElementById("broadcastForm").addEventListener("submit", async function(e) {
      e.preventDefault();
      const btn = document.getElementById("btnBroadcast");
      const log = document.getElementById("logBox");

      const numbersText = document.getElementById("numbersInput").value;
      const message = document.getElementById("messageInput").value;
      const delaySeconds = parseInt(document.getElementById("delayInput").value, 10);

      const numbers = numbersText.split(/[,\\n]/).map(n => n.trim()).filter(n => n.length >= 8);

      if (!numbers.length) {
        alert("Insira ao menos um número de WhatsApp válido.");
        return;
      }

      btn.disabled = true;
      btn.innerHTML = "⏳ Disparando mensagens...";
      log.style.display = "block";
      log.innerHTML = \`<div class="log-info">[Iniciando Disparo] Enviando para \${numbers.length} contatos...</div>\`;

      try {
        const res = await fetch("/api/whatsapp/broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ numbers, message, delaySeconds }),
        });

        const data = await res.json();
        if (!res.ok) {
          log.innerHTML += \`<div class="log-error">Erro: \${data.error}</div>\`;
        } else {
          log.innerHTML += \`<div class="log-success">✅ Disparo Concluído! Sucessos: \${data.successCount} / \${data.totalSent}</div>\`;
          if (data.results) {
            data.results.forEach(r => {
              log.innerHTML += \`<div class="\${r.success ? 'log-success' : 'log-error'}">\${r.phone}: \${r.success ? 'Mensagem Entregue ✓' : 'Falha ao Enviar'}</div>\`;
            });
          }
        }
      } catch (err) {
        log.innerHTML += \`<div class="log-error">Erro de rede: \${err}</div>\`;
      } finally {
        btn.disabled = false;
        btn.innerHTML = "🚀 Iniciar Disparo em Massa";
      }
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
