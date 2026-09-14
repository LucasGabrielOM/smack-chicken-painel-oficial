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
  const [theme, setTheme] = useState<"light" | "dark">("light"); // iFood default light theme
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

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
    const interval = setInterval(loadOrders, 7000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const toggleTheme = () => {
    setTheme((curr) => (curr === "light" ? "dark" : "light"));
  };

  const updateOrderStatus = async (order: Order, newStatus: Order["status"]) => {
    try {
      await api(`/api/orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });

      let statusName = "";
      if (newStatus === "preparing") statusName = "Em Preparo";
      else if (newStatus === "ready") statusName = "Saiu em Rota";
      else if (newStatus === "completed") statusName = "Entregue";
      else if (newStatus === "cancelled") statusName = "Cancelado";

      notify(`Pedido ${order.code} alterado para "${statusName}". Notificação enviada no WhatsApp!`);
      await loadOrders();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Falha ao atualizar o pedido");
    }
  };

  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return orders;
    const q = searchTerm.toLowerCase();
    return orders.filter(
      (o) =>
        o.code.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.paymentMethod.toLowerCase().includes(q)
    );
  }, [orders, searchTerm]);

  return (
    <main className={theme === "dark" ? "ifood-app dark-theme" : "ifood-app"}>
      {toast && <div className="ifood-toast">{toast}</div>}

      {/* Sidebar Esquerda Estilo iFood Gestor */}
      <aside className="ifood-sidebar">
        <div className="ifood-brand-logo">
          <img src="/smack-chicken-mark.png" alt="Smack" className="ifood-mark" />
        </div>

        <nav className="ifood-sidebar-nav">
          <button
            type="button"
            className={view === "gestor" ? "active" : ""}
            onClick={() => setView("gestor")}
            title="Gestor de Pedidos (Quadros)"
          >
            <span className="ifood-icon">🛍️</span>
            <span className="ifood-label">Pedidos</span>
          </button>

          <button
            type="button"
            className={view === "conversations" ? "active" : ""}
            onClick={() => setView("conversations")}
            title="WhatsApp Chat Atendimento"
          >
            <span className="ifood-icon">💬</span>
            <span className="ifood-label">Chat</span>
          </button>

          <button
            type="button"
            className={view === "flowbuilder" ? "active" : ""}
            onClick={() => setView("flowbuilder")}
            title="Flow Builder (Robô)"
          >
            <span className="ifood-icon">⚡</span>
            <span className="ifood-label">Robô</span>
          </button>

          <button
            type="button"
            className={view === "broadcast" ? "active" : ""}
            onClick={() => setView("broadcast")}
            title="Disparo de Campanhas 24h"
          >
            <span className="ifood-icon">🚀</span>
            <span className="ifood-label">Disparo</span>
          </button>

          <button
            type="button"
            className={view === "whatsapp" ? "active" : ""}
            onClick={() => setView("whatsapp")}
            title="Status WhatsApp (QR Code)"
          >
            <span className="ifood-icon">📱</span>
            <span className="ifood-label">Aparelho</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            title="Mudar Tema (Claro / Escuro)"
            style={{ marginTop: "auto" }}
          >
            <span className="ifood-icon">{theme === "light" ? "🌙" : "☀"}</span>
            <span className="ifood-label">{theme === "light" ? "Escuro" : "Claro"}</span>
          </button>
        </nav>
      </aside>

      {/* Área Principal com TopBar e Kanban */}
      <section className="ifood-main-area">
        {/* TopBar Estilo iFood */}
        <header className="ifood-topbar">
          <div className="ifood-search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Buscar por número, cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="ifood-farol-container">
            <button
              type="button"
              className={`ifood-farol-btn ${storeOpen ? "open" : "closed"}`}
              onClick={() => setStoreOpen(!storeOpen)}
            >
              <span className="farol-dot" />
              <span>Farol da Operação</span>
              <span className="farol-refresh">↻</span>
            </button>
          </div>

          <div className="ifood-topbar-right">
            <div className="ifood-notif-bell" title="Mensagens não lidas">
              💬 <b className="notif-count">5</b>
            </div>

            <div className="ifood-view-selector">
              <span>📊 Quadros</span> ▾
            </div>

            <button
              type="button"
              className="ifood-fullscreen-btn"
              onClick={async () => {
                setRefreshing(true);
                await loadOrders();
                setRefreshing(false);
                notify("Gestor atualizado!");
              }}
              title="Atualizar Pedidos"
            >
              {refreshing ? "⏳" : "⛶"}
            </button>
          </div>
        </header>

        {/* View Switcher Container */}
        <div className="ifood-content-body">
          {view === "gestor" && (
            <IFoodGestorBoard
              orders={filteredOrders}
              onUpdateStatus={updateOrderStatus}
              onSelectOrder={setSelectedOrder}
            />
          )}

          {view === "conversations" && <ConversationsView notify={notify} />}
          {view === "flowbuilder" && <FlowBuilderView notify={notify} />}
          {view === "broadcast" && <BroadcastView notify={notify} />}
          {view === "whatsapp" && <WhatsAppStatusView />}
        </div>
      </section>

      {/* Modal de Detalhes do Pedido estilo iFood */}
      {selectedOrder && (
        <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onUpdateStatus={updateOrderStatus} />
      )}

      {/* CSS Idêntico ao iFood Gestor */}
      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        .ifood-app {
          display: flex;
          min-height: 100vh;
          background-color: #f4f5f8;
          color: #1e293b;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .ifood-app.dark-theme {
          background-color: #0f1218;
          color: #edf1f7;
        }

        /* Sidebar Esquerda */
        .ifood-sidebar {
          width: 72px;
          background: #ffffff;
          border-right: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 12px;
          z-index: 40;
          flex-shrink: 0;
        }
        .dark-theme .ifood-sidebar {
          background: #141821;
          border-right-color: #252e3e;
        }

        .ifood-brand-logo {
          width: 44px;
          height: 44px;
          background: #ea1d2c;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }
        .ifood-mark {
          width: 30px;
          height: 30px;
          object-fit: contain;
        }

        .ifood-sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
          padding: 0 6px;
          flex: 1;
        }

        .ifood-sidebar-nav button {
          width: 100%;
          height: 56px;
          border: none;
          background: transparent;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          cursor: pointer;
          color: #64748b;
          position: relative;
          transition: 0.15s;
        }
        .dark-theme .ifood-sidebar-nav button { color: #8a96a8; }

        .ifood-sidebar-nav button:hover {
          background: #f1f5f9;
          color: #ea1d2c;
        }
        .dark-theme .ifood-sidebar-nav button:hover {
          background: #1e2634;
          color: #ea1d2c;
        }

        .ifood-sidebar-nav button.active {
          background: #ffebee;
          color: #ea1d2c;
          font-weight: 700;
        }
        .dark-theme .ifood-sidebar-nav button.active {
          background: rgba(234, 29, 44, 0.15);
          color: #ff3862;
        }
        .ifood-sidebar-nav button.active::before {
          content: "";
          position: absolute;
          left: -6px;
          top: 12px;
          bottom: 12px;
          width: 4px;
          background: #ea1d2c;
          border-radius: 0 4px 4px 0;
        }

        .ifood-icon { font-size: 20px; }
        .ifood-label { font-size: 10px; font-weight: 600; }

        /* Main Area */
        .ifood-main-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        /* TopBar */
        .ifood-topbar {
          height: 60px;
          background: #ffffff;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          position: sticky;
          top: 0;
          z-index: 30;
        }
        .dark-theme .ifood-topbar {
          background: #141821;
          border-bottom-color: #252e3e;
        }

        .ifood-search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f1f5f9;
          padding: 8px 14px;
          border-radius: 20px;
          width: 280px;
        }
        .dark-theme .ifood-search-box { background: #1e2634; }

        .search-icon { font-size: 13px; color: #94a3b8; }
        .ifood-search-box input {
          border: none;
          background: transparent;
          outline: none;
          font-size: 13px;
          width: 100%;
          color: inherit;
        }

        /* Farol da Operacao */
        .ifood-farol-btn {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 20px;
          padding: 6px 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 700;
          color: #1e293b;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.04);
        }
        .dark-theme .ifood-farol-btn { background: #1e2634; border-color: #334155; color: #f8fafc; }

        .farol-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 8px #22c55e;
        }
        .ifood-farol-btn.closed .farol-dot {
          background: #ef4444;
          box-shadow: 0 0 8px #ef4444;
        }
        .farol-refresh { color: #94a3b8; margin-left: 4px; }

        .ifood-topbar-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .ifood-notif-bell {
          position: relative;
          font-size: 18px;
          cursor: pointer;
        }
        .notif-count {
          position: absolute;
          top: -6px;
          right: -8px;
          background: #ea1d2c;
          color: white;
          font-size: 10px;
          border-radius: 999px;
          padding: 1px 5px;
        }

        .ifood-view-selector {
          background: #ea1d2c;
          color: white;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .ifood-fullscreen-btn {
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 6px 10px;
          cursor: pointer;
          font-size: 14px;
        }
        .dark-theme .ifood-fullscreen-btn { background: #1e2634; border-color: #334155; color: #fff; }

        .ifood-content-body {
          padding: 16px 20px;
          flex: 1;
        }

        .ifood-toast {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 100;
          background: #ea1d2c;
          color: #ffffff;
          padding: 14px 22px;
          border-radius: 12px;
          font-weight: 800;
          box-shadow: 0 10px 25px rgba(234, 29, 44, 0.4);
          font-size: 13px;
        }
      `}</style>
    </main>
  );
}

/* 🛍️ PAINEL KANBAN EXATO DO IFOOD (5 COLUNAS) */
function IFoodGestorBoard({
  orders,
  onUpdateStatus,
  onSelectOrder,
}: {
  orders: Order[];
  onUpdateStatus: (order: Order, status: Order["status"]) => Promise<void>;
  onSelectOrder: (order: Order) => void;
}) {
  // Mapeamento exato das 5 colunas do iFood:
  // 1. Aceitar (novos)
  // 2. Em preparo (cozinha)
  // 3. Pronto (esperando motoboy/retirada)
  // 4. Em rota (entregador a caminho)
  // 5. Finalizados

  const colAceitar = orders.filter((o) => o.status === "preparing" && !o.readyAt);
  const colPreparo = orders.filter((o) => o.status === "preparing");
  const colPronto = orders.filter((o) => o.status === "ready" && !o.completedAt);
  const colRota = orders.filter((o) => o.status === "ready");
  const colFinalizados = orders.filter((o) => o.status === "completed" || o.status === "cancelled");

  return (
    <div className="ifood-kanban-wrapper">
      <div className="ifood-board">
        {/* COLUNA 1: ACEITAR */}
        <div className="ifood-column">
          <div className="ifood-col-header">
            <span>Aceitar</span>
            <span className="ifood-col-badge">{colAceitar.length}</span>
          </div>

          <div className="ifood-cards-list">
            {colAceitar.map((order) => (
              <div key={order.id} className="ifood-order-card" onClick={() => onSelectOrder(order)}>
                <div className="ifood-card-num">{order.code.replace("#", "")}</div>
                <button
                  type="button"
                  className="ifood-btn-red"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateStatus(order, "preparing");
                  }}
                >
                  Aceite em até 5min
                </button>
              </div>
            ))}
            {!colAceitar.length && <div className="ifood-empty-col">Nenhum pedido pendente</div>}
          </div>
        </div>

        {/* COLUNA 2: EM PREPARO */}
        <div className="ifood-column">
          <div className="ifood-col-header">
            <span>Em preparo</span>
            <span className="ifood-col-badge">{colPreparo.length}</span>
          </div>

          <div className="ifood-cards-list">
            {colPreparo.map((order) => (
              <div key={order.id} className="ifood-order-card" onClick={() => onSelectOrder(order)}>
                <div className="ifood-card-sub">👤 {order.customerName} aguardando há 5 min</div>
                <div className="ifood-card-main-info">
                  <span className="ifood-card-num-sm">{order.code.replace("#", "")}</span>
                  <span className="ifood-card-name">{order.customerName}</span>
                </div>

                <div className="ifood-alert-pill amber">⚡ Prepare em até 5min</div>

                <button
                  type="button"
                  className="ifood-btn-action-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateStatus(order, "ready");
                  }}
                >
                  Marcar como Pronto 🛵 →
                </button>
              </div>
            ))}
            {!colPreparo.length && <div className="ifood-empty-col">Nenhum em preparo</div>}
          </div>
        </div>

        {/* COLUNA 3: PRONTO */}
        <div className="ifood-column">
          <div className="ifood-col-header">
            <span>Pronto</span>
            <span className="ifood-col-badge">{colPronto.length}</span>
          </div>

          <div className="ifood-cards-list">
            {colPronto.map((order) => (
              <div key={order.id} className="ifood-order-card" onClick={() => onSelectOrder(order)}>
                <div className="ifood-card-sub green">🛵 Entregador chegou na loja</div>
                <div className="ifood-card-main-info">
                  <span className="ifood-card-num-sm">{order.code.replace("#", "")}</span>
                  <span className="ifood-card-name">{order.customerName}</span>
                </div>

                <div className="ifood-status-tag green">Pronto há 2min</div>

                <button
                  type="button"
                  className="ifood-btn-action-sm green"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateStatus(order, "ready");
                  }}
                >
                  Despachar em Rota 🛵 →
                </button>
              </div>
            ))}
            {!colPronto.length && <div className="ifood-empty-col">Nenhum pedido pronto</div>}
          </div>
        </div>

        {/* COLUNA 4: EM ROTA */}
        <div className="ifood-column">
          <div className="ifood-col-header">
            <span>Em rota</span>
            <span className="ifood-col-badge">{colRota.length}</span>
          </div>

          <div className="ifood-cards-list">
            {colRota.map((order) => (
              <div key={order.id} className="ifood-order-card" onClick={() => onSelectOrder(order)}>
                <div className="ifood-card-sub">🛵 Entregador a caminho do cliente</div>
                <div className="ifood-card-main-info">
                  <span className="ifood-card-num-sm">{order.code.replace("#", "")}</span>
                  <span className="ifood-card-name">{order.customerName}</span>
                </div>

                <div className="ifood-status-tag">Chega em até 5min</div>

                <button
                  type="button"
                  className="ifood-btn-action-sm complete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateStatus(order, "completed");
                  }}
                >
                  Finalizar (Entregue) ✅ →
                </button>
              </div>
            ))}
            {!colRota.length && <div className="ifood-empty-col">Nenhum em rota</div>}
          </div>
        </div>

        {/* COLUNA 5: FINALIZADOS */}
        <div className="ifood-column compact">
          <div className="ifood-col-header">
            <span>Finalizados</span>
            <span className="ifood-col-badge">{colFinalizados.length}</span>
          </div>

          <div className="ifood-cards-list compact">
            {colFinalizados.map((order) => (
              <div key={order.id} className="ifood-order-card-compact" onClick={() => onSelectOrder(order)}>
                <strong>{order.code.replace("#", "")}</strong>
                <span>{order.customerName}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .ifood-board {
          display: flex;
          gap: 14px;
          overflow-x: auto;
          padding-bottom: 14px;
        }

        .ifood-column {
          flex: 0 0 250px;
          min-width: 250px;
          background: #ebedf2;
          border-radius: 16px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .dark-theme .ifood-column { background: #161c27; }

        .ifood-column.compact {
          flex: 0 0 130px;
          min-width: 130px;
        }

        .ifood-col-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 14px;
          font-weight: 800;
          color: #334155;
          padding: 4px 6px;
        }
        .dark-theme .ifood-col-header { color: #edf1f7; }

        .ifood-col-badge {
          background: #cbd5e1;
          color: #1e293b;
          border-radius: 999px;
          padding: 2px 8px;
          font-size: 11px;
          font-weight: 800;
        }
        .dark-theme .ifood-col-badge { background: #2d3748; color: #fff; }

        .ifood-cards-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .ifood-order-card {
          background: #ffffff;
          border-radius: 14px;
          padding: 14px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 8px;
          transition: 0.15s;
        }
        .dark-theme .ifood-order-card { background: #1f2736; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }

        .ifood-order-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 14px rgba(0,0,0,0.08);
        }

        .ifood-card-num {
          font-size: 26px;
          font-weight: 900;
          color: #1e293b;
          text-align: center;
          margin: 6px 0;
        }
        .dark-theme .ifood-card-num { color: #ffffff; }

        .ifood-btn-red {
          width: 100%;
          background: #ea1d2c;
          color: #ffffff;
          border: none;
          padding: 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          text-align: center;
        }

        .ifood-card-sub {
          font-size: 11px;
          color: #64748b;
          font-weight: 600;
        }
        .ifood-card-sub.green { color: #16a34a; }

        .ifood-card-main-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ifood-card-num-sm {
          font-size: 18px;
          font-weight: 900;
          color: #0f172a;
        }
        .dark-theme .ifood-card-num-sm { color: #fff; }

        .ifood-card-name {
          font-size: 14px;
          font-weight: 700;
          color: #334155;
        }
        .dark-theme .ifood-card-name { color: #cbd5e1; }

        .ifood-alert-pill {
          background: #7f1d1d;
          color: #fca5a5;
          font-size: 11px;
          font-weight: 800;
          padding: 6px 10px;
          border-radius: 20px;
          text-align: center;
        }
        .ifood-alert-pill.amber {
          background: #7c2d12;
          color: #fdba74;
        }

        .ifood-status-tag {
          background: #f1f5f9;
          color: #475569;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 20px;
          text-align: center;
        }
        .ifood-status-tag.green {
          background: #dcfce7;
          color: #15803d;
        }

        .ifood-btn-action-sm {
          width: 100%;
          background: #3b82f6;
          color: #ffffff;
          border: none;
          padding: 8px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }
        .ifood-btn-action-sm.green { background: #16a34a; }
        .ifood-btn-action-sm.complete { background: #22c55e; color: #000; font-weight: 900; }

        .ifood-empty-col {
          padding: 24px 10px;
          text-align: center;
          font-size: 11px;
          color: #94a3b8;
          text-transform: uppercase;
        }

        .ifood-order-card-compact {
          background: #ffffff;
          border-radius: 10px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          font-size: 12px;
          cursor: pointer;
        }
        .dark-theme .ifood-order-card-compact { background: #1f2736; }
        .ifood-order-card-compact strong { font-size: 16px; color: #ea1d2c; }
        .ifood-order-card-compact span { font-size: 10px; color: #64748b; }
      `}</style>
    </div>
  );
}

/* 📄 MODAL / GAVETA DE DETALHES DO PEDIDO (ESTILO IFOOD) */
function OrderDetailModal({
  order,
  onClose,
  onUpdateStatus,
}: {
  order: Order;
  onClose: () => void;
  onUpdateStatus: (order: Order, status: Order["status"]) => Promise<void>;
}) {
  return (
    <div className="ifood-modal-overlay" onClick={onClose}>
      <div className="ifood-modal-card" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div>
            <span className="modal-code">{order.code}</span>
            <h2>{order.customerName}</h2>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>×</button>
        </header>

        <div className="modal-body">
          <div className="info-row">
            <span>Forma de Pagamento:</span>
            <strong>{order.paymentMethod}</strong>
          </div>

          <div className="info-row">
            <span>Canal de Origem:</span>
            <strong>{order.channel || "Site Online"}</strong>
          </div>

          <div className="info-row">
            <span>Horário do Pedido:</span>
            <strong>{new Date(order.createdAt).toLocaleTimeString("pt-BR")}</strong>
          </div>

          {order.notes && (
            <div className="notes-box">
              <strong>Observações do Cliente:</strong>
              <p>{order.notes}</p>
            </div>
          )}

          <h3 className="items-heading">Itens Pedidos</h3>
          <ul className="items-list">
            {order.items.map((item) => (
              <li key={item.id}>
                <b>{item.quantity}x</b>
                <span>{item.name}</span>
                <strong>{formatMoney(item.unitPriceCents * item.quantity)}</strong>
              </li>
            ))}
          </ul>

          <div className="total-row">
            <span>Total em R$:</span>
            <strong>{formatMoney(order.totalCents)}</strong>
          </div>
        </div>

        <footer className="modal-footer">
          <button type="button" className="print-btn" onClick={() => window.print()}>
            🖨️ Imprimir Comanda
          </button>
          {order.status === "preparing" && (
            <button
              type="button"
              className="action-btn"
              onClick={async () => {
                await onUpdateStatus(order, "ready");
                onClose();
              }}
            >
              Marcar como Pronto 🛵 →
            </button>
          )}
        </footer>
      </div>

      <style jsx>{`
        .ifood-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ifood-modal-card {
          background: #ffffff;
          border-radius: 20px;
          width: 90%;
          max-width: 480px;
          padding: 24px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.2);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .modal-code {
          color: #ea1d2c;
          font-weight: 900;
          font-size: 14px;
        }
        .close-btn {
          border: none;
          background: #f1f5f9;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          font-size: 18px;
          cursor: pointer;
        }
        .modal-body {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
        }
        .notes-box {
          background: #fff7ed;
          border: 1px solid #ffedd5;
          padding: 10px;
          border-radius: 8px;
          font-size: 12px;
          color: #c2410c;
        }
        .items-heading {
          font-size: 14px;
          margin-top: 8px;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 6px;
        }
        .items-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .items-list li {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
        }
        .items-list b { color: #ea1d2c; }
        .total-row {
          display: flex;
          justify-content: space-between;
          font-size: 18px;
          font-weight: 900;
          margin-top: 10px;
          border-top: 2px solid #e2e8f0;
          padding-top: 10px;
        }
        .modal-footer {
          display: flex;
          gap: 10px;
        }
        .print-btn {
          flex: 1;
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          padding: 12px;
          border-radius: 8px;
          font-weight: 700;
          cursor: pointer;
        }
        .action-btn {
          flex: 1.5;
          background: #ea1d2c;
          color: white;
          border: none;
          padding: 12px;
          border-radius: 8px;
          font-weight: 800;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

/* 💬 WHATSAPP CHAT */
function ConversationsView({ notify }: { notify: (msg: string) => void }) {
  const [selected, setSelected] = useState("5548996116327");
  const [inputMsg, setInputMsg] = useState("");
  const [messages, setMessages] = useState<Record<string, Array<{ text: string; sender: "customer" | "bot" | "attendant"; time: string }>>>({
    "5548996116327": [
      { text: "Olá! Gostaria de pedir o Combo Família Balde G 🍗", sender: "customer", time: "19:40" },
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
    notify("Mensagem enviada no WhatsApp!");
  };

  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px", minHeight: "520px" }}>
      <h2 style={{ fontSize: "18px", margin: "0 0 16px", color: "#1e293b" }}>Atendimento WhatsApp Web (ao vivo)</h2>
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "16px", height: "420px" }}>
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "10px" }}>
          <div style={{ padding: "12px", background: "#ffffff", border: "1px solid #ea1d2c", borderRadius: "8px", fontWeight: 700, fontSize: "13px", color: "#1e293b" }}>
            👤 Lucas Gabriel
            <small style={{ display: "block", color: "#64748b", fontWeight: 400 }}>5548996116327</small>
          </div>
        </div>
        <div style={{ background: "#e5ddd5", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
            {(messages[selected] || []).map((m, i) => (
              <div key={i} style={{ alignSelf: m.sender === "customer" ? "flex-start" : "flex-end", background: m.sender === "customer" ? "#ffffff" : "#d9fdd3", color: "#111b21", padding: "10px 14px", borderRadius: "10px", maxWidth: "75%", fontSize: "13px", boxShadow: "0 1px 2px rgba(0,0,0,0.1)" }}>
                {m.text}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
            <button type="button" style={{ background: "#ea1d2c", color: "#fff", border: "none", padding: "8px 12px", borderRadius: "6px", fontWeight: 700, cursor: "pointer", fontSize: "12px" }} onClick={() => send("🍗 Link da Loja: https://smack-chicken-pedidos.lucasgabrielwww2218.workers.dev")}>
              🔗 Enviar Link da Loja
            </button>
            <input type="text" placeholder="Digite sua resposta..." value={inputMsg} onChange={(e) => setInputMsg(e.target.value)} style={{ flex: 1, padding: "10px", borderRadius: "6px", background: "#ffffff", border: "1px solid #cbd5e1", color: "#000" }} />
            <button type="button" style={{ background: "#ea1d2c", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "6px", fontWeight: 700, cursor: "pointer" }} onClick={() => send()}>
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
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "24px" }}>
      <h2 style={{ fontSize: "18px", margin: "0 0 6px", color: "#1e293b" }}>Editor de Respostas Automáticas (Flow Builder)</h2>
      <p style={{ color: "#64748b", fontSize: "13px", margin: "0 0 20px" }}>Respostas automáticas do robô de WhatsApp do site de pedidos.</p>
      
      <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "16px", marginBottom: "12px" }}>
        <strong style={{ color: "#ea1d2c" }}>🚀 Fluxo 1: Boas-vindas & Link do Cardápio</strong>
        <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 10px" }}>Gatilhos: "oi", "olá", "cardapio", "pedido"</p>
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", padding: "12px", borderRadius: "8px", fontSize: "13px" }}>
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
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "24px" }}>
      <h2 style={{ fontSize: "18px", margin: "0 0 6px", color: "#1e293b" }}>Campanhas de Disparo 24h em Massa</h2>
      <p style={{ color: "#64748b", fontSize: "13px", margin: "0 0 20px" }}>Envie cupons e links de pedidos para sua lista de clientes do WhatsApp.</p>
      <form onSubmit={(e) => { e.preventDefault(); notify("Disparo em massa iniciado!"); }}>
        <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "6px", color: "#1e293b" }}>Mensagem da Promoção</label>
        <textarea style={{ width: "100%", height: "100px", background: "#f8fafc", border: "1px solid #cbd5e1", color: "#000", padding: "12px", borderRadius: "8px" }} defaultValue="🔥 PROMOÇÃO SMACK CHICKEN! 🍗&#10;&#10;Na compra de qualquer Balde G, leve 1 Guaraná 1L grátis!&#10;&#10;Peça online agora pelo link:&#10;https://smack-chicken-pedidos.lucasgabrielwww2218.workers.dev" />
        <button type="submit" style={{ marginTop: "14px", background: "#ea1d2c", color: "#fff", border: "none", padding: "12px 24px", borderRadius: "8px", fontWeight: 800, cursor: "pointer" }}>🚀 Iniciar Disparos</button>
      </form>
    </div>
  );
}

/* 📱 WHATSAPP STATUS */
function WhatsAppStatusView() {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", overflow: "hidden", height: "650px" }}>
      <iframe src="/api/evolution/connect" style={{ width: "100%", height: "100%", border: "none" }} title="WhatsApp Connect" />
    </div>
  );
}
