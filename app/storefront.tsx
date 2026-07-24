"use client";

import { catalog, formatMoney } from "../lib/catalog";

function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className={`public-logo ${light ? "is-light" : ""}`}>
      <span>S</span>
      <strong>SMACK<small>CHICKEN</small></strong>
    </div>
  );
}

export default function Storefront() {
  const featured = catalog.filter((item) => item.featured);
  return (
    <main className="public-site">
      <header className="public-header">
        <Logo />
        <nav>
          <a href="#cardapio">Cardápio</a>
          <a href="#loja">A loja</a>
          <a href="#contato">Contato</a>
        </nav>
        <a className="public-order" href="https://www.ifood.com.br/" target="_blank" rel="noreferrer">Pedir no iFood</a>
      </header>

      <section className="public-hero">
        <div className="public-hero-copy">
          <span className="public-kicker">NOVA LOJA NO ESTREITO · FLORIANÓPOLIS</span>
          <h1>Frango que<br /><em>faz crunch.</em></h1>
          <p>Crocante por fora, suculento por dentro e preparado na hora. Para comer no local ou receber pelo iFood.</p>
          <div className="public-actions">
            <a href="#cardapio">Ver cardápio</a>
            <a className="ghost" href="https://www.google.com/maps/search/?api=1&query=Rua+Fulvio+Aducci+1074+Florianopolis" target="_blank" rel="noreferrer">Como chegar</a>
          </div>
          <div className="public-facts">
            <span><b>11h — 23h</b>Todos os dias</span>
            <span><b>35 — 40 min</b>Entrega pelo iFood</span>
            <span><b>Rua Fúlvio Aducci, 1074</b>Estreito, Florianópolis</span>
          </div>
        </div>
        <div className="public-hero-image">
          <img src="/combo-zero.jpeg" alt="Balde SMACK CHICKEN com frango crocante" />
          <span>FEITO<br />NA HORA</span>
        </div>
      </section>

      <div className="public-marquee">CROCANTE DE VERDADE ✦ MOLHOS DA CASA ✦ FEITO NA HORA ✦ FRANGO SEM CONVERSA</div>

      <section className="public-menu" id="cardapio">
        <div className="public-section-title">
          <span>O NOSSO CARDÁPIO</span>
          <h2>Escolha seu <em>crunch</em></h2>
          <p>Combos preparados para matar a fome — sozinho ou com a galera.</p>
        </div>
        <div className="public-product-grid">
          {featured.map((product) => (
            <article key={product.id}>
              <div><img src={product.image} alt={product.name} /><span>{product.category}</span></div>
              <section>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <strong>{formatMoney(product.priceCents)}</strong>
              </section>
            </article>
          ))}
        </div>
      </section>

      <section className="public-location" id="loja">
        <div>
          <span>VENHA CONHECER</span>
          <h2>O novo ponto de<br /><em>frango crocante.</em></h2>
          <p>Rua Fúlvio Aducci, 1074 — Estreito<br />Florianópolis — SC</p>
          <a href="https://www.google.com/maps/search/?api=1&query=Rua+Fulvio+Aducci+1074+Florianopolis" target="_blank" rel="noreferrer">Abrir no Google Maps ↗</a>
        </div>
        <div className="public-map-card"><b>SMACK</b><span>RUA FÚLVIO ADUCCI</span><strong>1074</strong><small>ESTREITO · FLORIANÓPOLIS</small></div>
      </section>

      <footer id="contato">
        <Logo light />
        <p>Frango crocante. Sem conversa.</p>
        <span>© 2026 SMACK CHICKEN</span>
      </footer>
    </main>
  );
}
