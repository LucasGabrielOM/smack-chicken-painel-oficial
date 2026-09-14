"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { formatMoney, catalog } from "../../lib/catalog";

type View = "orders" | "expedicao" | "cardapio" | "relatorios" | "avaliacoes" | "settings";

type OrderItem = { id: string; productId: string; name: string; quantity: number; unitPriceCents: number };

type Order = {
  id: string; code: string; customerName: string;
  status: "preparing" | "ready" | "completed" | "cancelled";
  paymentMethod: string; cashReceivedCents?: number; totalCents: number;
  discountCents?: number; splitCount?: number; channel: string;
  notes?: string; createdAt: string; readyAt?: string; completedAt?: string;
  items: OrderItem[];
};

const api = async <T,>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers || {}) } });
  const payload = (await response.json()) as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error || "Erro ao concluir a acao");
  return payload as T;
};

const STATUS_COLOR: Record<Order["status"], string> = {
  preparing: "#e67e00", ready: "#1a7fe8", completed: "#17a35c", cancelled: "#9b1c1c"
};

function elapsed(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "< 1 min";
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function statusLabel(s: Order["status"]) {
  const map = { preparing: "Em Preparo", ready: "Pronto / Em Rota", completed: "Entregue", cancelled: "Cancelado" };
  return map[s] || s;
}
// SVG Icons
const IcoOrders = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>);
const IcoQueue = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>);
const IcoMenu = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>);
const IcoChart = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>);
const IcoStar = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>);
const IcoSettings = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>);
const IcoRefresh = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>);
const IcoSearch = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>);
const IcoClose = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>);
const IcoArrow = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>);
const IcoClock = () => (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>);
const IcoPrint = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>);
const Dot = ({ color }: { color: string }) => (<span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background:color, flexShrink:0 }} />);

const ADMIN_CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
.adm-shell{display:flex;height:100vh;overflow:hidden;background:#f1ede8;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#1b1715}
.adm-sidebar{width:220px;flex-shrink:0;background:#1d1917;display:flex;flex-direction:column;border-right:1px solid #2c2624}
.adm-sidebar-logo{padding:18px 18px 14px;border-bottom:1px solid #2c2624;display:flex;flex-direction:column;align-items:flex-start}
.adm-sidebar-nav{flex:1;padding:10px 0;overflow-y:auto}
.adm-nav-item{display:flex;align-items:center;gap:10px;padding:10px 18px;color:#9c918d;font-size:13px;font-weight:500;cursor:pointer;border:none;background:none;width:100%;text-align:left;transition:background .15s,color .15s}
.adm-nav-item:hover{background:#2c2624;color:#e8e0db}
.adm-nav-item.active{background:#b70922;color:#fff}
.adm-sidebar-footer{padding:14px 18px;border-top:1px solid #2c2624}
.adm-store-btn{display:flex;align-items:center;justify-content:space-between;gap:8px;background:none;border:1px solid #2c2624;border-radius:8px;padding:8px 12px;width:100%;cursor:pointer;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;transition:all .2s}
.adm-store-btn.open{border-color:#17a35c;color:#17a35c}
.adm-store-btn.closed{border-color:#9b1c1c;color:#e05c5c}
.adm-sdot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.adm-sdot.open{background:#17a35c;box-shadow:0 0 6px #17a35c}
.adm-sdot.closed{background:#e05c5c}
.adm-main{flex:1;display:flex;flex-direction:column;overflow:hidden}
.adm-topbar{height:56px;background:#fff;border-bottom:1px solid #e6dfd6;display:flex;align-items:center;padding:0 24px;gap:16px;flex-shrink:0}
.adm-topbar-title{font-size:15px;font-weight:700;color:#1b1715;flex:1}
.adm-search-wrap{position:relative}
.adm-search-wrap svg{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#9c918d;pointer-events:none}
.adm-search{border:1px solid #e6dfd6;background:#f5f2ec;border-radius:7px;padding:7px 12px 7px 32px;font-size:13px;color:#1b1715;outline:none;width:220px}
.adm-search::placeholder{color:#b0a49e}
.adm-search:focus{border-color:#b70922;background:#fff}
.adm-icon-btn{background:none;border:1px solid #e6dfd6;border-radius:7px;padding:7px;cursor:pointer;color:#706965;display:flex;align-items:center;transition:all .15s}
.adm-icon-btn:hover{border-color:#b70922;color:#b70922}
.adm-badge{background:#b70922;color:#fff;border-radius:20px;font-size:11px;font-weight:700;padding:1px 7px}
.adm-content{flex:1;overflow-y:auto;padding:24px}
.kanban-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.kanban-col{background:#fff;border-radius:10px;border:1px solid #e6dfd6;overflow:hidden}
.kanban-col-header{padding:12px 16px;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;border-bottom:1px solid #e6dfd6}
.kanban-col-header .cnt{margin-left:auto;background:#f1ede8;color:#706965;border-radius:12px;font-size:11px;padding:1px 8px;font-weight:600}
.kanban-cards{padding:12px;display:flex;flex-direction:column;gap:10px;min-height:120px}
.ocard{background:#fff;border:1px solid #e6dfd6;border-radius:8px;padding:12px;cursor:pointer;transition:box-shadow .15s,border-color .15s;position:relative}
.ocard:hover{box-shadow:0 4px 12px rgba(0,0,0,.08);border-color:#ccc4bb}
.ocard-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.ocard-code{font-size:13px;font-weight:800;color:#1b1715}
.ocard-elapsed{display:flex;align-items:center;gap:4px;font-size:11px;color:#9c918d}
.ocard-customer{font-size:12px;color:#706965;margin-bottom:4px;font-weight:500}
.ocard-preview{font-size:11px;color:#9c918d;margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ocard-footer{display:flex;align-items:center;justify-content:space-between}
.ocard-total{font-size:13px;font-weight:700;color:#1b1715}
.ocard-channel{font-size:10px;background:#f1ede8;color:#706965;border-radius:4px;padding:2px 6px;font-weight:600;text-transform:uppercase;letter-spacing:.4px}
.ocard-bar{position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:8px 0 0 8px}
.btn-primary{background:#b70922;color:#fff;border:none;border-radius:7px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;transition:background .15s}
.btn-primary:hover{background:#820516}
.btn-secondary{background:#f5f2ec;color:#1b1715;border:1px solid #e6dfd6;border-radius:7px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;transition:background .15s}
.btn-secondary:hover{background:#e6dfd6}
.btn-sm{padding:5px 10px !important;font-size:11px !important}
.btn-danger{background:none;border:1px solid #fca5a5;color:#9b1c1c;border-radius:7px;padding:5px 10px;font-size:11px;font-weight:600;cursor:pointer;transition:all .15s}
.btn-danger:hover{background:#9b1c1c;color:#fff;border-color:#9b1c1c}
.exp-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.exp-panel{background:#fff;border-radius:10px;border:1px solid #e6dfd6;overflow:hidden}
.exp-panel-header{padding:14px 18px;border-bottom:1px solid #e6dfd6;display:flex;align-items:center;justify-content:space-between}
.exp-panel-title{font-size:13px;font-weight:700;display:flex;align-items:center;gap:8px}
.exp-list{overflow-y:auto;max-height:calc(100vh - 200px)}
.exp-row{padding:14px 18px;border-bottom:1px solid #f1ede8;cursor:pointer;transition:background .12s}
.exp-row:hover{background:#faf8f6}
.exp-row:last-child{border-bottom:none}
.exp-row-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}
.exp-row-code{font-size:14px;font-weight:800}
.exp-row-time{font-size:11px;color:#9c918d;display:flex;align-items:center;gap:4px}
.exp-row-customer{font-size:12px;color:#706965;margin-bottom:6px}
.exp-row-actions{display:flex;gap:6px}
.catalog-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.ccard{background:#fff;border-radius:10px;border:1px solid #e6dfd6;padding:14px;display:flex;align-items:flex-start;gap:12px}
.ccard-img{width:52px;height:52px;border-radius:7px;object-fit:cover;background:#f1ede8;flex-shrink:0}
.ccard-info{flex:1;min-width:0}
.ccard-name{font-size:13px;font-weight:700;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ccard-price{font-size:12px;color:#706965;margin-bottom:8px}
.ccard-toggle{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:600}
.tpill{width:32px;height:17px;border-radius:99px;position:relative;cursor:pointer;border:none;transition:background .2s;flex-shrink:0}
.tpill-thumb{width:13px;height:13px;border-radius:50%;background:#fff;position:absolute;top:2px;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.2)}
.metrics-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}
.mcard{background:#fff;border:1px solid #e6dfd6;border-radius:10px;padding:18px}
.mcard-label{font-size:11px;font-weight:600;color:#9c918d;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
.mcard-value{font-size:26px;font-weight:800;color:#1b1715;line-height:1}
.mcard-sub{font-size:11px;color:#9c918d;margin-top:4px}
.rcard{background:#fff;border:1px solid #e6dfd6;border-radius:10px;padding:16px;margin-bottom:12px}
.rcard-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.rcard-author{font-size:13px;font-weight:700}
.rcard-date{font-size:11px;color:#9c918d}
.ssection{background:#fff;border:1px solid #e6dfd6;border-radius:10px;padding:20px;margin-bottom:16px}
.ssection-title{font-size:13px;font-weight:700;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #f1ede8;color:#1b1715}
.srow{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f1ede8}
.srow:last-child{border-bottom:none;padding-bottom:0}
.slabel{font-size:13px;font-weight:500}
.shint{font-size:11px;color:#9c918d;margin-top:2px}
.radio-grp{display:flex;gap:8px}
.rbtn{border:1px solid #e6dfd6;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer;background:none;transition:all .15s;color:#706965}
.rbtn.active{background:#b70922;border-color:#b70922;color:#fff}
.modal-overlay{position:fixed;inset:0;background:rgba(27,23,21,.55);display:flex;align-items:center;justify-content:center;z-index:1000;padding:24px}
.modal-box{background:#fff;border-radius:12px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2)}
.modal-header{padding:18px 20px;border-bottom:1px solid #e6dfd6;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:#fff;z-index:1}
.modal-title{font-size:16px;font-weight:800}
.modal-body{padding:20px}
.msect-title{font-size:11px;font-weight:700;color:#9c918d;text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px}
.mrow{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1ede8;font-size:13px}
.mrow:last-child{border-bottom:none}
.mrow-label{color:#706965}
.mrow-val{font-weight:600}
.modal-actions{padding:16px 20px;border-top:1px solid #e6dfd6;display:flex;gap:8px;flex-wrap:wrap}
.sbadge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;border:1px solid transparent}
.adm-toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#1b1715;color:#fff;padding:11px 22px;border-radius:8px;font-size:13px;font-weight:500;z-index:2000;box-shadow:0 4px 16px rgba(0,0,0,.25);pointer-events:none;white-space:nowrap}
.empty-st{text-align:center;padding:40px 20px;color:#9c918d;font-size:13px}
.sec-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
.sec-title{font-size:16px;font-weight:800;color:#1b1715}
@media(max-width:900px){.kanban-grid{grid-template-columns:1fr}.exp-grid{grid-template-columns:1fr}.metrics-grid{grid-template-columns:repeat(2,1fr)}.adm-sidebar{width:56px}.adm-nav-item span,.adm-logo-text,.adm-store-label{display:none}}
`;

export default function OnlineOrderManager() {
  const [view, setView] = useState<View>("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [storeOpen, setStoreOpen] = useState(true);
  const [toast, setToast] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paperWidth, setPaperWidth] = useState<58 | 80>(58);

  const notify = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(""), 4000); };

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
      await api(`/api/orders/${order.id}`, { method: "PATCH", body: JSON.stringify({ status: newStatus }) });
      notify(`Pedido ${order.code} — ${statusLabel(newStatus)}`);
      await loadOrders();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Falha ao atualizar pedido");
    }
  };

  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return orders;
    const q = searchTerm.toLowerCase();
    return orders.filter((o) => o.code.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q) || o.channel.toLowerCase().includes(q));
  }, [orders, searchTerm]);

  const activeOrders = filteredOrders.filter((o) => o.status !== "completed" && o.status !== "cancelled");
  const completedOrders = filteredOrders.filter((o) => o.status === "completed");

  const printOrder = (order: Order) => {
    const w = paperWidth === 58 ? 32 : 48;
    const sep = "-".repeat(w);
    const lines = ["SMACK CHICKEN", `Pedido #${order.code}`, sep,
      `Cliente: ${order.customerName}`, `Horario: ${fmtTime(order.createdAt)}`, `Canal: ${order.channel}`, sep,
      ...order.items.flatMap((i) => [`${i.quantity}x ${i.name}`, `   ${formatMoney(i.unitPriceCents * i.quantity)}`]),
      sep, ...(order.discountCents ? [`Desconto: -${formatMoney(order.discountCents)}`] : []),
      `TOTAL: ${formatMoney(order.totalCents)}`, `Pagamento: ${order.paymentMethod}`,
      ...(order.notes ? [sep, `Obs: ${order.notes}`] : []), sep];
    const win = window.open("", "_blank", "width=400,height=600");
    if (win) { win.document.write(`<pre style="font-family:monospace;font-size:13px;padding:12px">${lines.join("\n")}</pre>`); win.document.close(); win.print(); }
  };

  type NavDef = { id: View; label: string; Icon: () => React.ReactElement };
  const navItems: NavDef[] = [
    { id: "orders",     label: "Pedidos",       Icon: IcoOrders   },
    { id: "expedicao",  label: "Expedicao",      Icon: IcoQueue    },
    { id: "cardapio",   label: "Cardapio",       Icon: IcoMenu     },
    { id: "relatorios", label: "Relatorios",     Icon: IcoChart    },
    { id: "avaliacoes", label: "Avaliacoes",     Icon: IcoStar     },
    { id: "settings",   label: "Configuracoes",  Icon: IcoSettings },
  ];
  const viewLabels: Record<View, string> = {
    orders: "Pedidos", expedicao: "Expedicao", cardapio: "Cardapio",
    relatorios: "Relatorios", avaliacoes: "Avaliacoes", settings: "Configuracoes"
  };

  return (
    <>
      <style>{ADMIN_CSS}</style>
      <div className="adm-shell">
        <aside className="adm-sidebar">
          <div className="adm-sidebar-logo">
            <img
              src="/smack-chicken-logo-white.png"
              alt="Smack Chicken"
              style={{ height: "26px", width: "auto", objectFit: "contain" }}
              onError={(e) => { (e.target as HTMLImageElement).src = "/smack-chicken-logo.png"; }}
            />
            <span style={{ fontSize: "9px", color: "#ffc814", letterSpacing: "2px", textTransform: "uppercase", fontWeight: 700, marginTop: "4px" }}>
              Gestão Online
            </span>
          </div>
          <nav className="adm-sidebar-nav">
            {navItems.map(({ id, label, Icon }) => (
              <button key={id} className={`adm-nav-item${view === id ? " active" : ""}`} onClick={() => setView(id)}>
                <Icon /><span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="adm-sidebar-footer">
            <button className={`adm-store-btn${storeOpen ? " open" : " closed"}`}
              onClick={() => { setStoreOpen((v) => !v); notify(storeOpen ? "Loja fechada para novos pedidos." : "Loja aberta para pedidos."); }}>
              <span className={`adm-sdot${storeOpen ? " open" : " closed"}`} />
              <span className="adm-store-label">{storeOpen ? "Loja Aberta" : "Loja Fechada"}</span>
            </button>
          </div>
        </aside>
        <div className="adm-main">
          <header className="adm-topbar">
            <span className="adm-topbar-title">{viewLabels[view]}</span>
            <div className="adm-search-wrap">
              <IcoSearch />
              <input className="adm-search" placeholder="Buscar pedido ou cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <span className="adm-badge">{activeOrders.length} ativos</span>
            <button className="adm-icon-btn" onClick={async () => { setRefreshing(true); await loadOrders(); setRefreshing(false); }} disabled={refreshing} title="Atualizar">
              <IcoRefresh />
            </button>
          </header>
          <main className="adm-content">
            {view === "orders" && (
              <KanbanView
                preparing={filteredOrders.filter((o) => o.status === "preparing")}
                ready={filteredOrders.filter((o) => o.status === "ready")}
                completed={completedOrders}
                onSelect={setSelectedOrder} onMove={updateOrderStatus}
              />
            )}
            {view === "expedicao" && (
              <ExpedicaoView
                preparing={filteredOrders.filter((o) => o.status === "preparing")}
                ready={filteredOrders.filter((o) => o.status === "ready")}
                onSelect={setSelectedOrder} onMove={updateOrderStatus}
              />
            )}
            {view === "cardapio" && <CardapioView notify={notify} />}
            {view === "relatorios" && <RelatoriosView orders={orders} completedOrders={completedOrders} />}
            {view === "avaliacoes" && <AvaliacoesView />}
            {view === "settings" && <SettingsView paperWidth={paperWidth} setPaperWidth={setPaperWidth} notify={notify} />}
          </main>
        </div>
      </div>
      {selectedOrder && <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onMove={updateOrderStatus} onPrint={printOrder} />}
      {toast && <div className="adm-toast">{toast}</div>}
    </>
  );
}

/* KANBAN */
function KanbanView({ preparing, ready, completed, onSelect, onMove }: {
  preparing: Order[]; ready: Order[]; completed: Order[];
  onSelect: (o: Order) => void; onMove: (o: Order, s: Order["status"]) => void;
}) {
  const cols = [
    { id: "preparing" as const, label: "Em Preparo",       color: "#e67e00", orders: preparing },
    { id: "ready"     as const, label: "Pronto / Em Rota", color: "#1a7fe8", orders: ready     },
    { id: "completed" as const, label: "Entregues",        color: "#17a35c", orders: completed },
  ];
  return (
    <>
      <div className="sec-header">
        <span className="sec-title">Quadro de Pedidos</span>
        <span style={{ fontSize:12, color:"#9c918d" }}>Atualizado a cada 7s</span>
      </div>
      <div className="kanban-grid">
        {cols.map((col) => (
          <div key={col.id} className="kanban-col">
            <div className="kanban-col-header" style={{ color:col.color }}>
              <Dot color={col.color} />{col.label}
              <span className="cnt">{col.orders.length}</span>
            </div>
            <div className="kanban-cards">
              {col.orders.length === 0 && <div className="empty-st">Nenhum pedido</div>}
              {col.orders.map((order) => <OrderCard key={order.id} order={order} accentColor={col.color} onSelect={onSelect} onMove={onMove} />)}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function OrderCard({ order, accentColor, onSelect, onMove }: {
  order: Order; accentColor: string;
  onSelect: (o: Order) => void; onMove: (o: Order, s: Order["status"]) => void;
}) {
  const preview = order.items.map((i) => `${i.quantity}x ${i.name}`).join(", ");
  const next = order.status === "preparing" ? "ready" : order.status === "ready" ? "completed" : null;
  const nextLbl = order.status === "preparing" ? "Pronto" : order.status === "ready" ? "Entregue" : null;
  return (
    <div className="ocard" onClick={() => onSelect(order)}>
      <div className="ocard-bar" style={{ background:accentColor }} />
      <div className="ocard-top">
        <span className="ocard-code">#{order.code}</span>
        <span className="ocard-elapsed"><IcoClock /> {elapsed(order.createdAt)}</span>
      </div>
      <div className="ocard-customer">{order.customerName}</div>
      <div className="ocard-preview">{preview}</div>
      <div className="ocard-footer">
        <span className="ocard-total">{formatMoney(order.totalCents)}</span>
        <span className="ocard-channel">{order.channel}</span>
      </div>
      {next && (
        <div style={{ marginTop:10, display:"flex", gap:6 }} onClick={(e) => e.stopPropagation()}>
          <button className="btn-primary btn-sm" style={{ flex:1 }} onClick={() => onMove(order, next)}>
            {nextLbl} <IcoArrow />
          </button>
          {order.status === "preparing" && (
            <button className="btn-danger btn-sm" onClick={() => onMove(order, "cancelled")}>Cancelar</button>
          )}
        </div>
      )}
    </div>
  );
}

/* EXPEDICAO */
function ExpedicaoView({ preparing, ready, onSelect, onMove }: {
  preparing: Order[]; ready: Order[];
  onSelect: (o: Order) => void; onMove: (o: Order, s: Order["status"]) => void;
}) {
  return (
    <>
      <div className="sec-header">
        <span className="sec-title">Expedicao</span>
        <span style={{ fontSize:12, color:"#9c918d" }}>{preparing.length + ready.length} pedidos em aberto</span>
      </div>
      <div className="exp-grid">
        <div className="exp-panel">
          <div className="exp-panel-header">
            <div className="exp-panel-title"><Dot color="#e67e00" /> Em Preparo</div>
            <span className="adm-badge" style={{ background:"#e67e00" }}>{preparing.length}</span>
          </div>
          <div className="exp-list">
            {preparing.length === 0 && <div className="empty-st">Fila vazia</div>}
            {preparing.map((o) => <ExpRow key={o.id} order={o} nextLabel="Marcar Pronto" nextStatus="ready" onSelect={onSelect} onMove={onMove} />)}
          </div>
        </div>
        <div className="exp-panel">
          <div className="exp-panel-header">
            <div className="exp-panel-title"><Dot color="#1a7fe8" /> Pronto / Em Rota</div>
            <span className="adm-badge" style={{ background:"#1a7fe8" }}>{ready.length}</span>
          </div>
          <div className="exp-list">
            {ready.length === 0 && <div className="empty-st">Fila vazia</div>}
            {ready.map((o) => <ExpRow key={o.id} order={o} nextLabel="Confirmar Entrega" nextStatus="completed" onSelect={onSelect} onMove={onMove} />)}
          </div>
        </div>
      </div>
    </>
  );
}

function ExpRow({ order, nextLabel, nextStatus, onSelect, onMove }: {
  order: Order; nextLabel: string; nextStatus: Order["status"];
  onSelect: (o: Order) => void; onMove: (o: Order, s: Order["status"]) => void;
}) {
  return (
    <div className="exp-row" onClick={() => onSelect(order)}>
      <div className="exp-row-top">
        <span className="exp-row-code">#{order.code}</span>
        <span className="exp-row-time"><IcoClock /> {elapsed(order.createdAt)}</span>
      </div>
      <div className="exp-row-customer">{order.customerName} — {formatMoney(order.totalCents)}</div>
      <div className="exp-row-actions" onClick={(e) => e.stopPropagation()}>
        <button className="btn-primary btn-sm" onClick={() => onMove(order, nextStatus)}>
          {nextLabel} <IcoArrow />
        </button>
        {nextStatus === "ready" && (
          <button className="btn-danger btn-sm" onClick={() => onMove(order, "cancelled")}>Cancelar</button>
        )}
      </div>
    </div>
  );
}

/* CARDAPIO */
function CardapioView({ notify }: { notify: (m: string) => void }) {
  const [paused, setPaused] = useState<Set<string | number>>(new Set());
  const toggle = (id: string | number) => {
    setPaused((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); notify("Item liberado no cardapio."); }
      else { next.add(id); notify("Item pausado temporariamente."); }
      return next;
    });
  };
  const categories = Array.from(new Set(catalog.map((p) => p.category)));
  return (
    <>
      <div className="sec-header">
        <span className="sec-title">Gestao de Cardapio</span>
        <span style={{ fontSize:12, color:"#9c918d" }}>{paused.size} item(s) pausado(s)</span>
      </div>
      {categories.map((cat) => (
        <div key={cat} style={{ marginBottom:24 }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#9c918d", textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:12 }}>{cat}</div>
          <div className="catalog-grid">
            {catalog.filter((p) => p.category === cat).map((product) => {
              const off = paused.has(product.id);
              return (
                <div key={product.id} className="ccard" style={{ opacity:off ? 0.6 : 1 }}>
                  <img className="ccard-img" src={(product as { image?: string }).image || "/smack-chicken-mark.png"} alt={product.name}
                    onError={(e) => { (e.target as HTMLImageElement).src = "/smack-chicken-mark.png"; }} />
                  <div className="ccard-info">
                    <div className="ccard-name">{product.name}</div>
                    <div className="ccard-price">{formatMoney(product.priceCents)}</div>
                    <div className="ccard-toggle">
                      <button className="tpill" style={{ background:off ? "#e6dfd6" : "#17a35c" }} onClick={() => toggle(product.id)}>
                        <div className="tpill-thumb" style={{ left:off ? 2 : 17 }} />
                      </button>
                      <span style={{ color:off ? "#9b1c1c" : "#065f46" }}>{off ? "Pausado" : "Disponivel"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

/* RELATORIOS */
function RelatoriosView({ orders, completedOrders }: { orders: Order[]; completedOrders: Order[] }) {
  const totalRevenue = completedOrders.reduce((s, o) => s + o.totalCents, 0);
  const avgTicket = completedOrders.length ? Math.round(totalRevenue / completedOrders.length) : 0;
  const cancelledCount = orders.filter((o) => o.status === "cancelled").length;
  const cancelRate = orders.length ? Math.round((cancelledCount / orders.length) * 100) : 0;
  const channelMap: Record<string, number> = {};
  completedOrders.forEach((o) => { channelMap[o.channel] = (channelMap[o.channel] || 0) + 1; });
  const paymentMap: Record<string, number> = {};
  completedOrders.forEach((o) => { paymentMap[o.paymentMethod] = (paymentMap[o.paymentMethod] || 0) + 1; });
  return (
    <>
      <div className="sec-header">
        <span className="sec-title">Relatorios e Desempenho</span>
        <span style={{ fontSize:12, color:"#9c918d" }}>Ultimos 30 dias</span>
      </div>
      <div className="metrics-grid">
        <div className="mcard">
          <div className="mcard-label">Receita Total</div>
          <div className="mcard-value" style={{ color:"#b70922" }}>{formatMoney(totalRevenue)}</div>
          <div className="mcard-sub">{completedOrders.length} pedidos entregues</div>
        </div>
        <div className="mcard">
          <div className="mcard-label">Ticket Medio</div>
          <div className="mcard-value">{formatMoney(avgTicket)}</div>
          <div className="mcard-sub">por pedido concluido</div>
        </div>
        <div className="mcard">
          <div className="mcard-label">Pedidos Totais</div>
          <div className="mcard-value">{orders.length}</div>
          <div className="mcard-sub">{cancelledCount} cancelado(s)</div>
        </div>
        <div className="mcard">
          <div className="mcard-label">Taxa de Cancelamento</div>
          <div className="mcard-value" style={{ color:cancelRate > 10 ? "#9b1c1c" : "#17a35c" }}>{cancelRate}%</div>
          <div className="mcard-sub">meta: abaixo de 5%</div>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <div className="ssection">
          <div className="ssection-title">Pedidos por Canal</div>
          {Object.entries(channelMap).length === 0 && <div style={{ fontSize:13, color:"#9c918d" }}>Sem dados ainda</div>}
          {Object.entries(channelMap).map(([ch, count]) => (
            <div key={ch} className="srow"><span className="slabel">{ch}</span><span style={{ fontWeight:700 }}>{count}</span></div>
          ))}
        </div>
        <div className="ssection">
          <div className="ssection-title">Formas de Pagamento</div>
          {Object.entries(paymentMap).length === 0 && <div style={{ fontSize:13, color:"#9c918d" }}>Sem dados ainda</div>}
          {Object.entries(paymentMap).map(([pay, count]) => (
            <div key={pay} className="srow"><span className="slabel">{pay}</span><span style={{ fontWeight:700 }}>{count}</span></div>
          ))}
        </div>
      </div>
    </>
  );
}

/* AVALIACOES */
function AvaliacoesView() {
  const reviews = [
    { id:1, author:"Gabriel S.", stars:5, date:"Hoje, 13h22", text:"Pedido chegou rapido, frango muito crocante! Ja e meu favorito." },
    { id:2, author:"Mariana L.", stars:4, date:"Hoje, 11h05", text:"Muito bom, so achei que demorou um pouquinho. A qualidade compensa." },
    { id:3, author:"Rafael P.", stars:5, date:"Ontem, 19h48", text:"Melhor frango da cidade, sem duvida. Voltarei sempre!" },
    { id:4, author:"Camila R.", stars:3, date:"Ontem, 14h30", text:"Estava gostoso, mas faltou molho que pedi nas observacoes." },
  ];
  const avg = reviews.reduce((s, r) => s + r.stars, 0) / reviews.length;
  return (
    <>
      <div className="sec-header">
        <span className="sec-title">Avaliacoes dos Clientes</span>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:22, fontWeight:800 }}>{avg.toFixed(1)}</span>
          <span style={{ color:"#ffc814", fontSize:18 }}>{"★".repeat(Math.round(avg))}</span>
          <span style={{ fontSize:12, color:"#9c918d" }}>{reviews.length} avaliacoes</span>
        </div>
      </div>
      {reviews.map((r) => (
        <div key={r.id} className="rcard">
          <div className="rcard-header">
            <span className="rcard-author">{r.author}</span>
            <span className="rcard-date">{r.date}</span>
          </div>
          <div style={{ display:"flex", gap:2, marginBottom:8 }}>
            {[1,2,3,4,5].map((s) => <span key={s} style={{ color:s <= r.stars ? "#ffc814" : "#e6dfd6", fontSize:16 }}>★</span>)}
          </div>
          <div style={{ fontSize:13, color:"#4a4340", lineHeight:1.5 }}>{r.text}</div>
        </div>
      ))}
    </>
  );
}

/* SETTINGS */
function SettingsView({ paperWidth, setPaperWidth, notify }: {
  paperWidth: 58 | 80; setPaperWidth: (w: 58 | 80) => void; notify: (m: string) => void;
}) {
  return (
    <>
      <div className="sec-header"><span className="sec-title">Configuracoes</span></div>
      <div className="ssection">
        <div className="ssection-title">Impressora Termica</div>
        <div className="srow">
          <div><div className="slabel">Largura do Papel</div><div className="shint">Selecione de acordo com o rolo da sua impressora</div></div>
          <div className="radio-grp">
            <button className={`rbtn${paperWidth === 58 ? " active" : ""}`} onClick={() => { setPaperWidth(58); notify("Configurado para papel 58mm."); }}>58mm</button>
            <button className={`rbtn${paperWidth === 80 ? " active" : ""}`} onClick={() => { setPaperWidth(80); notify("Configurado para papel 80mm."); }}>80mm</button>
          </div>
        </div>
        <div className="srow">
          <div><div className="slabel">Impressao automatica</div><div className="shint">Imprime ao aceitar um novo pedido</div></div>
          <button className="btn-secondary btn-sm">Em breve</button>
        </div>
      </div>
      <div className="ssection">
        <div className="ssection-title">Notificacoes</div>
        <div className="srow">
          <div><div className="slabel">Alerta sonoro de novo pedido</div><div className="shint">Toca um som ao receber um novo pedido</div></div>
          <button className="btn-secondary btn-sm">Em breve</button>
        </div>
        <div className="srow">
          <div><div className="slabel">Notificacao por WhatsApp ao cliente</div><div className="shint">Envia atualizacao de status automaticamente</div></div>
          <span style={{ fontSize:12, fontWeight:700, color:"#17a35c" }}>Ativo</span>
        </div>
      </div>
      <div className="ssection">
        <div className="ssection-title">Informacoes da Conta</div>
        <div className="srow"><span className="slabel">Estabelecimento</span><span style={{ fontWeight:700 }}>Smack Chicken</span></div>
        <div className="srow"><span className="slabel">Plataforma</span><span style={{ fontWeight:700 }}>Site de Pedidos Online</span></div>
        <div className="srow"><span className="slabel">Versao do sistema</span><span style={{ fontWeight:600, color:"#9c918d" }}>1.0.0</span></div>
      </div>
    </>
  );
}

/* ORDER DETAIL MODAL */
function OrderDetailModal({ order, onClose, onMove, onPrint }: {
  order: Order; onClose: () => void;
  onMove: (o: Order, s: Order["status"]) => void;
  onPrint: (o: Order) => void;
}) {
  const statusColor = STATUS_COLOR[order.status];
  const next = order.status === "preparing" ? "ready" : order.status === "ready" ? "completed" : null;
  const nextLbl = order.status === "preparing" ? "Marcar como Pronto" : order.status === "ready" ? "Confirmar Entrega" : null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Pedido #{order.code}</div>
            <div style={{ marginTop:4 }}>
              <span className="sbadge" style={{ background:`${statusColor}18`, color:statusColor, borderColor:`${statusColor}40` }}>
                <Dot color={statusColor} />{statusLabel(order.status)}
              </span>
            </div>
          </div>
          <button className="adm-icon-btn" onClick={onClose}><IcoClose /></button>
        </div>
        <div className="modal-body">
          <div className="msect-title">Informacoes do Pedido</div>
          <div className="mrow"><span className="mrow-label">Cliente</span><span className="mrow-val">{order.customerName}</span></div>
          <div className="mrow"><span className="mrow-label">Canal</span><span className="mrow-val">{order.channel}</span></div>
          <div className="mrow"><span className="mrow-label">Horario</span><span className="mrow-val">{fmtTime(order.createdAt)} · {elapsed(order.createdAt)} atras</span></div>
          <div className="mrow"><span className="mrow-label">Pagamento</span><span className="mrow-val">{order.paymentMethod}</span></div>
          {order.cashReceivedCents !== undefined && order.cashReceivedCents > 0 && (
            <div className="mrow"><span className="mrow-label">Troco para</span><span className="mrow-val">{formatMoney(order.cashReceivedCents)}</span></div>
          )}
          <div style={{ margin:"18px 0 12px" }} className="msect-title">Itens</div>
          {order.items.map((item) => (
            <div key={item.id} className="mrow">
              <span className="mrow-label">{item.quantity}x {item.name}</span>
              <span className="mrow-val">{formatMoney(item.unitPriceCents * item.quantity)}</span>
            </div>
          ))}
          {order.discountCents ? (
            <div className="mrow"><span className="mrow-label">Desconto</span><span className="mrow-val" style={{ color:"#17a35c" }}>-{formatMoney(order.discountCents)}</span></div>
          ) : null}
          <div className="mrow" style={{ borderTop:"2px solid #e6dfd6", paddingTop:10, marginTop:2 }}>
            <span style={{ fontWeight:700, fontSize:14 }}>Total</span>
            <span style={{ fontWeight:800, fontSize:16 }}>{formatMoney(order.totalCents)}</span>
          </div>
          {order.notes && (
            <>
              <div style={{ margin:"18px 0 8px" }} className="msect-title">Observacoes</div>
              <div style={{ background:"#fdf8ed", border:"1px solid #f0e8c8", borderRadius:8, padding:"10px 14px", fontSize:13, color:"#5a4a20" }}>{order.notes}</div>
            </>
          )}
        </div>
        <div className="modal-actions">
          {next && (
            <button className="btn-primary" onClick={() => { onMove(order, next); onClose(); }}>
              {nextLbl} <IcoArrow />
            </button>
          )}
          <button className="btn-secondary" onClick={() => onPrint(order)}>
            <IcoPrint /> Imprimir
          </button>
          {order.status === "preparing" && (
            <button className="btn-danger" onClick={() => { onMove(order, "cancelled"); onClose(); }}>Cancelar Pedido</button>
          )}
        </div>
      </div>
    </div>
  );
}
