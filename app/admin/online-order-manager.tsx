"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { formatMoney, catalog } from "../../lib/catalog";

type View =
  | "gestor"        // Modo Quadros (Kanban iFood)
  | "expedicao"     // Modo Expedição (Fila Única Alta Performance iFood)
  | "cardapio"      // Gestão de Cardápio (Pausar/Editar Preços)
  | "desempenho"    // Indicadores e Desempenho
  | "avaliacoes"    // Avaliações dos Clientes
  | "conversations" // WhatsApp Chat Atendimento ao Vivo
  | "flowbuilder"   // Editor do Robô de WhatsApp
  | "broadcast"     // Disparo 24h de Promoções
  | "whatsapp"      // Status do QR Code
  | "settings";     // Configurações & Impressora USB

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
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paperWidth, setPaperWidth] = useState<58 | 80>(58);

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

      notify(`Pedido ${order.code} alterado para "${statusName}". WhatsApp enviado ao cliente!`);
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

  const pendingCount = orders.filter((o) => o.status === "preparing").length;

  return (
    <main className={theme === "dark" ? "ifood-app dark-theme" : "ifood-app"}>
      {toast && <div className="ifood-toast">{toast}</div>}

      {/* 🟢 SIDEBAR COMPLETA DO IFOOD GESTOR */}
      <aside className="ifood-sidebar">
        <div className="ifood-brand-logo">
          <img src="/smack-chicken-mark.png" alt="Smack" className="ifood-mark" />
        </div>

        <div className="ifood-store-mini-status">
          <span className={`mini-dot ${storeOpen ? "open" : "closed"}`} />
          <small>{storeOpen ? "Loja Aberta" : "Fechada"}</small>
        </div>

        <nav className="ifood-sidebar-nav">
          <div className="nav-group-label">OPERAÇÃO</div>

          <button
            type="button"
            className={view === "gestor" ? "active" : ""}
            onClick={() => setView("gestor")}
            title="Modo Quadros (Kanban)"
          >
            <span className="ifood-icon">📊</span>
            <span className="ifood-label">Quadros</span>
            {pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
          </button>

          <button
            type="button"
            className={view === "expedicao" ? "active" : ""}
            onClick={() => setView("expedicao")}
            title="Modo Expedição (Fila Única 5x Performance)"
          >
            <span className="ifood-icon">📦</span>
            <span className="ifood-label">Expedição</span>
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

          <div className="nav-group-label">GESTÃO DA LOJA</div>

          <button
            type="button"
            className={view === "cardapio" ? "active" : ""}
            onClick={() => setView("cardapio")}
            title="Gestão de Cardápio"
          >
            <span className="ifood-icon">📋</span>
            <span className="ifood-label">Cardápio</span>
          </button>

          <button
            type="button"
            className={view === "desempenho" ? "active" : ""}
            onClick={() => setView("desempenho")}
            title="Desempenho & Métricas"
          >
            <span className="ifood-icon">📈</span>
            <span className="ifood-label">Desempenho</span>
          </button>

          <button
            type="button"
            className={view === "avaliacoes" ? "active" : ""}
            onClick={() => setView("avaliacoes")}
            title="Avaliações dos Clientes"
          >
            <span className="ifood-icon">⭐</span>
            <span className="ifood-label">Avaliações</span>
          </button>

          <div className="nav-group-label">AUTOMAÇÕES</div>

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
            title="Disparo 24h"
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
            className={view === "settings" ? "active" : ""}
            onClick={() => setView("settings")}
            title="Configurações & Impressora USB"
          >
            <span className="ifood-icon">⚙️</span>
            <span className="ifood-label">Ajustes</span>
          </button>

          <button
            type="button"
            onClick={() => setTheme((c) => (c === "light" ? "dark" : "light"))}
            title="Mudar Tema (Claro / Escuro)"
            style={{ marginTop: "auto" }}
          >
            <span className="ifood-icon">{theme === "light" ? "🌙" : "☀"}</span>
            <span className="ifood-label">{theme === "light" ? "Escuro" : "Claro"}</span>
          </button>
        </nav>
      </aside>

      {/* 🔴 ÁREA PRINCIPAL COM TOPBAR E CONTEÚDO */}
      <section className="ifood-main-area">
        {/* TopBar Estilo iFood Gestor */}
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
              onClick={() => {
                setStoreOpen(!storeOpen);
                notify(storeOpen ? "Loja pausada/fechada." : "Loja aberta! Recebendo pedidos.");
              }}
            >
              <span className="farol-dot" />
              <span>Farol da Operação: {storeOpen ? "ABERTA" : "FECHADA"}</span>
              <span className="farol-refresh">↻</span>
            </button>
          </div>

          <div className="ifood-topbar-right">
            <div className="ifood-notif-bell" title="Atendimento WhatsApp">
              💬 <b className="notif-count">5</b>
            </div>

            {/* Alternador de Modo de Pedidos (Quadros vs Expedição) */}
            <div className="ifood-mode-switcher">
              <button
                type="button"
                className={view === "gestor" ? "mode-btn active" : "mode-btn"}
                onClick={() => setView("gestor")}
              >
                📊 Quadros
              </button>
              <button
                type="button"
                className={view === "expedicao" ? "mode-btn active" : "mode-btn"}
                onClick={() => setView("expedicao")}
              >
                📦 Expedição
              </button>
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

        {/* Módulos Renderizados */}
        <div className="ifood-content-body">
          {view === "gestor" && (
            <IFoodKanbanBoard
              orders={filteredOrders}
              onUpdateStatus={updateOrderStatus}
              onSelectOrder={setSelectedOrder}
            />
          )}

          {view === "expedicao" && (
            <IFoodExpedicaoBoard
              orders={filteredOrders}
              onUpdateStatus={updateOrderStatus}
              onSelectOrder={setSelectedOrder}
              storeOpen={storeOpen}
            />
          )}

          {view === "cardapio" && <CardapioManager notify={notify} />}
          {view === "desempenho" && <DesempenhoView orders={orders} />}
          {view === "avaliacoes" && <AvaliacoesView />}
          {view === "conversations" && <ConversationsView notify={notify} />}
          {view === "flowbuilder" && <FlowBuilderView notify={notify} />}
          {view === "broadcast" && <BroadcastView notify={notify} />}
          {view === "whatsapp" && <WhatsAppStatusView />}
          {view === "settings" && <SettingsView paperWidth={paperWidth} setPaperWidth={setPaperWidth} notify={notify} />}
        </div>
      </section>

      {/* Modal de Detalhes do Pedido estilo iFood */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdateStatus={updateOrderStatus}
          paperWidth={paperWidth}
        />
      )}

      {/* CSS Idêntico ao iFood Gestor de Pedidos */}
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

        /* Sidebar */
        .ifood-sidebar {
          width: 80px;
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
          margin-bottom: 8px;
        }
        .ifood-mark {
          width: 30px;
          height: 30px;
          object-fit: contain;
        }

        .ifood-store-mini-status {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-bottom: 12px;
        }
        .mini-dot { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; }
        .mini-dot.closed { background: #ef4444; }
        .ifood-store-mini-status small { font-size: 9px; font-weight: 700; color: #64748b; }

        .ifood-sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: 100%;
          padding: 0 4px;
          flex: 1;
        }

        .nav-group-label {
          font-size: 8px;
          font-weight: 900;
          color: #94a3b8;
          text-align: center;
          margin-top: 8px;
          margin-bottom: 2px;
          letter-spacing: 0.5px;
        }

        .ifood-sidebar-nav button {
          width: 100%;
          height: 50px;
          border: none;
          background: transparent;
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
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
          left: -4px;
          top: 10px;
          bottom: 10px;
          width: 4px;
          background: #ea1d2c;
          border-radius: 0 4px 4px 0;
        }

        .nav-badge {
          position: absolute;
          top: 4px;
          right: 6px;
          background: #ea1d2c;
          color: #fff;
          font-size: 9px;
          font-weight: 900;
          padding: 1px 5px;
          border-radius: 999px;
        }

        .ifood-icon { font-size: 18px; }
        .ifood-label { font-size: 9px; font-weight: 700; }

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
          width: 260px;
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

        /* Farol */
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

        .ifood-topbar-right {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .ifood-mode-switcher {
          display: flex;
          background: #f1f5f9;
          padding: 3px;
          border-radius: 8px;
        }
        .dark-theme .ifood-mode-switcher { background: #1e2634; }
        .mode-btn {
          border: none;
          background: transparent;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
          cursor: pointer;
        }
        .mode-btn.active {
          background: #ea1d2c;
          color: #ffffff;
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

/* 🛍️ PAINEL MODO QUADROS (KANBAN 5 COLUNAS EXATO IFOOD) */
function IFoodKanbanBoard({
  orders,
  onUpdateStatus,
  onSelectOrder,
}: {
  orders: Order[];
  onUpdateStatus: (order: Order, status: Order["status"]) => Promise<void>;
  onSelectOrder: (order: Order) => void;
}) {
  const colAceitar = orders.filter((o) => o.status === "preparing" && !o.readyAt);
  const colPreparo = orders.filter((o) => o.status === "preparing");
  const colPronto = orders.filter((o) => o.status === "ready" && !o.completedAt);
  const colRota = orders.filter((o) => o.status === "ready");
  const colFinalizados = orders.filter((o) => o.status === "completed" || o.status === "cancelled");

  return (
    <div className="ifood-board">
      {/* 1. ACEITAR */}
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

      {/* 2. EM PREPARO */}
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

      {/* 3. PRONTO */}
      <div className="ifood-column">
        <div className="ifood-col-header">
          <span>Pronto</span>
          <span className="ifood-col-badge">{colPronto.length}</span>
        </div>

        <div className="ifood-cards-list">
          {colPronto.map((order) => (
            <div key={order.id} className="ifood-order-card" onClick={() => onSelectOrder(order)}>
              <div className="ifood-card-sub green">🛵 Entregador na loja</div>
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

      {/* 4. EM ROTA */}
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

      {/* 5. FINALIZADOS (COMPACTO) */}
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

      <style jsx>{`
        .ifood-board {
          display: flex;
          gap: 14px;
          overflow-x: auto;
          padding-bottom: 14px;
        }

        .ifood-column {
          flex: 0 0 240px;
          min-width: 240px;
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

        .ifood-alert-pill.amber {
          background: #7c2d12;
          color: #fdba74;
          font-size: 11px;
          font-weight: 800;
          padding: 6px 10px;
          border-radius: 20px;
          text-align: center;
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

/* 📦 MODO EXPEDIÇÃO (FILA ÚNICA 5X PERFORMANCE IFOOD) */
function IFoodExpedicaoBoard({
  orders,
  onUpdateStatus,
  onSelectOrder,
  storeOpen,
}: {
  orders: Order[];
  onUpdateStatus: (order: Order, status: Order["status"]) => Promise<void>;
  onSelectOrder: (order: Order) => void;
  storeOpen: boolean;
}) {
  const [tab, setTab] = useState<"agora" | "agendados">("agora");

  const pending = orders.filter((o) => o.status === "preparing");
  const completedCount = orders.filter((o) => o.status === "completed").length;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "20px" }}>
      {/* Painel Esquerdo de Fila de Pedidos */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #e2e8f0", paddingBottom: "10px" }}>
          <button
            type="button"
            style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "none", background: tab === "agora" ? "#ea1d2c" : "#f1f5f9", color: tab === "agora" ? "#fff" : "#64748b", fontWeight: 800, fontSize: "12px", cursor: "pointer" }}
            onClick={() => setTab("agora")}
          >
            Agora ({pending.length})
          </button>
          <button
            type="button"
            style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "none", background: tab === "agendados" ? "#ea1d2c" : "#f1f5f9", color: tab === "agendados" ? "#fff" : "#64748b", fontWeight: 800, fontSize: "12px", cursor: "pointer" }}
            onClick={() => setTab("agendados")}
          >
            Agendados (0)
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "560px", overflowY: "auto" }}>
          {pending.length ? (
            pending.map((order) => (
              <div
                key={order.id}
                style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "14px", cursor: "pointer", display: "flex", flexDirection: "column", gap: "8px" }}
                onClick={() => onSelectOrder(order)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>Pendente · 1 pedido</span>
                  <span style={{ background: "#ea1d2c", color: "#fff", padding: "2px 8px", borderRadius: "12px", fontSize: "10px", fontWeight: 800 }}>5 min.</span>
                </div>

                <div style={{ fontSize: "18px", fontWeight: 900, color: "#1e293b" }}>{order.code}</div>
                <strong style={{ fontSize: "13px" }}>{order.customerName}</strong>

                <div style={{ display: "flex", gap: "6px", fontSize: "10px" }}>
                  <span style={{ background: "#f3e8ff", color: "#6b21a8", padding: "2px 8px", borderRadius: "4px", fontWeight: 700 }}>Entrega Própria</span>
                  <span style={{ background: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: "4px", fontWeight: 700 }}>via WhatsApp / Site</span>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: "40px 10px", textAlign: "center", color: "#94a3b8", fontSize: "12px" }}>Nenhum pedido na fila de expedição</div>
          )}
        </div>
      </div>

      {/* Painel Direito de Visão Executiva da Operação */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
          <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "12px" }}>
            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700 }}>Horário de Funcionamento</span>
            <strong style={{ display: "block", fontSize: "16px", marginTop: "6px", color: "#1e293b" }}>18:00 - 23:59</strong>
          </div>

          <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "12px" }}>
            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700 }}>Itens Pausados no Cardápio</span>
            <strong style={{ display: "block", fontSize: "16px", marginTop: "6px", color: "#1e293b" }}>0 itens</strong>
          </div>

          <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "12px" }}>
            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700 }}>Pedidos Concluídos Hoje</span>
            <strong style={{ display: "block", fontSize: "20px", marginTop: "6px", color: "#ea1d2c" }}>{completedCount}</strong>
          </div>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "24px", minHeight: "360px", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <div>
            <img src="/smack-chicken-mark.png" alt="" style={{ height: "60px", opacity: 0.6, marginBottom: "12px" }} />
            <h3 style={{ fontSize: "18px", color: "#1e293b" }}>Modo Expedição de Alta Performance Ativo</h3>
            <p style={{ color: "#64748b", fontSize: "13px", maxWidth: "420px", margin: "8px auto 0" }}>
              Os pedidos que chegam pelo site de atendimento online aparecem instantaneamente com som de campainha e disparo direto de mensagens no WhatsApp.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* 📋 GESTÃO DE CARDÁPIO (PAUSAR / EDITAR ITENS) */
function CardapioManager({ notify }: { notify: (msg: string) => void }) {
  const [items, setItems] = useState(catalog);

  const toggleActive = (id: string | number) => {
    setItems((prev) =>
      prev.map((item) => (String(item.id) === String(id) ? { ...item, featured: !item.featured } : item))
    );
    notify("Status do item atualizado no cardápio online!");
  };

  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ fontSize: "20px", margin: 0 }}>Gestão de Cardápio iFood</h2>
          <p style={{ color: "#64748b", fontSize: "13px", margin: "4px 0 0" }}>Pause itens indisponíveis ou ajuste o estoque do site em tempo real.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
        {items.map((item) => (
          <div key={item.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "11px", fontWeight: 800, color: "#ea1d2c" }}>{item.category}</span>
              <button
                type="button"
                style={{ padding: "4px 10px", borderRadius: "20px", border: "none", background: item.featured ? "#dcfce7" : "#fee2e2", color: item.featured ? "#15803d" : "#991b1b", fontSize: "10px", fontWeight: 800, cursor: "pointer" }}
                onClick={() => toggleActive(item.id)}
              >
                {item.featured ? "✅ Disponível" : "⏸️ Pausado"}
              </button>
            </div>

            <strong style={{ fontSize: "14px" }}>{item.name}</strong>
            <p style={{ fontSize: "11px", color: "#64748b", minHeight: "28px" }}>{item.description}</p>
            <span style={{ fontSize: "15px", fontWeight: 900, color: "#1e293b" }}>{formatMoney(item.priceCents)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* 📈 DESEMPENHO E MÉTRICAS */
function DesempenhoView({ orders }: { orders: Order[] }) {
  const totalRev = orders.reduce((sum, o) => sum + o.totalCents, 0);

  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "24px" }}>
      <h2 style={{ fontSize: "20px", margin: "0 0 16px" }}>Desempenho da Operação (iFood Dashboard)</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "18px", borderRadius: "12px" }}>
          <span style={{ fontSize: "12px", color: "#64748b" }}>Faturamento Total</span>
          <strong style={{ display: "block", fontSize: "24px", color: "#ea1d2c", marginTop: "6px" }}>{formatMoney(totalRev)}</strong>
        </div>

        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "18px", borderRadius: "12px" }}>
          <span style={{ fontSize: "12px", color: "#64748b" }}>Total de Pedidos</span>
          <strong style={{ display: "block", fontSize: "24px", color: "#1e293b", marginTop: "6px" }}>{orders.length} pedidos</strong>
        </div>

        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "18px", borderRadius: "12px" }}>
          <span style={{ fontSize: "12px", color: "#64748b" }}>Tempo Médio de Preparo</span>
          <strong style={{ display: "block", fontSize: "24px", color: "#16a34a", marginTop: "6px" }}>18 min</strong>
        </div>
      </div>
    </div>
  );
}

/* ⭐ AVALIAÇÕES DOS CLIENTES */
function AvaliacoesView() {
  const reviews = [
    { name: "Günther R. Fank", rating: 5, comment: "Pensa numa delícia, sem falar no ótimo atendimento pelo WhatsApp!" },
    { name: "Ariela Pereira", rating: 5, comment: "Melhor frango que já provei, entrega super rápida e quentinha." },
    { name: "Valdoir Pedroso", rating: 5, comment: "Um dos melhores achados do Estreito. Frango no balde fresquinho e crocante!" },
  ];

  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "24px" }}>
      <h2 style={{ fontSize: "20px", margin: "0 0 16px" }}>Avaliações dos Clientes (Reviews)</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {reviews.map((r, i) => (
          <div key={i} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <strong>{r.name}</strong>
              <span style={{ color: "#f59e0b" }}>{"⭐".repeat(r.rating)}</span>
            </div>
            <p style={{ fontSize: "13px", color: "#475569", margin: 0 }}>"{r.comment}"</p>
          </div>
        ))}
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

/* ⚙️ CONFIGURAÇÕES & IMPRESSORA */
function SettingsView({ paperWidth, setPaperWidth, notify }: { paperWidth: 58 | 80; setPaperWidth: (w: 58 | 80) => void; notify: (msg: string) => void }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "24px" }}>
      <h2 style={{ fontSize: "20px", margin: "0 0 16px" }}>Configurações & Impressora USB</h2>
      <div style={{ background: "#f8fafc", padding: "18px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
        <strong>Bobina da Impressora Térmica:</strong>
        <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 12px" }}>Escolha o tamanho da bobina usada para imprimir comandas.</p>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: paperWidth === 58 ? "#ea1d2c" : "#e2e8f0", color: paperWidth === 58 ? "#fff" : "#000", fontWeight: 800, cursor: "pointer" }}
            onClick={() => { setPaperWidth(58); notify("Bobina configurada para 58mm"); }}
          >
            Bobina 58mm
          </button>
          <button
            type="button"
            style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: paperWidth === 80 ? "#ea1d2c" : "#e2e8f0", color: paperWidth === 80 ? "#fff" : "#000", fontWeight: 800, cursor: "pointer" }}
            onClick={() => { setPaperWidth(80); notify("Bobina configurada para 80mm"); }}
          >
            Bobina 80mm
          </button>
        </div>
      </div>
    </div>
  );
}

/* 📄 MODAL DE DETALHES DO PEDIDO */
function OrderDetailModal({
  order,
  onClose,
  onUpdateStatus,
  paperWidth,
}: {
  order: Order;
  onClose: () => void;
  onUpdateStatus: (order: Order, status: Order["status"]) => Promise<void>;
  paperWidth: 58 | 80;
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
            🖨️ Imprimir Comanda ({paperWidth}mm)
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
