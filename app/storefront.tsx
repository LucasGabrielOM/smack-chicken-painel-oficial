import { catalog } from "../lib/catalog";
import { getProductImage } from "./store-panel";

const MAPS_URL = "https://maps.app.goo.gl/f6Rk7JtTgcCMzCSr9";

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

const reasons = [
  { n: "01", title: "Crunch inesquecível", text: "Empanado dourado, crocante até a última mordida." },
  { n: "02", title: "Feito no pedido", text: "Nada parado: sai quente direto da nossa cozinha." },
  { n: "03", title: "Molhos da casa", text: "Combinações feitas para mergulhar sem moderação." },
];

export default function Storefront() {
  return (
    <main className="sc-site">
      <header className="sc-header">
        <Logo />
        <nav>
          <a href="#inicio">Início</a>
          <a href="#cardapio">Cardápio</a>
          <a href="#loja">Localização</a>
        </nav>
        <a className="sc-order" href={MAPS_URL} target="_blank" rel="noreferrer">
          Como chegar
        </a>
      </header>

      <section className="sc-hero" id="inicio">
        <div className="sc-hero-copy">
          <span className="sc-hero-kicker">FRANGO CROCANTE · ESTREITO, FLORIANÓPOLIS</span>
          <h1>
            Frango de Verdade.
            <br />
            <em>Crocante</em> de Verdade.
          </h1>
          <p>
            Empanado à mão e frito na hora. Dourado, absurdamente crocante e feito
            para você chegar com fome e sair pensando no próximo balde.
          </p>
          <div className="sc-hero-actions">
            <a href="#cardapio">Ver cardápio</a>
            <a className="ghost" href={MAPS_URL} target="_blank" rel="noreferrer">
              Como chegar
            </a>
          </div>
          <div className="sc-facts">
            <span>
              <b>18h — 00h</b>Segunda a sábado
            </span>
            <span>
              <b>Rua Fúlvio Aducci, 1074</b>Estreito · Florianópolis
            </span>
          </div>
        </div>
        <div className="sc-hero-image">
          <img src="/combo-zero.jpeg" alt="Balde de frango crocante da SMACK CHICKEN" />
          <span>
            FEITO
            <br />
            NA HORA
          </span>
        </div>
      </section>

      <section className="sc-reasons">
        {reasons.map((item) => (
          <article key={item.n}>
            <b>{item.n}</b>
            <span>
              <strong>{item.title}</strong>
              <small>{item.text}</small>
            </span>
          </article>
        ))}
      </section>

      <section className="sc-menu" id="cardapio">
        <div className="sc-section-title">
          <span>O NOSSO CARDÁPIO</span>
          <h2>
            Conheça nossos <em>combos</em>
          </h2>
          <p>Baldes, combos e porções para matar a fome — sozinho ou com a galera.</p>
        </div>
        <div className="sc-product-grid">
          {catalog
            .filter((product) => product.category !== "Bebidas")
            .map((product) => (
              <article key={product.id}>
                <div className="sc-product-img">
                  <img src={getProductImage(product)} alt={product.name} />
                  <span>{product.category}</span>
                </div>
                <section>
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
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
            Florianópolis — SC
            <br />
            Aberto de segunda a sábado, das 18h às 00h.
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

      <footer className="sc-footer" id="contato">
        <Logo light />
        <p>Frango crocante. Sem conversa.</p>
        <span>© 2026 SMACK CHICKEN · Rua Fúlvio Aducci, 1074 — Estreito, Florianópolis</span>
      </footer>
    </main>
  );
}
