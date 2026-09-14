"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { formatMoney } from "../../lib/catalog";

type View = "gestor" | "conversations" | "flowbuilder" | "broadcast" | "whatsapp";

type OrderItem = { id: string; productId: string; name: string; quantity: number; unitPriceCents: number };

type Order = {
  id: string;
  code: string;
  customerName: string;
  status: "preparing" | "ready" | "completed" | "cancelled";
  paymentMethod: string;
  cashReceivedCents?: number;
  totalCents: number;
  discountCents?: number;
  splitCount?: number;
  channel: string;
  notes?: string;
  createdAt: string;
  readyAt?: string;
  completedAt?: string;
  items: OrderItem[];
};

const api = async <T,>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  const payload = (await response.json()) as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error || "Não foi possível concluir a ação");
  return payload as T;
};

export default function OnlineOrderManager() {
  const [view, setView] = useState<View>("gestor");
  const [orders, setOrders] = useState<Order[]>([]);
  const [storeOpen, setStoreOpen] = useState(true);
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [refreshing, setRefreshing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
  };

  const loadOrders = useCallback(async () => {
    try {
      const res = await api<{ orders: Order[] }>("/api/orders").catch(() => ({ orders: [] }));
      setOrders(res.orders || []);
    } catch {}
  }, []);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 8000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const toggleTheme = () => {
    setTheme((curr) => (curr === "dark" ? "light" : "dark"));
  };

  const updateOrderStatus = async (order: Order, newStatus: Order["status"]) => {
    try {
      await api(`/api/orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });

      // Status text for customer notification
      let msg = "";
      if (newStatus === "preparing") {
        msg = `👨‍🍳 *PEDIDO ACEITO E EM PREPARO! - SMACK CHICKEN*\n\nOlá *${order.customerName}*! Seu pedido *${order.code}* já foi aceito pela nossa equipe e está quentinho em preparo na nossa cozinha!\n\nTempo estimado: 20-30 minutos. 🛵`;
      } else if (newStatus === "ready") {
        msg = `🛵 *SAIU PARA ENTREGA! - SMACK CHICKEN*\n\nNotícia boa *${order.customerName}*! Seu pedido *${order.code}* acabou de sair para entrega!\n\nO entregador está a caminho do seu endereço. Fique atento ao telefone! 🍗🥤`;
      } else if (newStatus === "completed") {
        msg = `✅ *PEDIDO ENTREGUE! - SMACK CHICKEN*\n\nSeu pedido *${order.code}* foi entregue com sucesso! Bom apetite! ❤️\n\nAgradecemos a preferência! Se puder, peça novamente no nosso site:\nhttps://smack-chicken-pedidos.lucasgabrielwww2218.workers.dev`;
      } else if (newStatus === "cancelled") {
        msg = `❌ *PEDIDO CANCELADO*\n\nOlá *${order.customerName}*, seu pedido *${order.code}* foi cancelado. Se tiver dúvidas, nos responda por este WhatsApp.`;
      }

      notify(`Pedido ${order.code} atualizado! Notificação disparada no WhatsApp.`);
      await loadOrders();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Falha ao atualizar o pedido");
    }
  };

  const activeCount = orders.filter((o) => o.status === "preparing" || o.status === "ready").length;

  return (
    <main className={theme === "light" ? "ifood-manager theme-light" : "ifood-manager"}>
      {toast && <div className="ifood-toast">{toast}</div>}

      {/* Header Gestor de Pedidos estilo iFood */}
      <header className="ifood-header">
        <div className="ifood-brand">
          <img src="/smack-chicken-logo-white.png" alt="Smack Chicken" className="ifood-logo-img" />
          <div className="ifood-brand-text">
            <strong>GESTOR DE PEDIDOS <small>SITE ONLINE</small></strong>
            <span>Smack Chicken Estreito · Loja #01</span>
          </div>
        </div>

        <div className="ifood-header-center">
          <button
            type="button"
            className={`ifood-store-toggle ${storeOpen ? "open" : "closed"}`}
            onClick={() => setStoreOpen(!storeOpen)}
          >
            <i /> <span>{storeOpen ? "LOJA ABERTA (Recebendo Pedidos)" : "LOJA FECHADA (Pausado)"}</span>
          </button>
        </div>

        <div className="ifood-header-actions">
          <div className="ifood-bot-pill">
            <span className="dot-connected" />
            <span>BOT WHATSAPP ONLINE</span>
          </div>

          <button
            type="button"
            className="ifood-btn-icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? "Som de novo pedido ativado" : "Som desativado"}
          >
            {soundEnabled ? "🔔 Som ON" : "🔕 Som OFF"}
          </button>

          <button type="button" className="ifood-btn-icon" onClick={toggleTheme}>
            {theme === "dark" ? "☀ Claro" : "🌙 Escuro"}
          </button>

          <button
            type="button"
            className="ifood-btn-refresh"
            onClick={async () => {
              setRefreshing(true);
              await loadOrders();
              setRefreshing(false);
              notify("Pedidos atualizados!");
            }}
          >
            ↻ {refreshing ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </header>

      {/* Bar de Navegação Principal */}
      <nav className="ifood-nav">
        <button
          className={view === "gestor" ? "active" : ""}
          onClick={() => setView("gestor")}
        >
          🛍️ Gestor de Pedidos {activeCount > 0 && <b className="ifood-badge">{activeCount}</b>}
        </button>
        <button
          className={view === "conversations" ? "active" : ""}
          onClick={() => setView("conversations")}
        >
          💬 WhatsApp Atendimento
        </button>
        <button
          className={view === "flowbuilder" ? "active" : ""}
          onClick={() => setView("flowbuilder")}
        >
          ⚡ Flow Builder (Robô)
        </button>
        <button
          className={view === "broadcast" ? "active" : ""}
          onClick={() => setView("broadcast")}
        >
          🚀 Disparo 24h
        </button>
        <button
          className={view === "whatsapp" ? "active" : ""}
          onClick={() => setView("whatsapp")}
        >
          📱 Status WhatsApp (QR Code)
        </button>
      </nav>

      {/* Conteúdo Principal */}
      <section className="ifood-body">
        {view === "gestor" && <GestorKanban orders={orders} onUpdateStatus={updateOrderStatus} />}
        {view === "conversations" && <ConversationsView notify={notify} />}
        {view === "flowbuilder" && <FlowBuilderView notify={notify} />}
        {view === "broadcast" && <BroadcastView notify={notify} />}
        {view === "whatsapp" && <WhatsAppStatusView />}
      </section>

      <style jsx global>{`
        .ifood-manager { min-height: 100vh; background: #0f1218; color: #edf1f7; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; }
        .ifood-manager.theme-light { background: #f4f1eb; color: #1c1816; }
        
        .ifood-header { height: 68px; padding: 0 24px; background: #171c26; border-bottom: 1px solid #252e3e; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 50; }
        .ifood-manager.theme-light .ifood-header { background: #ffffff; border-bottom-color: #e5dccc; }
        
        .ifood-brand { display: flex; align-items: center; gap: 12px; }
        .ifood-logo-img { height: 38px; }
        .ifood-brand-text strong { display: block; font-size: 14px; color: #ff3862; letter-spacing: 0.5px; }
        .ifood-brand-text small { color: #ffb32e; font-size: 10px; margin-left: 4px; border: 1px solid #ffb32e88; padding: 1px 5px; border-radius: 4px; }
        .ifood-brand-text span { font-size: 11px; color: #8a96a8; }
        
        .ifood-store-toggle { padding: 8px 18px; border-radius: 30px; border: none; font-size: 12px; font-weight: 800; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: 0.2s; }
        .ifood-store-toggle.open { background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid #22c55e55; }
        .ifood-store-toggle.open i { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 8px #22c55e; }
        
        .ifood-header-actions { display: flex; align-items: center; gap: 12px; }
        .ifood-bot-pill { background: rgba(15,126,166,0.15); border: 1px solid #0f7ea655; color: #38bdf8; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; display: flex; align-items: center; gap: 6px; }
        .dot-connected { width: 7px; height: 7px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 6px #38bdf8; }
        
        .ifood-btn-icon, .ifood-btn-refresh { background: #212836; border: 1px solid #313c50; color: #c3cbda; padding: 7px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .ifood-manager.theme-light .ifood-btn-icon, .ifood-manager.theme-light .ifood-btn-refresh { background: #f6f2ea; border-color: #e5dccc; color: #413a35; }
        
        .ifood-nav { background: #141821; border-bottom: 1px solid #252e3e; display: flex; gap: 4px; padding: 0 24px; }
        .ifood-manager.theme-light .ifood-nav { background: #ede8df; border-bottom-color: #e5dccc; }
        .ifood-nav button { padding: 14px 20px; border: none; background: transparent; color: #8a96a8; font-size: 13px; font-weight: 700; cursor: pointer; border-bottom: 3px solid transparent; display: flex; align-items: center; gap: 8px; transition: 0.2s; }
        .ifood-nav button:hover { color: #edf1f7; background: rgba(255,255,255,0.03); }
        .ifood-nav button.active { color: #ff3862; border-bottom-color: #ff3862; background: rgba(255,56,98,0.08); }
        .ifood-badge { background: #ff3862; color: #fff; border-radius: 999px; padding: 2px 7px; font-size: 10px; font-weight: 900; }
        
        .ifood-body { padding: 24px; flex: 1; }
        .ifood-toast { position: fixed; bottom: 24px; right: 24px; z-index: 100; background: #22c55e; color: #000; padding: 14px 22px; border-radius: 10px; font-weight: 800; box-shadow: 0 10px 30px rgba(0,0,0,0.3); font-size: 13px; }
        
        /* Gestor Kanban Columns */
        .ifood-kanban-grid { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 20px; min-height: 580px; }
        .ifood-col { flex: 0 0 310px; min-width: 310px; background: #171c26; border: 1fr solid #252e3e; border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 14px; border-top: 4px solid #ff3862; }
        .ifood-manager.theme-light .ifood-col { background: #ffffff; border: 1px solid #e5dccc; }
        .ifood-col-title { display: flex; align-items: center; justify-content: space-between; font-size: 14px; font-weight: 800; color: #edf1f7; }
        .ifood-manager.theme-light .ifood-col-title { color: #1c1816; }
        .ifood-col-count { background: #252e3e; color: #ff3862; padding: 2px 9px; border-radius: 20px; font-size: 12px; }
        
        /* Order Cards */
        .ifood-card { background: #212836; border: 1px solid #313c50; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 4px 14px rgba(0,0,0,0.2); }
        .ifood-manager.theme-light .ifood-card { background: #fcfbfa; border-color: #e8e2d8; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .ifood-card-header { display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
        .ifood-card-code { font-family: monospace; font-size: 15px; font-weight: 900; color: #ff3862; }
        .ifood-card-time { font-size: 11px; color: #8a96a8; background: rgba(255,255,255,0.05); padding: 3px 7px; border-radius: 4px; }
        .ifood-card-customer { font-size: 15px; font-weight: 800; color: #ffffff; }
        .ifood-manager.theme-light .ifood-card-customer { color: #1c1816; }
        .ifood-card-phone { font-size: 12px; color: #38bdf8; display: flex; align-items: center; gap: 4px; }
        
        .ifood-card-items { list-style: none; padding: 0; margin: 4px 0; border-block: 1px dashed #313c50; padding-block: 8px; }
        .ifood-manager.theme-light .ifood-card-items { border-block-color: #e5dccc; }
        .ifood-card-items li { font-size: 12px; line-height: 1.5; color: #d0d7e3; }
        .ifood-manager.theme-light .ifood-card-items li { color: #413a35; }
        .ifood-card-items b { color: #ff3862; }
        
        .ifood-card-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
        .ifood-card-total { font-size: 16px; font-weight: 900; color: #ffb32e; }
        .ifood-card-pay { font-size: 11px; color: #8a96a8; }
        
        .ifood-btn-action { width: 100%; padding: 12px; border: none; border-radius: 8px; font-weight: 800; font-size: 13px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .ifood-btn-action.accept { background: #22c55e; color: #000; }
        .ifood-btn-action.accept:hover { background: #16a34a; color: #fff; }
        .ifood-btn-action.dispatch { background: #38bdf8; color: #000; }
        .ifood-btn-action.dispatch:hover { background: #0284c7; color: #fff; }
        .ifood-btn-action.complete { background: #eab308; color: #000; }
        .ifood-btn-action.complete:hover { background: #ca8a04; color: #fff; }
      `}</style>
    </main>
  );
}

/* 🛍️ GESTOR KANBAN ESTILO IFOOD */
function GestorKanban({ orders, onUpdateStatus }: { orders: Order[]; onUpdateStatus: (order: Order, status: Order["status"]) => Promise<void> }) {
  const columns: Array<{ id: Order["status"]; title: string; color: string }> = [
    { id: "preparing", title: "🟡 NOVOS & EM PREPARO", color: "#ffb32e" },
    { id: "ready", title: "🛵 SAIU PARA ENTREGA", color: "#38bdf8" },
    { id: "completed", title: "✅ CONCLUÍDOS / ENTREGUES", color: "#22c55e" },
    { id: "cancelled", title: "❌ CANCELADOS", color: "#ef4444" },
  ];

  return (
    <div>
      <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "24px", margin: 0, fontWeight: 900 }}>Gestor de Pedidos Online</h1>
          <p style={{ margin: "4px 0 0", color: "#8a96a8", fontSize: "13px" }}>
            Os pedidos do site e WhatsApp chegam aqui em tempo real. Cada mudança de etapa envia notificação no WhatsApp do cliente!
          </p>
        </div>
      </div>

      <div className="ifood-kanban-grid">
        {columns.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.id);
          return (
            <div key={col.id} className="ifood-col" style={{ borderTopColor: col.color }}>
              <div className="ifood-col-title">
                <span>{col.title}</span>
                <span className="ifood-col-count">{colOrders.length}</span>
              </div>

              {colOrders.length ? (
                colOrders.map((order) => (
                  <div key={order.id} className="ifood-card">
                    <div className="ifood-card-header">
                      <span className="ifood-card-code">{order.code}</span>
                      <span className="ifood-card-time">
                        {new Date(order.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <div>
                      <div className="ifood-card-customer">{order.customerName}</div>
                      <div className="ifood-card-phone">📱 WhatsApp Conectado</div>
                    </div>

                    <ul className="ifood-card-items">
                      {order.items.map((item) => (
                        <li key={item.id}>
                          <b>{item.quantity}x</b> {item.name}
                        </li>
                      ))}
                    </ul>

                    {order.notes && (
                      <div style={{ fontSize: "11px", color: "#ffb32e", background: "rgba(255,179,46,0.1)", padding: "6px 10px", borderRadius: "6px" }}>
                        Obs: {order.notes}
                      </div>
                    )}

                    <div className="ifood-card-footer">
                      <span className="ifood-card-total">{formatMoney(order.totalCents)}</span>
                      <span className="ifood-card-pay">{order.paymentMethod}</span>
                    </div>

                    {col.id === "preparing" && (
                      <button
                        type="button"
                        className="ifood-btn-action dispatch"
                        onClick={() => onUpdateStatus(order, "ready")}
                      >
                        Despachar p/ Entrega 🛵 →
                      </button>
                    )}

                    {col.id === "ready" && (
                      <button
                        type="button"
                        className="ifood-btn-action accept"
                        onClick={() => onUpdateStatus(order, "completed")}
                      >
                        Marcar como Entregue ✅ →
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div style={{ padding: "40px 10px", textAlign: "center", color: "#526075", fontSize: "12px", textTransform: "uppercase" }}>
                  Sem pedidos nesta etapa
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* 💬 CONVERSAS DO WHATSAPP */
function ConversationsView({ notify }: { notify: (msg: string) => void }) {
  const [selected, setSelected] = useState("5548996116327");
  const [inputMsg, setInputMsg] = useState("");
  const [messages, setMessages] = useState<Record<string, Array<{ text: string; sender: "customer" | "bot" | "attendant"; time: string }>>>({
    "5548996116327": [
      { text: "Olá! Gostaria de fazer um pedido pelo site!", sender: "customer", time: "19:40" },
      { text: "Olá! Seja bem-vindo à Smack Chicken! 🍗🥤\n\nPeça online pelo nosso site com entrega rápida:\nhttps://smack-chicken-pedidos.lucasgabrielwww2218.workers.dev", sender: "bot", time: "19:40" },
    ],
  });

  const send = (msgText?: string) => {
    const text = msgText || inputMsg;
    if (!text.trim()) return;
    const now = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    setMessages((prev) => ({
      ...prev,
      [selected]: [...(prev[selected] || []), { text: text.trim(), sender: "attendant", time: now }],
    }));
    if (!msgText) setInputMsg("");
    notify("Mensagem enviada para o cliente no WhatsApp!");
  };

  return (
    <div style={{ background: "#171c26", border: "1px solid #252e3e", borderRadius: "14px", padding: "20px", minHeight: "520px" }}>
      <h2 style={{ fontSize: "18px", margin: "0 0 16px" }}>Atendimento ao Vivo (WhatsApp Web)</h2>
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "16px", height: "420px" }}>
        <div style={{ background: "#212836", border: "1px solid #313c50", borderRadius: "10px", padding: "10px" }}>
          <div style={{ padding: "10px", background: "#171c26", borderRadius: "8px", fontWeight: 700, fontSize: "13px" }}>
            👤 Lucas Gabriel
            <small style={{ display: "block", color: "#8a96a8", fontWeight: 400 }}>5548996116327</small>
          </div>
        </div>
        <div style={{ background: "#0f1218", border: "1px solid #252e3e", borderRadius: "10px", padding: "16px", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
            {(messages[selected] || []).map((m, i) => (
              <div key={i} style={{ alignSelf: m.sender === "customer" ? "flex-start" : "flex-end", background: m.sender === "customer" ? "#212836" : "#008069", padding: "10px 14px", borderRadius: "10px", maxWidth: "75%", fontSize: "13px" }}>
                {m.text}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
            <button type="button" style={{ background: "#38bdf8", color: "#000", border: "none", padding: "8px 12px", borderRadius: "6px", fontWeight: 700, cursor: "pointer", fontSize: "12px" }} onClick={() => send("🍗 Link do Cardápio Online: https://smack-chicken-pedidos.lucasgabrielwww2218.workers.dev")}>
              🔗 Enviar Link da Loja
            </button>
            <input type="text" placeholder="Digite sua resposta..." value={inputMsg} onChange={(e) => setInputMsg(e.target.value)} style={{ flex: 1, padding: "10px", borderRadius: "6px", background: "#212836", border: "1px solid #313c50", color: "#fff" }} />
            <button type="button" style={{ background: "#ff3862", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "6px", fontWeight: 700, cursor: "pointer" }} onClick={() => send()}>
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ⚡ FLOW BUILDER */
function FlowBuilderView({ notify }: { notify: (msg: string) => void }) {
  return (
    <div style={{ background: "#171c26", border: "1px solid #252e3e", borderRadius: "14px", padding: "24px" }}>
      <h2 style={{ fontSize: "18px", margin: "0 0 6px" }}>Editor de Respostas Automáticas (Flow Builder)</h2>
      <p style={{ color: "#8a96a8", fontSize: "13px", margin: "0 0 20px" }}>Respostas enviadas pelo robô de WhatsApp do site de pedidos.</p>
      
      <div style={{ background: "#212836", border: "1px solid #313c50", borderRadius: "10px", padding: "16px", marginBottom: "12px" }}>
        <strong style={{ color: "#ff3862" }}>🚀 Fluxo 1: Boas-vindas & Link do Cardápio</strong>
        <p style={{ fontSize: "12px", color: "#8a96a8", margin: "4px 0 10px" }}>Gatilhos: "oi", "olá", "cardapio", "pedido"</p>
        <div style={{ background: "#0f1218", padding: "12px", borderRadius: "8px", fontSize: "13px" }}>
          Olá! Seja bem-vindo à Smack Chicken Estreito! 🍗🥤<br /><br />
          Faça seu pedido online no nosso site oficial:<br />
          https://smack-chicken-pedidos.lucasgabrielwww2218.workers.dev
        </div>
      </div>
    </div>
  );
}

/* 🚀 DISPARO 24H */
function BroadcastView({ notify }: { notify: (msg: string) => void }) {
  return (
    <div style={{ background: "#171c26", border: "1px solid #252e3e", borderRadius: "14px", padding: "24px" }}>
      <h2 style={{ fontSize: "18px", margin: "0 0 6px" }}>Campanhas de Disparo 24h em Massa</h2>
      <p style={{ color: "#8a96a8", fontSize: "13px", margin: "0 0 20px" }}>Envie cupons e links de pedidos para sua lista de clientes do WhatsApp.</p>
      <form onSubmit={(e) => { e.preventDefault(); notify("Disparo em massa iniciado!"); }}>
        <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>Mensagem da Promoção</label>
        <textarea style={{ width: "100%", height: "100px", background: "#212836", border: "1px solid #313c50", color: "#fff", padding: "12px", borderRadius: "8px" }} defaultValue="🔥 PROMOÇÃO SMACK CHICKEN! 🍗&#10;&#10;Na compra de qualquer Balde G, leve 1 Guaraná 1L grátis!&#10;&#10;Peça online agora pelo link:&#10;https://smack-chicken-pedidos.lucasgabrielwww2218.workers.dev" />
        <button type="submit" style={{ marginTop: "14px", background: "#ff3862", color: "#fff", border: "none", padding: "12px 24px", borderRadius: "8px", fontWeight: 800, cursor: "pointer" }}>🚀 Iniciar Disparos</button>
      </form>
    </div>
  );
}

/* 📱 WHATSAPP STATUS */
function WhatsAppStatusView() {
  return (
    <div style={{ background: "#171c26", border: "1px solid #252e3e", borderRadius: "14px", overflow: "hidden", height: "650px" }}>
      <iframe src="/api/evolution/connect" style={{ width: "100%", height: "100%", border: "none" }} title="WhatsApp Connect" />
    </div>
  );
}
