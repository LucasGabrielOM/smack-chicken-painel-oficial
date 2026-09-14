"use client";

import React, { useState, useMemo } from "react";
import { catalog, formatMoney, CatalogProduct } from "../lib/catalog";

type CartItem = {
  product: CatalogProduct;
  quantity: number;
};

export default function OnlineOrderingSystem() {
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [cart, setCart] = useState<CartItem[]>([
    { product: catalog[0], quantity: 1 },
    { product: catalog[3], quantity: 1 },
  ]);
  const [showCartModal, setShowCartModal] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryType, setDeliveryType] = useState<"RETIRADA" | "ENTREGA">("RETIRADA");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Pix");
  const [submitting, setSubmitting] = useState(false);
  const [completedOrderCode, setCompletedOrderCode] = useState<string | null>(null);

  const cartItemCount = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);
  const cartTotalCents = useMemo(
    () => cart.reduce((s, i) => s + i.product.priceCents * i.quantity, 0),
    [cart]
  );

  const addToCart = (product: CatalogProduct) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) => {
      return prev
        .map((i) => {
          if (i.product.id === productId) {
            const qty = i.quantity + delta;
            return qty > 0 ? { ...i, quantity: qty } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const categories = ["Todos", "Baldes", "Combos", "Marmitas", "Porções", "Bebidas", "Molhos"];

  const filteredProducts = useMemo(() => {
    if (selectedCategory === "Todos") return catalog;
    return catalog.filter((p) => p.category === selectedCategory);
  }, [selectedCategory]);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) return alert("Por favor, digite seu nome");
    if (!customerPhone.trim()) return alert("Por favor, digite seu telefone/WhatsApp");
    if (deliveryType === "ENTREGA" && !deliveryAddress.trim()) return alert("Por favor, informe o endereco de entrega");

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          paymentMethod,
          channel: "SITE_ONLINE",
          notes: `Tel: ${customerPhone.trim()} | Entrega: ${deliveryType} | Endereco: ${deliveryAddress || "Balcao"}`,
          items: cart.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
        }),
      });
      const data = await res.json() as { error?: string; order?: { code: string } };
      if (!res.ok) throw new Error(data.error || "Falha ao enviar pedido");
      if (data.order?.code) setCompletedOrderCode(data.order.code);
      setCart([]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao enviar pedido");
    } finally {
      setSubmitting(false);
    }
  };  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #3d070f; color: #ffffff; font-family: Inter, ui-sans-serif, system-ui, sans-serif; overflow-x: hidden; }
        
        .sc-online-app { min-height: 100vh; background: radial-gradient(circle at 50% 0%, #630d1a 0%, #3d070f 65%, #250308 100%); color: #fff; padding-bottom: 90px; }

        .sc-online-header { height: 68px; padding: 0 5%; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.08); background: rgba(37,3,8,0.85); backdrop-filter: blur(12px); position: sticky; top: 0; z-index: 100; }
        .sc-online-logo { display: flex; align-items: center; gap: 10px; }
        .sc-online-logo img { height: 28px; width: auto; object-fit: contain; }
        .sc-online-nav { display: flex; gap: 24px; font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.7); }
        .sc-online-nav a { color: inherit; text-decoration: none; transition: color 0.15s; }
        .sc-online-nav a:hover { color: #ffc814; }
        .sc-cart-btn { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 99px; padding: 7px 16px; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; }
        .sc-cart-btn:hover { background: #ffc814; color: #1b1715; border-color: #ffc814; }
        .sc-cart-badge { background: #ffc814; color: #1b1715; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 900; }

        .sc-online-hero { max-width: 1200px; margin: 0 auto; padding: 44px 5% 36px; display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 40px; align-items: center; }
        .sc-hero-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 14px; border-radius: 99px; background: rgba(255,200,20,0.12); border: 1px solid rgba(255,200,20,0.3); color: #ffc814; font-size: 11px; font-weight: 800; letter-spacing: 1px; margin-bottom: 18px; }
        .sc-hero-title { font-size: clamp(34px, 4.5vw, 56px); font-weight: 900; line-height: 1.08; letter-spacing: -1px; margin-bottom: 16px; }
        .sc-hero-title em { color: #ffc814; font-style: italic; font-weight: 400; font-family: Georgia, serif; }
        .sc-hero-sub { font-size: 15px; color: rgba(255,255,255,0.75); line-height: 1.6; max-width: 480px; margin-bottom: 28px; }
        .sc-hero-btns { display: flex; gap: 12px; margin-bottom: 28px; }
        .btn-gold { background: #ffc814; color: #1b1715; border: none; border-radius: 99px; padding: 14px 28px; font-size: 14px; font-weight: 800; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; transition: transform 0.15s, background 0.15s; }
        .btn-gold:hover { background: #ffe066; transform: translateY(-2px); }
        .btn-outline { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.25); border-radius: 99px; padding: 14px 24px; font-size: 14px; font-weight: 700; cursor: pointer; text-decoration: none; transition: all 0.15s; }
        .btn-outline:hover { border-color: #ffc814; color: #ffc814; }
        .sc-hero-pills { display: flex; flex-wrap: wrap; gap: 16px; font-size: 12px; color: rgba(255,255,255,0.7); }

        /* Concentric Stage Hero Circle - STRICT MATHEMATICAL CENTER ALIGNMENT */
        .sc-hero-stage {
          position: relative;
          width: 420px;
          height: 420px;
          margin: 0 auto;
          display: grid;
          place-items: center;
          grid-template-areas: "concentric";
        }
        .sc-hero-circle-img {
          grid-area: concentric;
          width: 310px;
          height: 310px;
          border-radius: 50%;
          overflow: hidden;
          position: relative;
          z-index: 2;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5), 0 0 0 8px rgba(255,200,20,0.15);
        }
        .sc-hero-circle-img img { width: 100%; height: 100%; object-fit: cover; }
        
        /* Rotating Text Ring - Strict center 50% 50% spin, NO translateY vertical movement */
        .sc-hero-text-ring {
          grid-area: concentric;
          width: 420px;
          height: 420px;
          pointer-events: none;
          z-index: 1;
          transform-origin: 50% 50%;
          transform-box: fill-box;
          animation: sc-spin-ring 32s linear infinite;
        }
        @keyframes sc-spin-ring {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .sc-hero-icon { position: absolute; z-index: 3; font-size: 26px; pointer-events: none; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4)); }
        .sc-hero-icon.icon-top { top: 22px; left: 45px; transform: rotate(-15deg); }
        .sc-hero-icon.icon-bottom { bottom: 45px; right: 25px; transform: rotate(25deg); }

        .sc-hero-card {
          position: absolute;
          left: -10px;
          bottom: 20px;
          z-index: 10;
          background: rgba(23, 19, 17, 0.94);
          backdrop-filter: blur(14px);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 14px;
          padding: 12px 16px;
          color: #fff;
          box-shadow: 0 16px 36px rgba(0,0,0,0.6);
          min-width: 210px;
        }
        .sc-hero-card-tag { font-size: 9px; font-weight: 800; color: #ffc814; letter-spacing: 1px; display: block; margin-bottom: 4px; }
        .sc-hero-card strong { font-size: 14px; display: block; font-weight: 700; color: #fff; }
        .sc-hero-card small { font-size: 11px; color: rgba(255,255,255,0.6); display: block; margin-bottom: 8px; }
        .sc-hero-card-foot { display: flex; align-items: center; justify-content: space-between; }
        .sc-hero-card-foot b { color: #ffc814; font-size: 15px; font-weight: 800; }
        .qty-ctrl { display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.1); border-radius: 99px; padding: 2px 8px; font-size: 12px; font-weight: 700; }
        .qty-ctrl button { background: none; border: none; color: #fff; cursor: pointer; font-size: 14px; font-weight: 800; padding: 0 4px; }

        .sc-menu-section { max-width: 1200px; margin: 0 auto; padding: 32px 5%; }
        .sc-menu-title { font-size: 24px; font-weight: 800; margin-bottom: 20px; text-align: center; }
        .sc-category-pills { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 14px; margin-bottom: 28px; justify-content: center; }
        .sc-category-pill { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.8); border-radius: 99px; padding: 8px 18px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .sc-category-pill.active { background: #ffc814; color: #1b1715; border-color: #ffc814; }

        .sc-products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 18px; }
        .sc-product-card { background: rgba(23, 19, 17, 0.7); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.2s, border-color 0.2s; }
        .sc-product-card:hover { transform: translateY(-3px); border-color: rgba(255,200,20,0.4); }
        .sc-product-img { height: 170px; position: relative; overflow: hidden; background: #250308; }
        .sc-product-img img { width: 100%; height: 100%; object-fit: cover; }
        .sc-product-body { padding: 16px; flex: 1; display: flex; flex-direction: column; }
        .sc-product-name { font-size: 15px; font-weight: 800; margin-bottom: 4px; line-height: 1.3; }
        .sc-product-desc { font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 14px; line-height: 1.4; flex: 1; }
        .sc-product-foot { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 12px; margin-top: auto; }
        .sc-product-price { font-size: 17px; font-weight: 800; color: #ffc814; }
        .btn-add { background: #ffc814; color: #1b1715; border: none; border-radius: 8px; padding: 7px 14px; font-size: 12px; font-weight: 800; cursor: pointer; transition: background 0.15s; }
        .btn-add:hover { background: #ffe066; }

        .sc-sticky-bar { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); width: 90%; max-width: 480px; background: #ffc814; color: #1b1715; border-radius: 14px; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 16px 40px rgba(0,0,0,0.6); z-index: 1000; cursor: pointer; transition: transform 0.15s; }
        .sc-sticky-bar:hover { transform: translateX(-50%) scale(1.02); }
        .sc-sticky-left { display: flex; align-items: center; gap: 12px; font-size: 15px; font-weight: 800; }
        .sc-sticky-count { background: #1b1715; color: #ffc814; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-size: 13px; font-weight: 900; }
        .sc-sticky-total { font-size: 18px; font-weight: 900; }

        .sc-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 20px; }
        .sc-modal-box { background: #1d1917; border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; color: #fff; padding: 24px; }
        .sc-modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 14px; }
        .sc-modal-title { font-size: 18px; font-weight: 800; }
        .sc-modal-close { background: none; border: none; color: rgba(255,255,255,0.6); font-size: 20px; cursor: pointer; }
        .sc-form-group { margin-bottom: 14px; }
        .sc-form-group label { display: block; font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.7); margin-bottom: 6px; }
        .sc-input { width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 10px 14px; color: #fff; font-size: 14px; outline: none; }
        .sc-input:focus { border-color: #ffc814; }

        @media (max-width: 768px) {
          .sc-online-hero { grid-template-columns: 1fr; text-align: center; gap: 24px; padding-top: 24px; }
          .sc-hero-sub { margin-left: auto; margin-right: auto; }
          .sc-hero-btns { justify-content: center; }
          .sc-hero-pills { justify-content: center; }
          .sc-hero-stage { width: 290px; height: 290px; margin: 0 auto; }
          .sc-hero-circle-img { width: 210px; height: 210px; }
          .sc-hero-text-ring { width: 290px; height: 290px; }
          .sc-hero-card { left: 50%; transform: translateX(-50%); bottom: -15px; width: 90%; max-width: 240px; }
          .sc-online-nav { display: none; }
          .sc-category-pills { justify-content: flex-start; }
        }
      `}</style>

      <div className="sc-online-app">
        <header className="sc-online-header">
          <div className="sc-online-logo">
            <img src="/smack-chicken-logo-white.png" alt="Smack Chicken" />
          </div>
          <nav className="sc-online-nav">
            <a href="#hero">Destaques</a>
            <a href="#menu">Cardapio</a>
            <a href="#tracking" onClick={(e) => { e.preventDefault(); setShowTrackingModal(true); }}>Acompanhar pedido</a>
          </nav>
          <button className="sc-cart-btn" onClick={() => setShowCartModal(true)}>
            <span>Meu pedido</span>
            <span className="sc-cart-badge">{cartItemCount}</span>
          </button>
        </header>

        <section className="sc-online-hero" id="hero">
          <div>
            <span className="sc-hero-badge">● CARDAPIO ONLINE · FACA SEU PEDIDO</span>
            <h1 className="sc-hero-title">
              Crocante por fora.
              <br />
              <em>Irresistivel</em> por dentro.
            </h1>
            <p className="sc-hero-sub">
              Tiras e coxinhas da asa empanadas na hora e douradas no ponto certo. Escolha, monte seu balde e retire no Estreito!
            </p>
            <div className="sc-hero-btns">
              <a href="#menu" className="btn-gold">
                Ver cardapio <span>→</span>
              </a>
              <button className="btn-outline" onClick={() => setShowTrackingModal(true)}>
                Acompanhar pedido
              </button>
            </div>
            <div className="sc-hero-pills">
              <span>🔥 Feito na hora</span>
              <span>🥣 Ate 2 molhos gratis</span>
              <span>📍 Rua Fulvio Aducci, 1074</span>
            </div>
          </div>

          <div className="sc-hero-stage">
            <div className="sc-hero-circle-img">
              <img src="/combo-mesa.jpeg" alt="Balde de frango crocante da SMACK CHICKEN" />
            </div>

            <svg className="sc-hero-text-ring" viewBox="0 0 500 500">
              <path
                id="heroCirclePathApp"
                d="M 250, 250 m -185, 0 a 185,185 0 1,1 370,0 a 185,185 0 1,1 -370,0"
                fill="none"
              />
              <text fill="#ffffff" opacity="0.65" fontSize="13" fontWeight="800" letterSpacing="4.5">
                <textPath href="#heroCirclePathApp">
                  • SMACK CHICKEN • FRANGO CROCANTE • FEITO NA HORA • CROCANTE POR FORA
                </textPath>
              </text>
            </svg>

            <div className="sc-hero-icon icon-top">🍗</div>
            <div className="sc-hero-icon icon-bottom">🍗</div>

            <div className="sc-hero-card">
              <span className="sc-hero-card-tag">🔥 MAIS PEDIDO</span>
              <strong>Baldinho P 250 g</strong>
              <small>Tiras crocantes</small>
              <div className="sc-hero-card-foot">
                <b>R$ 26,99</b>
                <div className="qty-ctrl">
                  <button onClick={() => updateQuantity(1, -1)}>-</button>
                  <span>{cart.find((i) => i.product.id === 1)?.quantity || 1}</span>
                  <button onClick={() => updateQuantity(1, 1)}>+</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="sc-menu-section" id="menu">
          <h2 className="sc-menu-title">Cardapio Online</h2>
          <div className="sc-category-pills">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`sc-category-pill${selectedCategory === cat ? " active" : ""}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="sc-products-grid">
            {filteredProducts.map((product) => (
              <div key={product.id} className="sc-product-card">
                <div className="sc-product-img">
                  <img src={product.image || "/smack-chicken-mark.png"} alt={product.name} />
                </div>
                <div className="sc-product-body">
                  <div className="sc-product-name">{product.name}</div>
                  <div className="sc-product-desc">{product.description}</div>
                  <div className="sc-product-foot">
                    <span className="sc-product-price">{formatMoney(product.priceCents)}</span>
                    <button className="btn-add" onClick={() => addToCart(product)}>
                      + Adicionar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {cartItemCount > 0 && (
          <div className="sc-sticky-bar" onClick={() => setShowCartModal(true)}>
            <div className="sc-sticky-left">
              <span className="sc-sticky-count">{cartItemCount}</span>
              <span>Ver pedido</span>
            </div>
            <span className="sc-sticky-total">{formatMoney(cartTotalCents)}</span>
          </div>
        )}

        {showCartModal && (
          <div className="sc-modal-overlay" onClick={() => setShowCartModal(false)}>
            <div className="sc-modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="sc-modal-head">
                <span className="sc-modal-title">Seu Pedido</span>
                <button className="sc-modal-close" onClick={() => setShowCartModal(false)}>✕</button>
              </div>

              {completedOrderCode ? (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                  <h3 style={{ fontSize: 20, color: "#ffc814", marginBottom: 8 }}>Pedido Confirmado!</h3>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", marginBottom: 16 }}>
                    Seu pedido <strong style={{ color: "#fff" }}>#{completedOrderCode}</strong> foi enviado para a cozinha.
                  </p>
                  <button className="btn-gold" style={{ width: "100%" }} onClick={() => { setCompletedOrderCode(null); setShowCartModal(false); }}>
                    Fechar
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitOrder}>
                  {cart.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "30px 0", color: "rgba(255,255,255,0.5)" }}>
                      Seu carrinho esta vazio
                    </div>
                  ) : (
                    <>
                      <div style={{ marginBottom: 20 }}>
                        {cart.map((item) => (
                          <div key={item.product.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14 }}>{item.product.name}</div>
                              <div style={{ fontSize: 12, color: "#ffc814" }}>{formatMoney(item.product.priceCents * item.quantity)}</div>
                            </div>
                            <div className="qty-ctrl">
                              <button type="button" onClick={() => updateQuantity(item.product.id, -1)}>-</button>
                              <span>{item.quantity}</span>
                              <button type="button" onClick={() => updateQuantity(item.product.id, 1)}>+</button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="sc-form-group">
                        <label>Seu Nome</label>
                        <input className="sc-input" placeholder="Digite seu nome" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
                      </div>

                      <div className="sc-form-group">
                        <label>WhatsApp / Celular</label>
                        <input className="sc-input" placeholder="(48) 99999-9999" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} required />
                      </div>

                      <div className="sc-form-group">
                        <label>Forma de Entrega</label>
                        <div style={{ display: "flex", gap: 10 }}>
                          <button type="button" className={`btn-outline${deliveryType === "RETIRADA" ? " active" : ""}`} style={{ flex: 1, borderColor: deliveryType === "RETIRADA" ? "#ffc814" : undefined }} onClick={() => setDeliveryType("RETIRADA")}>🛍️ Retirada Balcao</button>
                          <button type="button" className={`btn-outline${deliveryType === "ENTREGA" ? " active" : ""}`} style={{ flex: 1, borderColor: deliveryType === "ENTREGA" ? "#ffc814" : undefined }} onClick={() => setDeliveryType("ENTREGA")}>🛵 Tele-Entrega</button>
                        </div>
                      </div>

                      {deliveryType === "ENTREGA" && (
                        <div className="sc-form-group">
                          <label>Endereco de Entrega</label>
                          <input className="sc-input" placeholder="Rua, Numero, Bairro e Ponto de Referencia" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} required />
                        </div>
                      )}

                      <div className="sc-form-group">
                        <label>Forma de Pagamento</label>
                        <select className="sc-input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                          <option value="Pix">⚡ PIX</option>
                          <option value="Cartao">💳 Cartao na Entrega</option>
                          <option value="Dinheiro">💵 Dinheiro</option>
                        </select>
                      </div>

                      <button type="submit" className="btn-gold" style={{ width: "100%", marginTop: 14 }} disabled={submitting}>
                        {submitting ? "Enviando..." : `Confirmar Pedido · ${formatMoney(cartTotalCents)}`}
                      </button>
                    </>
                  )}
                </form>
              )}
            </div>
          </div>
        )}

        {showTrackingModal && (
          <div className="sc-modal-overlay" onClick={() => setShowTrackingModal(false)}>
            <div className="sc-modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="sc-modal-head">
                <span className="sc-modal-title">Acompanhar Pedido</span>
                <button className="sc-modal-close" onClick={() => setShowTrackingModal(false)}>✕</button>
              </div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 16 }}>
                Digite o numero do seu WhatsApp para consultar o andamento do seu pedido:
              </p>
              <input className="sc-input" placeholder="(48) 99999-9999" style={{ marginBottom: 14 }} />
              <button className="btn-gold" style={{ width: "100%" }} onClick={() => alert("Consulta realizada! Seu pedido esta em preparo.")}>
                Consultar Pedido
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
