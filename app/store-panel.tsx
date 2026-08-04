"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { formatMoney } from "../lib/catalog";
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

export default function StorePanel() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [view, setView] = useState<View>("dashboard");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [toast, setToast] = useState("");
  const [paperWidth, setPaperWidth] = useState<58 | 80>(80);
  const [refreshing, setRefreshing] = useState(false);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  const loadAll = useCallback(async () => {
    const [productData, orderData, financeData, planData, dashboardData] = await Promise.all([
      api<{ products: Product[] }>("/api/products"),
      api<{ orders: Order[] }>("/api/orders"),
      api<{ entries: FinanceEntry[] }>("/api/finance"),
      api<{ plans: Plan[] }>("/api/plans"),
      api<DashboardData>("/api/dashboard"),
    ]);
    setProducts(productData.products.map((product) => ({
      ...product,
      id: Number(product.id),
      priceCents: Number(product.priceCents),
    })));
    setOrders(orderData.orders);
    setEntries(financeData.entries);
    setPlans(planData.plans);
    setDashboard(dashboardData);
  }, []);

  useEffect(() => {
    api<{ user: User }>("/api/auth")
      .then(async ({ user }) => { setUser(user); await loadAll(); })
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, [loadAll]);

  useEffect(() => {
    const savedWidth = Number(window.localStorage.getItem("smack-thermal-paper"));
    if (savedWidth === 58 || savedWidth === 80) setPaperWidth(savedWidth);
  }, []);

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
    <main className="panel-app">
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
          <div className="panel-top-actions"><button className={refreshing ? "refreshing" : ""} onClick={refresh} disabled={refreshing}><i>↻</i>{refreshing ? "Atualizando…" : "Atualizar"}</button><span className="panel-user"><i><b>{user.name}</b><small>{user.role === "owner" ? "Proprietário" : "Equipe"}</small></i><em>{user.name.charAt(0)}</em></span></div>
        </header>
        {view === "dashboard" && <Dashboard data={dashboard} orders={orders} />}
        {view === "pos" && <PointOfSale products={products} paperWidth={paperWidth} onCreated={async () => { await loadAll(); notify("Pedido enviado para a cozinha e impressão preparada."); }} notify={notify} />}
        {view === "kitchen" && <Kitchen orders={orders} onStatus={async (id, status) => { await api(`/api/orders/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); await loadAll(); }} />}
        {view === "orders" && <Orders orders={orders} onPrint={(order) => printOrder(order, paperWidth)} onCancel={async (id) => { await api(`/api/orders/${id}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) }); await loadAll(); notify("Pedido cancelado e retirado do faturamento."); }} onDelete={async (id) => { await api(`/api/orders/${id}`, { method: "DELETE" }); await loadAll(); notify("Pedido excluído permanentemente."); }} />}
        {view === "finance" && <Finance entries={entries} dashboard={dashboard} onCreated={async () => { await loadAll(); notify("Lançamento salvo."); }} onDeleted={async (id) => { await api(`/api/finance?id=${encodeURIComponent(id)}`, { method: "DELETE" }); await loadAll(); notify("Lançamento removido do histórico."); }} />}
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

function Dashboard({ data, orders }: { data: DashboardData | null; orders: Order[] }) {
  if (!data) return <div className="panel-empty">Carregando indicadores…</div>;
  const balance = Number(data.finance.income) - Number(data.finance.expense);
  const hourly = Array.from({ length: 13 }, (_, index) => {
    const hour = index + 11;
    return { label: `${hour}h`, value: Number(data.hourly.find((item) => Number(item.hour) === hour)?.value || 0) };
  });
  const days = data.days.map((item) => ({
    label: new Date(item.day).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    value: Number(item.value),
  }));
  return <div className="panel-page dashboard-page">
    <PageTitle eyebrow="CENTRAL AO VIVO" title="Visão geral da operação" subtitle="Vendas, cozinha e caixa atualizados automaticamente a cada 10 segundos." action={<span className="live-pill"><i /> AO VIVO</span>} />
    <div className="panel-metrics">
      <Metric label="Faturamento hoje" value={formatMoney(Number(data.summary.revenue))} note={`${data.summary.orders} pedidos confirmados`} tone="green" />
      <Metric label="Ticket médio" value={formatMoney(Number(data.summary.ticket))} note="Valor médio por pedido" />
      <Metric label="Tempo médio" value={`${Number(data.summary.avgMinutes || 0).toFixed(0)} min`} note={`${orders.filter((item) => item.status === "preparing").length} em preparo`} tone="amber" />
      <Metric label="Saldo financeiro do mês" value={formatMoney(balance)} note={`${formatMoney(Number(data.finance.expense))} em despesas`} tone={balance >= 0 ? "green" : "red"} />
    </div>
    <div className="panel-dashboard-grid">
      <article className="panel-card sales-chart chart-card">
        <header><div><span>VENDAS POR HORÁRIO</span><h3>{formatMoney(Number(data.summary.revenue))}</h3></div><small>Hoje · tempo real</small></header>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={hourly} margin={{ top: 20, right: 4, left: -22, bottom: 0 }}>
            <defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c8102e" stopOpacity=".35" /><stop offset="100%" stopColor="#c8102e" stopOpacity=".02" /></linearGradient></defs>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#eee8e0" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#857c75" }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#a39a93" }} tickFormatter={(value) => `R$${Number(value) / 100}`} />
            <Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={{ border: 0, borderRadius: 10, boxShadow: "0 12px 35px #190b0e18", fontSize: 11 }} />
            <Area type="monotone" dataKey="value" stroke="#c8102e" strokeWidth={3} fill="url(#salesFill)" animationDuration={900} />
          </AreaChart>
        </ResponsiveContainer>
      </article>
      <article className="panel-card payment-card">
        <header><span>PAGAMENTOS HOJE</span></header>
        <div className="payment-donut"><ResponsiveContainer width="100%" height={150}><PieChart><Pie data={data.payments.length ? data.payments : [{ name: "Sem vendas", value: 1 }]} dataKey="value" innerRadius={48} outerRadius={66} paddingAngle={3}>{(data.payments.length ? data.payments : [{ name: "Sem vendas", value: 1 }]).map((item, index) => <Cell key={item.name} fill={["#c8102e", "#ffc514", "#16835b", "#1f1a18"][index % 4]} />)}</Pie><Tooltip formatter={(value) => data.payments.length ? formatMoney(Number(value)) : "Sem vendas"} /></PieChart></ResponsiveContainer><div><b>{data.summary.orders}</b><span>pedidos</span></div></div>
        <ul>{data.payments.length ? data.payments.map((item) => <li key={item.name}><span>{item.name}</span><b>{formatMoney(Number(item.value))}</b></li>) : <li><span>Sem vendas registradas</span></li>}</ul>
      </article>
      <article className="panel-card day-chart chart-card">
        <header><div><span>FATURAMENTO · 14 DIAS</span><h3>Histórico recente</h3></div></header>
        <ResponsiveContainer width="100%" height={205}><BarChart data={days} margin={{ top: 20, right: 2, left: -24, bottom: 0 }}><CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#eee8e0" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#857c75" }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#a39a93" }} tickFormatter={(value) => `R$${Number(value) / 100}`} /><Tooltip formatter={(value) => formatMoney(Number(value))} /><Bar dataKey="value" fill="#c8102e" radius={[5, 5, 0, 0]} animationDuration={1000} /></BarChart></ResponsiveContainer>
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

function ProductVisual({ product }: { product: Product }) {
  const name = product.name.toLowerCase();
  if (product.image.startsWith("data:image/")) return <img src={product.image} alt={product.name} />;
  if (name.includes("coca-cola")) return <div className="brand-visual coca"><SiCocacola aria-label="Coca-Cola" /></div>;
  if (name.includes("monster")) return <div className="brand-visual monster"><SiMonster aria-label="Monster Energy" /><small>ENERGY</small></div>;
  if (name.includes("heineken")) return <div className="brand-visual heineken"><strong><b>★</b> HEINEKEN</strong><small>18+</small></div>;
  return <img src={product.image} alt={product.name} />;
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
  const categories = ["Todos", ...Array.from(new Set(products.map((product) => product.category)))];
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
    const printPopup = window.open("", "_blank", `width=${paperWidth === 80 ? 520 : 390},height=760`);
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
      if (printPopup) printOrder(createdOrder, paperWidth, printPopup);
      else notify("Pedido salvo. Permita pop-ups para imprimir automaticamente.");
      setCart([]); setCustomer(""); setCash(""); setNotes("");
      await onCreated();
    } catch (error) { printPopup?.close(); notify(error instanceof Error ? error.message : "Falha ao salvar pedido"); }
    finally { setSaving(false); }
  };
  return <div className="panel-page pos-page">
    <section className="pos-catalog">
      <PageTitle eyebrow="CAIXA" title="Novo pedido" subtitle="Selecione os itens e envie a comanda para a cozinha." />
      <div className="pos-categories">{categories.map((item) => <button className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div>
      <div className="real-product-grid">{products.filter((product) => product.active && (category === "Todos" || product.category === category)).map((product) => (
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

function Kitchen({ orders, onStatus }: { orders: Order[]; onStatus: (id: string, status: Order["status"]) => Promise<void> }) {
  const preparing = orders.filter((order) => order.status === "preparing");
  const ready = orders.filter((order) => order.status === "ready");
  return <div className="panel-page kitchen-real">
    <PageTitle eyebrow="FLUXO AO VIVO" title="Cozinha" subtitle={`${preparing.length + ready.length} pedidos em andamento · atualização automática`} />
    <div className="kitchen-lanes">
      <section><header><h2>Em preparo</h2><b>{preparing.length}</b></header>{preparing.length ? preparing.map((order) => <KitchenCard key={order.id} order={order} label="Marcar como pronto" onClick={() => onStatus(order.id, "ready")} onCancel={() => window.confirm(`Cancelar ${order.code} de ${order.customerName}?`) ? onStatus(order.id, "cancelled") : Promise.resolve()} />) : <KitchenEmpty title="Cozinha em ordem" text="Os novos pedidos aparecerão aqui com o tempo de preparo." />}</section>
      <section className="ready"><header><h2>Prontos para chamar</h2><b>{ready.length}</b></header>{ready.length ? ready.map((order) => <KitchenCard key={order.id} order={order} label={`Entregar para ${order.customerName}`} onClick={() => onStatus(order.id, "completed")} onCancel={() => window.confirm(`Cancelar ${order.code} de ${order.customerName}?`) ? onStatus(order.id, "cancelled") : Promise.resolve()} />) : <KitchenEmpty title="Nenhum pedido esperando" text="Quando a cozinha finalizar, o nome do cliente aparece aqui." />}</section>
    </div>
  </div>;
}

function KitchenEmpty({ title, text }: { title: string; text: string }) {
  return <div className="kitchen-empty"><span><img src="/smack-chicken-mark.png" alt="" /></span><h3>{title}</h3><p>{text}</p></div>;
}

function KitchenCard({ order, label, onClick, onCancel }: { order: Order; label: string; onClick: () => Promise<void>; onCancel: () => Promise<void> }) {
  return <article className="kitchen-order">
    <header><b>{order.code}</b><OrderTimer iso={order.createdAt} /></header>
    <h3>{order.customerName}</h3>
    <ul>{order.items.map((item) => <li key={item.id}><b>{item.quantity}×</b> {item.name}</li>)}</ul>
    {order.notes && <p>Obs.: {order.notes}</p>}
    <footer><span>{order.paymentMethod}</span><button className="kitchen-cancel" onClick={onCancel}>Cancelar</button><button onClick={onClick}>{label} →</button></footer>
  </article>;
}

function Orders({ orders, onPrint, onCancel, onDelete }: { orders: Order[]; onPrint: (order: Order) => void; onCancel: (id: string) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const labels: Record<Order["status"], string> = { preparing: "Em preparo", ready: "Pronto", completed: "Finalizado", cancelled: "Cancelado" };
  const cancel = async (order: Order) => {
    if (!window.confirm(`Cancelar o pedido ${order.code} de ${order.customerName}? O valor será retirado do faturamento.`)) return;
    await onCancel(order.id);
  };
  const remove = async (order: Order) => {
    if (!window.confirm(`Excluir permanentemente o pedido ${order.code} de ${order.customerName}?`)) return;
    await onDelete(order.id);
  };
  return <div className="panel-page">
    <PageTitle eyebrow="HISTÓRICO E CONTROLE" title="Todos os pedidos" subtitle="Consulte comandas, imprima, cancele ou exclua pedidos." />
    <div className="orders-table"><header><span>Pedido</span><span>Cliente</span><span>Horário</span><span>Pagamento</span><span>Total</span><span>Status</span><span /></header>
      {orders.map((order) => <div key={order.id}><b>{order.code}</b><strong>{order.customerName}</strong><span>{new Date(order.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span><span>{order.paymentMethod}</span><b>{formatMoney(order.totalCents)}</b><i className={order.status}>{labels[order.status]}</i><span className="order-actions"><button onClick={() => onPrint(order)}>Imprimir</button>{order.status !== "completed" && order.status !== "cancelled" && <button className="cancel-order" onClick={() => cancel(order)}>Cancelar</button>}<button className="row-delete" onClick={() => remove(order)}>Excluir</button></span></div>)}
    </div>
  </div>;
}

function Finance({ entries, dashboard, onCreated, onDeleted }: { entries: FinanceEntry[]; dashboard: DashboardData | null; onCreated: () => Promise<void>; onDeleted: (id: string) => Promise<void> }) {
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
  const cashflow = (dashboard?.days || []).map((item) => ({
    day: new Date(item.day).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    vendas: Number(item.value),
  }));
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
        <ResponsiveContainer width="100%" height={280}><AreaChart data={cashflow} margin={{ top: 20, right: 6, left: -20, bottom: 0 }}><defs><linearGradient id="financeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#16835b" stopOpacity=".38" /><stop offset="100%" stopColor="#16835b" stopOpacity=".02" /></linearGradient></defs><CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#eee8e0" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#857c75" }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#a39a93" }} tickFormatter={(value) => `R$${Number(value) / 100}`} /><Tooltip formatter={(value) => formatMoney(Number(value))} /><Area type="monotone" dataKey="vendas" name="Vendas" stroke="#16835b" strokeWidth={3} fill="url(#financeFill)" animationDuration={1100} /></AreaChart></ResponsiveContainer>
      </article>
      <article className="panel-card finance-categories"><header><div><span>DESPESAS</span><h3>Por categoria</h3></div></header>
        {expenseCategories.length ? <><div className="finance-pie"><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={expenseCategories} dataKey="value" innerRadius={58} outerRadius={84} paddingAngle={3}>{expenseCategories.map((item, index) => <Cell key={item.name} fill={["#c8102e", "#ffc514", "#1f1a18", "#ef7b45", "#7a2942"][index % 5]} />)}</Pie><Tooltip formatter={(value) => formatMoney(Number(value))} /></PieChart></ResponsiveContainer><strong>{formatMoney(expense)}<small>Total</small></strong></div><ul>{expenseCategories.slice(0, 5).map((item) => <li key={item.name}><span>{item.name}</span><b>{formatMoney(item.value)}</b></li>)}</ul></> : <div className="panel-empty">Registre uma despesa para ver a distribuição.</div>}
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

function printOrder(order: Order, paperWidth: 58 | 80, existingPopup?: Window | null) {
  const popup = existingPopup ?? window.open("", "_blank", `width=${paperWidth === 80 ? 520 : 390},height=760`);
  if (!popup) return;
  const fontSize = paperWidth === 58 ? 17 : 22;
  const horizontalPadding = paperWidth === 58 ? 3.5 : 5;
  const paperLength = paperWidth === 58 ? 200 : 297;
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeReceipt(order.code)}</title><style>
    @page{size:${paperWidth}mm ${paperLength}mm;margin:0}
    *{box-sizing:border-box}
    html,body{width:${paperWidth}mm;min-height:${paperLength}mm;margin:0;padding:0;background:#fff;color:#000}
    body{font:${fontSize}px/1.55 "Courier New",monospace;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .receipt{width:${paperWidth}mm;min-height:${paperLength}mm;padding:7mm ${horizontalPadding}mm 22mm;margin:0 auto}
    .center{text-align:center}.brand{margin:0;font-size:${paperWidth === 58 ? 30 : 40}px;line-height:1.05;font-weight:900;letter-spacing:.6px}
    .address{margin:4mm 0 6mm;font-size:${paperWidth === 58 ? 14 : 17}px;font-weight:700;line-height:1.4}
    .divider{border:0;border-top:2px dashed #000;margin:5mm 0}
    .identity{margin:0;padding:6mm 0;text-align:center;border-block:3px solid #000}
    .identity-label{display:block;margin:0 0 2mm;font-size:${paperWidth === 58 ? 14 : 17}px;font-weight:900;letter-spacing:1.2px}
    .order-code{display:block;margin:0 0 6mm;font-size:${paperWidth === 58 ? 38 : 52}px;line-height:1;font-weight:900;letter-spacing:2px}
    .customer{display:block;font-size:${paperWidth === 58 ? 27 : 36}px;line-height:1.2;font-weight:900;text-transform:uppercase;overflow-wrap:anywhere}
    .items-title{margin:7mm 0 2mm;padding:3mm 0;border-block:2px dashed #000;text-align:center;font-size:${paperWidth === 58 ? 19 : 24}px;font-weight:900;letter-spacing:1px}
    ul{margin:0 0 7mm;padding:0;list-style:none}li{display:grid;grid-template-columns:${paperWidth === 58 ? 12 : 15}mm 1fr;align-items:start;gap:4mm;padding:5mm 0;border-bottom:2px solid #000;font-size:${paperWidth === 58 ? 21 : 27}px;line-height:1.45}
    li b{font-size:${paperWidth === 58 ? 25 : 32}px;font-weight:900}li strong{font-weight:900}.notes{margin:6mm 0;padding:4mm;border:2px solid #000;font-size:${paperWidth === 58 ? 18 : 22}px;line-height:1.5}
    .meta{margin-top:6mm;padding-top:5mm;border-top:2px dashed #000}.meta p{margin:3mm 0}.total{display:block;margin:5mm 0;font-size:${paperWidth === 58 ? 26 : 34}px;line-height:1.2}
    .footer{margin-top:7mm;padding-top:4mm;border-top:2px dashed #000;text-align:center;font-size:${paperWidth === 58 ? 14 : 17}px}.cut-space{height:14mm}
    @media print{html,body,.receipt{width:${paperWidth}mm;min-height:${paperLength}mm}.receipt{break-inside:avoid}}
  </style></head><body><main class="receipt"><h1 class="brand center">SMACK CHICKEN</h1><p class="address center">Rua Fúlvio Aducci, 1074 · Estreito</p><section class="identity"><span class="identity-label">NÚMERO DO PEDIDO</span><strong class="order-code">${escapeReceipt(order.code)}</strong><span class="identity-label">NOME DO CLIENTE</span><strong class="customer">${escapeReceipt(order.customerName)}</strong></section><h2 class="items-title">ITENS DO PEDIDO</h2><ul>${order.items.map((item) => `<li><b>${item.quantity}x</b><strong>${escapeReceipt(item.name)}</strong></li>`).join("")}</ul>${order.notes ? `<p class="notes"><b>OBSERVAÇÃO</b><br>${escapeReceipt(order.notes)}</p>` : ""}<div class="meta"><p>Pagamento: <b>${escapeReceipt(order.paymentMethod)}</b></p><strong class="total">TOTAL: ${formatMoney(order.totalCents)}</strong><p>${new Date(order.createdAt).toLocaleString("pt-BR")}</p></div><footer class="footer">Pedido para produção · SMACK CHICKEN</footer><div class="cut-space"></div></main><script>window.onload=()=>setTimeout(()=>window.print(),180);window.onafterprint=()=>window.close()</script></body></html>`);
  popup.document.close();
}
