const MAPS_URL = "https://maps.app.goo.gl/f6Rk7JtTgcCMzCSr9";
const IFOOD_URL =
  "https://www.ifood.com.br/delivery/florianopolis-sc/smack-chicken-frango-frito-no-balde-estreito/93484d61-4553-4caf-b136-d1a0f5e73ecf?utm_medium=share";
const INSTAGRAM_URL = "https://www.instagram.com/smack.chicken";

// Conteúdo estático da vitrine pública — não usa lib/catalog.ts nem banco
// de dados. Preços de destaque abaixo são atualizados manualmente aqui.
const BUCKETS = [
  { size: "P", name: "Balde P — 250 g", note: "Tiras ou coxinha da asa crocante", price: "R$ 26,99", image: "/balde-tiras.jpeg" },
  { size: "M", name: "Balde M — 500 g", note: "Tiras ou coxinha da asa crocante", price: "R$ 59,99", image: "/balde-coxinha.jpeg" },
  { size: "G", name: "Balde G — 800 g", note: "Tiras ou coxinha da asa crocante", price: "R$ 79,99", image: "/combo-mesa.jpeg" },
];

const LANCHES = [
  { name: "Smack Kids + Batata Smile", note: "Opção especial para os pequenos: pão brioche, frango crocante por fora e macio por dentro, com 150 g de batata smile.", price: "R$ 32,90", image: "/lanche-kids.jpeg" },
  { name: "Smack Fresh", note: "Crocância e frescor no mesmo lanche: frango crocante em tirinhas, alface roxa, tomate, cebola roxa, queijo e molho à escolha.", price: "R$ 39,90", image: "/lanche-fresh.jpeg" },
  { name: "Smack Original", note: "O clássico da casa: frango crocante em tirinhas, queijo, molho à escolha e pão brioche. Simples e saboroso.", price: "R$ 29,90", image: "/lanche-original.jpeg" },
  { name: "Smack Power", note: "Frango crocante em tirinhas, bacon crocante, queijo cheddar ou mussarela e cebola caramelizada.", price: "R$ 49,90", image: "/lanche-power.jpeg" },
];

const reasons = [
  { n: "01", title: "Crunch inesquecível", text: "Empanado dourado, crocante até a última mordida." },
  { n: "02", title: "Feito no pedido", text: "Nada parado: sai quente direto da nossa cozinha." },
  { n: "03", title: "Molhos da casa", text: "Combinações feitas para mergulhar sem moderação." },
];

// Avaliações reais do perfil da SMACK CHICKEN no Google (5,0 · 8 avaliações).
const REVIEWS = [
  { name: "Günther R. Fank", text: "Pensa numa delícia, sem falar no ótimo atendimento." },
  { name: "Ariela Pereira", text: "Melhor frango que já provei, atendimento maravilhoso." },
  { name: "Valdoir Pedroso", text: "Um dos melhores achados do Estreito. Frango no balde fresquinho, saboroso e crocante — super indico!" },
  { name: "Laura", text: "Fui com minha família, ambiente agradável e aconchegante, atendimento impecável. Recomendo!" },
];

function StarRow() {
  return (
    <div className="sc-stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 20 20">
          <path d="M10 1.5l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L1.4 7.8l6-.7z" />
        </svg>
      ))}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.617z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A9 9 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.581C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className={`sc-logo ${light ? "is-light" : ""}`}>
      <img
        className="sc-logo-mark"
        src={light ? "/smack-chicken-logo-white.png" : "/smack-chicken-logo.png"}
        alt="SMACK CHICKEN"
      />
    </div>
  );
}

export default function Storefront() {
  return (
    <main className="sc-site">
      <header className="sc-header">
        <Logo />
        <nav>
          <a href="#inicio">Início</a>
          <a href="#almoco">Almoço</a>
          <a href="#cardapio">Cardápio</a>
          <a href="#lanches">Lanches</a>
          <a href="#avaliacoes">Avaliações</a>
          <a href="#loja">Como chegar</a>
        </nav>
        <div className="sc-header-actions">
          <a className="sc-insta" href={INSTAGRAM_URL} target="_blank" rel="noreferrer">
            <InstagramIcon />
            <span>@smack.chicken</span>
          </a>
          <a className="sc-order sc-cta-pulse" href={IFOOD_URL} target="_blank" rel="noreferrer">
            Pedir no iFood <span className="sc-cta-arrow">→</span>
          </a>
        </div>
      </header>

      <a href={IFOOD_URL} target="_blank" rel="noreferrer" className="sc-sticky-cta sc-cta-pulse">
        Peça agora no iFood <span className="sc-cta-arrow">→</span>
      </a>

      <section className="sc-hero" id="inicio">
        <div className="sc-hero-copy">
          <span className="sc-hero-kicker">FRANGO CROCANTE · ESTREITO, FLORIANÓPOLIS</span>
          <h1>
            Frango de verdade.
            <br />
            <em>Crocante</em> de verdade.
          </h1>
          <p>
            Empanado à mão e frito na hora. Dourado, absurdamente crocante e feito
            para você chegar com fome e sair pensando no próximo balde.
          </p>
          <div className="sc-hero-price">
            <b>Baldes a partir de R$ 26,99</b>
            <span>peça pelo iFood</span>
          </div>
          <div className="sc-hero-actions">
            <a className="sc-cta-pulse" href={IFOOD_URL} target="_blank" rel="noreferrer">
              Peça no iFood <span className="sc-cta-arrow">→</span>
            </a>
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
          <img src="/balde-tiras.jpeg" alt="Balde de frango crocante da SMACK CHICKEN" />
          <div className="sc-hero-tag">
            <em>Feito na hora, todo dia.</em>
          </div>
        </div>
      </section>

      <section className="sc-reasons">
        {reasons.map((item) => (
          <article key={item.n} className="sc-reveal sc-pre">
            <b>{item.n}</b>
            <span>
              <strong>{item.title}</strong>
              <small>{item.text}</small>
            </span>
          </article>
        ))}
      </section>

      <section className="sc-menu" id="almoco">
        <div className="sc-section-title sc-reveal sc-pre">
          <span>HORA DO ALMOÇO</span>
          <h2>
            Marmita <em>Smack 600g</em>
          </h2>
          <p>Uma refeição completa, saborosa e bem servida para o seu almoço!</p>
        </div>
        <div className="sc-marmita-grid">
          <article className="sc-reveal sc-pre sc-marmita-card">
            <div className="sc-marmita-img">
              <img src="/marmita-smack.jpg" alt="Marmita Smack 600g" />
              <span className="sc-bucket-size">600g</span>
            </div>
            <div className="sc-marmita-body">
              <span className="sc-marmita-tag">NOVIDADE DA LOJA</span>
              <h3>MARMITA SMACK 600g</h3>
              <p>
                Uma refeição completa, saborosa e bem servida com 600g ao todo!
              </p>
              <ul className="sc-marmita-items">
                <li><strong>Frango Smack:</strong> filé de sassami crocante e sequinho</li>
                <li><strong>Arroz branco:</strong> soltinho</li>
                <li><strong>Feijão carioca:</strong> bem temperado</li>
                <li><strong>Batata frita:</strong> crocante</li>
                <li><strong>Salada:</strong> acompanha salada fresca</li>
              </ul>
              <div className="sc-bucket-price">
                <span>Refeição completa por</span>
                <b>R$ 29,90</b>
              </div>
              <a href={IFOOD_URL} target="_blank" rel="noreferrer" className="sc-marmita-btn sc-cta-pulse">
                Pedir Marmita no iFood <span className="sc-cta-arrow">→</span>
              </a>
            </div>
          </article>
        </div>
      </section>

      <section className="sc-menu" id="cardapio">
        <div className="sc-section-title">
          <span>OS BALDES</span>
          <h2>
            Escolha o <em>seu</em> balde
          </h2>
          <p>A gente frita na hora — você escolhe o tamanho e pede direto pelo iFood.</p>
        </div>
        <div className="sc-bucket-grid">
          {BUCKETS.map((bucket) => (
            <article key={bucket.size} className="sc-reveal sc-pre">
              <div className="sc-bucket-img">
                <img src={bucket.image} alt={bucket.name} />
                <span className="sc-bucket-size">{bucket.size}</span>
              </div>
              <div className="sc-bucket-body">
                <h3>{bucket.name}</h3>
                <p>{bucket.note}</p>
                <div className="sc-bucket-price">
                  <span>a partir de</span>
                  <b>{bucket.price}</b>
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="sc-menu-cta">
          <p>Combos, porções e bebidas também estão no cardápio completo do iFood.</p>
          <a href={IFOOD_URL} target="_blank" rel="noreferrer">
            Ver cardápio completo ↗
          </a>
        </div>
      </section>

      <section className="sc-menu" id="lanches">
        <div className="sc-section-title sc-reveal sc-pre">
          <span>TAMBÉM TEMOS</span>
          <h2>
            Lanches <em>Smack</em>
          </h2>
          <p>Sanduíches de frango crocante, do jeitinho que só a Smack faz.</p>
        </div>
        <div className="sc-bucket-grid sc-lanche-grid">
          {LANCHES.map((item) => (
            <article key={item.name} className="sc-reveal sc-pre">
              <div className="sc-bucket-img sc-lanche-img">
                <img src={item.image} alt={item.name} />
              </div>
              <div className="sc-bucket-body">
                <h3>{item.name}</h3>
                <p>{item.note}</p>
                <div className="sc-bucket-price">
                  <span>a partir de</span>
                  <b>{item.price}</b>
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="sc-menu-cta">
          <p>Cardápio completo de lanches, combos e bebidas no iFood.</p>
          <a href={IFOOD_URL} target="_blank" rel="noreferrer">
            Ver cardápio completo ↗
          </a>
        </div>
      </section>

      <section className="sc-reviews" id="avaliacoes">
        <div className="sc-section-title">
          <span>AVALIAÇÕES GOOGLE</span>
          <h2>
            Quem já provou, <em>aprova</em>
          </h2>
          <p>Nota 5,0 em 8 avaliações — direto do nosso perfil no Google.</p>
        </div>
        <div className="sc-review-grid">
          {REVIEWS.map((review) => (
            <article key={review.name} className="sc-reveal sc-pre">
              <div className="sc-review-head">
                <span className="sc-review-avatar">{review.name[0]}</span>
                <div>
                  <strong>{review.name}</strong>
                  <div className="sc-review-meta">
                    <StarRow />
                    <GoogleIcon />
                  </div>
                </div>
              </div>
              <p>&ldquo;{review.text}&rdquo;</p>
            </article>
          ))}
        </div>
        <div className="sc-promo sc-reveal sc-pre">
          <div className="sc-promo-badge">
            <strong>10%</strong>
            <span>OFF</span>
          </div>
          <div className="sc-promo-body">
            <span>AVALIE E GANHE</span>
            <h3>10% de desconto em qualquer pedido</h3>
            <ol className="sc-promo-steps">
              <li>
                <b>1</b>Avalie a gente no Google
              </li>
              <li>
                <b>2</b>Mostre a tela pro atendente no caixa
              </li>
              <li>
                <b>3</b>Ganhe 10% off — sem valor mínimo, em qualquer pedido da loja
              </li>
            </ol>
          </div>
          <a href={MAPS_URL} target="_blank" rel="noreferrer">
            Avaliar no Google ↗
          </a>
        </div>
      </section>

      <section className="sc-location" id="loja">
        <div className="sc-reveal sc-pre">
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
        <div className="sc-map-card sc-reveal sc-pre">
          <b>SMACK</b>
          <span>RUA FÚLVIO ADUCCI</span>
          <strong>1074</strong>
          <small>ESTREITO · FLORIANÓPOLIS</small>
        </div>
      </section>

      <footer className="sc-footer" id="contato">
        <Logo light />
        <div className="sc-footer-links">
          <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer">
            <InstagramIcon /> Instagram
          </a>
          <a href={IFOOD_URL} target="_blank" rel="noreferrer">
            iFood ↗
          </a>
        </div>
        <span>© 2026 SMACK CHICKEN · Rua Fúlvio Aducci, 1074 — Estreito, Florianópolis</span>
      </footer>

      <noscript>
        <style>{`.sc-pre { opacity: 1 !important; transform: none !important; }`}</style>
      </noscript>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){
            if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
            var els = document.querySelectorAll('.sc-reveal');
            var io = new IntersectionObserver(function(entries){
              entries.forEach(function(entry){
                if (entry.isIntersecting) { entry.target.classList.add('is-visible'); io.unobserve(entry.target); }
              });
            }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
            els.forEach(function(el){ io.observe(el); });
          })();`,
        }}
      />
    </main>
  );
}
