"use client";

import { useEffect, useMemo, useState } from "react";
import { catalog, formatMoney } from "../lib/catalog";

const IFOOD_URL = "https://www.ifood.com.br/";
const MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=Rua+Fulvio+Aducci+1074+Florianopolis";

function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className={`sc-logo ${light ? "is-light" : ""}`}>
      <span>
        <img src="/smack-chicken-mark.png" alt="" />
      </span>
      <strong>
        SMACK<small>CHICKEN</small>
      </strong>
    </div>
  );
}

const categoryIcons: Record<string, string> = {
  Baldes: "🍗",
  Combos: "🍔",
  Porções: "🍟",
  Bebidas: "🥤",
  Extras: "🧂",
};

const addOns = [
  { id: "queijo", label: "Queijo extra", price: 250 },
  { id: "crocante", label: "Extra crocante", price: 300 },
  { id: "frango", label: "Mais frango", price: 600 },
];
const sauces = ["Alho", "Barbecue", "Picante", "Da casa"];
const sizes = [
  { id: "P", label: "Pequeno", price: 0 },
  { id: "M", label: "Médio", price: 300 },
  { id: "G", label: "Grande", price: 500 },
];

function useCountdown() {
  const [left, setLeft] = useState({ h: "00", m: "00", s: "00" });
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const target = new Date(now);
      target.setHours(2, 0, 0, 0);
      if (now.getHours() >= 2) target.setDate(target.getDate() + 1);
      const diff = Math.max(0, target.getTime() - now.getTime());
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      setLeft({ h: pad(h), m: pad(m), s: pad(s) });
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  return left;
}

function MealBuilder() {
  const base = catalog.find((item) => item.name === "Combo Crocante") ?? catalog[0];
  const [checked, setChecked] = useState<string[]>(["queijo", "crocante"]);
  const [sauce, setSauce] = useState("Da casa");
  const [size, setSize] = useState("M");
  const [combo, setCombo] = useState(true);

  const total = useMemo(() => {
    const extras = addOns
      .filter((item) => checked.includes(item.id))
      .reduce((sum, item) => sum + item.price, 0);
    const sizePrice = sizes.find((item) => item.id === size)?.price ?? 0;
    const comboPrice = combo ? 900 : 0;
    return base.priceCents + extras + sizePrice + comboPrice;
  }, [base.priceCents, checked, size, combo]);

  const toggle = (id: string) =>
    setChecked((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  return (
    <div className="sc-builder">
      <span className="sc-builder-eyebrow">MONTE SEU COMBO</span>
      <div className="sc-builder-grid">
        <div className="sc-builder-col">
          <h4>Adicionais</h4>
          {addOns.map((item) => (
            <button
              key={item.id}
              className={`sc-check ${checked.includes(item.id) ? "on" : ""}`}
              onClick={() => toggle(item.id)}
              type="button"
            >
              <i />
              <span>{item.label}</span>
              <b>+{formatMoney(item.price)}</b>
            </button>
          ))}
        </div>
        <div className="sc-builder-col">
          <h4>Molho</h4>
          <div className="sc-chips">
            {sauces.map((item) => (
              <button
                key={item}
                type="button"
                className={sauce === item ? "on" : ""}
                onClick={() => setSauce(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="sc-builder-col">
          <h4>Tamanho</h4>
          <div className="sc-chips">
            {sizes.map((item) => (
              <button
                key={item.id}
                type="button"
                className={size === item.id ? "on" : ""}
                onClick={() => setSize(item.id)}
              >
                {item.id}
              </button>
            ))}
          </div>
        </div>
        <div className="sc-builder-col">
          <h4>Vira combo?</h4>
          <button
            type="button"
            className={`sc-upgrade ${combo ? "on" : ""}`}
            onClick={() => setCombo((value) => !value)}
          >
            <span>
              <b>Batata + Refri</b>
              <small>+{formatMoney(900)}</small>
            </span>
            <i />
          </button>
        </div>
      </div>
      <div className="sc-builder-summary">
        <div className="sc-meal-preview">
          <img src={base.image} alt={base.name} />
          <div>
            <small>SEU COMBO</small>
            <b>{base.name}</b>
            <strong>{formatMoney(total)}</strong>
          </div>
        </div>
        <a className="sc-add-cart" href={IFOOD_URL} target="_blank" rel="noreferrer">
          Adicionar ao carrinho 🛒
        </a>
      </div>
    </div>
  );
}

function MidnightDeals() {
  const time = useCountdown();
  const deals = [
    { name: "Balde Noturno", meta: "12 tiras", price: 3990, old: 6590, off: "39% OFF", image: "/balde.jpeg" },
    { name: "Combo Meia-Noite", meta: "Combo completo", price: 3490, old: 5490, off: "36% OFF", image: "/combo.jpeg" },
    { name: "Noite de Tiras", meta: "8 tiras", price: 1990, old: 3290, off: "39% OFF", image: "/molho.jpeg" },
  ];
  return (
    <div className="sc-deals">
      <div className="sc-deals-head">
        <span className="sc-deals-tag">TEMPO LIMITADO</span>
        <h3>
          OFERTAS DA
          <br />
          <em>MEIA-NOITE</em>
        </h3>
        <p>Descontos imperdíveis. Só à noite.</p>
        <div className="sc-timer">
          <div>
            <b>{time.h}</b>
            <small>HRS</small>
          </div>
          <i>:</i>
          <div>
            <b>{time.m}</b>
            <small>MIN</small>
          </div>
          <i>:</i>
          <div>
            <b>{time.s}</b>
            <small>SEG</small>
          </div>
        </div>
        <span className="sc-flash">🔥 Válido das 22h às 02h</span>
      </div>
      <div className="sc-deals-cards">
        {deals.map((deal) => (
          <article key={deal.name}>
            <img src={deal.image} alt={deal.name} />
            <div>
              <b>{deal.name}</b>
              <small>{deal.meta}</small>
              <span>
                <strong>{formatMoney(deal.price)}</strong>
                <s>{formatMoney(deal.old)}</s>
              </span>
            </div>
            <i className="sc-off">{deal.off}</i>
          </article>
        ))}
      </div>
    </div>
  );
}

export default function Storefront() {
  const featured = catalog.filter((item) => item.featured);
  const categories = ["Baldes", "Combos", "Porções", "Bebidas", "Extras"];
  return (
    <main className="sc-site">
      <header className="sc-header">
        <Logo />
        <nav>
          <a href="#inicio" className="active">
            Início
          </a>
          <a href="#cardapio">Cardápio</a>
          <a href="#ofertas">Ofertas</a>
          <a href="#loja">Nossa loja</a>
          <a href="#contato">Contato</a>
        </nav>
        <div className="sc-header-actions">
          <a className="sc-icon" href="#cardapio" aria-label="Buscar">
            🔍
          </a>
          <a className="sc-icon" href={IFOOD_URL} target="_blank" rel="noreferrer" aria-label="Conta">
            👤
          </a>
          <a className="sc-order" href={IFOOD_URL} target="_blank" rel="noreferrer">
            🛍 Pedir agora
          </a>
        </div>
      </header>

      <section className="sc-hero" id="inicio">
        <div className="sc-hero-copy">
          <span className="sc-hero-kicker">▪▪▪ NOSSO CARDÁPIO. FEITO NA HORA.</span>
          <h1>
            Frango
            <br />
            de Verdade.
            <br />
            <em>Crocante</em>
            <br />
            de Verdade.
          </h1>
          <p>
            Empanado à mão. Frito na hora. Feito para você.
            <br />
            Só na SMACK CHICKEN — Estreito, Florianópolis.
          </p>
          <div className="sc-hero-actions">
            <a href="#cardapio">Ver cardápio</a>
            <a className="ghost" href={MAPS_URL} target="_blank" rel="noreferrer">
              Como chegar
            </a>
          </div>
        </div>
        <div className="sc-featured">
          <span className="sc-featured-label">DESTAQUES DO CARDÁPIO —</span>
          <div className="sc-featured-row">
            {featured.map((product, index) => (
              <article key={product.id}>
                {index < 2 && <i className="sc-popular">POPULAR</i>}
                <div className="sc-featured-img">
                  <img src={product.image} alt={product.name} />
                </div>
                <b>{product.name}</b>
                <strong>{formatMoney(product.priceCents)}</strong>
                <small>{product.description}</small>
                <a
                  className="sc-plus"
                  href={IFOOD_URL}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Adicionar ${product.name}`}
                >
                  +
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="sc-categories" id="cardapio">
        {categories.map((item, index) => (
          <button key={item} type="button" className={index === 0 ? "on" : ""}>
            <span>{categoryIcons[item]}</span>
            {item}
          </button>
        ))}
      </div>

      <section className="sc-main-grid">
        <MealBuilder />
        <div id="ofertas">
          <MidnightDeals />
        </div>
      </section>

      <section className="sc-menu">
        <div className="sc-section-title">
          <span>O NOSSO CARDÁPIO</span>
          <h2>
            Escolha seu <em>crunch</em>
          </h2>
          <p>Combos preparados para matar a fome — sozinho ou com a galera.</p>
        </div>
        <div className="sc-product-grid">
          {catalog.map((product) => (
            <article key={product.id}>
              <div className="sc-product-img">
                <img src={product.image} alt={product.name} />
                <span>{product.category}</span>
              </div>
              <section>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <div className="sc-product-buy">
                  <strong>{formatMoney(product.priceCents)}</strong>
                  <a href={IFOOD_URL} target="_blank" rel="noreferrer">
                    +
                  </a>
                </div>
              </section>
            </article>
          ))}
        </div>
      </section>

      <section className="sc-location" id="loja">
        <div>
          <span>VENHA CONHECER</span>
          <h2>
            O novo ponto de
            <br />
            <em>frango crocante.</em>
          </h2>
          <p>
            Rua Fúlvio Aducci, 1074 — Estreito
            <br />
            Florianópolis — SC · 11h às 23h todos os dias
          </p>
          <a href={MAPS_URL} target="_blank" rel="noreferrer">
            Abrir no Google Maps ↗
          </a>
        </div>
        <div className="sc-map-card">
          <b>SMACK</b>
          <span>RUA FÚLVIO ADUCCI</span>
          <strong>1074</strong>
          <small>ESTREITO · FLORIANÓPOLIS</small>
        </div>
      </section>

      <footer className="sc-bottom-bar">
        <div>
          <i>🛵</i>
          <span>
            <b>Entrega em 35 min</b>
            <small>Pelo iFood</small>
          </span>
        </div>
        <div>
          <i>🐔</i>
          <span>
            <b>100% Frango Fresco</b>
            <small>Empanado na hora</small>
          </span>
        </div>
        <div>
          <i>🔥</i>
          <span>
            <b>Mais Pedidos</b>
            <small>Amado pela galera</small>
          </span>
        </div>
        <div>
          <i>⭐</i>
          <span>
            <b>Avaliação 4.9</b>
            <small>No iFood</small>
          </span>
        </div>
        <div>
          <i>📱</i>
          <span>
            <b>SMACK no iFood</b>
            <small>Ofertas exclusivas</small>
          </span>
        </div>
        <a className="sc-cart" href={IFOOD_URL} target="_blank" rel="noreferrer">
          <i>🛒</i>
          <span>
            <small>Meu pedido</small>
            <b>Pedir agora</b>
          </span>
        </a>
      </footer>

      <footer className="sc-footer" id="contato">
        <Logo light />
        <p>Frango crocante. Sem conversa.</p>
        <span>© 2026 SMACK CHICKEN · Rua Fúlvio Aducci, 1074 — Estreito, Florianópolis</span>
      </footer>
    </main>
  );
}
