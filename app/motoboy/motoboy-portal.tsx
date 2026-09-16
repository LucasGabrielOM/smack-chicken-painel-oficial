"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { formatMoney } from "../../lib/catalog";
import type { Motoboy } from "../../lib/motoboy-store";

type OrderItem = { id: string; productId: string; name: string; quantity: number; unitPriceCents: number };

type Order = {
  id: string;
  code: string;
  customerName: string;
  status: "preparing" | "ready" | "completed" | "cancelled";
  paymentMethod: string;
  totalCents: number;
  discountCents?: number;
  channel: string;
  createdAt: string;
  items: OrderItem[];
  notes: string | null;
};

function fmtCode(code: string) {
  if (!code) return "";
  return code.startsWith("#") ? code : `#${code}`;
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function parseOrderDetails(order: Order) {
  const parts = (order.notes || "").split("|").map((p) => p.trim()).filter(Boolean);
  let phone: string | null = null;
  let deliveryType: string | null = null;
  let address: string | null = null;
  let paymentInfo: string | null = null;
  let motoboyName: string | null = null;
  let checkedInAt: string | null = null;
  let deliveredAt: string | null = null;

  for (const part of parts) {
    if (/^whatsapp:\s*/i.test(part) || /^tel:\s*/i.test(part) || /^telefone:\s*/i.test(part)) {
      phone = part.replace(/^(whatsapp|tel|telefone):\s*/i, "").trim();
    } else if (/^modalidade:\s*/i.test(part)) {
      deliveryType = part.replace(/^modalidade:\s*/i, "").trim();
    } else if (/^endereço:\s*/i.test(part) || /^endereco:\s*/i.test(part)) {
      address = part.replace(/^endere[cç]o:\s*/i, "").trim();
    } else if (/^pagamento:\s*/i.test(part)) {
      paymentInfo = part.replace(/^pagamento:\s*/i, "").trim();
    } else if (/^motoboy:\s*/i.test(part) || /^entregador:\s*/i.test(part)) {
      motoboyName = part.replace(/^(motoboy|entregador):\s*/i, "").trim();
    } else if (/^sa[íi]da:\s*/i.test(part) || /^check-?in:\s*/i.test(part)) {
      checkedInAt = part.replace(/^(sa[íi]da|check-?in):\s*/i, "").trim();
    } else if (/^entregue [àa]s:\s*/i.test(part) || /^check-?out:\s*/i.test(part)) {
      deliveredAt = part.replace(/^(entregue [àa]s|check-?out):\s*/i, "").trim();
    } else if (/^levar troco de:\s*/i.test(part)) {
      paymentInfo = paymentInfo ? `${paymentInfo} (${part})` : part;
    }
  }

  return {
    phone,
    deliveryType,
    address,
    paymentInfo,
    motoboyName,
    checkedInAt,
    deliveredAt,
  };
}

export default function MotoboyPortal() {
  const [motoboys, setMotoboys] = useState<Motoboy[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Motoboy | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<"pending" | "in_route" | "completed">("pending");
  const [toast, setToast] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try { navigator.vibrate(100); } catch {}
    }
    setTimeout(() => setToast(""), 3500);
  };

  // Carrega lista de motoboys cadastrados
  const loadMotoboys = useCallback(async () => {
    try {
      const res = (await fetch("/api/motoboys").then((r) => r.json())) as { ok: boolean; motoboys: Motoboy[] };
      if (res.ok && Array.isArray(res.motoboys)) {
        setMotoboys(res.motoboys);
        const savedId = localStorage.getItem("smack_driver_id");
        if (savedId) {
          const found = res.motoboys.find((m: Motoboy) => m.id === savedId);
          if (found) setSelectedDriver(found);
        } else if (res.motoboys.length === 1) {
          setSelectedDriver(res.motoboys[0]);
          localStorage.setItem("smack_driver_id", res.motoboys[0].id);
        }
      }
    } catch (e) {
      console.warn("Erro ao carregar motoboys:", e);
    }
  }, []);

  // Carrega lista de pedidos
  const loadOrders = useCallback(async () => {
    try {
      const res = (await fetch("/api/orders").then((r) => r.json())) as { orders: Order[] };
      if (res.orders && Array.isArray(res.orders)) {
        setOrders(res.orders);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadMotoboys();
    loadOrders();
    const interval = setInterval(loadOrders, 6000);
    return () => clearInterval(interval);
  }, [loadMotoboys, loadOrders]);

  const handleSelectDriver = (m: Motoboy) => {
    setSelectedDriver(m);
    try {
      localStorage.setItem("smack_driver_id", m.id);
    } catch {}
    notify(`Bem-vindo, ${m.name}! Pronto para as entregas.`);
  };

  const handleSwitchDriver = () => {
    setSelectedDriver(null);
    try {
      localStorage.removeItem("smack_driver_id");
    } catch {}
  };

  // Filtra pedidos de entrega
  const deliveryOrders = useMemo(() => {
    return orders.filter((o) => {
      const parsed = parseOrderDetails(o);
      return (
        (parsed.deliveryType && parsed.deliveryType.toLowerCase().includes("entrega")) ||
        Boolean(parsed.address) ||
        Boolean(parsed.motoboyName)
      );
    });
  }, [orders]);

  // Pedidos aguardando retirada na loja
  const pendingOrders = useMemo(() => {
    return deliveryOrders.filter((o) => {
      const parsed = parseOrderDetails(o);
      return (o.status === "preparing" || o.status === "ready") && !parsed.checkedInAt;
    });
  }, [deliveryOrders]);

  // Pedidos em rota com o motoboy atual
  const inRouteOrders = useMemo(() => {
    if (!selectedDriver) return [];
    return deliveryOrders.filter((o) => {
      const parsed = parseOrderDetails(o);
      const isMyOrder =
        parsed.motoboyName?.toLowerCase() === selectedDriver.name.toLowerCase() ||
        parsed.motoboyName?.toLowerCase().includes(selectedDriver.name.toLowerCase());
      return o.status === "ready" && Boolean(parsed.checkedInAt) && !parsed.deliveredAt && isMyOrder;
    });
  }, [deliveryOrders, selectedDriver]);

  // Pedidos entregues hoje pelo motoboy atual
  const completedToday = useMemo(() => {
    if (!selectedDriver) return [];
    return deliveryOrders.filter((o) => {
      const parsed = parseOrderDetails(o);
      const isMyOrder =
        parsed.motoboyName?.toLowerCase() === selectedDriver.name.toLowerCase() ||
        parsed.motoboyName?.toLowerCase().includes(selectedDriver.name.toLowerCase());
      return (o.status === "completed" || Boolean(parsed.deliveredAt)) && isMyOrder;
    });
  }, [deliveryOrders, selectedDriver]);

  // Ação: Check-in na Loja (Sair para entrega)
  const handleCheckin = async (order: Order) => {
    if (!selectedDriver) return;
    setUpdatingId(order.id);
    const nowTime = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    let notes = order.notes || "";
    if (!notes.toLowerCase().includes("motoboy:")) {
      notes += ` | Motoboy: ${selectedDriver.name}`;
    }
    if (!notes.toLowerCase().includes("saída:") && !notes.toLowerCase().includes("saida:")) {
      notes += ` | Saída: ${nowTime}`;
    }

    try {
      const res = (await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ready", notes }),
      }).then((r) => r.json())) as { ok: boolean };

      if (res.ok) {
        notify(`Check-in confirmado! Pedido ${fmtCode(order.code)} em rota.`);
        setActiveTab("in_route");
        await loadOrders();
      } else {
        notify("Falha ao registrar check-in.");
      }
    } catch {
      notify("Erro de conexão.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Ação: Check-out no Cliente (Confirmar Entrega)
  const handleCheckout = async (order: Order) => {
    if (!selectedDriver) return;
    setUpdatingId(order.id);
    const parsed = parseOrderDetails(order);
    const nowTime = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    let notes = order.notes || "";
    if (!notes.toLowerCase().includes("entregue às:") && !notes.toLowerCase().includes("entregue as:")) {
      notes += ` | Entregue às: ${nowTime}`;
    }

    try {
      const res = (await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed", notes }),
      }).then((r) => r.json())) as { ok: boolean };

      if (res.ok) {
        notify(`Entrega concluída! Pedido ${fmtCode(order.code)}.`);
        await loadOrders();

        // Notificação no WhatsApp do Cliente
        if (parsed.phone) {
          const cleanPhone = parsed.phone.replace(/\D/g, "");
          const waNumber = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
          const msg = `Olá ${order.customerName}! Seu pedido ${fmtCode(order.code)} do Smack Chicken acabou de ser entregue por mim (${selectedDriver.name}) às ${nowTime}! Desejamos um excelente apetite! 🍗😋`;
          const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;
          window.open(waUrl, "_blank");
        }
      } else {
        notify("Falha ao registrar entrega.");
      }
    } catch {
      notify("Erro de conexão.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Se o entregador ainda não foi selecionado, exibe tela de identificação
  if (!selectedDriver) {
    return (
      <div style={{ minHeight: "100vh", background: "#141110", color: "#F5EDE8", fontFamily: "Inter, sans-serif", padding: "30px 20px" }}>
        <div style={{ maxWidth: 440, margin: "40px auto 0", textAlign: "center" }}>
          <img
            src="/smack-chicken-logo-white.png"
            alt="Smack Chicken"
            style={{ height: 38, width: "auto", margin: "0 auto 16px", objectFit: "contain" }}
            onError={(e) => { (e.target as HTMLImageElement).src = "/smack-chicken-logo.png"; }}
          />
          <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.5px", marginBottom: 6 }}>
            Portal do Entregador 🛵
          </h1>
          <p style={{ fontSize: 13, color: "#A89C96", marginBottom: 30 }}>
            Selecione seu nome para gerenciar suas coletas e entregas
          </p>

          <div style={{ background: "#211B19", border: "1px solid #38302D", borderRadius: 16, padding: 24, boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#D1C7C2", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 14 }}>
              Quem é você hoje?
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {motoboys.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleSelectDriver(m)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "#2D2522",
                    border: "1.5px solid #453A36",
                    borderRadius: 12,
                    padding: "16px 20px",
                    color: "#FFFFFF",
                    fontSize: 16,
                    fontWeight: 800,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    textAlign: "left",
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.borderColor = "#B70922"; e.currentTarget.style.background = "#352A26"; }}
                  onMouseOut={(e) => { e.currentTarget.style.borderColor = "#453A36"; e.currentTarget.style.background = "#2D2522"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 24 }}>🛵</span>
                    <div>
                      <div>{m.name}</div>
                      <div style={{ fontSize: 11, color: "#A89C96", fontWeight: 500 }}>
                        {m.vehicle || "Moto"} {m.phone ? `· ${m.phone}` : ""}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 18, color: "#B70922" }}>➔</span>
                </button>
              ))}

              {motoboys.length === 0 && (
                <div style={{ color: "#A89C96", fontSize: 13, padding: 20 }}>
                  Carregando entregadores cadastrados...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#171312", color: "#F5EDE8", fontFamily: "Inter, sans-serif", paddingBottom: 60 }}>
      {/* HEADER FIXO MOBILE */}
      <header
        style={{
          background: "#211B19",
          borderBottom: "1px solid #332B28",
          padding: "12px 18px",
          position: "sticky",
          top: 0,
          zIndex: 100,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img
            src="/smack-chicken-mark.png"
            alt="Smack Chicken"
            style={{ width: 28, height: 28, objectFit: "contain" }}
          />
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#FFFFFF", display: "flex", alignItems: "center", gap: 6 }}>
              <span>{selectedDriver.name}</span>
              <span style={{ background: "#16A34A", width: 8, height: 8, borderRadius: "50%", display: "inline-block" }} />
            </div>
            <div style={{ fontSize: 10, color: "#FFC814", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
              Entregador Ativo
            </div>
          </div>
        </div>

        <button
          onClick={handleSwitchDriver}
          style={{
            background: "none",
            border: "1px solid #453A36",
            borderRadius: 8,
            color: "#A89C96",
            padding: "5px 10px",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          Trocar
        </button>
      </header>

      {/* ABAS SUPERIORES */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          background: "#1E1816",
          borderBottom: "1px solid #332B28",
          position: "sticky",
          top: 53,
          zIndex: 90,
        }}
      >
        <button
          onClick={() => setActiveTab("pending")}
          style={{
            padding: "12px 6px",
            border: "none",
            background: activeTab === "pending" ? "#2B211E" : "transparent",
            color: activeTab === "pending" ? "#FFC814" : "#A89C96",
            borderBottom: activeTab === "pending" ? "3px solid #FFC814" : "3px solid transparent",
            fontWeight: 800,
            fontSize: 12,
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          Retirar ({pendingOrders.length})
        </button>
        <button
          onClick={() => setActiveTab("in_route")}
          style={{
            padding: "12px 6px",
            border: "none",
            background: activeTab === "in_route" ? "#2B211E" : "transparent",
            color: activeTab === "in_route" ? "#38BDF8" : "#A89C96",
            borderBottom: activeTab === "in_route" ? "3px solid #38BDF8" : "3px solid transparent",
            fontWeight: 800,
            fontSize: 12,
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          Em Rota ({inRouteOrders.length})
        </button>
        <button
          onClick={() => setActiveTab("completed")}
          style={{
            padding: "12px 6px",
            border: "none",
            background: activeTab === "completed" ? "#2B211E" : "transparent",
            color: activeTab === "completed" ? "#4ADE80" : "#A89C96",
            borderBottom: activeTab === "completed" ? "3px solid #4ADE80" : "3px solid transparent",
            fontWeight: 800,
            fontSize: 12,
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          Entregues ({completedToday.length})
        </button>
      </div>

      {/* CONTEÚDO PRINCIPAL */}
      <main style={{ maxWidth: 600, margin: "0 auto", padding: "16px" }}>
        {/* ABA: AGUARDANDO RETIRADA NA LOJA */}
        {activeTab === "pending" && (
          <div>
            <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#D1C7C2" }}>
                Pedidos para Coleta na Loja
              </span>
              <span style={{ fontSize: 11, color: "#A89C96" }}>
                Auto-atualiza a cada 6s
              </span>
            </div>

            {pendingOrders.length === 0 ? (
              <div style={{ background: "#211B19", border: "1px solid #332B28", borderRadius: 14, padding: "40px 20px", textAlign: "center" }}>
                <span style={{ fontSize: 36, display: "block", marginBottom: 10 }}>📦</span>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#FFFFFF" }}>Nenhum pedido aguardando saída</div>
                <div style={{ fontSize: 12, color: "#A89C96", marginTop: 4 }}>
                  Assim que a cozinha liberar um pedido de entrega, ele aparecerá aqui para você fazer o check-in.
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {pendingOrders.map((order) => {
                  const parsed = parseOrderDetails(order);
                  const isUpdating = updatingId === order.id;

                  return (
                    <div
                      key={order.id}
                      style={{
                        background: "#211B19",
                        border: "1.5px solid #38302D",
                        borderLeft: "5px solid #FFC814",
                        borderRadius: 14,
                        padding: 16,
                        boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 18, fontWeight: 900, color: "#FFFFFF" }}>{fmtCode(order.code)}</span>
                        <span style={{ background: "#FEF3C7", color: "#92400E", fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 99 }}>
                          {fmtTime(order.createdAt)}
                        </span>
                      </div>

                      <div style={{ fontSize: 14, fontWeight: 800, color: "#F5EDE8", marginBottom: 4 }}>
                        👤 {order.customerName}
                      </div>

                      {parsed.address ? (
                        <div style={{ background: "#2B221F", padding: "10px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700, color: "#FBBF24", margin: "8px 0", lineHeight: 1.4 }}>
                          📍 {parsed.address}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: "#A89C96", margin: "6px 0" }}>
                          📍 Retirada / Endereço não informado
                        </div>
                      )}

                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#D1C7C2", borderTop: "1px solid #332B28", paddingTop: 10, marginTop: 8 }}>
                        <span>Pagamento: <strong>{parsed.paymentInfo || order.paymentMethod}</strong></span>
                        <span style={{ fontSize: 14, fontWeight: 900, color: "#FFFFFF" }}>{formatMoney(order.totalCents)}</span>
                      </div>

                      {/* BOTÃO PRINCIPAL DE CHECK-IN */}
                      <button
                        onClick={() => handleCheckin(order)}
                        disabled={isUpdating}
                        style={{
                          width: "100%",
                          marginTop: 12,
                          background: "#B70922",
                          color: "#FFFFFF",
                          border: "none",
                          borderRadius: 10,
                          padding: "14px",
                          fontSize: 14,
                          fontWeight: 800,
                          cursor: isUpdating ? "wait" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          boxShadow: "0 4px 12px rgba(183,9,34,0.4)",
                        }}
                      >
                        {isUpdating ? "Registrando saída..." : "🛵 Fazer Check-in (Pegar e Sair)"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ABA: EM ROTA COM O MOTOBOY ATUAL */}
        {activeTab === "in_route" && (
          <div>
            <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#38BDF8" }}>
                Em Rota com {selectedDriver.name}
              </span>
              <span style={{ fontSize: 11, color: "#A89C96" }}>
                {inRouteOrders.length} pedido(s) em trânsito
              </span>
            </div>

            {inRouteOrders.length === 0 ? (
              <div style={{ background: "#211B19", border: "1px solid #332B28", borderRadius: 14, padding: "40px 20px", textAlign: "center" }}>
                <span style={{ fontSize: 36, display: "block", marginBottom: 10 }}>🛵💨</span>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#FFFFFF" }}>Você não está com nenhum pedido em rota</div>
                <div style={{ fontSize: 12, color: "#A89C96", marginTop: 4 }}>
                  Vá até a aba "Retirar" para fazer o check-in dos pedidos que estão prontos na loja.
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {inRouteOrders.map((order) => {
                  const parsed = parseOrderDetails(order);
                  const isUpdating = updatingId === order.id;

                  const mapsUrl = parsed.address
                    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parsed.address)}`
                    : null;
                  const wazeUrl = parsed.address
                    ? `https://waze.com/ul?q=${encodeURIComponent(parsed.address)}`
                    : null;

                  const cleanPhone = parsed.phone ? parsed.phone.replace(/\D/g, "") : null;
                  const waNumber = cleanPhone ? (cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone) : null;
                  const waUrl = waNumber
                    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(`Olá ${order.customerName}, aqui é o ${selectedDriver.name}, motoboy do Smack Chicken! Estou a caminho com o seu pedido ${fmtCode(order.code)}!`)}`
                    : null;

                  return (
                    <div
                      key={order.id}
                      style={{
                        background: "#211B19",
                        border: "2px solid #0284C7",
                        borderRadius: 16,
                        padding: 18,
                        boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div>
                          <span style={{ fontSize: 20, fontWeight: 900, color: "#FFFFFF" }}>{fmtCode(order.code)}</span>
                          {parsed.checkedInAt && (
                            <span style={{ fontSize: 11, color: "#38BDF8", marginLeft: 8, fontWeight: 700 }}>
                              Saída: {parsed.checkedInAt}
                            </span>
                          )}
                        </div>
                        <span style={{ background: "#0369A1", color: "#FFFFFF", fontSize: 11, fontWeight: 900, padding: "3px 10px", borderRadius: 99 }}>
                          EM ROTA
                        </span>
                      </div>

                      <div style={{ fontSize: 15, fontWeight: 800, color: "#FFFFFF", marginBottom: 4 }}>
                        👤 {order.customerName}
                      </div>

                      {/* CARD DO ENDEREÇO COM DESTAQUE */}
                      {parsed.address && (
                        <div
                          style={{
                            background: "#192633",
                            border: "1px solid #0369A1",
                            padding: "12px 14px",
                            borderRadius: 10,
                            margin: "10px 0",
                          }}
                        >
                          <div style={{ fontSize: 11, fontWeight: 800, color: "#38BDF8", textTransform: "uppercase", marginBottom: 3 }}>
                            Endereço de Entrega:
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "#FFFFFF", lineHeight: 1.4 }}>
                            {parsed.address}
                          </div>
                        </div>
                      )}

                      {/* VALOR E FORMA DE PAGAMENTO */}
                      <div style={{ background: "#2B221F", padding: "10px 12px", borderRadius: 8, margin: "10px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 11, color: "#A89C96" }}>Forma de Pagamento:</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "#FFC814" }}>
                            {parsed.paymentInfo || order.paymentMethod}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 11, color: "#A89C96" }}>Total a Cobrar:</div>
                          <div style={{ fontSize: 17, fontWeight: 900, color: "#FFFFFF" }}>
                            {formatMoney(order.totalCents)}
                          </div>
                        </div>
                      </div>

                      {/* BOTÕES DE NAVEGAÇÃO GPS E CONTATO */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "12px 0" }}>
                        {mapsUrl && (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              background: "#2563EB",
                              color: "#FFFFFF",
                              padding: "12px",
                              borderRadius: 10,
                              textDecoration: "none",
                              fontSize: 13,
                              fontWeight: 800,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                            }}
                          >
                            🗺️ Google Maps
                          </a>
                        )}

                        {wazeUrl && (
                          <a
                            href={wazeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              background: "#0284C7",
                              color: "#FFFFFF",
                              padding: "12px",
                              borderRadius: 10,
                              textDecoration: "none",
                              fontSize: 13,
                              fontWeight: 800,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                            }}
                          >
                            🚙 Waze
                          </a>
                        )}

                        {waUrl && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              gridColumn: "span 2",
                              background: "#16A34A",
                              color: "#FFFFFF",
                              padding: "12px",
                              borderRadius: 10,
                              textDecoration: "none",
                              fontSize: 13,
                              fontWeight: 800,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                            }}
                          >
                            💬 Falar no WhatsApp do Cliente
                          </a>
                        )}
                      </div>

                      {/* BOTÃO PRINCIPAL DE CHECK-OUT */}
                      <button
                        onClick={() => handleCheckout(order)}
                        disabled={isUpdating}
                        style={{
                          width: "100%",
                          marginTop: 8,
                          background: "#15803D",
                          color: "#FFFFFF",
                          border: "none",
                          borderRadius: 12,
                          padding: "16px",
                          fontSize: 15,
                          fontWeight: 900,
                          cursor: isUpdating ? "wait" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          boxShadow: "0 6px 16px rgba(21,128,61,0.4)",
                        }}
                      >
                        {isUpdating ? "Confirmando entrega..." : "✅ Fazer Check-out (Confirmar Entrega)"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ABA: MINHAS ENTREGAS DE HOJE */}
        {activeTab === "completed" && (
          <div>
            <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#4ADE80" }}>
                Entregas Concluídas Hoje por {selectedDriver.name}
              </span>
              <span style={{ fontSize: 12, fontWeight: 900, color: "#FFFFFF" }}>
                Total: {completedToday.length}
              </span>
            </div>

            {completedToday.length === 0 ? (
              <div style={{ background: "#211B19", border: "1px solid #332B28", borderRadius: 14, padding: "40px 20px", textAlign: "center" }}>
                <span style={{ fontSize: 36, display: "block", marginBottom: 10 }}>🏁</span>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#FFFFFF" }}>Nenhuma entrega finalizada ainda hoje</div>
                <div style={{ fontSize: 12, color: "#A89C96", marginTop: 4 }}>
                  As entregas que você fizer check-out com sucesso serão listadas aqui.
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {completedToday.map((order) => {
                  const parsed = parseOrderDetails(order);

                  return (
                    <div
                      key={order.id}
                      style={{
                        background: "#211B19",
                        border: "1px solid #2B3B2E",
                        borderLeft: "4px solid #16A34A",
                        borderRadius: 12,
                        padding: 14,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 900, color: "#FFFFFF" }}>{fmtCode(order.code)}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "#4ADE80" }}>{formatMoney(order.totalCents)}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "#D1C7C2" }}>👤 {order.customerName}</div>
                      {parsed.address && (
                        <div style={{ fontSize: 11.5, color: "#A89C96", marginTop: 2 }}>📍 {parsed.address}</div>
                      )}
                      <div style={{ fontSize: 11, color: "#16A34A", fontWeight: 700, marginTop: 6, display: "flex", gap: 12 }}>
                        {parsed.checkedInAt && <span>Saída: {parsed.checkedInAt}</span>}
                        {parsed.deliveredAt && <span>Entregue: {parsed.deliveredAt}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* TOAST FLUTUANTE */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1E1816",
            border: "1.5px solid #FFC814",
            color: "#FFFFFF",
            padding: "12px 24px",
            borderRadius: 99,
            fontSize: 13.5,
            fontWeight: 800,
            zIndex: 999,
            boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
            whiteSpace: "nowrap",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
