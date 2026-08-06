"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { catalog, formatMoney } from "../lib/catalog";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { SiCocacola, SiMonster } from "react-icons/si";

type View = "dashboard" | "pos" | "kitchen" | "orders" | "finance" | "planning";
type User = { id: string; name: string; email: string; role: string };
type Product = { id: number; name: string; description: string; priceCents: number; category: string; image: string; active: boolean };
type CartItem = Product & { quantity: number };
type OrderItem = { id: string; productId: string; name: string; quantity: number; unitPriceCents: number };
type Order = {
  id: string; code: string; customerName: string; status: "preparing" | "ready" | "completed" | "cancelled";
  paymentMethod: string; cashReceivedCents?: number; totalCents: number; channel: string; notes?: string;
  createdAt: string; readyAt?: string; completedAt?: string; items: OrderItem[];
};
type FinanceEntry = {
  id: string; entryType: "income" | "expense"; category: string; description: string;
  amountCents: number; paymentMethod?: string; entryDate: string; notes?: string;
};
type Plan = { id: string; title: string; targetCents: number; currentCents: number; dueDate?: string; status: string; notes?: string };
type DashboardData = {
  summary: { revenue: number; orders: number; ticket: number; avgMinutes: string };
  hourly: Array<{ hour: number; value: number }>;
  days: Array<{ day: string; value: number; orders: number }>;
  payments: Array<{ name: string; count: number; value: number }>;
  products: Array<{ name: string; quantity: number; value: number }>;
  finance: { income: number; expense: number };
};

const api = async <T,>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers || {}) } });
  const payload = await response.json() as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error || "Não foi possível concluir");
  return payload as T;
};

function PanelLogo() {
  return <div className="panel-logo"><span><img src="/smack-chicken-mark.png" alt="" /></span><strong>SMACK<small>OPERAÇÃO</small></strong></div>;
}

function useClock(iso: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const seconds = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function OrderTimer({ iso }: { iso: string }) {
  const value = useClock(iso);
  return <span className={Number(value.split(":")[0]) >= 15 ? "timer late" : "timer"}>{value}</span>;
}

function formatOrderDuration(order: Order) {
  if (order.status === "cancelled") return "—";
  const start = new Date(order.createdAt).getTime();
  const endIso = order.completedAt || order.readyAt;
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "—";
  const totalMinutes = Math.max(0, Math.round((end - start) / 60000));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}min` : `${hours}h`;
}

export default function StorePanel() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [view, setView] = useState<View>("dashboard");
  const [products, setProducts] = useState<Product[]>(() =>
    catalog.map((item) => ({ ...item, id: Number(item.id), priceCents: Number(item.priceCents), active: true }))
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [toast, setToast] = useState("");
  const [paperWidth, setPaperWidth] = useState<58 | 80>(80);
  const [refreshing, setRefreshing] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  const [selectedDate, setSelectedDate] = useState<string>("");

  const loadAll = useCallback(async (targetDate?: string) => {
    const dateQuery = targetDate ? `?date=${encodeURIComponent(targetDate)}` : "";
    
    try {
      const productRes = await api<{ products: Product[] }>("/api/products").catch(() => ({ products: [] }));
      const list = productRes.products && productRes.products.length > 0 ? productRes.products : catalog;
      setProducts(list.map((product) => ({
        ...product,
        id: Number(product.id),
        priceCents: Number(product.priceCents),
        active: product.active !== false,
      })));
    } catch {}

    try {
      const orderRes = await api<{ orders: Order[] }>("/api/orders").catch(() => ({ orders: [] }));
      setOrders(orderRes.orders || []);
    } catch {}

    try {
      const financeRes = await api<{ entries: FinanceEntry[] }>("/api/finance").catch(() => ({ entries: [] }));
      setEntries(financeRes.entries || []);
    } catch {}

    try {
      const planRes = await api<{ plans: Plan[] }>("/api/plans").catch(() => ({ plans: [] }));
      setPlans(planRes.plans || []);
    } catch {}

    try {
      const dashRes = await api<DashboardData>(`/api/dashboard${dateQuery}`).catch(() => null);
      if (dashRes) setDashboard(dashRes);
    } catch {}
  }, []);

  const changeDashboardDate = async (newDate: string) => {
    setSelectedDate(newDate);
    await loadAll(newDate);
  };

  useEffect(() => {
    api<{ user: User }>("/api/auth")
      .then(async ({ user }) => { setUser(user); await loadAll(); })
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, [loadAll]);

  useEffect(() => {
    const savedWidth = Number(window.localStorage.getItem("smack-thermal-paper"));
    if (savedWidth === 58 || savedWidth === 80) setPaperWidth(savedWidth);
    const savedTheme = window.localStorage.getItem("smack-panel-theme");
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
  }, []);

  const toggleTheme = () => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      window.localStorage.setItem("smack-panel-theme", next);
      return next;
    });
  };

  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => {
      Promise.all([
        api<{ orders: Order[] }>("/api/orders"),
        api<DashboardData>("/api/dashboard"),
      ]).then(([orderData, dashboardData]) => {
        setOrders(orderData.orders);
        setDashboard(dashboardData);
      }).catch(() => undefined);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [user]);

  if (checking) return <div className="panel-loading"><PanelLogo /><span>Preparando operação…</span></div>;
  if (!user) return <Login onLogin={async (loggedUser) => { setUser(loggedUser); await loadAll(); }} />;

  const activeCount = orders.filter((order) => order.status === "preparing" || order.status === "ready").length;
  const nav: Array<[View, string, string]> = [
    ["dashboard", "▦", "Visão geral"],
    ["pos", "＋", "Novo pedido"],
    ["kitchen", "♨", "Cozinha"],
    ["orders", "≡", "Pedidos"],
    ["finance", "R$", "Financeiro"],
    ["planning", "◎", "Planejamento"],
  ];

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await loadAll();
      notify("Dados atualizados com sucesso.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível atualizar os dados.");
    } finally {
      setRefreshing(false);
    }
  };

  const configurePrinter = () => {
    const answer = window.prompt("Qual é a largura da bobina térmica? Digite 80 ou 58 (mm).", String(paperWidth));
    if (answer === null) return;
    const width = Number(answer);
    if (width !== 58 && width !== 80) {
      notify("Informe 80 ou 58 para o tamanho da bobina.");
      return;
    }
    setPaperWidth(width);
    window.localStorage.setItem("smack-thermal-paper", String(width));
    notify(`Impressão USB configurada para bobina de ${width} mm.`);
  };

  return (
    <main className={theme === "light" ? "panel-app theme-light" : "panel-app"}>
      {toast && <div className="panel-toast">{toast}</div>}
      <aside className="panel-sidebar">
        <PanelLogo />
        <div className="store-chip"><i /> <span><b>Loja Estreito</b><small>Aberta · até 23h</small></span></div>
        <nav>{nav.map(([id, icon, label]) => (
          <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>
            <span>{icon}</span>{label}{id === "kitchen" && activeCount > 0 && <b>{activeCount}</b>}
          </button>
        ))}</nav>
        <div className="panel-side-bottom">
          <button onClick={configurePrinter}>⌁ <span><b>Impressora USB · {paperWidth} mm</b><small>Alterar tamanho da bobina</small></span></button>
          <button onClick={async () => { await api("/api/auth", { method: "DELETE" }); location.reload(); }}>↪ Sair do painel</button>
        </div>
      </aside>
      <section className="panel-main">
        <header className="panel-top">
          <div><b>SMACK CHICKEN</b><span>Rua Fúlvio Aducci, 1074 · Estreito</span></div>
          <div className="panel-top-actions"><button className="theme-toggle" onClick={toggleTheme} title={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}><i>{theme === "dark" ? "☀" : "🌙"}</i>{theme === "dark" ? "Tema claro" : "Tema escuro"}</button><button className={refreshing ? "refreshing" : ""} onClick={refresh} disabled={refreshing}><i>↻</i>{refreshing ? "Atualizando…" : "Atualizar"}</button><span className="panel-user"><i><b>{user.name}</b><small>{user.role === "owner" ? "Proprietário" : "Equipe"}</small></i><em>{user.name.charAt(0)}</em></span></div>
        </header>
        {view === "dashboard" && <Dashboard data={dashboard} orders={orders} selectedDate={selectedDate} onDateChange={changeDashboardDate} theme={theme} />}
        {view === "pos" && <PointOfSale products={products} paperWidth={paperWidth} onCreated={async () => { await loadAll(); notify("Pedido enviado para a cozinha e impressão preparada."); }} notify={notify} />}
        {view === "kitchen" && <Kitchen orders={orders} onStatus={async (id, status) => { await api(`/api/orders/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); await loadAll(); }} onPayment={async (id, paymentMethod) => { await api(`/api/orders/${id}`, { method: "PATCH", body: JSON.stringify({ paymentMethod }) }); await loadAll(); notify(`Pagamento alterado para ${paymentMethod}.`); }} />}
        {view === "orders" && <Orders orders={orders} onPrint={(order) => printOrder(order, paperWidth)} onCancel={async (id) => { await api(`/api/orders/${id}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) }); await loadAll(); notify("Pedido cancelado e retirado do faturamento."); }} onDelete={async (id) => { await api(`/api/orders/${id}`, { method: "DELETE" }); await loadAll(); notify("Pedido excluído permanentemente."); }} onPayment={async (id, paymentMethod) => { await api(`/api/orders/${id}`, { method: "PATCH", body: JSON.stringify({ paymentMethod }) }); await loadAll(); notify(`Pagamento alterado para ${paymentMethod}.`); }} />}
        {view === "finance" && <Finance entries={entries} dashboard={dashboard} onCreated={async () => { await loadAll(); notify("Lançamento salvo."); }} onDeleted={async (id) => { await api(`/api/finance?id=${encodeURIComponent(id)}`, { method: "DELETE" }); await loadAll(); notify("Lançamento removido do histórico."); }} theme={theme} />}
        {view === "planning" && <Planning plans={plans} dashboard={dashboard} onCreated={async () => { await loadAll(); notify("Meta criada."); }} onDeleted={async (id) => { await api(`/api/plans?id=${encodeURIComponent(id)}`, { method: "DELETE" }); await loadAll(); notify("Meta removida do planejamento."); }} />}
      </section>
    </main>
  );
}

function Login({ onLogin }: { onLogin: (user: User) => Promise<void> }) {
  const [email, setEmail] = useState("gestao@smackchicken.com.br");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const result = await api<{ user: User }>("/api/auth", { method: "POST", body: JSON.stringify({ email, password }) });
      await onLogin(result.user);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Falha ao entrar");
    } finally { setLoading(false); }
  };
  return <main className="panel-login">
    <section>
      <PanelLogo />
      <span className="login-badge">PAINEL PRIVADO DA LOJA</span>
      <h1>Controle sua operação<br />em um só lugar.</h1>
      <p>Pedidos, cozinha, caixa, faturamento e planejamento financeiro conectados.</p>
      <div className="login-features"><span>✓ Pedidos em tempo real</span><span>✓ Controle financeiro</span><span>✓ Indicadores da loja</span></div>
    </section>
    <form onSubmit={submit}>
      <div><span>ACESSO DA EQUIPE</span><h2>Entrar no painel</h2><p>Use os dados cadastrados para a gestão.</p></div>
      <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoFocus /></label>
      {error && <p className="form-error">{error}</p>}
      <button disabled={loading}>{loading ? "Entrando…" : "Entrar com segurança →"}</button>
      <small>Acesso restrito à equipe SMACK CHICKEN.</small>
    </form>
  </main>;
}

function chartTheme(theme: "dark" | "light") {
  return theme === "light"
    ? {
        grid: "#e8e0d6",
        tick: "#8a8078",
        accent: "#c8102e",
        accent2: "#16835b",
        tooltipStyle: { border: "1px solid #ece4da", borderRadius: 10, background: "#ffffff", color: "#201a18", boxShadow: "0 12px 35px #00000018", fontSize: 11 },
      }
    : {
        grid: "#1f2530",
        tick: "#7c8698",
        accent: "#ff3862",
        accent2: "#29e6a6",
        tooltipStyle: { border: "1px solid #242b38", borderRadius: 10, background: "#12151c", color: "#edf1f7", boxShadow: "0 12px 35px #00000060", fontSize: 11 },
      };
}

function Dashboard({ data, orders, selectedDate, onDateChange, theme }: { data: DashboardData | null; orders: Order[]; selectedDate: string; onDateChange: (date: string) => Promise<void>; theme: "dark" | "light" }) {
  if (!data) return <div className="panel-empty">Carregando indicadores…</div>;
  const chart = chartTheme(theme);
  const axisMoney = (value: number) => { const v = Number(value) / 100; return v >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v}`; };
  const balance = Number(data.finance.income) - Number(data.finance.expense);
  const hourly = Array.from({ length: 13 }, (_, index) => {
    const hour = index + 11;
    return { label: `${hour}h`, value: Number(data.hourly.find((item) => Number(item.hour) === hour)?.value || 0) };
  });
  const days = data.days.map((item) => {
    const str = String(item.day);
    let dayNum = "";
    let monthNum = "";
    if (str.includes("T")) {
      const d = new Date(str);
      dayNum = String(d.getUTCDate()).padStart(2, "0");
      monthNum = String(d.getUTCMonth() + 1).padStart(2, "0");
    } else {
      const parts = str.slice(0, 10).split("-");
      if (parts.length === 3) {
        dayNum = parts[2];
        monthNum = parts[1];
      }
    }
    const label = dayNum && monthNum ? `${dayNum}/${monthNum}` : str;
    return {
      label,
      value: Number(item.value),
    };
  });

  const displayDateText = selectedDate ? selectedDate.split("-").reverse().join("/") : "Hoje";

  return <div className="panel-page dashboard-page">
    <PageTitle eyebrow="CENTRAL AO VIVO" title="Visão geral da operação" subtitle={`Exibindo indicadores e faturamento de: ${displayDateText}`} action={<span className="live-pill"><i /> AO VIVO</span>} />

    <div className="dashboard-date-picker" style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", margin: "16px 0 24px 0", padding: "12px 18px", borderRadius: "14px" }}>
      <span style={{ fontWeight: 700, fontSize: "14px" }}>🔎 Pesquisar vendas por data:</span>
      <input
        type="date"
        value={selectedDate}
        onChange={(e) => onDateChange(e.target.value)}
        style={{ padding: "8px 12px", borderRadius: "8px", fontSize: "14px", outline: "none", cursor: "pointer" }}
      />
      <button
        type="button"
        onClick={() => onDateChange("")}
        style={{ padding: "8px 14px", borderRadius: "999px", background: selectedDate === "" ? "linear-gradient(135deg, #ff4d70, #c8102e)" : "var(--p-surface-2)", color: selectedDate === "" ? "#fff" : "var(--p-text-dim)", border: selectedDate === "" ? "1px solid transparent" : "1px solid var(--p-border)", fontWeight: 700, cursor: "pointer" }}
      >
        Hoje
      </button>
      <button
        type="button"
        onClick={() => onDateChange("2026-08-04")}
        style={{ padding: "8px 14px", borderRadius: "999px", background: selectedDate === "2026-08-04" ? "linear-gradient(135deg, #ff4d70, #c8102e)" : "var(--p-surface-2)", color: selectedDate === "2026-08-04" ? "#fff" : "var(--p-text-dim)", border: selectedDate === "2026-08-04" ? "1px solid transparent" : "1px solid var(--p-border)", fontWeight: 700, cursor: "pointer" }}
      >
        Ontem (04/08)
      </button>
      <button
        type="button"
        onClick={() => onDateChange("2026-08-03")}
        style={{ padding: "8px 14px", borderRadius: "999px", background: selectedDate === "2026-08-03" ? "linear-gradient(135deg, #ff4d70, #c8102e)" : "var(--p-surface-2)", color: selectedDate === "2026-08-03" ? "#fff" : "var(--p-text-dim)", border: selectedDate === "2026-08-03" ? "1px solid transparent" : "1px solid var(--p-border)", fontWeight: 700, cursor: "pointer" }}
      >
        Segunda (03/08)
      </button>
      {selectedDate && (
        <span style={{ marginLeft: "auto", fontSize: "13px", color: "var(--p-gold)", fontWeight: 600 }}>
          Exibindo resultados de {selectedDate.split("-").reverse().join("/")}
        </span>
      )}
    </div>

    <div className="panel-metrics">
      <Metric label={`Faturamento (${displayDateText})`} value={formatMoney(Number(data.summary.revenue))} note={`${data.summary.orders} pedidos confirmados`} tone="green" />
      <Metric label="Ticket médio" value={formatMoney(Number(data.summary.ticket))} note="Valor médio por pedido" />
      <Metric label="Tempo médio" value={`${Number(data.summary.avgMinutes || 0).toFixed(0)} min`} note={`${orders.filter((item) => item.status === "preparing").length} em preparo`} tone="amber" />
      <Metric label="Saldo financeiro do mês" value={formatMoney(balance)} note={`${formatMoney(Number(data.finance.expense))} em despesas`} tone={balance >= 0 ? "green" : "red"} />
    </div>
    <div className="panel-dashboard-grid">
      <article className="panel-card sales-chart chart-card">
        <header><div><span>VENDAS POR HORÁRIO ({displayDateText})</span><h3>{formatMoney(Number(data.summary.revenue))}</h3></div><small>{hourly.filter((h) => h.value > 0).length} horários com venda</small></header>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={hourly} margin={{ top: 20, right: 8, left: -18, bottom: 0 }}>
            <defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={chart.accent} stopOpacity=".42" /><stop offset="100%" stopColor={chart.accent} stopOpacity="0" /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 6" vertical={false} stroke={chart.grid} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chart.tick }} interval={1} />
            <YAxis axisLine={false} tickLine={false} width={44} tick={{ fontSize: 9, fill: chart.tick }} tickFormatter={axisMoney} />
            <Tooltip formatter={(value) => formatMoney(Number(value))} labelFormatter={(label) => `Horário: ${label}`} contentStyle={chart.tooltipStyle} cursor={{ stroke: chart.grid, strokeWidth: 1 }} />
            <Area type="monotone" dataKey="value" stroke={chart.accent} strokeWidth={3} fill="url(#salesFill)" animationDuration={900} activeDot={{ r: 5, strokeWidth: 2, stroke: chart.tooltipStyle.background as string, fill: chart.accent }} />
          </AreaChart>
        </ResponsiveContainer>
      </article>
      <article className="panel-card payment-card">
        <header><span>PAGAMENTOS HOJE</span></header>
        <div className="payment-donut"><ResponsiveContainer width="100%" height={150}><PieChart><Pie data={data.payments.length ? data.payments : [{ name: "Sem vendas", value: 1 }]} dataKey="value" innerRadius={48} outerRadius={66} paddingAngle={3}>{(data.payments.length ? data.payments : [{ name: "Sem vendas", value: 1 }]).map((item, index) => <Cell key={item.name} fill={["#ff3862", "#ffb32e", "#29e6a6", "#2dd9ff"][index % 4]} />)}</Pie><Tooltip formatter={(value) => data.payments.length ? formatMoney(Number(value)) : "Sem vendas"} contentStyle={chart.tooltipStyle} /></PieChart></ResponsiveContainer><div><b>{data.summary.orders}</b><span>pedidos</span></div></div>
        <ul>{data.payments.length ? data.payments.map((item) => <li key={item.name}><span>{item.name}</span><b>{formatMoney(Number(item.value))}</b></li>) : <li><span>Sem vendas registradas</span></li>}</ul>
      </article>
      <article className="panel-card day-chart chart-card">
        <header><div><span>FATURAMENTO · 14 DIAS</span><h3>Histórico recente</h3></div></header>
        <ResponsiveContainer width="100%" height={205}><BarChart data={days} margin={{ top: 20, right: 2, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 6" vertical={false} stroke={chart.grid} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: chart.tick }} /><YAxis axisLine={false} tickLine={false} width={40} tick={{ fontSize: 9, fill: chart.tick }} tickFormatter={axisMoney} /><Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={chart.tooltipStyle} cursor={{ fill: chart.grid, opacity: .4 }} /><Bar dataKey="value" fill={chart.accent} radius={[5, 5, 0, 0]} maxBarSize={26} animationDuration={1000} /></BarChart></ResponsiveContainer>
      </article>
      <article className="panel-card product-ranking">
        <header><span>MAIS VENDIDOS HOJE</span></header>
        {data.products.length ? data.products.map((item, index) => <div key={item.name}><b>{index + 1}</b><span><strong>{item.name}</strong><small>{item.quantity} unidades</small></span><i>{formatMoney(Number(item.value))}</i></div>) : <p>Os produtos aparecerão após as primeiras vendas.</p>}
      </article>
    </div>
  </div>;
}

function PageTitle({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: React.ReactNode }) {
  return <header className="panel-page-title"><div><span>{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>{action}</header>;
}

function Metric({ label, value, note, tone = "" }: { label: string; value: string; note: string; tone?: string }) {
  return <article><span>{label}</span><strong>{value}</strong><small className={tone}>{note}</small></article>;
}

export function getProductImage(product: { name: string; category?: string; image?: string }): string {
  const name = product.name.toLowerCase().trim();

  // 1. Polenta Frita
  if (name.includes("polenta")) return "/polenta-frita.jpg";

  // 2. Batata Frita
  if (name.includes("batata")) return "/batata-frita.jpeg";

  // 3. Guaraná Lata, Zero e Pureza — sempre a lata real do Guaraná, nunca foto de Coca-Cola
  if (name.includes("guaraná lata") || name.includes("guarana lata") || name.includes("guaraná") || name.includes("guarana")) {
    return "/guarana-lata.png";
  }

  // 4. Águas
  if (name.includes("água sem gás") || name.includes("agua sem gas")) return "/agua-sem-gas.webp";
  if (name.includes("água com gás") || name.includes("agua com gas") || name.includes("com gás")) return "/agua-com-gas.jpg";

  // 5. Cervejas
  if (name.includes("stella")) return "/stella.webp";
  if (name.includes("heineken")) return "/heineken.webp";

  // 6. Coca 200ml
  if (name.includes("200 ml") || name.includes("200ml")) return "/coca-200ml.webp";

  // 7. Coca 1.5L e 600ml
  if (name.includes("1,5") || name.includes("1.5") || name.includes("600 ml") || name.includes("600ml")) return "/coca-15l.jpeg";

  // 8. Coca Lata Zero e Original
  if (name.includes("coca") && (name.includes("zero") || name.includes("sem açúcar"))) return "/coca-zero-lata.jpeg";
  if (name.includes("coca")) return "/coca-lata.jpeg";

  // 9. Sprite
  if (name.includes("sprite") && name.includes("zero")) return "/sprite-zero-lata.jpeg";
  if (name.includes("sprite")) return "/sprite-lata.jpeg";

  // 10. Baly
  if (name.includes("baly tropical")) return "/baly-tropical.jpeg";
  if (name.includes("baly tradicional")) return "/baly-tradicional.jpeg";
  if (name.includes("baly manga")) return "/baly-manga.jpeg";

  // 11. Kapo
  if (name.includes("kapo uva")) return "/kapo-uva.jpeg";
  if (name.includes("kapo morango") || name.includes("kapo laranja")) return "/kapo-morango.jpeg";

  // 12. Baldes & Combos
  if (name.includes("tiras")) return "/balde-tiras.jpeg";
  if (name.includes("coxinha")) return "/balde-coxinha.jpeg";
  if (name.includes("combo")) return "/combo-mesa.jpeg";

  // 13. Molhos
  if (name.includes("molho") || name.includes("maionese") || name.includes("barbecue") || name.includes("pimenta") || product.category === "Molhos") return "/molho.jpeg";

  return "/combo-mesa.jpeg";
}

function ProductVisual({ product }: { product: Product }) {
  const imgSrc = getProductImage(product);
  return <img src={imgSrc} alt={product.name} />;
}

function PointOfSale({ products, paperWidth, onCreated, notify }: { products: Product[]; paperWidth: 58 | 80; onCreated: () => Promise<void>; notify: (message: string) => void }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState("");
  const [payment, setPayment] = useState("Pix");
  const [cash, setCash] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState("Todos");
  const [saving, setSaving] = useState(false);
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.priceCents * item.quantity, 0), [cart]);
  const displayProducts = products && products.length > 0 ? products : catalog.map((c) => ({ ...c, active: true }));
  const categories = ["Todos", ...Array.from(new Set(displayProducts.map((product) => product.category)))];
  const add = (product: Product) => setCart((current) => {
    const isFreeSauce = product.category === "Molhos" && product.priceCents === 0;
    const freeSauceCount = current
      .filter((item) => item.category === "Molhos" && item.priceCents === 0)
      .reduce((sum, item) => sum + item.quantity, 0);
    if (isFreeSauce && freeSauceCount >= 2) {
      notify("O pedido inclui até 2 molhos grátis. Use uma opção adicional para outros molhos.");
      return current;
    }
    return current.some((item) => item.id === product.id)
      ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      : [...current, { ...product, quantity: 1 }];
  });
  const changeQty = (id: number, amount: number) => setCart((current) => current.map((item) => item.id === id ? { ...item, quantity: item.quantity + amount } : item).filter((item) => item.quantity > 0));
  const submit = async () => {
    if (!customer.trim() || !cart.length) return notify("Informe o cliente e adicione itens.");
    setSaving(true);
    try {
      const result = await api<{ order: { id: string; code: string; totalCents: number } }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customerName: customer,
          paymentMethod: payment,
          cashReceivedCents: payment === "Dinheiro" ? Math.round(Number(cash.replace(",", ".")) * 100) : null,
          notes,
          items: cart.map((item) => ({ productId: item.id, quantity: item.quantity })),
        }),
      });
      const createdOrder: Order = {
        id: result.order.id,
        code: result.order.code,
        customerName: customer.trim(),
        status: "preparing",
        paymentMethod: payment,
        cashReceivedCents: payment === "Dinheiro" ? Math.round(Number(cash.replace(",", ".")) * 100) : undefined,
        totalCents: result.order.totalCents,
        channel: "Balcão",
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString(),
        items: cart.map((item) => ({ id: `new-${result.order.id}-${item.id}`, productId: String(item.id), name: item.name, quantity: item.quantity, unitPriceCents: item.priceCents })),
      };
      printOrder(createdOrder, paperWidth);
      notify(`Pedido ${createdOrder.code} enviado para impressão automaticamente.`);
      setCart([]); setCustomer(""); setCash(""); setNotes("");
      await onCreated();
    } catch (error) { notify(error instanceof Error ? error.message : "Falha ao salvar pedido"); }
    finally { setSaving(false); }
  };
  return <div className="panel-page pos-page">
    <section className="pos-catalog">
      <PageTitle eyebrow="CAIXA" title="Novo pedido" subtitle="Selecione os itens e envie a comanda para a cozinha." />
      <div className="pos-categories">{categories.map((item) => <button className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div>
      <div className="real-product-grid">{displayProducts.filter((product) => product.active !== false && (category === "Todos" || product.category === category)).map((product) => (
        <button key={product.id} onClick={() => add(product)}><ProductVisual product={product} /><span><b>{product.name}</b><small>{product.description}</small><strong>{formatMoney(product.priceCents)}</strong></span><i>+</i></button>
      ))}</div>
    </section>
    <aside className="real-checkout">
      <header><div><span>COMANDA</span><h2>Pedido local</h2></div><b>{cart.reduce((sum, item) => sum + item.quantity, 0)} itens</b></header>
      <label>Nome do cliente<input value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Nome para chamar quando estiver pronto" /></label>
      <div className="real-cart">{cart.length ? cart.map((item) => <div key={item.id}><span><b>{item.name}</b><small>{formatMoney(item.priceCents)}</small></span><div><button onClick={() => changeQty(item.id, -1)}>−</button><b>{item.quantity}</b><button onClick={() => changeQty(item.id, 1)}>+</button></div></div>) : <p>Adicione produtos do cardápio.</p>}</div>
      <label>Observações<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Sem molho, bem passado, alergias…" /></label>
      <label>Forma de pagamento<select value={payment} onChange={(event) => setPayment(event.target.value)}><option>Pix</option><option>Dinheiro</option><option>Crédito</option><option>Débito</option></select></label>
      {payment === "Dinheiro" && <label>Valor recebido<input inputMode="decimal" value={cash} onChange={(event) => setCash(event.target.value)} placeholder="0,00" /><span className="cash-change">Troco <b>{formatMoney(Math.max(0, Math.round(Number(cash.replace(",", ".")) * 100) - total))}</b></span></label>}
      <div className="checkout-total"><span>Total</span><strong>{formatMoney(total)}</strong></div>
      <button className="send-kitchen" onClick={submit} disabled={saving}>{saving ? "Salvando…" : "Confirmar e enviar à cozinha →"}</button>
    </aside>
  </div>;
}

function Kitchen({ orders, onStatus, onPayment }: { orders: Order[]; onStatus: (id: string, status: Order["status"]) => Promise<void>; onPayment: (id: string, paymentMethod: string) => Promise<void> }) {
  const preparing = orders.filter((order) => order.status === "preparing");
  const ready = orders.filter((order) => order.status === "ready");
  return <div className="panel-page kitchen-real">
    <PageTitle eyebrow="FLUXO AO VIVO" title="Cozinha" subtitle={`${preparing.length + ready.length} pedidos em andamento · atualização automática`} />
    <div className="kitchen-lanes">
      <section><header><h2>Em preparo</h2><b>{preparing.length}</b></header>{preparing.length ? preparing.map((order) => <KitchenCard key={order.id} order={order} label="Marcar como pronto" onClick={() => onStatus(order.id, "ready")} onPayment={onPayment} onCancel={() => window.confirm(`Cancelar ${order.code} de ${order.customerName}?`) ? onStatus(order.id, "cancelled") : Promise.resolve()} />) : <KitchenEmpty title="Cozinha em ordem" text="Os novos pedidos aparecerão aqui com o tempo de preparo." />}</section>
      <section className="ready"><header><h2>Prontos para chamar</h2><b>{ready.length}</b></header>{ready.length ? ready.map((order) => <KitchenCard key={order.id} order={order} label={`Entregar para ${order.customerName}`} onClick={() => onStatus(order.id, "completed")} onPayment={onPayment} onCancel={() => window.confirm(`Cancelar ${order.code} de ${order.customerName}?`) ? onStatus(order.id, "cancelled") : Promise.resolve()} />) : <KitchenEmpty title="Nenhum pedido esperando" text="Quando a cozinha finalizar, o nome do cliente aparece aqui." />}</section>
    </div>
  </div>;
}

function KitchenEmpty({ title, text }: { title: string; text: string }) {
  return <div className="kitchen-empty"><span><img src="/smack-chicken-mark.png" alt="" /></span><h3>{title}</h3><p>{text}</p></div>;
}

function KitchenCard({ order, label, onClick, onCancel, onPayment }: { order: Order; label: string; onClick: () => Promise<void>; onCancel: () => Promise<void>; onPayment: (id: string, paymentMethod: string) => Promise<void> }) {
  const editPayment = async () => {
    const value = window.prompt("Nova forma de pagamento: Pix, Dinheiro, Crédito ou Débito", order.paymentMethod);
    if (value === null) return;
    const match = ["Pix", "Dinheiro", "Crédito", "Débito"].find((item) => item.toLocaleLowerCase("pt-BR") === value.trim().toLocaleLowerCase("pt-BR"));
    if (!match) return window.alert("Informe Pix, Dinheiro, Crédito ou Débito.");
    await onPayment(order.id, match);
  };
  return <article className="kitchen-order">
    <header><b>{order.code}</b><OrderTimer iso={order.createdAt} /></header>
    <h3>{order.customerName}</h3>
    <ul>{order.items.map((item) => <li key={item.id}><b>{item.quantity}×</b> {item.name}</li>)}</ul>
    {order.notes && <p>Obs.: {order.notes}</p>}
    <footer><span>{order.paymentMethod}</span><button type="button" onClick={editPayment}>Alterar pagamento</button><button className="kitchen-cancel" onClick={onCancel}>Cancelar</button><button onClick={onClick}>{label} →</button></footer>
  </article>;
}

function Orders({ orders, onPrint, onCancel, onDelete, onPayment }: { orders: Order[]; onPrint: (order: Order) => void; onCancel: (id: string) => Promise<void>; onDelete: (id: string) => Promise<void>; onPayment: (id: string, paymentMethod: string) => Promise<void> }) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const labels: Record<Order["status"], string> = { preparing: "Em preparo", ready: "Pronto", completed: "Finalizado", cancelled: "Cancelado" };
  const cancel = async (order: Order) => {
    if (!window.confirm(`Cancelar o pedido ${order.code} de ${order.customerName}? O valor será retirado do faturamento.`)) return;
    await onCancel(order.id);
  };
  const editPayment = async (order: Order) => {
    const value = window.prompt("Nova forma de pagamento: Pix, Dinheiro, Crédito ou Débito", order.paymentMethod);
    if (value === null) return;
    const match = ["Pix", "Dinheiro", "Crédito", "Débito"].find((item) => item.toLocaleLowerCase("pt-BR") === value.trim().toLocaleLowerCase("pt-BR"));
    if (!match) return window.alert("Informe Pix, Dinheiro, Crédito ou Débito.");
    await onPayment(order.id, match);
  };
  const remove = async (order: Order) => {
    if (!window.confirm(`Excluir permanentemente o pedido ${order.code} de ${order.customerName}?`)) return;
    await onDelete(order.id);
  };

  const filteredOrders = orders.filter((order) => {
    if (filterDate) {
      const orderDateStr = new Date(order.createdAt).toISOString().slice(0, 10);
      if (orderDateStr !== filterDate) return false;
    }
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase().trim();
      const matchCode = order.code.toLowerCase().includes(query);
      const matchCustomer = order.customerName.toLowerCase().includes(query);
      const matchPayment = order.paymentMethod.toLowerCase().includes(query);
      const matchDateStr = new Date(order.createdAt).toLocaleDateString("pt-BR").includes(query);
      if (!matchCode && !matchCustomer && !matchPayment && !matchDateStr) return false;
    }
    return true;
  });

  return <div className="panel-page">
    <PageTitle eyebrow="HISTÓRICO E CONTROLE" title="Todos os pedidos" subtitle="Clique no número do pedido para consultar os itens." />

    <div className="orders-filter-bar" style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", padding: "12px 16px", borderRadius: "12px" }}>
      <input
        type="text"
        placeholder="🔍 Buscar cliente, pedido, pagamento ou data..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ padding: "8px 14px", borderRadius: "8px", fontSize: "14px", flex: 1, minWidth: "220px", outline: "none" }}
      />
      <span style={{ fontWeight: 600, fontSize: "13px" }}>📅 Filtrar por data:</span>
      <input
        type="date"
        value={filterDate}
        onChange={(e) => setFilterDate(e.target.value)}
        style={{ padding: "8px 12px", borderRadius: "8px", fontSize: "14px", outline: "none" }}
      />
      {(filterDate || searchTerm) && (
        <button
          type="button"
          onClick={() => { setFilterDate(""); setSearchTerm(""); }}
          style={{ padding: "8px 14px", borderRadius: "999px", background: "linear-gradient(135deg, #ff4d70, #c8102e)", color: "#fff", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 700 }}
        >
          Limpar filtros
        </button>
      )}
    </div>

    <div className="orders-table"><header><span>Pedido</span><span>Cliente</span><span>Horário</span><span>Tempo</span><span>Pagamento</span><span>Total</span><span>Status</span><span /></header>
      {filteredOrders.map((order) => <div key={order.id}><button type="button" className="order-code-button" onClick={() => setSelectedOrder(order)}>{order.code}</button><strong>{order.customerName}</strong><span>{new Date(order.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span><strong className="order-duration">{formatOrderDuration(order)}</strong><span>{order.paymentMethod}</span><b>{formatMoney(order.totalCents)}</b><i className={order.status}>{labels[order.status]}</i><span className="order-actions"><button onClick={() => onPrint(order)}>Imprimir</button><button onClick={() => editPayment(order)}>Alterar pagamento</button>{order.status !== "completed" && order.status !== "cancelled" && <button className="cancel-order" onClick={() => cancel(order)}>Cancelar</button>}<button className="row-delete" onClick={() => remove(order)}>Excluir</button></span></div>)}
    </div>
    {selectedOrder && <div className="order-detail-backdrop" role="presentation" onClick={() => setSelectedOrder(null)}>
      <article className="order-detail-modal" role="dialog" aria-modal="true" aria-labelledby="order-detail-title" onClick={(event) => event.stopPropagation()}>
        <header><div><span>DETALHES DO PEDIDO</span><h2 id="order-detail-title">{selectedOrder.code}</h2></div><button type="button" aria-label="Fechar detalhes" onClick={() => setSelectedOrder(null)}>×</button></header>
        <section className="order-detail-customer"><span>CLIENTE</span><strong>{selectedOrder.customerName}</strong></section>
        <section className="order-detail-items"><h3>Itens pedidos</h3><ul>{selectedOrder.items.map((item) => <li key={item.id}><b>{item.quantity}×</b><span>{item.name}</span><strong>{formatMoney(Number(item.unitPriceCents) * item.quantity)}</strong></li>)}</ul></section>
        {selectedOrder.notes && <p className="order-detail-notes"><b>Observação:</b> {selectedOrder.notes}</p>}
        <dl><div><dt>Horário</dt><dd>{new Date(selectedOrder.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</dd></div><div><dt>Tempo</dt><dd>{formatOrderDuration(selectedOrder)}</dd></div><div><dt>Pagamento</dt><dd>{selectedOrder.paymentMethod}</dd></div><div><dt>Status</dt><dd>{labels[selectedOrder.status]}</dd></div></dl>
        <footer><span>Total</span><strong>{formatMoney(selectedOrder.totalCents)}</strong><button type="button" onClick={() => onPrint(selectedOrder)}>Imprimir pedido</button></footer>
      </article>
    </div>}
  </div>;
}

function Finance({ entries, dashboard, onCreated, onDeleted, theme }: { entries: FinanceEntry[]; dashboard: DashboardData | null; onCreated: () => Promise<void>; onDeleted: (id: string) => Promise<void>; theme: "dark" | "light" }) {
  const chart = chartTheme(theme);
  const axisMoney = (value: number) => { const v = Number(value) / 100; return v >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v}`; };
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("Fornecedores");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const income = entries.filter((entry) => entry.entryType === "income").reduce((sum, entry) => sum + Number(entry.amountCents), 0);
  const expense = entries.filter((entry) => entry.entryType === "expense").reduce((sum, entry) => sum + Number(entry.amountCents), 0);
  const sales = Number(dashboard?.days.reduce((sum, item) => sum + Number(item.value), 0) || 0);
  const net = sales + income - expense;
  const cashflow = (dashboard?.days || []).map((item) => {
    const str = String(item.day);
    let dayNum = "";
    let monthNum = "";
    if (str.includes("T")) {
      const d = new Date(str);
      dayNum = String(d.getUTCDate()).padStart(2, "0");
      monthNum = String(d.getUTCMonth() + 1).padStart(2, "0");
    } else {
      const parts = str.slice(0, 10).split("-");
      if (parts.length === 3) {
        dayNum = parts[2];
        monthNum = parts[1];
      }
    }
    const dayLabel = dayNum && monthNum ? `${dayNum}/${monthNum}` : str;
    return {
      day: dayLabel,
      vendas: Number(item.value),
    };
  });
  const expenseCategories = Object.entries(entries.filter((entry) => entry.entryType === "expense").reduce<Record<string, number>>((groups, entry) => {
    groups[entry.category] = (groups[entry.category] || 0) + Number(entry.amountCents);
    return groups;
  }, {})).map(([name, value]) => ({ name, value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await api("/api/finance", { method: "POST", body: JSON.stringify({ entryType: type, category, description, amountCents: Math.round(Number(amount.replace(",", ".")) * 100), entryDate: date }) });
    setDescription(""); setAmount(""); setOpen(false); await onCreated();
  };
  const remove = async (entry: FinanceEntry) => {
    if (!window.confirm(`Excluir o lançamento “${entry.description}” de ${formatMoney(entry.amountCents)}?`)) return;
    await onDeleted(entry.id);
  };
  return <div className="panel-page finance-page">
    <PageTitle eyebrow="GESTÃO FINANCEIRA" title="Saúde financeira da loja" subtitle="Vendas do caixa, entradas, despesas e saldo em uma visão executiva." action={<div className="finance-actions"><span className="live-pill"><i /> AO VIVO</span><button className="panel-primary" onClick={() => setOpen(true)}>+ Novo lançamento</button></div>} />
    <div className="finance-summary">
      <Metric label="Vendas · 14 dias" value={formatMoney(sales)} note={`${dashboard?.days.reduce((sum, item) => sum + Number(item.orders), 0) || 0} pedidos no período`} tone="green" />
      <Metric label="Outras entradas" value={formatMoney(income)} note="Aportes e ajustes manuais" tone="green" />
      <Metric label="Despesas registradas" value={formatMoney(expense)} note="Custos operacionais" tone="red" />
      <Metric label="Resultado estimado" value={formatMoney(net)} note="Vendas + entradas − despesas" tone={net >= 0 ? "green" : "red"} />
    </div>
    <section className="finance-charts">
      <article className="panel-card finance-flow chart-card"><header><div><span>FLUXO DE CAIXA</span><h3>Faturamento diário</h3></div><small>Últimos 14 dias</small></header>
        <ResponsiveContainer width="100%" height={280}><AreaChart data={cashflow} margin={{ top: 20, right: 6, left: -18, bottom: 0 }}><defs><linearGradient id="financeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={chart.accent2} stopOpacity=".4" /><stop offset="100%" stopColor={chart.accent2} stopOpacity="0" /></linearGradient></defs><CartesianGrid strokeDasharray="3 6" vertical={false} stroke={chart.grid} /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: chart.tick }} /><YAxis axisLine={false} tickLine={false} width={44} tick={{ fontSize: 9, fill: chart.tick }} tickFormatter={axisMoney} /><Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={chart.tooltipStyle} cursor={{ stroke: chart.grid, strokeWidth: 1 }} /><Area type="monotone" dataKey="vendas" name="Vendas" stroke={chart.accent2} strokeWidth={3} fill="url(#financeFill)" animationDuration={1100} activeDot={{ r: 5, strokeWidth: 2, stroke: chart.tooltipStyle.background as string, fill: chart.accent2 }} /></AreaChart></ResponsiveContainer>
      </article>
      <article className="panel-card finance-categories"><header><div><span>DESPESAS</span><h3>Por categoria</h3></div></header>
        {expenseCategories.length ? <><div className="finance-pie"><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={expenseCategories} dataKey="value" innerRadius={58} outerRadius={84} paddingAngle={3}>{expenseCategories.map((item, index) => <Cell key={item.name} fill={["#ff3862", "#ffb32e", "#2dd9ff", "#ff8f3d", "#a3396a"][index % 5]} />)}</Pie><Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={chart.tooltipStyle} /></PieChart></ResponsiveContainer><strong>{formatMoney(expense)}<small>Total</small></strong></div><ul>{expenseCategories.slice(0, 5).map((item) => <li key={item.name}><span>{item.name}</span><b>{formatMoney(item.value)}</b></li>)}</ul></> : <div className="panel-empty">Registre uma despesa para ver a distribuição.</div>}
      </article>
    </section>
    <section className="finance-layout">
      <article className="panel-card finance-list"><header><div><span>LANÇAMENTOS</span><h3>Histórico financeiro</h3></div></header>
        <div className="finance-table"><header><span>Data</span><span>Descrição</span><span>Categoria</span><span>Tipo</span><span>Valor</span><span /></header>
          {entries.length ? entries.map((entry) => <div key={entry.id}><span>{new Date(entry.entryDate).toLocaleDateString("pt-BR")}</span><strong>{entry.description}</strong><span>{entry.category}</span><i className={entry.entryType}>{entry.entryType === "income" ? "Entrada" : "Saída"}</i><b className={entry.entryType}>{entry.entryType === "expense" ? "−" : "+"}{formatMoney(entry.amountCents)}</b><button type="button" className="row-delete" onClick={() => remove(entry)}>Excluir</button></div>) : <p>Nenhum lançamento manual ainda.</p>}
        </div>
      </article>
      <article className="panel-card finance-help"><span>ORGANIZAÇÃO DO MÊS</span><h3>O que registrar aqui?</h3><ul><li>Compras de frango e insumos</li><li>Embalagens e descartáveis</li><li>Aluguel, energia e equipe</li><li>Aportes e outras receitas</li></ul><p>As vendas do caixa aparecem no dashboard. Aqui ficam as anotações financeiras da gestão.</p></article>
    </section>
    {open && <div className="panel-modal"><form onSubmit={submit}><header><div><span>NOVO LANÇAMENTO</span><h2>Registrar movimentação</h2></div><button type="button" onClick={() => setOpen(false)}>×</button></header>
      <div className="type-switch"><button type="button" className={type === "income" ? "active income" : ""} onClick={() => setType("income")}>Entrada</button><button type="button" className={type === "expense" ? "active expense" : ""} onClick={() => setType("expense")}>Saída</button></div>
      <label>Descrição<input value={description} onChange={(event) => setDescription(event.target.value)} required placeholder="Ex.: Compra de embalagens" /></label>
      <label>Categoria<select value={category} onChange={(event) => setCategory(event.target.value)}><option>Fornecedores</option><option>Insumos</option><option>Embalagens</option><option>Equipe</option><option>Aluguel</option><option>Energia</option><option>Marketing</option><option>Manutenção</option><option>Outras receitas</option><option>Outras despesas</option></select></label>
      <div className="form-row"><label>Valor<input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" required placeholder="0,00" /></label><label>Data<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></div>
      <button className="panel-primary">Salvar lançamento</button>
    </form></div>}
  </div>;
}

function Planning({ plans, dashboard, onCreated, onDeleted }: { plans: Plan[]; dashboard: DashboardData | null; onCreated: () => Promise<void>; onDeleted: (id: string) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [date, setDate] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await api("/api/plans", { method: "POST", body: JSON.stringify({ title, targetCents: Math.round(Number(target.replace(",", ".")) * 100), dueDate: date || null }) });
    setTitle(""); setTarget(""); setDate(""); await onCreated();
  };
  const remove = async (plan: Plan) => {
    if (!window.confirm(`Excluir a meta “${plan.title}”?`)) return;
    await onDeleted(plan.id);
  };
  return <div className="panel-page planning-page">
    <PageTitle eyebrow="GESTÃO E METAS" title="Planejamento financeiro" subtitle="Defina objetivos e acompanhe o avanço financeiro da loja." />
    <div className="planning-grid">
      <section><h2>Metas ativas</h2>{plans.length ? plans.map((plan) => {
        const percent = Math.min(100, Math.round(Number(plan.currentCents) / Number(plan.targetCents) * 100));
        return <article className="plan-card" key={plan.id}><header><div><span>META</span><h3>{plan.title}</h3></div><div className="plan-card-actions"><b>{percent}%</b><button type="button" onClick={() => remove(plan)}>Excluir meta</button></div></header><div className="progress"><i style={{ width: `${percent}%` }} /></div><footer><span>{formatMoney(Number(plan.currentCents))} alcançados</span><strong>{formatMoney(Number(plan.targetCents))}</strong></footer>{plan.dueDate && <small>Prazo: {new Date(plan.dueDate).toLocaleDateString("pt-BR")}</small>}</article>;
      }) : <div className="panel-empty">Crie a primeira meta da loja.</div>}</section>
      <aside>
        <form className="plan-form" onSubmit={submit}><span>NOVA META</span><h2>Planejar objetivo</h2><label>Nome da meta<input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="Ex.: Reserva para nova fritadeira" /></label><label>Valor alvo<input value={target} onChange={(event) => setTarget(event.target.value)} inputMode="decimal" required placeholder="0,00" /></label><label>Prazo<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><button className="panel-primary">Criar meta</button></form>
        <article className="planning-insight"><span>LEITURA DO NEGÓCIO</span><h3>Saldo financeiro registrado</h3><strong>{formatMoney(Number(dashboard?.finance.income || 0) - Number(dashboard?.finance.expense || 0))}</strong><p>Use as metas junto com os lançamentos do financeiro para organizar compras, investimentos e reserva de caixa.</p></article>
      </aside>
    </div>
  </div>;
}

function escapeReceipt(value: unknown) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] || character);
}

function printOrder(order: Order, paperWidth: 58 | 80) {
  const fontSize = paperWidth === 58 ? 20 : 26;
  const horizontalPadding = paperWidth === 58 ? 4 : 6;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeReceipt(order.code)}</title><style>
    @page{size:${paperWidth}mm auto;margin:0}
    *{box-sizing:border-box}
    html,body{width:${paperWidth}mm;margin:0;padding:0;background:#fff;color:#000}
    body{font:${fontSize}px/1.7 "Courier New",monospace;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .receipt{width:${paperWidth}mm;padding:8mm ${horizontalPadding}mm 28mm;margin:0 auto}
    .center{text-align:center}.brand{margin:0;font-size:${paperWidth === 58 ? 34 : 46}px;line-height:1.1;font-weight:900;letter-spacing:.6px}
    .address{margin:5mm 0 8mm;font-size:${paperWidth === 58 ? 16 : 19}px;font-weight:700;line-height:1.5}
    .divider{border:0;border-top:2px dashed #000;margin:7mm 0}
    .identity{margin:0 0 8mm;padding:8mm 0;text-align:center;border-block:3px solid #000}
    .identity-label{display:block;margin:0 0 3mm;font-size:${paperWidth === 58 ? 16 : 19}px;font-weight:900;letter-spacing:1.4px}
    .order-code{display:block;margin:0 0 8mm;font-size:${paperWidth === 58 ? 44 : 60}px;line-height:1.1;font-weight:900;letter-spacing:2px}
    .customer{display:block;font-size:${paperWidth === 58 ? 30 : 40}px;line-height:1.3;font-weight:900;text-transform:uppercase;overflow-wrap:anywhere}
    .items-title{margin:9mm 0 4mm;padding:4mm 0;border-block:2px dashed #000;text-align:center;font-size:${paperWidth === 58 ? 22 : 28}px;font-weight:900;letter-spacing:1px}
    ul{margin:0 0 9mm;padding:0;list-style:none}li{display:grid;grid-template-columns:${paperWidth === 58 ? 15 : 19}mm 1fr;align-items:start;gap:6mm;padding:7mm 0;border-bottom:2px solid #000;font-size:${paperWidth === 58 ? 25 : 31}px;line-height:1.6}
    li b{font-size:${paperWidth === 58 ? 29 : 37}px;font-weight:900}li strong{font-weight:900}.notes{margin:8mm 0;padding:6mm;border:2px solid #000;font-size:${paperWidth === 58 ? 21 : 26}px;line-height:1.7}
    .meta{margin-top:8mm;padding-top:7mm;border-top:2px dashed #000}.meta p{margin:5mm 0;font-size:${paperWidth === 58 ? 20 : 25}px}.total{display:block;margin:7mm 0;font-size:${paperWidth === 58 ? 32 : 40}px;line-height:1.3}
    .footer{margin-top:9mm;padding-top:6mm;border-top:2px dashed #000;text-align:center;font-size:${paperWidth === 58 ? 16 : 19}px}.cut-space{height:18mm}
    @media print{html,body,.receipt{width:${paperWidth}mm}.receipt{break-inside:avoid}}
  </style></head><body><main class="receipt"><h1 class="brand center">SMACK CHICKEN</h1><p class="address center">Rua Fúlvio Aducci, 1074 · Estreito</p><section class="identity"><span class="identity-label">NÚMERO DO PEDIDO</span><strong class="order-code">${escapeReceipt(order.code)}</strong><span class="identity-label">NOME DO CLIENTE</span><strong class="customer">${escapeReceipt(order.customerName)}</strong></section><h2 class="items-title">ITENS DO PEDIDO</h2><ul>${order.items.map((item) => `<li><b>${item.quantity}x</b><strong>${escapeReceipt(item.name)}</strong></li>`).join("")}</ul>${order.notes ? `<p class="notes"><b>OBSERVAÇÃO</b><br>${escapeReceipt(order.notes)}</p>` : ""}<div class="meta"><p>Pagamento: <b>${escapeReceipt(order.paymentMethod)}</b></p><strong class="total">TOTAL: ${formatMoney(order.totalCents)}</strong><p>${new Date(order.createdAt).toLocaleString("pt-BR")}</p></div><footer class="footer">Pedido para produção · SMACK CHICKEN</footer><div class="cut-space"></div></main></body></html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    window.setTimeout(() => iframe.remove(), 500);
  };
  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) { cleanup(); return; }
    win.addEventListener("afterprint", cleanup);
    window.setTimeout(() => {
      win.focus();
      win.print();
    }, 250);
    window.setTimeout(cleanup, 60000);
  };
  iframe.srcdoc = html;
}
