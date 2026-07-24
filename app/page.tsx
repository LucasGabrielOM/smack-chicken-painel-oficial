"use client";

import { useEffect, useMemo, useState } from "react";

type Product = { id: number; name: string; detail: string; price: number; image: string; tag?: string };
type CartLine = Product & { qty: number };
type Order = {
  id: number; code: string; customer: string; items: CartLine[]; total: number;
  payment: string; cash?: number; status: "preparing" | "ready" | "done"; createdAt: number; channel: string;
};

const products: Product[] = [
  { id: 1, name: "Balde Smack 12", detail: "12 tiras crocantes + 3 molhos", price: 49.9, image: "/balde.jpeg", tag: "Mais pedido" },
  { id: 2, name: "Combo Crocante", detail: "8 tiras + batata + refrigerante", price: 42.9, image: "/combo.jpeg", tag: "Combo" },
  { id: 3, name: "Balde Família 20", detail: "20 tiras crocantes + 4 molhos", price: 69.9, image: "/combo-zero.jpeg" },
  { id: 4, name: "Smack Individual", detail: "5 tiras + batata + molho", price: 27.9, image: "/molho.jpeg" },
  { id: 5, name: "Batata Crocante", detail: "Porção grande, serve 2 pessoas", price: 16.9, image: "/balde-mesa.jpeg" },
  { id: 6, name: "Molho da Casa", detail: "Escolha: alho, barbecue ou picante", price: 3.5, image: "/molho.jpeg" },
];

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Brand({ small = false }: { small?: boolean }) {
  return <div className={`brand ${small ? "small" : ""}`}><span className="brand-mark">S</span><span>SMACK<em>CHICKEN</em></span></div>;
}

function Timer({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const secs = Math.max(0, Math.floor((now - since) / 1000));
  return <span className={secs > 900 ? "late" : ""}>{String(Math.floor(secs / 60)).padStart(2, "0")}:{String(secs % 60).padStart(2, "0")}</span>;
}

export default function Home() {
  const [view, setView] = useState<"store" | "pos" | "kitchen" | "dash">("store");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orders, setOrders] = useState<Order[]>([
    { id: 1, code: "#1042", customer: "Marina", items: [{ ...products[1], qty: 1 }], total: 42.9, payment: "Débito", status: "preparing", createdAt: Date.now() - 8 * 60000, channel: "Balcão" },
    { id: 2, code: "#1041", customer: "Rafael", items: [{ ...products[0], qty: 1 }, { ...products[5], qty: 2 }], total: 56.9, payment: "Pix", status: "ready", createdAt: Date.now() - 14 * 60000, channel: "Balcão" },
  ]);
  const [customer, setCustomer] = useState("");
  const [payment, setPayment] = useState("Pix");
  const [cash, setCash] = useState("");
  const [toast, setToast] = useState("");
  const [printer, setPrinter] = useState(false);
  const total = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);

  const add = (p: Product) => setCart(c => c.some(i => i.id === p.id) ? c.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i) : [...c, { ...p, qty: 1 }]);
  const qty = (id: number, d: number) => setCart(c => c.map(i => i.id === id ? { ...i, qty: i.qty + d } : i).filter(i => i.qty > 0));
  const notify = (text: string) => { setToast(text); setTimeout(() => setToast(""), 2600); };

  const sendOrder = () => {
    if (!customer.trim() || !cart.length) return notify("Informe o nome e adicione pelo menos um item.");
    const next = 1043 + orders.length;
    const order: Order = { id: Date.now(), code: `#${next}`, customer: customer.trim(), items: cart, total, payment, cash: Number(cash) || undefined, status: "preparing", createdAt: Date.now(), channel: "Balcão" };
    setOrders(o => [order, ...o]); setCart([]); setCustomer(""); setCash("");
    notify(printer ? `Pedido ${order.code} enviado e impresso na cozinha.` : `Pedido ${order.code} enviado à cozinha (impressora offline).`);
  };

  const status = (id: number, s: Order["status"]) => setOrders(o => o.map(x => x.id === id ? { ...x, status: s } : x));

  return (
    <main>
      {toast && <div className="toast">{toast}</div>}
      <header className="topbar">
        <Brand />
        <nav>
          <button className={view === "store" ? "active" : ""} onClick={() => setView("store")}>Loja</button>
          <button className={view === "pos" ? "active" : ""} onClick={() => setView("pos")}>Caixa</button>
          <button className={view === "kitchen" ? "active" : ""} onClick={() => setView("kitchen")}>Cozinha <b>{orders.filter(o => o.status !== "done").length}</b></button>
          <button className={view === "dash" ? "active" : ""} onClick={() => setView("dash")}>Gestão</button>
        </nav>
        <button className={`printer ${printer ? "online" : ""}`} onClick={() => { setPrinter(!printer); notify(!printer ? "Impressora SMACK-KITCHEN conectada." : "Impressora desconectada."); }}>
          <span>●</span> {printer ? "Impressora online" : "Conectar impressora"}
        </button>
      </header>

      {view === "store" && <Store add={add} cart={cart} total={total} goPos={() => setView("pos")} />}
      {view === "pos" && <section className="workspace">
        <div className="catalog">
          <div className="section-head"><div><span className="eyebrow">NOVO PEDIDO</span><h1>O que vai sair hoje?</h1></div><div className="search">⌕ Buscar no cardápio</div></div>
          <div className="filters"><button className="selected">Todos</button><button>Baldes</button><button>Combos</button><button>Porções</button><button>Bebidas</button></div>
          <div className="pos-grid">{products.map(p => <button className="pos-card" key={p.id} onClick={() => add(p)}><img src={p.image} alt="" /><div><strong>{p.name}</strong><span>{p.detail}</span><b>{money(p.price)}</b></div><i>+</i></button>)}</div>
        </div>
        <aside className="checkout">
          <div className="checkout-title"><div><span className="eyebrow">COMANDA</span><h2>Novo pedido</h2></div><span className="code">#{1043 + orders.length}</span></div>
          <label>Nome do cliente<input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Ex.: Lucas" /></label>
          <div className="cart-lines">{cart.length ? cart.map(i => <div className="cart-line" key={i.id}><div><strong>{i.name}</strong><span>{money(i.price)}</span></div><div className="stepper"><button onClick={() => qty(i.id, -1)}>−</button><b>{i.qty}</b><button onClick={() => qty(i.id, 1)}>+</button></div></div>) : <div className="empty">Adicione itens do cardápio<br/><small>Toque em um produto ao lado</small></div>}</div>
          <div className="totals"><span>Subtotal <b>{money(total)}</b></span><span>Total <strong>{money(total)}</strong></span></div>
          <label>Forma de pagamento<select value={payment} onChange={e => setPayment(e.target.value)}><option>Pix</option><option>Dinheiro</option><option>Crédito</option><option>Débito</option></select></label>
          {payment === "Dinheiro" && <label>Valor recebido<input type="number" value={cash} onChange={e => setCash(e.target.value)} placeholder="R$ 0,00" /><span className="change">Troco: <b>{money(Math.max(0, Number(cash) - total))}</b></span></label>}
          <button className="primary full" onClick={sendOrder}>Enviar para cozinha <span>→</span></button>
          <p className="print-note">{printer ? "● Impressão automática ativada" : "○ Conecte a impressora para imprimir automaticamente"}</p>
        </aside>
      </section>}
      {view === "kitchen" && <Kitchen orders={orders} status={status} />}
      {view === "dash" && <Dashboard />}
    </main>
  );
}

function Store({ add, cart, total, goPos }: { add: (p: Product) => void; cart: CartLine[]; total: number; goPos: () => void }) {
  return <div className="store">
    <section className="hero">
      <div className="hero-copy"><span className="pill">📍 NOVA LOJA NO ESTREITO</span><h1>O FRANGO<br/><em>QUE FAZ CRUNCH.</em></h1><p>Crocante por fora. Suculento por dentro.<br/>Preparado na hora, do jeito SMACK.</p><div className="hero-actions"><a href="#cardapio" className="primary">Ver cardápio <span>↓</span></a><a className="outline" href="https://www.google.com/maps/search/?api=1&query=Rua+Fulvio+Aducci+1074+Florianopolis" target="_blank">Como chegar</a></div><div className="facts"><span><b>11h — 23h</b>Todos os dias</span><span><b>35 — 40 min</b>Entrega iFood</span><span><b>Estreito</b>Florianópolis</span></div></div>
      <div className="hero-photo"><img src="/combo-zero.jpeg" alt="Balde de frango crocante Smack Chicken" /><div className="stamp">FEITO<br/>NA HORA</div></div>
    </section>
    <section className="marquee">CROCANTE DE VERDADE ✦ MOLHOS DA CASA ✦ FEITO NA HORA ✦ CROCANTE DE VERDADE ✦</section>
    <section className="menu-section" id="cardapio"><div className="menu-title"><span className="eyebrow">NOSSO CARDÁPIO</span><h2>Escolha seu <em>crunch</em></h2><p>Combos pensados para matar a fome — sozinho ou com a galera.</p></div><div className="menu-grid">{products.slice(0, 4).map(p => <article className="menu-card" key={p.id}><div className="image-wrap"><img src={p.image} alt={p.name}/>{p.tag && <span>{p.tag}</span>}</div><div className="menu-info"><h3>{p.name}</h3><p>{p.detail}</p><div><strong>{money(p.price)}</strong><button onClick={() => add(p)}>Adicionar +</button></div></div></article>)}</div></section>
    <section className="location"><div><span className="eyebrow">NOS ENCONTRE</span><h2>Seu novo ponto de<br/><em>frango crocante.</em></h2><p>Rua Fúlvio Aducci, 1074 — Estreito<br/>Florianópolis — SC</p><a className="outline light" href="https://www.google.com/maps/search/?api=1&query=Rua+Fulvio+Aducci+1074+Florianopolis" target="_blank">Abrir no Google Maps ↗</a></div><div className="map-card"><b>SMACK</b><span>Rua Fúlvio Aducci</span><i>1074</i><small>ESTREITO · FLORIANÓPOLIS</small></div></section>
    <button className="floating-cart" onClick={goPos}><span>{cart.reduce((s,i)=>s+i.qty,0)}</span> Meu pedido <b>{money(total)}</b></button>
    <footer><Brand small/><p>Frango crocante. Sem conversa.</p><span>© 2026 SMACK CHICKEN</span></footer>
  </div>;
}

function Kitchen({ orders, status }: { orders: Order[]; status: (id: number, s: Order["status"]) => void }) {
  const active = orders.filter(o => o.status !== "done");
  return <section className="kitchen-page"><div className="page-title"><div><span className="eyebrow">OPERAÇÃO AO VIVO</span><h1>Cozinha</h1><p>{active.length} pedidos em andamento</p></div><div className="legend"><span>● Em preparo</span><span>● Pronto</span></div></div>
    <div className="kanban"><div className="lane"><header><h2>Em preparo</h2><b>{active.filter(o=>o.status==="preparing").length}</b></header>{active.filter(o=>o.status==="preparing").map(o=><OrderCard key={o.id} order={o} action={() => status(o.id,"ready")} label="Marcar como pronto"/>)}</div><div className="lane ready"><header><h2>Prontos para chamar</h2><b>{active.filter(o=>o.status==="ready").length}</b></header>{active.filter(o=>o.status==="ready").map(o=><OrderCard key={o.id} order={o} action={() => status(o.id,"done")} label={`Entregar para ${o.customer}`}/>)}</div></div>
  </section>;
}

function OrderCard({ order, action, label }: { order: Order; action: () => void; label: string }) {
  return <article className="order-card"><div className="order-top"><span>{order.code}</span><Timer since={order.createdAt}/></div><h3>{order.customer}</h3><ul>{order.items.map(i=><li key={i.id}><b>{i.qty}×</b> {i.name}</li>)}</ul><div className="order-meta"><span>{order.channel}</span><span>{order.payment}</span></div><button onClick={action}>{label} →</button></article>;
}

function Dashboard() {
  const bars = [42,58,49,70,62,96,78,61,84,75,108,92,118,103];
  return <section className="dash"><div className="page-title"><div><span className="eyebrow">VISÃO GERAL</span><h1>Boa tarde, equipe!</h1><p>A loja está vendendo 18% acima da última sexta.</p></div><select><option>Hoje, 24 de julho</option><option>Últimos 7 dias</option><option>Este mês</option></select></div>
    <div className="metrics"><div><span>Faturamento hoje</span><strong>R$ 4.286,40</strong><small className="up">↑ 18,2% vs. sexta passada</small></div><div><span>Pedidos</span><strong>87</strong><small className="up">↑ 11 pedidos</small></div><div><span>Ticket médio</span><strong>R$ 49,27</strong><small className="up">↑ 6,4%</small></div><div><span>Tempo médio</span><strong>12min 48s</strong><small className="warn">2 pedidos acima da meta</small></div></div>
    <div className="dash-grid"><article className="chart-card sales"><header><div><span>Vendas por horário</span><strong>R$ 4.286,40</strong></div><div className="toggle">Valor <span>Pedidos</span></div></header><div className="bars">{bars.map((b,i)=><div key={i} style={{height:`${b}px`}} className={i===11?"hot":""}><i>{i===11?"R$ 612":""}</i></div>)}</div><div className="axis"><span>11h</span><span>14h</span><span>17h</span><span>20h</span><span>23h</span></div></article>
      <article className="chart-card mix"><header><span>Formas de pagamento</span></header><div className="donut"><div><b>87</b><span>pedidos</span></div></div><ul><li><i className="pix"/>Pix <b>42%</b></li><li><i className="credit"/>Crédito <b>31%</b></li><li><i className="debit"/>Débito <b>19%</b></li><li><i className="cash"/>Dinheiro <b>8%</b></li></ul></article>
      <article className="chart-card ranking"><header><span>Mais vendidos hoje</span><button>Ver cardápio</button></header>{products.slice(0,4).map((p,i)=><div key={p.id}><span className="rank">{i+1}</span><img src={p.image} alt=""/><p><b>{p.name}</b><span>{32-i*5} unidades</span></p><strong>{money((32-i*5)*p.price)}</strong></div>)}</article>
      <article className="chart-card insight"><span>INSIGHT DO DIA</span><h3>O pico das 20h chegou mais cedo.</h3><p>Entre 19h e 20h, as vendas subiram 27%. Considere iniciar o pré-preparo às 18h30 nas sextas.</p><button>Adicionar ao planejamento →</button></article></div>
  </section>;
}
