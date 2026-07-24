"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { formatMoney } from "../lib/catalog";

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
  return <div className="panel-logo"><span>S</span><strong>SMACK<small>OPERAÇÃO</small></strong></div>;
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
  const [printer, setPrinter] = useState("Impressora não pareada");

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
    setProducts(productData.products);
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
    if (!user) return;
    const timer = window.setInterval(() => {
      api<{ orders: Order[] }>("/api/orders").then((data) => setOrders(data.orders)).catch(() => undefined);
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
    await loadAll();
    notify("Dados atualizados.");
  };

  const connectPrinter = async () => {
    try {
      const bluetooth = (navigator as Navigator & { bluetooth?: { requestDevice: (options: object) => Promise<{ name?: string }> } }).bluetooth;
      if (!bluetooth) throw new Error("Bluetooth não disponível neste navegador");
      const device = await bluetooth.requestDevice({ acceptAllDevices: true });
      setPrinter(device.name || "Impressora Bluetooth pareada");
      notify("Dispositivo pareado. Use “Imprimir comanda” nos pedidos.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível parear");
    }
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
          <button onClick={connectPrinter}>⌁ <span><b>{printer}</b><small>Configurar impressão</small></span></button>
          <button onClick={async () => { await api("/api/auth", { method: "DELETE" }); location.reload(); }}>↪ Sair do painel</button>
        </div>
      </aside>
      <section className="panel-main">
        <header className="panel-top">
          <div><b>SMACK CHICKEN</b><span>Rua Fúlvio Aducci, 1074 · Estreito</span></div>
          <div><button onClick={refresh}>↻ Atualizar</button><span className="panel-user">{user.name.charAt(0)}<i><b>{user.name}</b><small>{user.role === "owner" ? "Proprietário" : "Equipe"}</small></i></span></div>
        </header>
        {view === "dashboard" && <Dashboard data={dashboard} orders={orders} />}
        {view === "pos" && <PointOfSale products={products} onCreated={async () => { await loadAll(); notify("Pedido enviado para a cozinha."); }} notify={notify} />}
        {view === "kitchen" && <Kitchen orders={orders} onStatus={async (id, status) => { await api(`/api/orders/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); await loadAll(); }} />}
        {view === "orders" && <Orders orders={orders} onPrint={printOrder} />}
        {view === "finance" && <Finance entries={entries} onCreated={async () => { await loadAll(); notify("Lançamento salvo."); }} />}
        {view === "planning" && <Planning plans={plans} dashboard={dashboard} onCreated={async () => { await loadAll(); notify("Meta criada."); }} />}
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
  const maxHour = Math.max(1, ...data.hourly.map((item) => item.value));
  const maxDay = Math.max(1, ...data.days.map((item) => item.value));
  const balance = Number(data.finance.income) - Number(data.finance.expense);
  return <div className="panel-page dashboard-page">
    <PageTitle eyebrow="VISÃO GERAL" title="Operação de hoje" subtitle="Indicadores atualizados com as vendas registradas no caixa." />
    <div className="panel-metrics">
      <Metric label="Faturamento hoje" value={formatMoney(Number(data.summary.revenue))} note={`${data.summary.orders} pedidos confirmados`} tone="green" />
      <Metric label="Ticket médio" value={formatMoney(Number(data.summary.ticket))} note="Valor médio por pedido" />
      <Metric label="Tempo médio" value={`${Number(data.summary.avgMinutes || 0).toFixed(0)} min`} note={`${orders.filter((item) => item.status === "preparing").length} em preparo`} tone="amber" />
      <Metric label="Saldo financeiro do mês" value={formatMoney(balance)} note={`${formatMoney(Number(data.finance.expense))} em despesas`} tone={balance >= 0 ? "green" : "red"} />
    </div>
    <div className="panel-dashboard-grid">
      <article className="panel-card sales-chart">
        <header><div><span>VENDAS POR HORÁRIO</span><h3>{formatMoney(Number(data.summary.revenue))}</h3></div><small>Hoje</small></header>
        <div className="hour-bars">{Array.from({ length: 13 }, (_, index) => index + 11).map((hour) => {
          const value = Number(data.hourly.find((item) => Number(item.hour) === hour)?.value || 0);
          return <div key={hour}><i style={{ height: `${Math.max(4, value / maxHour * 150)}px` }} /><span>{hour}h</span></div>;
        })}</div>
      </article>
      <article className="panel-card payment-card">
        <header><span>PAGAMENTOS HOJE</span></header>
        <div className="payment-total"><b>{data.summary.orders}</b><span>pedidos</span></div>
        <ul>{data.payments.length ? data.payments.map((item) => <li key={item.name}><span>{item.name}</span><b>{formatMoney(Number(item.value))}</b></li>) : <li><span>Sem vendas registradas</span></li>}</ul>
      </article>
      <article className="panel-card day-chart">
        <header><div><span>FATURAMENTO · 14 DIAS</span><h3>Histórico recente</h3></div></header>
        <div className="day-bars">{data.days.map((item) => <div key={item.day}><i style={{ height: `${Math.max(5, Number(item.value) / maxDay * 110)}px` }} /><span>{new Date(item.day).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span></div>)}</div>
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

function PointOfSale({ products, onCreated, notify }: { products: Product[]; onCreated: () => Promise<void>; notify: (message: string) => void }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState("");
  const [payment, setPayment] = useState("Pix");
  const [cash, setCash] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState("Todos");
  const [saving, setSaving] = useState(false);
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.priceCents * item.quantity, 0), [cart]);
  const categories = ["Todos", ...Array.from(new Set(products.map((product) => product.category)))];
  const add = (product: Product) => setCart((current) => current.some((item) => item.id === product.id)
    ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
    : [...current, { ...product, quantity: 1 }]);
  const changeQty = (id: number, amount: number) => setCart((current) => current.map((item) => item.id === id ? { ...item, quantity: item.quantity + amount } : item).filter((item) => item.quantity > 0));
  const submit = async () => {
    if (!customer.trim() || !cart.length) return notify("Informe o cliente e adicione itens.");
    setSaving(true);
    try {
      await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customerName: customer,
          paymentMethod: payment,
          cashReceivedCents: payment === "Dinheiro" ? Math.round(Number(cash.replace(",", ".")) * 100) : null,
          notes,
          items: cart.map((item) => ({ productId: item.id, quantity: item.quantity })),
        }),
      });
      setCart([]); setCustomer(""); setCash(""); setNotes("");
      await onCreated();
    } catch (error) { notify(error instanceof Error ? error.message : "Falha ao salvar pedido"); }
    finally { setSaving(false); }
  };
  return <div className="panel-page pos-page">
    <section className="pos-catalog">
      <PageTitle eyebrow="CAIXA" title="Novo pedido" subtitle="Selecione os itens e envie a comanda para a cozinha." />
      <div className="pos-categories">{categories.map((item) => <button className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div>
      <div className="real-product-grid">{products.filter((product) => product.active && (category === "Todos" || product.category === category)).map((product) => (
        <button key={product.id} onClick={() => add(product)}><img src={product.image} alt="" /><span><b>{product.name}</b><small>{product.description}</small><strong>{formatMoney(product.priceCents)}</strong></span><i>+</i></button>
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
      <section><header><h2>Em preparo</h2><b>{preparing.length}</b></header>{preparing.map((order) => <KitchenCard key={order.id} order={order} label="Marcar como pronto" onClick={() => onStatus(order.id, "ready")} />)}</section>
      <section className="ready"><header><h2>Prontos para chamar</h2><b>{ready.length}</b></header>{ready.map((order) => <KitchenCard key={order.id} order={order} label={`Entregar para ${order.customerName}`} onClick={() => onStatus(order.id, "completed")} />)}</section>
    </div>
  </div>;
}

function KitchenCard({ order, label, onClick }: { order: Order; label: string; onClick: () => Promise<void> }) {
  return <article className="kitchen-order">
    <header><b>{order.code}</b><OrderTimer iso={order.createdAt} /></header>
    <h3>{order.customerName}</h3>
    <ul>{order.items.map((item) => <li key={item.id}><b>{item.quantity}×</b> {item.name}</li>)}</ul>
    {order.notes && <p>Obs.: {order.notes}</p>}
    <footer><span>{order.paymentMethod}</span><button onClick={onClick}>{label} →</button></footer>
  </article>;
}

function Orders({ orders, onPrint }: { orders: Order[]; onPrint: (order: Order) => void }) {
  const labels: Record<Order["status"], string> = { preparing: "Em preparo", ready: "Pronto", completed: "Finalizado", cancelled: "Cancelado" };
  return <div className="panel-page">
    <PageTitle eyebrow="HISTÓRICO" title="Todos os pedidos" subtitle="Consulte comandas, pagamentos e andamento da operação." />
    <div className="orders-table"><header><span>Pedido</span><span>Cliente</span><span>Horário</span><span>Pagamento</span><span>Total</span><span>Status</span><span /></header>
      {orders.map((order) => <div key={order.id}><b>{order.code}</b><strong>{order.customerName}</strong><span>{new Date(order.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span><span>{order.paymentMethod}</span><b>{formatMoney(order.totalCents)}</b><i className={order.status}>{labels[order.status]}</i><button onClick={() => onPrint(order)}>Imprimir</button></div>)}
    </div>
  </div>;
}

function Finance({ entries, onCreated }: { entries: FinanceEntry[]; onCreated: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("Fornecedores");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const income = entries.filter((entry) => entry.entryType === "income").reduce((sum, entry) => sum + Number(entry.amountCents), 0);
  const expense = entries.filter((entry) => entry.entryType === "expense").reduce((sum, entry) => sum + Number(entry.amountCents), 0);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await api("/api/finance", { method: "POST", body: JSON.stringify({ entryType: type, category, description, amountCents: Math.round(Number(amount.replace(",", ".")) * 100), entryDate: date }) });
    setDescription(""); setAmount(""); setOpen(false); await onCreated();
  };
  return <div className="panel-page finance-page">
    <PageTitle eyebrow="CONTROLE FINANCEIRO" title="Financeiro" subtitle="Registre entradas e saídas, acompanhe o caixa e organize as contas." action={<button className="panel-primary" onClick={() => setOpen(true)}>+ Novo lançamento</button>} />
    <div className="finance-summary">
      <Metric label="Entradas registradas" value={formatMoney(income)} note="Receitas e ajustes manuais" tone="green" />
      <Metric label="Saídas registradas" value={formatMoney(expense)} note="Custos e despesas" tone="red" />
      <Metric label="Saldo dos lançamentos" value={formatMoney(income - expense)} note="Entradas menos saídas" tone={income - expense >= 0 ? "green" : "red"} />
    </div>
    <section className="finance-layout">
      <article className="panel-card finance-list"><header><div><span>LANÇAMENTOS</span><h3>Histórico financeiro</h3></div></header>
        <div className="finance-table"><header><span>Data</span><span>Descrição</span><span>Categoria</span><span>Tipo</span><span>Valor</span></header>
          {entries.length ? entries.map((entry) => <div key={entry.id}><span>{new Date(entry.entryDate).toLocaleDateString("pt-BR")}</span><strong>{entry.description}</strong><span>{entry.category}</span><i className={entry.entryType}>{entry.entryType === "income" ? "Entrada" : "Saída"}</i><b className={entry.entryType}>{entry.entryType === "expense" ? "−" : "+"}{formatMoney(entry.amountCents)}</b></div>) : <p>Nenhum lançamento manual ainda.</p>}
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

function Planning({ plans, dashboard, onCreated }: { plans: Plan[]; dashboard: DashboardData | null; onCreated: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [date, setDate] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await api("/api/plans", { method: "POST", body: JSON.stringify({ title, targetCents: Math.round(Number(target.replace(",", ".")) * 100), dueDate: date || null }) });
    setTitle(""); setTarget(""); setDate(""); await onCreated();
  };
  return <div className="panel-page planning-page">
    <PageTitle eyebrow="GESTÃO E METAS" title="Planejamento financeiro" subtitle="Defina objetivos e acompanhe o avanço financeiro da loja." />
    <div className="planning-grid">
      <section><h2>Metas ativas</h2>{plans.length ? plans.map((plan) => {
        const percent = Math.min(100, Math.round(Number(plan.currentCents) / Number(plan.targetCents) * 100));
        return <article className="plan-card" key={plan.id}><header><div><span>META</span><h3>{plan.title}</h3></div><b>{percent}%</b></header><div className="progress"><i style={{ width: `${percent}%` }} /></div><footer><span>{formatMoney(Number(plan.currentCents))} alcançados</span><strong>{formatMoney(Number(plan.targetCents))}</strong></footer>{plan.dueDate && <small>Prazo: {new Date(plan.dueDate).toLocaleDateString("pt-BR")}</small>}</article>;
      }) : <div className="panel-empty">Crie a primeira meta da loja.</div>}</section>
      <aside>
        <form className="plan-form" onSubmit={submit}><span>NOVA META</span><h2>Planejar objetivo</h2><label>Nome da meta<input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="Ex.: Reserva para nova fritadeira" /></label><label>Valor alvo<input value={target} onChange={(event) => setTarget(event.target.value)} inputMode="decimal" required placeholder="0,00" /></label><label>Prazo<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><button className="panel-primary">Criar meta</button></form>
        <article className="planning-insight"><span>LEITURA DO NEGÓCIO</span><h3>Saldo financeiro registrado</h3><strong>{formatMoney(Number(dashboard?.finance.income || 0) - Number(dashboard?.finance.expense || 0))}</strong><p>Use as metas junto com os lançamentos do financeiro para organizar compras, investimentos e reserva de caixa.</p></article>
      </aside>
    </div>
  </div>;
}

function printOrder(order: Order) {
  const popup = window.open("", "_blank", "width=420,height=700");
  if (!popup) return;
  popup.document.write(`<!doctype html><html><head><title>${order.code}</title><style>body{font:14px monospace;padding:18px}h1{text-align:center;font-size:22px}h2{font-size:18px;border-block:1px dashed #000;padding:12px 0}li{margin:8px 0}.meta{border-top:1px dashed #000;margin-top:18px;padding-top:12px}strong{font-size:18px}</style></head><body><h1>SMACK CHICKEN</h1><p style="text-align:center">Rua Fúlvio Aducci, 1074</p><h2>${order.code} · ${order.customerName}</h2><ul>${order.items.map((item) => `<li><b>${item.quantity}x</b> ${item.name}</li>`).join("")}</ul>${order.notes ? `<p><b>OBS:</b> ${order.notes}</p>` : ""}<div class="meta"><p>${order.paymentMethod}</p><strong>Total: ${formatMoney(order.totalCents)}</strong><p>${new Date(order.createdAt).toLocaleString("pt-BR")}</p></div><script>window.onload=()=>window.print()</script></body></html>`);
  popup.document.close();
}
