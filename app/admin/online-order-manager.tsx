"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatMoney, catalog, CatalogProduct } from "../../lib/catalog";
import type { DeliverySettings, SaveProductInput } from "../../lib/product-store";
import type { DeliveryTier } from "../../lib/delivery";

type View = "orders" | "expedicao" | "motoboy" | "cardapio" | "delivery" | "relatorios" | "settings";

type OrderItem = { id: string; productId: string; name: string; quantity: number; unitPriceCents: number };

type Order = {
  id: string; code: string; customerName: string;
  status: "preparing" | "ready" | "completed" | "cancelled";
  paymentMethod: string; cashReceivedCents?: number; totalCents: number;
  discountCents?: number; splitCount?: number; channel: string;
  notes?: string; createdAt: string; readyAt?: string; completedAt?: string;
  items: OrderItem[];
};

const api = async <T,>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers || {}) } });
  const payload = (await response.json()) as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error || "Erro ao concluir a acao");
  return payload as T;
};

const STATUS_COLOR: Record<Order["status"], string> = {
  preparing: "#e67e00", ready: "#1a7fe8", completed: "#17a35c", cancelled: "#9b1c1c"
};

function elapsed(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "< 1 min";
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function statusLabel(s: Order["status"]) {
  const map = { preparing: "Em Preparo", ready: "Pronto / Em Rota", completed: "Entregue", cancelled: "Cancelado" };
  return map[s] || s;
}

function fmtCode(code: string) {
  if (!code) return "";
  return code.startsWith("#") ? code : `#${code}`;
}

// Chime de Restaurante sintetizado via Web Audio API
function playNewOrderSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    const now = ctx.currentTime;
    const notes = [
      { freq: 587.33, start: 0.0, dur: 0.35 },  // D5
      { freq: 739.99, start: 0.16, dur: 0.35 }, // F#5
      { freq: 880.00, start: 0.32, dur: 0.45 }, // A5
      { freq: 1174.66, start: 0.48, dur: 0.8 }, // D6
    ];
    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.4, now + start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur);
    });
  } catch (err) {
    console.warn("Nao foi possivel tocar o alerta sonoro:", err);
  }
}

// SVG Icons
const IcoOrders = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>);
const IcoQueue = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>);
const IcoMenu = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>);
const IcoChart = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>);
const IcoStar = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>);
const IcoSettings = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>);
const IcoRefresh = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>);
const IcoSearch = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>);
const IcoClose = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>);
const IcoArrow = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>);
const IcoClock = () => (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>);
const IcoWhatsApp = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
);
const IcoAlert = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
);
const IcoPrint = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
);
const IcoTruck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
);
const IcoMotorcycle = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h-3l-3 5h6l3-5z"/><path d="M9 11l-3.5 6.5"/><path d="M15 11l2 6.5"/><path d="M12 6V3"/><path d="M10 3h4"/></svg>
);
const IcoLogout = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
);
const IcoVolume = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
);
const IcoVolumeMute = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
);
const IcoMapPin = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
);
const IcoCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const IcoEdit = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
);
const IcoTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
);
const IcoPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);

type ParsedDetails = {
  phone: string | null;
  phoneFormatted: string | null;
  deliveryType: string | null;
  address: string | null;
  paymentInfo: string | null;
  orderKitchenNotes: string | null;
  allKitchenNotes: string[];
  motoboyName: string | null;
  checkedInAt: string | null;
  deliveredAt: string | null;
};

function parseOrderDetails(order: Order): ParsedDetails {
  const notes = order.notes || "";
  const parts = notes.split("|").map((p) => p.trim()).filter(Boolean);

  let phone: string | null = null;
  let deliveryType: string | null = null;
  let address: string | null = null;
  let paymentInfo: string | null = null;
  let orderKitchenNotes: string | null = null;
  let motoboyName: string | null = null;
  let checkedInAt: string | null = null;
  let deliveredAt: string | null = null;
  const otherParts: string[] = [];

  for (const part of parts) {
    if (/^whatsapp:\s*/i.test(part)) {
      phone = part.replace(/^whatsapp:\s*/i, "").trim();
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
    } else if (/^observa[cç][aã]o:\s*/i.test(part) || /^obs:\s*/i.test(part)) {
      orderKitchenNotes = part.replace(/^(observa[cç][aã]o|obs):\s*/i, "").trim();
    } else if (/^levar troco de:\s*/i.test(part)) {
      paymentInfo = paymentInfo ? `${paymentInfo} (${part})` : part;
    } else {
      otherParts.push(part);
    }
  }

  if (!orderKitchenNotes && otherParts.length > 0) {
    orderKitchenNotes = otherParts.join(" | ");
  }

  const allKitchenNotes: string[] = [];
  if (orderKitchenNotes) {
    allKitchenNotes.push(orderKitchenNotes);
  }

  for (const it of order.items) {
    const match = it.name.match(/(?:Obs|Observação|Observacao):\s*([^\]|]+)/i);
    if (match && match[1]) {
      const base = it.name.replace(/\s*\[.*\]$/, "").trim();
      allKitchenNotes.push(`${it.quantity}x ${base}: ${match[1].trim()}`);
    }
  }

  let phoneFormatted: string | null = null;
  if (phone) {
    const raw = phone.replace(/\D/g, "");
    if (raw.length === 11) {
      phoneFormatted = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
    } else if (raw.length === 10) {
      phoneFormatted = `(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`;
    } else {
      phoneFormatted = phone;
    }
  }

  return {
    phone,
    phoneFormatted,
    deliveryType,
    address,
    paymentInfo,
    orderKitchenNotes,
    allKitchenNotes,
    motoboyName,
    checkedInAt,
    deliveredAt,
  };
}

function parseItemName(fullName: string) {
  const match = fullName.match(/^(.*?)\s*\[(.*)\]$/);
  if (!match) {
    return { title: fullName, customs: [], itemObs: null };
  }
  const title = match[1].trim();
  const rawParts = match[2].split("|").map((p) => p.trim()).filter(Boolean);
  const customs: string[] = [];
  let itemObs: string | null = null;

  for (const p of rawParts) {
    if (/^(?:obs|observa[cç][aã]o):\s*/i.test(p)) {
      itemObs = p.replace(/^(?:obs|observa[cç][aã]o):\s*/i, "").trim();
    } else {
      customs.push(p);
    }
  }

  return { title, customs, itemObs };
}

const Dot = ({ color }: { color: string }) => (<span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background:color, flexShrink:0 }} />);

const ADMIN_CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
.kitchen-alert{background:#fef2f2;border:1.5px solid #f87171;border-radius:8px;padding:12px 14px;margin:14px 0;display:flex;align-items:flex-start;gap:10px}
.kitchen-alert-title{font-size:11px;font-weight:800;color:#991b1b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px}
.kitchen-alert-text{font-size:13.5px;font-weight:700;color:#b91c1c;line-height:1.4}
.obs-pill{display:inline-flex;align-items:center;gap:4px;background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:700}
.whatsapp-btn{display:inline-flex;align-items:center;gap:5px;background:#138c56;color:#fff;border:none;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:700;text-decoration:none;cursor:pointer;transition:background .15s}
.whatsapp-btn:hover{background:#0f6e43}
.adm-shell{display:flex;height:100vh;overflow:hidden;background:#f1ede8;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#1b1715}
.adm-sidebar{width:220px;flex-shrink:0;background:#1d1917;display:flex;flex-direction:column;border-right:1px solid #2c2624;position:relative;transition:width .22s cubic-bezier(0.4, 0, 0.2, 1)}
.adm-sidebar.collapsed{width:68px}
.adm-collapse-btn{position:absolute;right:-11px;top:22px;background:#2c2624;border:1px solid #4a403d;color:#e8e0db;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:20;transition:all .15s}
.adm-collapse-btn:hover{background:#b70922;color:#fff;border-color:#b70922}
.adm-sidebar-logo{padding:18px 18px 14px;border-bottom:1px solid #2c2624;display:flex;flex-direction:column;align-items:flex-start}
.adm-sidebar.collapsed .adm-sidebar-logo{padding:16px 12px;align-items:center}
.adm-sidebar.collapsed .adm-logo-full{display:none}
.adm-sidebar.collapsed .adm-logo-mini{display:block}
.adm-logo-mini{display:none;width:32px;height:32px;object-fit:contain}
.adm-sidebar.collapsed .adm-logo-subtitle{display:none}
.adm-sidebar-nav{flex:1;padding:10px 0;overflow-y:auto}
.adm-nav-item{display:flex;align-items:center;gap:10px;padding:10px 18px;color:#9c918d;font-size:13px;font-weight:500;cursor:pointer;border:none;background:none;width:100%;text-align:left;transition:background .15s,color .15s}
.adm-sidebar.collapsed .adm-nav-item{justify-content:center;padding:12px 0}
.adm-sidebar.collapsed .adm-nav-item span{display:none}
.adm-nav-item:hover{background:#2c2624;color:#e8e0db}
.adm-nav-item.active{background:#b70922;color:#fff}
.adm-sidebar-footer{padding:14px 18px;border-top:1px solid #2c2624}
.adm-sidebar.collapsed .adm-sidebar-footer{padding:12px 8px;display:flex;justify-content:center}
.adm-store-btn{display:flex;align-items:center;justify-content:space-between;gap:8px;background:none;border:1px solid #2c2624;border-radius:8px;padding:8px 12px;width:100%;cursor:pointer;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;transition:all .2s}
.adm-sidebar.collapsed .adm-store-btn{padding:8px;justify-content:center;width:auto}
.adm-sidebar.collapsed .adm-store-label{display:none}
.adm-store-btn.open{border-color:#17a35c;color:#17a35c}
.adm-store-btn.closed{border-color:#9b1c1c;color:#e05c5c}
.adm-sdot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.adm-sdot.open{background:#17a35c;box-shadow:0 0 6px #17a35c}
.adm-sdot.closed{background:#e05c5c}
.adm-main{flex:1;display:flex;flex-direction:column;overflow:hidden}
.adm-topbar{height:56px;background:#fff;border-bottom:1px solid #e6dfd6;display:flex;align-items:center;padding:0 24px;gap:16px;flex-shrink:0}
.adm-topbar-title{font-size:15px;font-weight:700;color:#1b1715;flex:1}
.adm-search-wrap{position:relative}
.adm-search-wrap svg{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#9c918d;pointer-events:none}
.adm-search{border:1px solid #e6dfd6;background:#f5f2ec;border-radius:7px;padding:7px 12px 7px 32px;font-size:13px;color:#1b1715;outline:none;width:220px}
.adm-search::placeholder{color:#b0a49e}
.adm-search:focus{border-color:#b70922;background:#fff}
.adm-icon-btn{background:none;border:1px solid #e6dfd6;border-radius:7px;padding:7px;cursor:pointer;color:#706965;display:flex;align-items:center;transition:all .15s}
.adm-icon-btn:hover{border-color:#b70922;color:#b70922}
.adm-badge{background:#b70922;color:#fff;border-radius:20px;font-size:11px;font-weight:700;padding:1px 7px}
.adm-content{flex:1;overflow-y:auto;padding:24px}
.kanban-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.kanban-col{background:#fff;border-radius:10px;border:1px solid #e6dfd6;overflow:hidden}
.kanban-col-header{padding:12px 16px;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;border-bottom:1px solid #e6dfd6}
.kanban-col-header .cnt{margin-left:auto;background:#f1ede8;color:#706965;border-radius:12px;font-size:11px;padding:1px 8px;font-weight:600}
.kanban-cards{padding:12px;display:flex;flex-direction:column;gap:10px;min-height:120px}
.ocard{background:#fff;border:1px solid #e6dfd6;border-radius:8px;padding:12px;cursor:pointer;transition:box-shadow .15s,border-color .15s;position:relative}
.ocard:hover{box-shadow:0 4px 12px rgba(0,0,0,.08);border-color:#ccc4bb}
.ocard-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.ocard-code{font-size:13px;font-weight:800;color:#1b1715}
.ocard-elapsed{display:flex;align-items:center;gap:4px;font-size:11px;color:#9c918d}
.ocard-customer{font-size:12px;color:#706965;margin-bottom:4px;font-weight:500}
.ocard-preview{font-size:11px;color:#9c918d;margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ocard-footer{display:flex;align-items:center;justify-content:space-between}
.ocard-total{font-size:13px;font-weight:700;color:#1b1715}
.ocard-channel{font-size:10px;background:#f1ede8;color:#706965;border-radius:4px;padding:2px 6px;font-weight:600;text-transform:uppercase;letter-spacing:.4px}
.ocard-bar{position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:8px 0 0 8px}
.btn-primary{background:#b70922;color:#fff;border:none;border-radius:7px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;transition:background .15s}
.btn-primary:hover{background:#820516}
.btn-secondary{background:#f5f2ec;color:#1b1715;border:1px solid #e6dfd6;border-radius:7px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;transition:background .15s}
.btn-secondary:hover{background:#e6dfd6}
.btn-sm{padding:5px 10px !important;font-size:11px !important}
.btn-danger{background:none;border:1px solid #fca5a5;color:#9b1c1c;border-radius:7px;padding:5px 10px;font-size:11px;font-weight:600;cursor:pointer;transition:all .15s}
.btn-danger:hover{background:#9b1c1c;color:#fff;border-color:#9b1c1c}
.exp-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.exp-panel{background:#fff;border-radius:10px;border:1px solid #e6dfd6;overflow:hidden}
.exp-panel-header{padding:14px 18px;border-bottom:1px solid #e6dfd6;display:flex;align-items:center;justify-content:space-between}
.exp-panel-title{font-size:13px;font-weight:700;display:flex;align-items:center;gap:8px}
.exp-list{overflow-y:auto;max-height:calc(100vh - 200px)}
.exp-row{padding:14px 18px;border-bottom:1px solid #f1ede8;cursor:pointer;transition:background .12s}
.exp-row:hover{background:#faf8f6}
.exp-row:last-child{border-bottom:none}
.exp-row-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}
.exp-row-code{font-size:14px;font-weight:800}
.exp-row-time{font-size:11px;color:#9c918d;display:flex;align-items:center;gap:4px}
.exp-row-customer{font-size:12px;color:#706965;margin-bottom:6px}
.exp-row-actions{display:flex;gap:6px}
.catalog-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.ccard{background:#fff;border-radius:10px;border:1px solid #e6dfd6;padding:14px;display:flex;align-items:flex-start;gap:12px;box-shadow:0 1px 3px rgba(0,0,0,.04);transition:box-shadow .15s}
.ccard:hover{box-shadow:0 4px 12px rgba(0,0,0,.08)}
.ccard-img{width:62px;height:62px;border-radius:8px;object-fit:cover;background:#f1ede8;flex-shrink:0;border:1px solid #f1ede8}
.ccard-info{flex:1;min-width:0;display:flex;flex-direction:column}
.ccard-name{font-size:13.5px;font-weight:700;margin-bottom:3px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
.ccard-price{font-size:12.5px;font-weight:700;color:#b70922;margin-bottom:6px}
.ccard-toggle{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:600}
.tpill{width:32px;height:17px;border-radius:99px;position:relative;cursor:pointer;border:none;transition:background .2s;flex-shrink:0}
.tpill-thumb{width:13px;height:13px;border-radius:50%;background:#fff;position:absolute;top:2px;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.2)}
.metrics-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}
.mcard{background:#fff;border:1px solid #e6dfd6;border-radius:10px;padding:18px}
.mcard-label{font-size:11px;font-weight:600;color:#9c918d;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
.mcard-value{font-size:26px;font-weight:800;color:#1b1715;line-height:1}
.mcard-sub{font-size:11px;color:#9c918d;margin-top:4px}
.rcard{background:#fff;border:1px solid #e6dfd6;border-radius:10px;padding:16px;margin-bottom:12px}
.rcard-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.rcard-author{font-size:13px;font-weight:700}
.rcard-date{font-size:11px;color:#9c918d}
.ssection{background:#fff;border:1px solid #e6dfd6;border-radius:10px;padding:20px;margin-bottom:16px}
.ssection-title{font-size:13px;font-weight:700;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #f1ede8;color:#1b1715}
.srow{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f1ede8}
.srow:last-child{border-bottom:none;padding-bottom:0}
.slabel{font-size:13px;font-weight:500}
.shint{font-size:11px;color:#9c918d;margin-top:2px}
.radio-grp{display:flex;gap:8px}
.rbtn{border:1px solid #e6dfd6;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer;background:none;transition:all .15s;color:#706965}
.rbtn.active{background:#b70922;border-color:#b70922;color:#fff}
.modal-overlay{position:fixed;inset:0;background:rgba(27,23,21,.55);display:flex;align-items:center;justify-content:center;z-index:1000;padding:24px}
.modal-box{background:#fff;border-radius:12px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2)}
.modal-header{padding:18px 20px;border-bottom:1px solid #e6dfd6;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:#fff;z-index:1}
.modal-title{font-size:16px;font-weight:800}
.modal-body{padding:20px}
.msect-title{font-size:11px;font-weight:700;color:#9c918d;text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px}
.mrow{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1ede8;font-size:13px}
.mrow:last-child{border-bottom:none}
.mrow-label{color:#706965}
.mrow-val{font-weight:600}
.modal-actions{padding:16px 20px;border-top:1px solid #e6dfd6;display:flex;gap:8px;flex-wrap:wrap}
.sbadge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;border:1px solid transparent}
.adm-toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#1b1715;color:#fff;padding:11px 22px;border-radius:8px;font-size:13px;font-weight:500;z-index:2000;box-shadow:0 4px 16px rgba(0,0,0,.25);pointer-events:none;white-space:nowrap}
.empty-st{text-align:center;padding:40px 20px;color:#9c918d;font-size:13px}
.sec-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
.sec-title{font-size:16px;font-weight:800;color:#1b1715}
.cat-top-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px;flex-wrap:wrap}
.cat-search{border:1px solid #e6dfd6;background:#fff;border-radius:7px;padding:7px 12px;font-size:13px;width:240px;outline:none}
.cat-search:focus{border-color:#b70922}
.cat-pill-bar{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:16px}
.cat-pill{border:1px solid #e6dfd6;background:#fff;border-radius:20px;padding:5px 12px;font-size:12px;font-weight:600;color:#706965;cursor:pointer;white-space:nowrap;transition:all .15s}
.cat-pill.active{background:#b70922;color:#fff;border-color:#b70922}
.ccard-desc{font-size:11px;color:#9c918d;margin-bottom:8px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ccard-actions{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:auto;padding-top:8px;flex-wrap:wrap}
.form-grp{margin-bottom:14px}
.form-lbl{display:block;font-size:12px;font-weight:700;color:#1b1715;margin-bottom:5px}
.form-ctrl{width:100%;border:1px solid #e6dfd6;background:#faf8f6;border-radius:7px;padding:8px 10px;font-size:13px;color:#1b1715;outline:none;box-sizing:border-box}
.form-ctrl:focus{border-color:#b70922;background:#fff}
.form-textarea{min-height:75px;resize:vertical}
.form-2col{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.img-preview{width:80px;height:80px;border-radius:8px;object-fit:cover;background:#f1ede8;border:1px solid #e6dfd6;flex-shrink:0}
.delivery-table{width:100%;border-collapse:collapse;margin-top:12px}
.delivery-table th{background:#faf8f6;padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#706965;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e6dfd6}
.delivery-table td{padding:10px 12px;border-bottom:1px solid #f1ede8;font-size:13px}
/* LOGIN SCREEN */
.adm-login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#181413;padding:20px;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
.adm-login-card{background:#231e1c;border:1px solid #3d3532;border-radius:14px;padding:34px 28px;width:100%;max-width:380px;box-shadow:0 24px 60px rgba(0,0,0,.6);color:#f5ede8;text-align:center}
.adm-login-logo{height:36px;width:auto;margin:0 auto 14px;object-fit:contain}
.adm-login-title{font-size:19px;font-weight:800;letter-spacing:-.2px;color:#fff;margin-bottom:4px}
.adm-login-sub{font-size:12px;color:#a89c96;margin-bottom:22px}
.adm-login-form{display:flex;flex-direction:column;gap:14px;text-align:left}
.adm-login-input{width:100%;border:1px solid #4a403d;background:#171412;border-radius:8px;padding:11px 14px;font-size:14px;color:#fff;outline:none;transition:border-color .15s;box-sizing:border-box}
.adm-login-input:focus{border-color:#b70922}
.adm-login-submit{width:100%;background:#b70922;color:#fff;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;transition:background .15s;margin-top:4px}
.adm-login-submit:hover{background:#93071b}
.adm-login-err{background:#3b1517;border:1px solid #b91c1c;color:#fca5a5;padding:8px 12px;border-radius:6px;font-size:12px;margin-bottom:12px;text-align:center}
.adm-logout-btn{display:flex;align-items:center;gap:8px;background:none;border:none;color:#9c918d;font-size:12px;cursor:pointer;padding:8px 12px;border-radius:6px;width:100%;transition:all .15s;margin-top:6px}
.adm-logout-btn:hover{background:#2c2624;color:#fca5a5}
.adm-sidebar.collapsed .adm-logout-btn{justify-content:center;padding:8px}
.adm-sidebar.collapsed .adm-logout-btn span{display:none}
.adm-sound-btn{display:inline-flex;align-items:center;gap:6px;background:#f5f2ec;border:1px solid #e6dfd6;border-radius:7px;padding:6px 10px;font-size:12px;font-weight:600;color:#706965;cursor:pointer;transition:all .15s}
.adm-sound-btn:hover{border-color:#b70922;color:#b70922}
.adm-sound-btn.active{background:#ebf8f1;color:#138c56;border-color:#c4edd6}

/* MOTOBOY VIEW */
.motoboy-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:12px}
.motoboy-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px}
.motoboy-card{background:#fff;border:1px solid #e6dfd6;border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:12px;box-shadow:0 1px 4px rgba(0,0,0,.04);position:relative}
.motoboy-card.ready{border-left:4px solid #2563eb}
.motoboy-card.preparing{border-left:4px solid #d97706}
.motoboy-card.completed{border-left:4px solid #16a34a;opacity:.9}
.motoboy-badge{display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700}
.motoboy-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:auto;padding-top:12px;border-top:1px solid #f1ede8;align-items:center}
.btn-waze{background:#33ccff;color:#000;border:none;border-radius:6px;padding:6px 10px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:4px;text-decoration:none;cursor:pointer}
.btn-maps{background:#4285f4;color:#fff;border:none;border-radius:6px;padding:6px 10px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:4px;text-decoration:none;cursor:pointer}
.btn-checkout{background:#16a34a;color:#fff;border:none;border-radius:6px;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:background .15s}
.btn-checkout:hover{background:#15803d}
.btn-checkin{background:#2563eb;color:#fff;border:none;border-radius:6px;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:background .15s}
.btn-checkin:hover{background:#1d4ed8}
@media(max-width:900px){.kanban-grid{grid-template-columns:1fr}.exp-grid{grid-template-columns:1fr}.metrics-grid{grid-template-columns:repeat(2,1fr)}.adm-sidebar{width:56px}.adm-nav-item span,.adm-logo-text,.adm-store-label{display:none}.motoboy-grid{grid-template-columns:1fr}}
`;

/* COMPONENTE DE LOGIN PARA PROTEÇÃO DO PAINEL ADMIN */
function AdminLoginScreen({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let storedPwd = "smack2026";
    try {
      storedPwd = localStorage.getItem("smack_admin_pwd") || "smack2026";
    } catch {}

    if (password === storedPwd || password === "smack2026") {
      try {
        localStorage.setItem("smack_admin_auth", "true");
        // Desbloqueia contexto de áudio após interação do usuário
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          ctx.resume();
        }
      } catch {}
      onLogin();
    } else {
      setError("Senha incorreta. Tente novamente.");
    }
  };

  return (
    <div className="adm-login-wrap">
      <div className="adm-login-card">
        <img
          src="/smack-chicken-logo-white.png"
          alt="Smack Chicken"
          className="adm-login-logo"
          onError={(e) => { (e.target as HTMLImageElement).src = "/smack-chicken-logo.png"; }}
        />
        <h1 className="adm-login-title">Painel de Pedidos</h1>
        <p className="adm-login-sub">Acesso restrito à gerência e entregadores</p>

        {error && <div className="adm-login-err">{error}</div>}

        <form className="adm-login-form" onSubmit={handleSubmit}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#d1c7c2", marginBottom: 6 }}>
              Senha de Acesso
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                className="adm-login-input"
                placeholder="Digite a senha do painel..."
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "#9c918d",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          <button type="submit" className="adm-login-submit">
            Entrar no Painel
          </button>
          <div style={{ fontSize: 11, color: "#7a6f69", textAlign: "center", marginTop: 4 }}>
            Senha padrão de acesso: <strong style={{ color: "#d1c7c2" }}>smack2026</strong>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function OnlineOrderManager() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem("smack_admin_auth") === "true";
    } catch {
      return false;
    }
  });

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("smack_sound_enabled");
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  });

  const previousOrderIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      localStorage.setItem("smack_sound_enabled", String(next));
    } catch {}
    if (next) {
      playNewOrderSound();
      notify("Alerta sonoro de pedidos ativado!");
    } else {
      notify("Alerta sonoro de pedidos desativado.");
    }
  };

  const [view, setView] = useState<View>("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [storeOpen, setStoreOpen] = useState(true);
  const [toast, setToast] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paperWidth, setPaperWidth] = useState<58 | 80>(58);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("smack_adm_sidebar_collapsed");
      if (saved === "true") setSidebarCollapsed(true);
    } catch {}
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("smack_adm_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  const notify = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(""), 4000); };

  const loadOrders = useCallback(async () => {
    try {
      const res = await api<{ orders: Order[] }>("/api/orders").catch(() => ({ orders: [] }));
      const newOrders = res.orders || [];

      // Dispara alerta sonoro se chegar pedido novo em preparo
      if (!isFirstLoadRef.current && soundEnabled) {
        const hasBrandNewOrder = newOrders.some(
          (o) => !previousOrderIdsRef.current.has(o.id) && o.status === "preparing"
        );
        if (hasBrandNewOrder) {
          playNewOrderSound();
        }
      }

      previousOrderIdsRef.current = new Set(newOrders.map((o) => o.id));
      isFirstLoadRef.current = false;
      setOrders(newOrders);
    } catch {}
  }, [soundEnabled]);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 7000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const updateOrderStatus = async (order: Order, newStatus: Order["status"], customNotes?: string) => {
    if (updatingOrderId === order.id) return;
    if (order.status === newStatus && !customNotes) return;

    if (newStatus === "cancelled") {
      const confirmCancel = window.confirm(`Deseja realmente cancelar o pedido ${order.code} de ${order.customerName}?`);
      if (!confirmCancel) return;
    }

    setUpdatingOrderId(order.id);
    try {
      const payload: { status: Order["status"]; notes?: string } = { status: newStatus };
      if (customNotes !== undefined) {
        payload.notes = customNotes;
      }
      await api(`/api/orders/${order.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      notify(`Pedido ${order.code} — ${statusLabel(newStatus)}`);
      await loadOrders();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Falha ao atualizar pedido");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return orders;
    const q = searchTerm.toLowerCase();
    return orders.filter((o) => o.code.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q) || o.channel.toLowerCase().includes(q));
  }, [orders, searchTerm]);

  const activeOrders = filteredOrders.filter((o) => o.status !== "completed" && o.status !== "cancelled");
  const completedOrders = filteredOrders.filter((o) => o.status === "completed");

  const printOrder = (order: Order) => {
    const w = paperWidth === 58 ? 32 : 48;
    const sep = "-".repeat(w);
    const parsed = parseOrderDetails(order);
    const lines = [
      "SMACK CHICKEN",
      `Pedido ${fmtCode(order.code)}`,
      sep,
      `Cliente: ${order.customerName}`,
      ...(parsed.phoneFormatted ? [`WhatsApp: ${parsed.phoneFormatted}`] : parsed.phone ? [`WhatsApp: ${parsed.phone}`] : []),
      `Horario: ${fmtTime(order.createdAt)}`,
      `Canal: ${order.channel}`,
      ...(parsed.deliveryType ? [`Modalidade: ${parsed.deliveryType}`] : []),
      ...(parsed.address ? [`Endereco: ${parsed.address}`] : []),
      sep,
      ...(parsed.allKitchenNotes.length > 0
        ? [
            "*** ATENCAO COZINHA ***",
            ...parsed.allKitchenNotes.map((n) => `* ${n}`),
            sep,
          ]
        : []),
      "ITENS:",
      ...order.items.flatMap((i) => {
        const { title, customs, itemObs } = parseItemName(i.name);
        const itemLines = [`${i.quantity}x ${title} - ${formatMoney(i.unitPriceCents * i.quantity)}`];
        if (customs.length) itemLines.push(`   Adicionais: ${customs.join(", ")}`);
        if (itemObs) itemLines.push(`   * OBS: ${itemObs}`);
        return itemLines;
      }),
      sep,
      ...(order.discountCents ? [`Desconto: -${formatMoney(order.discountCents)}`] : []),
      `TOTAL: ${formatMoney(order.totalCents)}`,
      `Pagamento: ${parsed.paymentInfo || order.paymentMethod}`,
      sep,
    ];
    const win = window.open("", "_blank", "width=400,height=600");
    if (win) {
      win.document.write(`<pre style="font-family:monospace;font-size:13px;padding:12px;white-space:pre-wrap;word-break:break-word;">${lines.join("\n")}</pre>`);
      win.document.close();
      win.print();
    }
  };

  type NavDef = { id: View; label: string; Icon: () => React.ReactElement };
  const navItems: NavDef[] = [
    { id: "orders",     label: "Pedidos",            Icon: IcoOrders      },
    { id: "expedicao",  label: "Expedição",          Icon: IcoQueue       },
    { id: "motoboy",    label: "Entregas / Motoboy", Icon: IcoMotorcycle  },
    { id: "cardapio",   label: "Cardápio",           Icon: IcoMenu        },
    { id: "delivery",   label: "Taxas de Entrega",   Icon: IcoTruck       },
    { id: "relatorios", label: "Relatórios",         Icon: IcoChart       },
    { id: "settings",   label: "Configurações",      Icon: IcoSettings    },
  ];
  const viewLabels: Record<View, string> = {
    orders: "Pedidos",
    expedicao: "Expedição",
    motoboy: "Entregas & Motoboy (Check-in / Check-out)",
    cardapio: "Cardápio & Produtos",
    delivery: "Taxas de Entrega & Raio",
    relatorios: "Relatórios",
    settings: "Configurações"
  };

  if (!isAuthenticated) {
    return (
      <>
        <style>{ADMIN_CSS}</style>
        <AdminLoginScreen onLogin={() => setIsAuthenticated(true)} />
      </>
    );
  }

  return (
    <>
      <style>{ADMIN_CSS}</style>
      <div className="adm-shell">
        <aside className={`adm-sidebar${sidebarCollapsed ? " collapsed" : ""}`}>
          <button
            type="button"
            className="adm-collapse-btn"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            aria-label={sidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: sidebarCollapsed ? "rotate(180deg)" : "none", transition: "transform .2s" }}
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="adm-sidebar-logo">
            <img
              className="adm-logo-full"
              src="/smack-chicken-logo-white.png"
              alt="Smack Chicken"
              style={{ height: "26px", width: "auto", objectFit: "contain" }}
              onError={(e) => { (e.target as HTMLImageElement).src = "/smack-chicken-logo.png"; }}
            />
            <img
              className="adm-logo-mini"
              src="/smack-chicken-mark.png"
              alt="Smack Chicken"
              style={{ height: "30px", width: "30px", objectFit: "contain" }}
            />
            <span className="adm-logo-subtitle" style={{ fontSize: "9px", color: "#ffc814", letterSpacing: "2px", textTransform: "uppercase", fontWeight: 700, marginTop: "4px" }}>
              Gestão Online
            </span>
          </div>
          <nav className="adm-sidebar-nav">
            {navItems.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                className={`adm-nav-item${view === id ? " active" : ""}`}
                onClick={() => setView(id)}
                title={sidebarCollapsed ? label : undefined}
              >
                <Icon /><span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="adm-sidebar-footer">
            <button
              type="button"
              className={`adm-store-btn${storeOpen ? " open" : " closed"}`}
              onClick={() => { setStoreOpen((v) => !v); notify(storeOpen ? "Loja fechada para novos pedidos." : "Loja aberta para pedidos."); }}
              title={sidebarCollapsed ? (storeOpen ? "Loja Aberta" : "Loja Fechada") : undefined}
            >
              <span className={`adm-sdot${storeOpen ? " open" : " closed"}`} />
              <span className="adm-store-label">{storeOpen ? "Loja Aberta" : "Loja Fechada"}</span>
            </button>

            <button
              type="button"
              className="adm-logout-btn"
              onClick={() => {
                try {
                  localStorage.removeItem("smack_admin_auth");
                } catch {}
                setIsAuthenticated(false);
              }}
              title={sidebarCollapsed ? "Sair do Painel" : undefined}
            >
              <IcoLogout />
              <span>Sair do Painel</span>
            </button>
          </div>
        </aside>
        <div className="adm-main">
          <header className="adm-topbar">
            <span className="adm-topbar-title">{viewLabels[view]}</span>
            <div className="adm-search-wrap">
              <IcoSearch />
              <input className="adm-search" placeholder="Buscar pedido ou cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <button
              type="button"
              className={`adm-sound-btn${soundEnabled ? " active" : ""}`}
              onClick={toggleSound}
              title={soundEnabled ? "Alerta sonoro ativado (Clique para silenciar)" : "Alerta sonoro silenciado (Clique para ativar)"}
            >
              {soundEnabled ? <IcoVolume /> : <IcoVolumeMute />}
              <span>{soundEnabled ? "Som Ativo" : "Mudo"}</span>
            </button>
            <button
              type="button"
              className="adm-icon-btn"
              onClick={() => { playNewOrderSound(); notify("Testando alerta sonoro de novo pedido! 🔔"); }}
              title="Testar alerta sonoro de novo pedido"
            >
              🔔
            </button>
            <span className="adm-badge">{activeOrders.length} ativos</span>
            <button className="adm-icon-btn" onClick={async () => { setRefreshing(true); await loadOrders(); setRefreshing(false); }} disabled={refreshing} title="Atualizar">
              <IcoRefresh />
            </button>
          </header>
          <main className="adm-content">
            {view === "orders" && (
              <KanbanView
                preparing={filteredOrders.filter((o) => o.status === "preparing")}
                ready={filteredOrders.filter((o) => o.status === "ready")}
                completed={completedOrders}
                onSelect={setSelectedOrder} onMove={updateOrderStatus}
              />
            )}
            {view === "expedicao" && (
              <ExpedicaoView
                preparing={filteredOrders.filter((o) => o.status === "preparing")}
                ready={filteredOrders.filter((o) => o.status === "ready")}
                onSelect={setSelectedOrder} onMove={updateOrderStatus}
              />
            )}
            {view === "motoboy" && (
              <MotoboyDeliveryView
                orders={orders}
                onMoveWithNotes={updateOrderStatus}
                notify={notify}
              />
            )}
            {view === "cardapio" && <CardapioView notify={notify} onOpenDelivery={() => setView("delivery")} />}
            {view === "delivery" && <DeliverySettingsView notify={notify} />}
            {view === "relatorios" && <RelatoriosView orders={orders} completedOrders={completedOrders} />}
            {view === "settings" && (
              <SettingsView
                paperWidth={paperWidth}
                setPaperWidth={setPaperWidth}
                soundEnabled={soundEnabled}
                onToggleSound={toggleSound}
                onTestSound={() => { playNewOrderSound(); notify("Testando alerta sonoro! 🔔"); }}
                notify={notify}
                onClear={loadOrders}
              />
            )}
          </main>
        </div>
      </div>
      {selectedOrder && <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onMove={updateOrderStatus} onPrint={printOrder} />}
      {toast && <div className="adm-toast">{toast}</div>}
    </>
  );
}

/* KANBAN */
function KanbanView({ preparing, ready, completed, onSelect, onMove }: {
  preparing: Order[]; ready: Order[]; completed: Order[];
  onSelect: (o: Order) => void; onMove: (o: Order, s: Order["status"]) => void;
}) {
  const cols = [
    { id: "preparing" as const, label: "Em Preparo",       color: "#e67e00", orders: preparing },
    { id: "ready"     as const, label: "Pronto / Em Rota", color: "#1a7fe8", orders: ready     },
    { id: "completed" as const, label: "Entregues",        color: "#17a35c", orders: completed },
  ];
  return (
    <>
      <div className="sec-header">
        <span className="sec-title">Quadro de Pedidos</span>
        <span style={{ fontSize:12, color:"#9c918d" }}>Atualizado a cada 7s</span>
      </div>
      <div className="kanban-grid">
        {cols.map((col) => (
          <div key={col.id} className="kanban-col">
            <div className="kanban-col-header" style={{ color:col.color }}>
              <Dot color={col.color} />{col.label}
              <span className="cnt">{col.orders.length}</span>
            </div>
            <div className="kanban-cards">
              {col.orders.length === 0 && <div className="empty-st">Nenhum pedido</div>}
              {col.orders.map((order) => <OrderCard key={order.id} order={order} accentColor={col.color} onSelect={onSelect} onMove={onMove} />)}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function OrderCard({ order, accentColor, onSelect, onMove }: {
  order: Order; accentColor: string;
  onSelect: (o: Order) => void; onMove: (o: Order, s: Order["status"]) => void;
}) {
  const parsed = parseOrderDetails(order);
  const preview = order.items.map((i) => {
    const { title } = parseItemName(i.name);
    return `${i.quantity}x ${title}`;
  }).join(", ");
  const next = order.status === "preparing" ? "ready" : order.status === "ready" ? "completed" : null;
  const nextLbl = order.status === "preparing" ? "Pronto" : order.status === "ready" ? "Entregue" : null;
  return (
    <div className="ocard" onClick={() => onSelect(order)}>
      <div className="ocard-bar" style={{ background:accentColor }} />
      <div className="ocard-top">
        <span className="ocard-code">{fmtCode(order.code)}</span>
        <span className="ocard-elapsed"><IcoClock /> {elapsed(order.createdAt)}</span>
      </div>
      <div className="ocard-customer">{order.customerName}</div>
      <div className="ocard-preview">{preview}</div>
      {parsed.allKitchenNotes.length > 0 && (
        <div style={{ marginTop:6, display:"flex", flexWrap:"wrap", gap:4 }}>
          <span className="obs-pill" title={parsed.allKitchenNotes.join(" | ")}>
            <IcoAlert /> {parsed.allKitchenNotes[0]}
            {parsed.allKitchenNotes.length > 1 ? ` (+${parsed.allKitchenNotes.length - 1})` : ""}
          </span>
        </div>
      )}
      <div className="ocard-footer">
        <span className="ocard-total">{formatMoney(order.totalCents)}</span>
        <span className="ocard-channel">
          {parsed.deliveryType ? (parsed.deliveryType.toLowerCase().includes("entrega") ? "Entrega" : "Retirada") : order.channel}
        </span>
      </div>
      {parsed.motoboyName && (
        <div style={{ marginTop:6, display:"flex", alignItems:"center", gap:5, fontSize:11.5, color:"#1d4ed8", fontWeight:700, background:"#eff6ff", padding:"3px 7px", borderRadius:4 }}>
          <IcoMotorcycle />
          <span>{parsed.motoboyName} {parsed.checkedInAt ? `(${parsed.checkedInAt})` : ""}</span>
        </div>
      )}
      {next && (
        <div style={{ marginTop:10, display:"flex", gap:6 }} onClick={(e) => e.stopPropagation()}>
          <button className="btn-primary btn-sm" style={{ flex:1 }} onClick={() => onMove(order, next)}>
            {nextLbl} <IcoArrow />
          </button>
          {order.status === "preparing" && (
            <button className="btn-danger btn-sm" onClick={() => onMove(order, "cancelled")}>Cancelar</button>
          )}
        </div>
      )}
    </div>
  );
}

/* EXPEDICAO */
function ExpedicaoView({ preparing, ready, onSelect, onMove }: {
  preparing: Order[]; ready: Order[];
  onSelect: (o: Order) => void; onMove: (o: Order, s: Order["status"]) => void;
}) {
  return (
    <>
      <div className="sec-header">
        <span className="sec-title">Expedicao</span>
        <span style={{ fontSize:12, color:"#9c918d" }}>{preparing.length + ready.length} pedidos em aberto</span>
      </div>
      <div className="exp-grid">
        <div className="exp-panel">
          <div className="exp-panel-header">
            <div className="exp-panel-title"><Dot color="#e67e00" /> Em Preparo</div>
            <span className="adm-badge" style={{ background:"#e67e00" }}>{preparing.length}</span>
          </div>
          <div className="exp-list">
            {preparing.length === 0 && <div className="empty-st">Fila vazia</div>}
            {preparing.map((o) => <ExpRow key={o.id} order={o} nextLabel="Marcar Pronto" nextStatus="ready" onSelect={onSelect} onMove={onMove} />)}
          </div>
        </div>
        <div className="exp-panel">
          <div className="exp-panel-header">
            <div className="exp-panel-title"><Dot color="#1a7fe8" /> Pronto / Em Rota</div>
            <span className="adm-badge" style={{ background:"#1a7fe8" }}>{ready.length}</span>
          </div>
          <div className="exp-list">
            {ready.length === 0 && <div className="empty-st">Fila vazia</div>}
            {ready.map((o) => <ExpRow key={o.id} order={o} nextLabel="Confirmar Entrega" nextStatus="completed" onSelect={onSelect} onMove={onMove} />)}
          </div>
        </div>
      </div>
    </>
  );
}

function ExpRow({ order, nextLabel, nextStatus, onSelect, onMove }: {
  order: Order; nextLabel: string; nextStatus: Order["status"];
  onSelect: (o: Order) => void; onMove: (o: Order, s: Order["status"]) => void;
}) {
  const parsed = parseOrderDetails(order);
  return (
    <div className="exp-row" onClick={() => onSelect(order)}>
      <div className="exp-row-top">
        <span className="exp-row-code">{fmtCode(order.code)}</span>
        <span className="exp-row-time"><IcoClock /> {elapsed(order.createdAt)}</span>
      </div>
      <div className="exp-row-customer">
        {order.customerName} — {formatMoney(order.totalCents)}
        {parsed.deliveryType ? ` · ${parsed.deliveryType.toLowerCase().includes("entrega") ? "Entrega" : "Retirada"}` : ""}
      </div>
      {parsed.allKitchenNotes.length > 0 && (
        <div style={{ marginTop:4, display:"flex", flexWrap:"wrap", gap:4 }}>
          <span className="obs-pill">
            <IcoAlert /> {parsed.allKitchenNotes.join(" | ")}
          </span>
        </div>
      )}
      <div className="exp-row-actions" onClick={(e) => e.stopPropagation()}>
        <button className="btn-primary btn-sm" onClick={() => onMove(order, nextStatus)}>
          {nextLabel} <IcoArrow />
        </button>
        {nextStatus === "ready" && (
          <button className="btn-danger btn-sm" onClick={() => onMove(order, "cancelled")}>Cancelar</button>
        )}
      </div>
    </div>
  );
}

/* ENTREGAS & MOTOBOY (CHECK-IN E CHECK-OUT) */
function MotoboyDeliveryView({
  orders,
  onMoveWithNotes,
  notify,
}: {
  orders: Order[];
  onMoveWithNotes: (order: Order, newStatus: Order["status"], newNotes: string) => Promise<void>;
  notify: (msg: string) => void;
}) {
  const [tab, setTab] = useState<"pending" | "in_route" | "delivered" | "all">("pending");
  const [currentMotoboy, setCurrentMotoboy] = useState<string>(() => {
    try {
      return localStorage.getItem("smack_current_motoboy") || "";
    } catch {
      return "";
    }
  });

  const handleSetMotoboy = (name: string) => {
    setCurrentMotoboy(name);
    try {
      localStorage.setItem("smack_current_motoboy", name);
    } catch {}
  };

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

  const pendingCheckin = useMemo(() => {
    return deliveryOrders.filter((o) => (o.status === "preparing" || o.status === "ready") && !parseOrderDetails(o).checkedInAt);
  }, [deliveryOrders]);

  const inRoute = useMemo(() => {
    return deliveryOrders.filter((o) => o.status === "ready" && Boolean(parseOrderDetails(o).checkedInAt) && !parseOrderDetails(o).deliveredAt);
  }, [deliveryOrders]);

  const deliveredToday = useMemo(() => {
    return deliveryOrders.filter((o) => o.status === "completed" || Boolean(parseOrderDetails(o).deliveredAt));
  }, [deliveryOrders]);

  const displayed = tab === "pending"
    ? pendingCheckin
    : tab === "in_route"
    ? inRoute
    : tab === "delivered"
    ? deliveredToday
    : deliveryOrders;

  const handleCheckin = async (order: Order) => {
    const motoboy = currentMotoboy.trim() || "Entregador da Casa";
    const nowTime = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    let notes = order.notes || "";
    if (!notes.toLowerCase().includes("motoboy:")) {
      notes += ` | Motoboy: ${motoboy}`;
    }
    if (!notes.toLowerCase().includes("saída:") && !notes.toLowerCase().includes("saida:")) {
      notes += ` | Saída: ${nowTime}`;
    }
    await onMoveWithNotes(order, "ready", notes);
    notify(`Check-in de saída realizado para Pedido ${fmtCode(order.code)} (${motoboy})!`);
  };

  const handleCheckout = async (order: Order) => {
    const parsed = parseOrderDetails(order);
    const motoboy = parsed.motoboyName || currentMotoboy.trim() || "Entregador";
    const nowTime = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    let notes = order.notes || "";
    if (!notes.toLowerCase().includes("entregue às:") && !notes.toLowerCase().includes("entregue as:")) {
      notes += ` | Entregue às: ${nowTime}`;
    }
    await onMoveWithNotes(order, "completed", notes);
    notify(`Check-out de entrega concluído para Pedido ${fmtCode(order.code)}!`);

    // Notificar cliente no WhatsApp
    if (parsed.phone) {
      const cleanPhone = parsed.phone.replace(/\D/g, "");
      const waNumber = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
      const msg = `Olá ${order.customerName}! Seu pedido ${fmtCode(order.code)} do Smack Chicken acabou de ser entregue pelo motoboy ${motoboy} às ${nowTime}! Desejamos um excelente apetite! 🍗😋`;
      window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`, "_blank");
    }
  };

  const quickNames = ["Lucas", "Rodrigo", "Gabriel", "Mateus", "Felipe"];

  return (
    <div>
      <div className="motoboy-header">
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1b1715" }}>Entregas & Motoboy</h2>
          <p style={{ fontSize: 12, color: "#706965" }}>Check-in de saída na loja e check-out no endereço do cliente</p>
        </div>

        {/* SELETOR DE MOTOBOY */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #e6dfd6", padding: "6px 12px", borderRadius: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#706965" }}>Entregador em serviço:</span>
          <input
            type="text"
            placeholder="Nome do motoboy..."
            value={currentMotoboy}
            onChange={(e) => handleSetMotoboy(e.target.value)}
            style={{ border: "1px solid #e6dfd6", borderRadius: 6, padding: "5px 8px", fontSize: 12, outline: "none", width: 140 }}
          />
          <div style={{ display: "flex", gap: 4 }}>
            {quickNames.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => handleSetMotoboy(name)}
                style={{
                  background: currentMotoboy === name ? "#b70922" : "#f1ede8",
                  color: currentMotoboy === name ? "#fff" : "#706965",
                  border: "none",
                  borderRadius: 4,
                  padding: "4px 7px",
                  fontSize: 11,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ABAS */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "1px solid #e6dfd6", paddingBottom: 10, flexWrap: "wrap" }}>
        <button
          className={`rbtn${tab === "pending" ? " active" : ""}`}
          onClick={() => setTab("pending")}
        >
          Aguardando Saída ({pendingCheckin.length})
        </button>
        <button
          className={`rbtn${tab === "in_route" ? " active" : ""}`}
          onClick={() => setTab("in_route")}
        >
          Em Rota de Entrega ({inRoute.length})
        </button>
        <button
          className={`rbtn${tab === "delivered" ? " active" : ""}`}
          onClick={() => setTab("delivered")}
        >
          Entregues Hoje ({deliveredToday.length})
        </button>
        <button
          className={`rbtn${tab === "all" ? " active" : ""}`}
          onClick={() => setTab("all")}
        >
          Todos ({deliveryOrders.length})
        </button>
      </div>

      {/* GRID DE PEDIDOS DE ENTREGA */}
      {displayed.length === 0 ? (
        <div className="empty-st" style={{ background: "#fff", borderRadius: 10, border: "1px solid #e6dfd6", padding: 40 }}>
          Nenhum pedido de entrega nesta lista no momento.
        </div>
      ) : (
        <div className="motoboy-grid">
          {displayed.map((order) => {
            const parsed = parseOrderDetails(order);
            const isDelivered = order.status === "completed" || Boolean(parsed.deliveredAt);
            const isInRoute = order.status === "ready" && Boolean(parsed.checkedInAt) && !isDelivered;
            const isPending = !isDelivered && !isInRoute;

            const cleanPhone = parsed.phone ? parsed.phone.replace(/\D/g, "") : null;
            const waNumber = cleanPhone ? (cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone) : null;
            const waUrl = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(`Olá ${order.customerName}! Falamos da entrega do seu pedido ${fmtCode(order.code)} do Smack Chicken!`)}` : null;

            const mapsUrl = parsed.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parsed.address)}` : null;
            const wazeUrl = parsed.address ? `https://waze.com/ul?q=${encodeURIComponent(parsed.address)}` : null;

            return (
              <div key={order.id} className={`motoboy-card ${isInRoute ? "ready" : isDelivered ? "completed" : "preparing"}`}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#1b1715" }}>Pedido {fmtCode(order.code)}</span>
                    <div style={{ fontSize: 12, color: "#706965", marginTop: 2 }}>{fmtTime(order.createdAt)} · {elapsed(order.createdAt)} atrás</div>
                  </div>
                  <div>
                    {isDelivered ? (
                      <span className="motoboy-badge" style={{ background: "#ebf8f1", color: "#16a34a", border: "1px solid #c4edd6" }}>
                        <IcoCheck /> ENTREGUE
                      </span>
                    ) : isInRoute ? (
                      <span className="motoboy-badge" style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }}>
                        <IcoMotorcycle /> EM ROTA
                      </span>
                    ) : (
                      <span className="motoboy-badge" style={{ background: "#fef3c7", color: "#d97706", border: "1px solid #fde68a" }}>
                        AGUARDANDO SAÍDA
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ background: "#faf8f6", borderRadius: 8, padding: 10, border: "1px solid #f1ede8" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1b1715" }}>👤 {order.customerName}</div>
                  {parsed.phone && (
                    <div style={{ fontSize: 12, color: "#706965", marginTop: 3 }}>
                      📱 {parsed.phoneFormatted || parsed.phone}
                    </div>
                  )}
                  {parsed.address ? (
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#b70922", marginTop: 4, display: "flex", alignItems: "flex-start", gap: 4 }}>
                      <IcoMapPin /> <span>{parsed.address}</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "#706965", marginTop: 4 }}>
                      Endereço não informado / Balcão
                    </div>
                  )}
                </div>

                {/* METADADOS DO MOTOBOY */}
                {(parsed.motoboyName || parsed.checkedInAt || parsed.deliveredAt) && (
                  <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 3, background: "#f8fafc", padding: "8px 10px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                    {parsed.motoboyName && (
                      <div>
                        <strong>Entregador:</strong> 🛵 {parsed.motoboyName}
                      </div>
                    )}
                    {parsed.checkedInAt && (
                      <div style={{ color: "#2563eb" }}>
                        <strong>Saída da loja (Check-in):</strong> {parsed.checkedInAt}
                      </div>
                    )}
                    {parsed.deliveredAt && (
                      <div style={{ color: "#16a34a" }}>
                        <strong>Entregue no cliente (Check-out):</strong> ✅ {parsed.deliveredAt}
                      </div>
                    )}
                  </div>
                )}

                {/* PAGAMENTO E TOTAL */}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, paddingTop: 4 }}>
                  <span style={{ color: "#706965" }}>Pagamento: {parsed.paymentInfo || order.paymentMethod}</span>
                  <span style={{ color: "#b70922" }}>{formatMoney(order.totalCents)}</span>
                </div>

                {/* BOTÕES DE NAVEGAÇÃO & AÇÕES */}
                <div className="motoboy-actions">
                  {mapsUrl && (
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn-maps" title="Abrir Google Maps">
                      🗺️ Maps
                    </a>
                  )}
                  {wazeUrl && (
                    <a href={wazeUrl} target="_blank" rel="noopener noreferrer" className="btn-waze" title="Abrir Waze">
                      🚙 Waze
                    </a>
                  )}
                  {waUrl && (
                    <a href={waUrl} target="_blank" rel="noopener noreferrer" className="whatsapp-btn" style={{ padding: "6px 10px" }} title="WhatsApp do Cliente">
                      <IcoWhatsApp /> WhatsApp
                    </a>
                  )}

                  <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    {isPending && (
                      <button className="btn-checkin" onClick={() => handleCheckin(order)}>
                        <IcoMotorcycle /> Check-in (Sair da Loja)
                      </button>
                    )}
                    {isInRoute && (
                      <button className="btn-checkout" onClick={() => handleCheckout(order)}>
                        <IcoCheck /> Check-out (Confirmar Entrega)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* PRODUCT MODAL (CRIAR E EDITAR) */
function ProductModal({
  product,
  categories,
  onClose,
  onSave,
  onDelete,
}: {
  product: CatalogProduct | "new";
  categories: string[];
  onClose: () => void;
  onSave: (data: SaveProductInput) => Promise<void>;
  onDelete?: (id: number | string, name: string) => Promise<void>;
}) {
  const isNew = product === "new";
  const [name, setName] = useState(isNew ? "" : product.name);
  const [category, setCategory] = useState(isNew ? (categories[0] || "Lanches") : product.category);
  const [customCat, setCustomCat] = useState("");
  const [isCustomCat, setIsCustomCat] = useState(false);
  const [priceStr, setPriceStr] = useState(
    isNew ? "" : (product.priceCents / 100).toFixed(2).replace(".", ",")
  );
  const [description, setDescription] = useState(isNew ? "" : (product.description || ""));
  const [image, setImage] = useState(isNew ? "" : (product.image || ""));
  const [active, setActive] = useState(isNew ? true : product.active !== false);
  const [featured, setFeatured] = useState(isNew ? false : Boolean(product.featured));
  const [saving, setSaving] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  // Otimização automática e compressão de imagem no navegador
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const maxDim = 600;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL("image/jpeg", 0.82);
            setImage(compressed);
          } else {
            setImage(dataUrl);
          }
        } catch {
          setImage(dataUrl);
        } finally {
          setImageLoading(false);
        }
      };
      img.onerror = () => {
        setImageLoading(false);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert("Por favor, digite o nome do produto.");
    const finalCat = isCustomCat ? customCat.trim() : category.trim();
    if (!finalCat) return alert("Por favor, selecione ou digite uma categoria.");

    // Parse preço
    const cleanPrice = priceStr.replace(/[^\d.,]/g, "").replace(",", ".");
    const numPrice = parseFloat(cleanPrice);
    if (isNaN(numPrice) || numPrice < 0) return alert("Por favor, informe um preço válido (ex: 39,90).");
    const priceCents = Math.round(numPrice * 100);

    setSaving(true);
    try {
      await onSave({
        id: isNew ? undefined : product.id,
        name: name.trim(),
        category: finalCat,
        priceCents,
        description: description.trim(),
        image: image.trim() || "/smack-chicken-mark.png",
        active,
        featured,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao salvar produto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <div className="modal-title">{isNew ? "Adicionar Novo Produto" : `Editar: ${product.name}`}</div>
          <button className="adm-icon-btn" onClick={onClose}><IcoClose /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grp">
              <label className="form-lbl">Nome do Produto *</label>
              <input
                className="form-ctrl"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Balde Especial Crocante"
                required
              />
            </div>

            <div className="form-2col">
              <div className="form-grp">
                <label className="form-lbl">Categoria *</label>
                {!isCustomCat ? (
                  <select
                    className="form-ctrl"
                    value={category}
                    onChange={(e) => {
                      if (e.target.value === "__NEW__") {
                        setIsCustomCat(true);
                      } else {
                        setCategory(e.target.value);
                      }
                    }}
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="__NEW__">+ Nova categoria...</option>
                  </select>
                ) : (
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      className="form-ctrl"
                      value={customCat}
                      onChange={(e) => setCustomCat(e.target.value)}
                      placeholder="Nome da categoria"
                      autoFocus
                    />
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => setIsCustomCat(false)}
                      title="Voltar à lista"
                    >
                      X
                    </button>
                  </div>
                )}
              </div>

              <div className="form-grp">
                <label className="form-lbl">Preço (R$) *</label>
                <input
                  className="form-ctrl"
                  value={priceStr}
                  onChange={(e) => setPriceStr(e.target.value)}
                  placeholder="Ex: 49,90"
                  required
                />
              </div>
            </div>

            <div className="form-grp">
              <label className="form-lbl">Descrição do Produto</label>
              <textarea
                className="form-ctrl form-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ingredientes, porção, detalhes do que acompanha..."
              />
            </div>

            <div className="form-grp">
              <label className="form-lbl">Foto do Produto</label>
              <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 8 }}>
                <img
                  src={image || "/smack-chicken-mark.png"}
                  alt="Prévia"
                  className="img-preview"
                  onError={(e) => { (e.target as HTMLImageElement).src = "/smack-chicken-mark.png"; }}
                />
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      background: "#b70922",
                      color: "#fff",
                      borderRadius: 7,
                      padding: "8px 14px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      marginBottom: 6,
                    }}
                  >
                    <span>{imageLoading ? "Otimizando foto..." : "Escolher Foto (PC / Celular)"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={handleImageUpload}
                      disabled={imageLoading}
                    />
                  </label>
                  <div style={{ fontSize: 11, color: "#9c918d" }}>
                    Foto otimizada e gravada em alta velocidade na nuvem.
                  </div>
                </div>
              </div>
              <input
                className="form-ctrl"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="Ou cole a URL direta da imagem (ex: /balde-tiras.jpeg ou https://...)"
                style={{ fontSize: 12 }}
              />
            </div>

            <div style={{ display: "flex", gap: 20, marginTop: 10, padding: "10px 14px", background: "#faf8f6", borderRadius: 8, border: "1px solid #e6dfd6" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  style={{ accentColor: "#17a35c", width: 16, height: 16 }}
                />
                <span>Disponível no cardápio online</span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  style={{ accentColor: "#b70922", width: 16, height: 16 }}
                />
                <span>Destaque</span>
              </label>
            </div>
          </div>

          <div className="modal-actions" style={{ justifyContent: "space-between" }}>
            <div>
              {!isNew && onDelete && (
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => onDelete(product.id, product.name)}
                >
                  <IcoTrash /> Excluir Produto
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={saving || imageLoading}>
                {saving ? "Salvando..." : isNew ? "Cadastrar Produto" : "Salvar Alterações"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/* CARDAPIO */
function CardapioView({
  notify,
  onOpenDelivery,
}: {
  notify: (m: string) => void;
  onOpenDelivery?: () => void;
}) {
  const [products, setProducts] = useState<CatalogProduct[]>(catalog);
  const [loading, setLoading] = useState(false);
  const [filterCat, setFilterCat] = useState("Todos");
  const [search, setSearch] = useState("");
  const [editingProduct, setEditingProduct] = useState<CatalogProduct | "new" | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ products: CatalogProduct[] }>("/api/products").catch(() => ({ products: [] }));
      if (Array.isArray(res.products) && res.products.length > 0) {
        setProducts(res.products);
      }
    } catch {
      notify("Erro ao carregar cardápio atualizado");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleToggleActive = async (id: number | string) => {
    try {
      const res = await api<{ product: CatalogProduct }>("/api/products", {
        method: "PATCH",
        body: JSON.stringify({ id, toggleActive: true }),
      });
      setProducts((prev) => prev.map((p) => (p.id === res.product.id ? res.product : p)));
      notify(res.product.active !== false ? "Item liberado no cardápio!" : "Item pausado temporariamente!");
    } catch {
      notify("Erro ao alternar status do item");
    }
  };

  const handleSaveProduct = async (data: SaveProductInput) => {
    const isNew = !data.id;
    const res = await api<{ product: CatalogProduct }>("/api/products", {
      method: isNew ? "POST" : "PATCH",
      body: JSON.stringify(data),
    });
    setProducts((prev) => {
      if (isNew) return [...prev, res.product];
      return prev.map((p) => (p.id === res.product.id ? res.product : p));
    });
    setEditingProduct(null);
    notify(isNew ? `Produto "${res.product.name}" adicionado!` : `Produto "${res.product.name}" atualizado!`);
  };

  const handleDeleteProduct = async (id: number | string, name: string) => {
    if (!window.confirm(`Deseja realmente excluir permanentemente "${name}" do cardápio?`)) return;
    try {
      await api(`/api/products?id=${id}`, { method: "DELETE" });
      setProducts((prev) => prev.filter((p) => p.id !== Number(id)));
      if (editingProduct && editingProduct !== "new" && editingProduct.id === Number(id)) {
        setEditingProduct(null);
      }
      notify(`Produto "${name}" excluído com sucesso!`);
    } catch {
      notify("Erro ao excluir produto");
    }
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => { if (p.category) set.add(p.category); });
    return Array.from(set);
  }, [products]);

  const pausedCount = useMemo(() => products.filter((p) => p.active === false).length, [products]);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (filterCat !== "Todos") {
      list = list.filter((p) => p.category === filterCat);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q)));
    }
    return list;
  }, [products, filterCat, search]);

  return (
    <>
      <div className="cat-top-bar">
        <div>
          <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Gestão do Cardápio Online
            {loading && <span style={{ fontSize: 12, fontWeight: 500, color: "#9c918d" }}>(atualizando...)</span>}
          </div>
          <div style={{ fontSize: 12, color: "#9c918d", marginTop: 4 }}>
            {products.length} itens cadastrados · {pausedCount} pausado(s) · Sincronizado em tempo real com o site de pedidos
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {onOpenDelivery && (
            <button className="btn-secondary" onClick={onOpenDelivery} style={{ fontSize: 12 }}>
              <IcoTruck /> Taxas de Entrega
            </button>
          )}
          <button className="btn-primary" onClick={() => setEditingProduct("new")}>
            <IcoPlus /> Novo Produto
          </button>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div className="cat-pill-bar" style={{ marginBottom: 0 }}>
          <button
            className={`cat-pill ${filterCat === "Todos" ? "active" : ""}`}
            onClick={() => setFilterCat("Todos")}
          >
            Todos ({products.length})
          </button>
          {categories.map((c) => {
            const count = products.filter((p) => p.category === c).length;
            return (
              <button
                key={c}
                className={`cat-pill ${filterCat === c ? "active" : ""}`}
                onClick={() => setFilterCat(c)}
              >
                {c} ({count})
              </button>
            );
          })}
        </div>

        <input
          type="text"
          className="cat-search"
          placeholder="Buscar produto por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Grid de Produtos */}
      <div className="catalog-grid">
        {filteredProducts.map((product) => {
          const off = product.active === false;
          return (
            <div key={product.id} className="ccard" style={{ opacity: off ? 0.65 : 1 }}>
              <img
                className="ccard-img"
                src={product.image || "/smack-chicken-mark.png"}
                alt={product.name}
                onError={(e) => { (e.target as HTMLImageElement).src = "/smack-chicken-mark.png"; }}
              />
              <div className="ccard-info">
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, background: "#f1ede8", padding: "2px 7px", borderRadius: 4, color: "#706965", fontWeight: 700, letterSpacing: "0.3px", textTransform: "uppercase" }}>
                    {product.category}
                  </span>
                  {product.featured && (
                    <span style={{ fontSize: 10, background: "#fef2f2", color: "#b70922", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>
                      ★ Destaque
                    </span>
                  )}
                </div>
                <div className="ccard-name" title={product.name}>{product.name}</div>
                <div className="ccard-price">{formatMoney(product.priceCents)}</div>
                {product.description && (
                  <div className="ccard-desc" title={product.description}>{product.description}</div>
                )}
                <div className="ccard-actions">
                  <div className="ccard-toggle">
                    <button
                      type="button"
                      className="tpill"
                      style={{ background: off ? "#e6dfd6" : "#17a35c" }}
                      onClick={() => handleToggleActive(product.id)}
                      title={off ? "Clique para ativar no cardápio" : "Clique para pausar"}
                    >
                      <div className="tpill-thumb" style={{ left: off ? 2 : 17 }} />
                    </button>
                    <span style={{ color: off ? "#9b1c1c" : "#065f46" }}>
                      {off ? "Pausado" : "Disponível"}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => setEditingProduct(product)}
                      title="Editar dados e foto"
                    >
                      <IcoEdit /> Editar
                    </button>
                    <button
                      type="button"
                      className="btn-danger btn-sm"
                      onClick={() => handleDeleteProduct(product.id, product.name)}
                      title="Excluir produto"
                    >
                      <IcoTrash />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="empty-st">Nenhum produto encontrado neste filtro.</div>
      )}

      {/* Modal de Adicionar / Editar */}
      {editingProduct && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          onClose={() => setEditingProduct(null)}
          onSave={handleSaveProduct}
          onDelete={editingProduct !== "new" ? handleDeleteProduct : undefined}
        />
      )}
    </>
  );
}

/* DELIVERY SETTINGS */
function DeliverySettingsView({ notify }: { notify: (m: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [maxRadiusKm, setMaxRadiusKm] = useState<number>(6);
  const [tiers, setTiers] = useState<DeliveryTier[]>([]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ settings: DeliverySettings }>("/api/delivery-settings");
      if (res.settings) {
        setMaxRadiusKm(res.settings.maxRadiusKm || 6);
        setTiers(res.settings.tiers || []);
      }
    } catch {
      notify("Erro ao carregar taxas de entrega");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleUpdateTier = (index: number, field: keyof DeliveryTier, value: any) => {
    setTiers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (field === "feeCents") {
        next[index].feeFormatted = `R$ ${(Number(value) / 100).toFixed(2).replace(".", ",")}`;
      }
      return next;
    });
  };

  const handleRemoveTier = (index: number) => {
    if (tiers.length <= 1) return alert("Pelo menos uma faixa de entrega deve permanecer cadastrada.");
    setTiers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddTier = () => {
    const last = tiers[tiers.length - 1];
    const newMaxKm = last ? Number((last.maxKm + 0.5).toFixed(1)) : 1.0;
    const newTime = last ? last.timeMinutes + 2 : 40;
    const newFee = last ? last.feeCents + 100 : 599;
    const newTier: DeliveryTier = {
      maxKm: newMaxKm,
      timeMinutes: newTime,
      feeCents: newFee,
      feeFormatted: `R$ ${(newFee / 100).toFixed(2).replace(".", ",")}`,
    };
    setTiers((prev) => [...prev, newTier]);
    if (newMaxKm > maxRadiusKm) {
      setMaxRadiusKm(newMaxKm);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: DeliverySettings = {
        maxRadiusKm: Number(maxRadiusKm),
        tiers: tiers.map((t) => ({
          maxKm: Number(t.maxKm),
          timeMinutes: Number(t.timeMinutes),
          feeCents: Number(t.feeCents),
          feeFormatted: `R$ ${(Number(t.feeCents) / 100).toFixed(2).replace(".", ",")}`,
        })),
      };
      const res = await api<{ settings: DeliverySettings }>("/api/delivery-settings", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setMaxRadiusKm(res.settings.maxRadiusKm);
      setTiers(res.settings.tiers);
      notify("Taxas de entrega e raio de atendimento atualizados com sucesso!");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erro ao salvar configurações de entrega");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="sec-header">
        <div>
          <div className="sec-title">Taxas de Entrega & Raio de Atendimento</div>
          <div style={{ fontSize: 12, color: "#9c918d", marginTop: 4 }}>
            Calculado automaticamente pelo CEP do cliente no site de pedidos online a partir da loja no Estreito (Rua Fúlvio Aducci, 1074)
          </div>
        </div>
        <button className="btn-primary" onClick={handleSave} disabled={saving || loading}>
          {saving ? "Salvando..." : "Salvar Configurações"}
        </button>
      </div>

      <div className="ssection">
        <div className="ssection-title">Raio Máximo de Atendimento</div>
        <div className="srow" style={{ alignItems: "center" }}>
          <div>
            <div className="slabel">Distância máxima atendida para entregas (km)</div>
            <div className="shint">
              Endereços além desta distância serão orientados a retirar no balcão da loja.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="number"
              step="0.5"
              min="1"
              max="50"
              className="form-ctrl"
              style={{ width: 90, textAlign: "center", fontWeight: 700, fontSize: 14 }}
              value={maxRadiusKm}
              onChange={(e) => setMaxRadiusKm(parseFloat(e.target.value) || 0)}
            />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#706965" }}>km</span>
          </div>
        </div>
      </div>

      <div className="ssection">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div className="ssection-title" style={{ margin: 0, padding: 0, border: "none" }}>
              Tabela de Faixas de Entrega (Distância, Tempo e Taxa)
            </div>
            <div className="shint">
              Defina a taxa e tempo estimado para cada raio de alcance.
            </div>
          </div>
          <button className="btn-secondary btn-sm" onClick={handleAddTier}>
            <IcoPlus /> Adicionar Faixa
          </button>
        </div>

        <table className="delivery-table">
          <thead>
            <tr>
              <th style={{ width: "25%" }}>Raio Máximo (km)</th>
              <th style={{ width: "30%" }}>Tempo Estimado (min)</th>
              <th style={{ width: "30%" }}>Taxa de Entrega (R$)</th>
              <th style={{ width: "15%", textAlign: "center" }}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier, idx) => {
              const feeVal = (tier.feeCents / 100).toFixed(2);
              return (
                <tr key={idx}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span>Até</span>
                      <input
                        type="number"
                        step="0.5"
                        min="0.1"
                        className="form-ctrl"
                        style={{ width: 75, padding: "5px 8px" }}
                        value={tier.maxKm}
                        onChange={(e) => handleUpdateTier(idx, "maxKm", parseFloat(e.target.value) || 0)}
                      />
                      <span>km</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="number"
                        step="1"
                        min="5"
                        className="form-ctrl"
                        style={{ width: 75, padding: "5px 8px" }}
                        value={tier.timeMinutes}
                        onChange={(e) => handleUpdateTier(idx, "timeMinutes", parseInt(e.target.value, 10) || 0)}
                      />
                      <span>minutos</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span>R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-ctrl"
                        style={{ width: 90, padding: "5px 8px", fontWeight: 700 }}
                        value={feeVal}
                        onChange={(e) => {
                          const parsed = Math.round(parseFloat(e.target.value || "0") * 100);
                          handleUpdateTier(idx, "feeCents", isNaN(parsed) ? 0 : parsed);
                        }}
                      />
                    </div>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      className="btn-danger btn-sm"
                      onClick={() => handleRemoveTier(idx)}
                      title="Remover faixa"
                    >
                      <IcoTrash />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
          <button className="btn-primary" onClick={handleSave} disabled={saving || loading}>
            {saving ? "Salvando..." : "Salvar Configurações de Entrega"}
          </button>
        </div>
      </div>
    </>
  );
}

/* RELATORIOS */
function RelatoriosView({ orders, completedOrders }: { orders: Order[]; completedOrders: Order[] }) {
  const totalRevenue = completedOrders.reduce((s, o) => s + o.totalCents, 0);
  const avgTicket = completedOrders.length ? Math.round(totalRevenue / completedOrders.length) : 0;
  const cancelledCount = orders.filter((o) => o.status === "cancelled").length;
  const cancelRate = orders.length ? Math.round((cancelledCount / orders.length) * 100) : 0;
  const channelMap: Record<string, number> = {};
  completedOrders.forEach((o) => { channelMap[o.channel] = (channelMap[o.channel] || 0) + 1; });
  const paymentMap: Record<string, number> = {};
  completedOrders.forEach((o) => { paymentMap[o.paymentMethod] = (paymentMap[o.paymentMethod] || 0) + 1; });
  return (
    <>
      <div className="sec-header">
        <span className="sec-title">Relatorios e Desempenho</span>
        <span style={{ fontSize:12, color:"#9c918d" }}>Ultimos 30 dias</span>
      </div>
      <div className="metrics-grid">
        <div className="mcard">
          <div className="mcard-label">Receita Total</div>
          <div className="mcard-value" style={{ color:"#b70922" }}>{formatMoney(totalRevenue)}</div>
          <div className="mcard-sub">{completedOrders.length} pedidos entregues</div>
        </div>
        <div className="mcard">
          <div className="mcard-label">Ticket Medio</div>
          <div className="mcard-value">{formatMoney(avgTicket)}</div>
          <div className="mcard-sub">por pedido concluido</div>
        </div>
        <div className="mcard">
          <div className="mcard-label">Pedidos Totais</div>
          <div className="mcard-value">{orders.length}</div>
          <div className="mcard-sub">{cancelledCount} cancelado(s)</div>
        </div>
        <div className="mcard">
          <div className="mcard-label">Taxa de Cancelamento</div>
          <div className="mcard-value" style={{ color:cancelRate > 10 ? "#9b1c1c" : "#17a35c" }}>{cancelRate}%</div>
          <div className="mcard-sub">meta: abaixo de 5%</div>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <div className="ssection">
          <div className="ssection-title">Pedidos por Canal</div>
          {Object.entries(channelMap).length === 0 && <div style={{ fontSize:13, color:"#9c918d" }}>Sem dados ainda</div>}
          {Object.entries(channelMap).map(([ch, count]) => (
            <div key={ch} className="srow"><span className="slabel">{ch}</span><span style={{ fontWeight:700 }}>{count}</span></div>
          ))}
        </div>
        <div className="ssection">
          <div className="ssection-title">Formas de Pagamento</div>
          {Object.entries(paymentMap).length === 0 && <div style={{ fontSize:13, color:"#9c918d" }}>Sem dados ainda</div>}
          {Object.entries(paymentMap).map(([pay, count]) => (
            <div key={pay} className="srow"><span className="slabel">{pay}</span><span style={{ fontWeight:700 }}>{count}</span></div>
          ))}
        </div>
      </div>
    </>
  );
}

/* SETTINGS */
function SettingsView({
  paperWidth,
  setPaperWidth,
  soundEnabled,
  onToggleSound,
  onTestSound,
  notify,
  onClear,
}: {
  paperWidth: 58 | 80;
  setPaperWidth: (w: 58 | 80) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onTestSound: () => void;
  notify: (m: string) => void;
  onClear?: () => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");

  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.trim().length < 4) {
      setPwdMsg("A senha deve conter ao menos 4 caracteres.");
      return;
    }
    try {
      localStorage.setItem("smack_admin_pwd", newPassword.trim());
      setPwdMsg("Senha de acesso atualizada com sucesso!");
      setNewPassword("");
      notify("Nova senha de admin salva com sucesso!");
    } catch {
      setPwdMsg("Erro ao salvar senha no navegador.");
    }
  };

  return (
    <>
      <div className="sec-header"><span className="sec-title">Configurações</span></div>

      {/* SEGURANÇA & ACESSO */}
      <div className="ssection">
        <div className="ssection-title">Segurança de Acesso ao Painel</div>
        <form onSubmit={handleSavePassword}>
          <div className="srow">
            <div>
              <div className="slabel">Senha do Painel de Admin</div>
              <div className="shint">Senha para autorizar o acesso ao painel (padrão: smack2026)</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="text"
                className="form-ctrl"
                placeholder="Nova senha..."
                style={{ width: 160, padding: "6px 10px", fontSize: 13 }}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setPwdMsg(""); }}
              />
              <button type="submit" className="btn-primary btn-sm">
                Salvar Senha
              </button>
            </div>
          </div>
          {pwdMsg && (
            <div style={{ fontSize: 12, marginTop: 8, color: pwdMsg.includes("sucesso") ? "#16a34a" : "#b91c1c", fontWeight: 600 }}>
              {pwdMsg}
            </div>
          )}
        </form>
      </div>

      <div className="ssection">
        <div className="ssection-title">Impressora Térmica</div>
        <div className="srow">
          <div><div className="slabel">Largura do Papel</div><div className="shint">Selecione de acordo com o rolo da sua impressora</div></div>
          <div className="radio-grp">
            <button className={`rbtn${paperWidth === 58 ? " active" : ""}`} onClick={() => { setPaperWidth(58); notify("Configurado para papel 58mm."); }}>58mm</button>
            <button className={`rbtn${paperWidth === 80 ? " active" : ""}`} onClick={() => { setPaperWidth(80); notify("Configurado para papel 80mm."); }}>80mm</button>
          </div>
        </div>
        <div className="srow">
          <div><div className="slabel">Impressão automática</div><div className="shint">Imprime ao aceitar um novo pedido</div></div>
          <button className="btn-secondary btn-sm">Em breve</button>
        </div>
      </div>

      <div className="ssection">
        <div className="ssection-title">Notificações Sonoras e Mensagens</div>
        <div className="srow">
          <div>
            <div className="slabel">Alerta sonoro de novo pedido</div>
            <div className="shint">Toca um sino sonoro agradável quando um novo pedido chega</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              className={`rbtn${soundEnabled ? " active" : ""}`}
              onClick={onToggleSound}
            >
              {soundEnabled ? "Som Ativo" : "Mudo"}
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={onTestSound}
            >
              Testar Som 🔔
            </button>
          </div>
        </div>
        <div className="srow">
          <div><div className="slabel">Notificação por WhatsApp ao cliente</div><div className="shint">Permite envio de status de saída e entrega com 1 clique</div></div>
          <span style={{ fontSize:12, fontWeight:700, color:"#17a35c" }}>Ativo</span>
        </div>
      </div>

      <div className="ssection">
        <div className="ssection-title">Gerenciamento de Testes</div>
        <div className="srow">
          <div>
            <div className="slabel" style={{ color:"#9b1c1c" }}>Limpar Pedidos de Teste</div>
            <div className="shint">Zera todos os pedidos do Quadro Kanban e histórico</div>
          </div>
          <button
            className="btn-danger"
            style={{ padding:"8px 16px", fontSize:12 }}
            onClick={async () => {
              if (confirm("Deseja realmente limpar todos os pedidos de teste?")) {
                try {
                  await fetch("/api/orders", { method: "DELETE" });
                  notify("Todos os pedidos foram limpos!");
                  if (onClear) onClear();
                } catch (e) {
                  notify("Falha ao limpar pedidos");
                }
              }
            }}
          >
            Limpar Pedidos
          </button>
        </div>
      </div>
      <div className="ssection">
        <div className="ssection-title">Informações da Conta</div>
        <div className="srow"><span className="slabel">Estabelecimento</span><span style={{ fontWeight:700 }}>Smack Chicken</span></div>
        <div className="srow"><span className="slabel">Plataforma</span><span style={{ fontWeight:700 }}>Site de Pedidos Online</span></div>
        <div className="srow"><span className="slabel">Versão do sistema</span><span style={{ fontWeight:600, color:"#9c918d" }}>1.1.0</span></div>
      </div>
    </>
  );
}

/* ORDER DETAIL MODAL */
function OrderDetailModal({ order, onClose, onMove, onPrint }: {
  order: Order; onClose: () => void;
  onMove: (o: Order, s: Order["status"]) => void;
  onPrint: (o: Order) => void;
}) {
  const statusColor = STATUS_COLOR[order.status];
  const next = order.status === "preparing" ? "ready" : order.status === "ready" ? "completed" : null;
  const nextLbl = order.status === "preparing" ? "Marcar como Pronto" : order.status === "ready" ? "Confirmar Entrega" : null;

  const parsed = parseOrderDetails(order);
  const cleanPhone = parsed.phone ? parsed.phone.replace(/\D/g, "") : null;
  const whatsappNumber = cleanPhone ? (cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone) : null;
  const whatsappLink = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
        `Olá ${order.customerName}, tudo bem? Falamos do Smack Chicken referente ao seu pedido ${fmtCode(order.code)}!`
      )}`
    : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Pedido {fmtCode(order.code)}</div>
            <div style={{ marginTop:4 }}>
              <span className="sbadge" style={{ background:`${statusColor}18`, color:statusColor, borderColor:`${statusColor}40` }}>
                <Dot color={statusColor} />{statusLabel(order.status)}
              </span>
            </div>
          </div>
          <button className="adm-icon-btn" onClick={onClose}><IcoClose /></button>
        </div>

        <div className="modal-body">
          {/* ALERTA CRÍTICO PARA COZINHA */}
          {parsed.allKitchenNotes.length > 0 && (
            <div className="kitchen-alert">
              <div style={{ color:"#b91c1c", marginTop:2, flexShrink:0 }}>
                <IcoAlert />
              </div>
              <div style={{ flex:1 }}>
                <div className="kitchen-alert-title">Atenção Cozinha — Observações</div>
                {parsed.allKitchenNotes.map((note, idx) => (
                  <div key={idx} className="kitchen-alert-text">
                    {parsed.allKitchenNotes.length > 1 ? `• ${note}` : note}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DADOS DO CLIENTE & CONTATO */}
          <div className="msect-title">Cliente & Contato</div>
          <div className="mrow">
            <span className="mrow-label">Cliente</span>
            <span className="mrow-val" style={{ fontWeight:700 }}>{order.customerName}</span>
          </div>
          {parsed.phone && (
            <div className="mrow">
              <span className="mrow-label">WhatsApp</span>
              <span className="mrow-val" style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
                <span style={{ fontWeight:600 }}>{parsed.phoneFormatted || parsed.phone}</span>
                {whatsappLink && (
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="whatsapp-btn"
                    title="Conversar no WhatsApp"
                  >
                    <IcoWhatsApp /> Conversar
                  </a>
                )}
              </span>
            </div>
          )}
          <div className="mrow">
            <span className="mrow-label">Canal / Origem</span>
            <span className="mrow-val">{order.channel}</span>
          </div>
          <div className="mrow">
            <span className="mrow-label">Horário</span>
            <span className="mrow-val">{fmtTime(order.createdAt)} · {elapsed(order.createdAt)} atrás</span>
          </div>

          {/* ENTREGA & PAGAMENTO */}
          <div style={{ margin:"18px 0 8px" }} className="msect-title">Entrega & Pagamento</div>
          <div className="mrow">
            <span className="mrow-label">Modalidade</span>
            <span className="mrow-val" style={{ fontWeight:700, color:parsed.deliveryType?.toLowerCase().includes("entrega") ? "#b70922" : "#1b1715" }}>
              {parsed.deliveryType || "Balcão / Não especificado"}
            </span>
          </div>
          {parsed.address ? (
            <div className="mrow" style={{ alignItems:"flex-start" }}>
              <span className="mrow-label">Endereço</span>
              <span className="mrow-val" style={{ textAlign:"right", maxWidth:280, fontWeight:600, color:"#1b1715", wordBreak:"break-word" }}>
                {parsed.address}
              </span>
            </div>
          ) : parsed.deliveryType?.toLowerCase().includes("retirada") ? (
            <div className="mrow">
              <span className="mrow-label">Endereço</span>
              <span className="mrow-val" style={{ color:"#7a6f69" }}>Retirada no Balcão da Loja</span>
            </div>
          ) : null}
          <div className="mrow">
            <span className="mrow-label">Forma de Pagamento</span>
            <span className="mrow-val" style={{ fontWeight:600 }}>{parsed.paymentInfo || order.paymentMethod}</span>
          </div>
          {order.cashReceivedCents !== undefined && order.cashReceivedCents > 0 && (
            <div className="mrow">
              <span className="mrow-label">Troco para</span>
              <span className="mrow-val" style={{ fontWeight:700, color:"#138c56" }}>{formatMoney(order.cashReceivedCents)}</span>
            </div>
          )}

          {/* RASTREIO E MOTOBOY */}
          {(parsed.motoboyName || parsed.checkedInAt || parsed.deliveredAt) && (
            <div style={{ marginTop:14, background:"#f8fafc", padding:"10px 12px", borderRadius:8, border:"1px solid #e2e8f0" }}>
              <div className="msect-title" style={{ marginBottom:6, color:"#1d4ed8" }}>Dados do Entregador & Horários</div>
              {parsed.motoboyName && (
                <div className="mrow">
                  <span className="mrow-label">Motoboy</span>
                  <span className="mrow-val" style={{ fontWeight:700, color:"#1d4ed8" }}>🛵 {parsed.motoboyName}</span>
                </div>
              )}
              {parsed.checkedInAt && (
                <div className="mrow">
                  <span className="mrow-label">Check-in (Saída da Loja)</span>
                  <span className="mrow-val" style={{ fontWeight:600 }}>{parsed.checkedInAt}</span>
                </div>
              )}
              {parsed.deliveredAt && (
                <div className="mrow">
                  <span className="mrow-label">Check-out (Entregue)</span>
                  <span className="mrow-val" style={{ fontWeight:700, color:"#16a34a" }}>✅ {parsed.deliveredAt}</span>
                </div>
              )}
            </div>
          )}

          {/* ITENS DETALHADOS */}
          <div style={{ margin:"18px 0 8px" }} className="msect-title">Itens do Pedido</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {order.items.map((item) => {
              const { title, customs, itemObs } = parseItemName(item.name);
              return (
                <div key={item.id} style={{ background:"#faf7f2", border:"1px solid #e6dfd6", borderRadius:8, padding:"10px 12px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                    <span style={{ fontWeight:700, fontSize:13.5, color:"#1b1715" }}>
                      {item.quantity}x {title}
                    </span>
                    <span style={{ fontWeight:700, fontSize:13.5, color:"#1b1715", flexShrink:0 }}>
                      {formatMoney(item.unitPriceCents * item.quantity)}
                    </span>
                  </div>
                  {customs.length > 0 && (
                    <div style={{ fontSize:12, color:"#7a6f69", marginTop:4, display:"flex", flexWrap:"wrap", gap:6 }}>
                      {customs.map((c, i) => (
                        <span key={i} style={{ background:"#ede7df", padding:"1px 6px", borderRadius:4 }}>
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                  {itemObs && (
                    <div style={{ marginTop:6 }}>
                      <span className="obs-pill">
                        <IcoAlert /> Obs: {itemObs}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* TOTAIS */}
          <div style={{ marginTop:14 }}>
            {order.discountCents ? (
              <div className="mrow">
                <span className="mrow-label">Desconto</span>
                <span className="mrow-val" style={{ color:"#17a35c" }}>-{formatMoney(order.discountCents)}</span>
              </div>
            ) : null}
            <div className="mrow" style={{ borderTop:"2px solid #e6dfd6", paddingTop:10, marginTop:4 }}>
              <span style={{ fontWeight:700, fontSize:14 }}>Total do Pedido</span>
              <span style={{ fontWeight:800, fontSize:17, color:"#b70922" }}>{formatMoney(order.totalCents)}</span>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          {next && (
            <button className="btn-primary" onClick={() => { onMove(order, next); onClose(); }}>
              {nextLbl} <IcoArrow />
            </button>
          )}
          <button className="btn-secondary" onClick={() => onPrint(order)}>
            <IcoPrint /> Imprimir
          </button>
          {order.status === "preparing" && (
            <button className="btn-danger" onClick={() => { onMove(order, "cancelled"); onClose(); }}>
              Cancelar Pedido
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
