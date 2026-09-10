import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Disparo em Massa WhatsApp — Smack Chicken 🍗</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background: #0f172a; color: #f8fafc; padding: 30px 20px; display: flex; justify-content: center; }
    .card { background: #1e293b; border-radius: 20px; box-shadow: 0 15px 35px rgba(0,0,0,0.5); padding: 36px; max-width: 680px; width: 100%; border: 1px solid #334155; }
    h1 { color: #f97316; font-size: 26px; font-weight: 800; display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
    p.desc { color: #94a3b8; font-size: 14px; margin-bottom: 24px; line-height: 1.5; }
    .banner { background: rgba(34,197,94,0.12); border: 1px solid #22c55e; color: #4ade80; padding: 14px; border-radius: 10px; font-size: 13px; margin-bottom: 24px; line-height: 1.5; }
    .form-group { margin-bottom: 20px; }
    label { display: block; font-size: 13px; color: #cbd5e1; font-weight: 700; margin-bottom: 8px; }
    textarea, input { width: 100%; padding: 14px; background: #0f172a; border: 1px solid #475569; border-radius: 10px; color: #fff; font-size: 14px; outline: none; }
    textarea:focus, input:focus { border-color: #f97316; }
    textarea { height: 130px; resize: vertical; }
    .hint { font-size: 12px; color: #64748b; margin-top: 6px; }
    button { width: 100%; padding: 16px; background: #f97316; border: none; border-radius: 10px; color: #fff; font-weight: 800; font-size: 16px; cursor: pointer; transition: 0.2s; }
    button:hover { background: #ea580c; }
    button:disabled { background: #475569; cursor: not-allowed; }
    #log { margin-top: 24px; background: #0f172a; padding: 16px; border-radius: 10px; border: 1px solid #334155; font-family: monospace; font-size: 13px; max-height: 200px; overflow-y: auto; display: none; }
    .log-success { color: #4ade80; }
    .log-error { color: #f87171; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🚀 Disparo em Massa no WhatsApp</h1>
    <p class="desc">Envie campanhas promocionais, cupons e comunicados diretamente para o WhatsApp dos seus clientes sem limites da Meta.</p>

    <div class="banner">
      ⚡ <strong>Vantagens vs Meta:</strong> Zero custo por mensagem, zero necessidade de aprovação de modelos, envio imediato com emojis e formatação!
    </div>

    <form id="broadcastForm">
      <div class="form-group">
        <label>Números dos Destinatários (1 por linha ou separados por vírgula)</label>
        <textarea id="numbersInput" placeholder="Ex: 5548996116327&#10;5548988888888" required></textarea>
        <div class="hint">Digite o DDD + Número (ex: 48996116327). Formatação internacional é aplicada automaticamente.</div>
      </div>

      <div class="form-group">
        <label>Mensagem da Campanha / Promoção</label>
        <textarea id="messageInput" placeholder="🔥 PROMOÇÃO SMACK CHICKEN!&#10;&#10;Nesta sexta-feira, peça qualquer Balde G e ganhe 1 Guaraná 1L grátis! 🍗🥤&#10;&#10;Responda CARDAPIO para fazer seu pedido agora!" required></textarea>
      </div>

      <div class="form-group">
        <label>Intervalo de Segurança Anti-Spam (Segundos entre cada mensagem)</label>
        <input type="number" id="delayInput" value="3" min="1" max="30">
        <div class="hint">Recomendado: 3 a 5 segundos para segurança do seu WhatsApp.</div>
      </div>

      <button type="submit" id="submitBtn">🚀 Iniciar Disparo em Massa</button>
    </form>

    <div id="log"></div>
  </div>

  <script>
    document.getElementById("broadcastForm").addEventListener("submit", function(e) {
      e.preventDefault();
      var btn = document.getElementById("submitBtn");
      var log = document.getElementById("log");

      var numbersText = document.getElementById("numbersInput").value;
      var message = document.getElementById("messageInput").value;
      var delaySeconds = parseInt(document.getElementById("delayInput").value, 10);

      var numbers = numbersText.split(/[,\\n]/).map(function(n) { return n.trim(); }).filter(function(n) { return n.length >= 8; });

      if (!numbers.length) {
        alert("Insira ao menos um número válido.");
        return;
      }

      btn.disabled = true;
      btn.innerText = "⏳ Disparando mensagens...";
      log.style.display = "block";
      log.innerHTML = '<div style="color:#38bdf8;">[Iniciando] Enviando para ' + numbers.length + ' contatos...</div>';

      fetch("/api/whatsapp/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numbers: numbers, message: message, delaySeconds: delaySeconds }),
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.error) {
          log.innerHTML += '<div class="log-error">Erro: ' + data.error + '</div>';
        } else {
          log.innerHTML += '<div class="log-success">✅ Disparo Concluído! Sucessos: ' + data.successCount + ' / ' + data.totalSent + '</div>';
          if (data.results) {
            data.results.forEach(function(r) {
              log.innerHTML += '<div class="' + (r.success ? 'log-success' : 'log-error') + '">' + r.phone + ': ' + (r.success ? 'Enviado' : 'Falha') + '</div>';
            });
          }
        }
      })
      .catch(function(err) {
        log.innerHTML += '<div class="log-error">Erro de rede: ' + err + '</div>';
      })
      .finally(function() {
        btn.disabled = false;
        btn.innerText = "🚀 Iniciar Disparo em Massa";
      });
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
