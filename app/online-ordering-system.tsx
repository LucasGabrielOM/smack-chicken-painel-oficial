"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { catalog, formatMoney, CatalogProduct } from "../lib/catalog";
import { fetchCepDeliveryInfo, CepDeliveryResult, MAX_DELIVERY_RADIUS_KM } from "../lib/delivery";
import type { DeliverySettings } from "../lib/product-store";

// Molhos grátis da casa (até 2 grátis por lanche/balde/combo)
const FREE_SAUCE_OPTIONS = [
  { id: "maionese-temperada", name: "Maionese Temperada Especial" },
  { id: "maionese-alho", name: "Maionese de Alho Artesanal" },
  { id: "pimenta-agridoce", name: "Molho de Pimenta Agridoce" },
  { id: "barbecue", name: "Molho Barbecue Defumado" },
  { id: "molho-smack", name: "Molho Secreto da Smack" },
];

// Molhos extras pagos (a partir do 3º ou especiais)
const EXTRA_SAUCE_OPTIONS = [
  { id: "extra-bacon", name: "Molho de Bacon Crocante (50g)", priceCents: 500 },
  { id: "extra-maionese-temperada", name: "Maionese Temperada Adicional (50g)", priceCents: 400 },
  { id: "extra-maionese-alho", name: "Maionese de Alho Adicional (50g)", priceCents: 400 },
  { id: "extra-pimenta-agridoce", name: "Pimenta Agridoce Adicional (50g)", priceCents: 400 },
  { id: "extra-barbecue", name: "Barbecue Defumado Adicional (50g)", priceCents: 400 },
  { id: "extra-molho-smack", name: "Molho Smack Adicional (50g)", priceCents: 400 },
];

// Acompanhamentos sugeridos (Turbine seu pedido)
const RECOMMENDED_UPSELLS = [
  { id: "upsell-batata-m", name: "Batata Frita 250g (M)", priceCents: 1499 },
  { id: "upsell-batata-g", name: "Batata Frita 350g (G)", priceCents: 1999 },
  { id: "upsell-polenta-m", name: "Polenta Frita Crocante 250g", priceCents: 1499 },
  { id: "upsell-coca-lata", name: "Coca-Cola Lata 350ml Gelada", priceCents: 600 },
  { id: "upsell-guarana-lata", name: "Guaraná Pureza / Antarctica 350ml", priceCents: 600 },
];

// Opções de acompanhamentos inclusos nos combos (grátis)
const COMBO_SIDE_OPTIONS = [
  { id: "side-batata-250", name: "Batata Frita 250g (M) Crocante", desc: "Batata palito crocante e sequinha" },
  { id: "side-polenta-250", name: "Polenta Frita 250g (M) Crocante", desc: "Polenta frita artesanal super crocante" },
];

const COMBO_KIDS_SIDE_OPTIONS = [
  { id: "side-batata-smile", name: "Batata Smile 150g Divertida", desc: "Batatas smile crocantes por fora e macias por dentro" },
  { id: "side-batata-frita-150", name: "Batata Frita 150g Tradicional", desc: "Batata palito crocante" },
];

// Opções de refrigerantes / bebidas inclusas nos combos (grátis)
const COMBO_DRINK_STANDARD = [
  { id: "refri-coca-600", name: "Coca-Cola 600ml Gelada", desc: "Garrafa 600ml gelada" },
  { id: "refri-pureza-1l", name: "Guaraná Pureza 1 Litro Gelado", desc: "Garrafa 1 Litro gelada tradicional de SC" },
];

const COMBO_DRINK_BOTTLES = [
  { id: "refri-coca-600", name: "Coca-Cola 600ml Gelada", desc: "Garrafa 600ml gelada" },
  { id: "refri-pureza-1l", name: "Guaraná Pureza 1 Litro Gelado", desc: "Garrafa 1 Litro gelada tradicional de SC" },
  { id: "refri-coca-15l", name: "Coca-Cola Original 1,5L Gelada", desc: "Garrafa 1,5L gelada" },
  { id: "refri-coca-zero-15l", name: "Coca-Cola Zero 1,5L Gelada", desc: "Garrafa 1,5L zero açúcar gelada" },
];

type CustomizationItem = {
  id: string;
  name: string;
  priceCents: number;
};

type CartItem = {
  cartItemId: string;
  product: CatalogProduct;
  quantity: number;
  selectedSide?: string;
  selectedDrink?: string;
  freeSauces: string[];
  extraSauces: CustomizationItem[];
  upsells: CustomizationItem[];
  notes: string;
  unitPriceCents: number;
};

type TrackedOrder = {
  id: string;
  code: string;
  customerName: string;
  status: "preparing" | "ready" | "completed" | "cancelled";
  paymentMethod: string;
  totalCents: number;
  createdAt: string;
  notes?: string;
  items: Array<{ id: string; name: string; quantity: number; unitPriceCents: number }>;
};

function fmtOrderTime(dateStr?: string) {
  if (!dateStr) return "--:--";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtEstimatedTime(dateStr?: string, plusMinutes: number = 45) {
  if (!dateStr) return "--:--";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "--:--";
  const target = new Date(d.getTime() + plusMinutes * 60000);
  return target.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function OnlineOrderingSystem() {
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [liveProducts, setLiveProducts] = useState<CatalogProduct[]>(catalog);
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings | null>(null);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(Date.now()), 10000);
    return () => clearInterval(t);
  }, []);

  // Sincronização em tempo real de produtos e taxas de entrega com o Painel de Administração
  useEffect(() => {
    let isMounted = true;
    fetch("/api/products")
      .then((res) => res.json())
      .then((data: any) => {
        if (isMounted && Array.isArray(data?.products) && data.products.length > 0) {
          setLiveProducts(data.products);
        }
      })
      .catch((err) => console.warn("Erro ao buscar produtos atualizados:", err));

    fetch("/api/delivery-settings")
      .then((res) => res.json())
      .then((data: any) => {
        if (isMounted && data?.settings) {
          setDeliverySettings(data.settings);
        }
      })
      .catch((err) => console.warn("Erro ao buscar taxas de entrega atualizadas:", err));

    return () => {
      isMounted = false;
    };
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [searchQuery, setSearchQuery] = useState("");

  // Carrinho
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCartModal, setShowCartModal] = useState(false);

  // Modal de Detalhes do Produto (iFood Style)
  const [activeProduct, setActiveProduct] = useState<CatalogProduct | null>(null);
  const [detailQuantity, setDetailQuantity] = useState(1);
  const [selectedComboSide, setSelectedComboSide] = useState<string>("");
  const [selectedComboDrink, setSelectedComboDrink] = useState<string>("");
  const [selectedFreeSauces, setSelectedFreeSauces] = useState<string[]>([]);
  const [selectedExtraSauces, setSelectedExtraSauces] = useState<CustomizationItem[]>([]);
  const [selectedUpsells, setSelectedUpsells] = useState<CustomizationItem[]>([]);
  const [detailNotes, setDetailNotes] = useState("");

  // Checkout Form State
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryType, setDeliveryType] = useState<"ENTREGA" | "RETIRADA">("ENTREGA");
  const [orderCustomerNotes, setOrderCustomerNotes] = useState("");

  // ViaCEP Address State
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [cityState, setCityState] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepError, setCepError] = useState("");
  const [deliveryInfo, setDeliveryInfo] = useState<CepDeliveryResult | null>(null);

  // Forma de Pagamento & Troco
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "CARTAO_CREDITO" | "CARTAO_DEBITO" | "DINHEIRO">("PIX");
  const [needsChange, setNeedsChange] = useState(false);
  const [changeForAmount, setChangeForAmount] = useState("");

  // Status de envio e pedido confirmado
  const [submitting, setSubmitting] = useState(false);
  const [latestOrderCode, setLatestOrderCode] = useState<string | null>(null);

  // Acompanhamento de Pedido
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [trackQuery, setTrackQuery] = useState("");
  const [trackedOrders, setTrackedOrders] = useState<TrackedOrder[]>([]);
  const [trackingLoading, setTrackingLoading] = useState(false);

  // Cupom de Desconto
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountPercent: number;
    discountCents: number;
    message: string;
    remainingUses: number;
    validatedPhone: string;
  } | null>(null);

  // Verifica se o produto atual tem direito a molhos grátis
  const productHasFreeSauces = useMemo(() => {
    if (!activeProduct) return false;
    const cat = activeProduct.category.toLowerCase();
    return cat === "baldes" || cat === "combos" || cat === "lanches";
  }, [activeProduct]);

  // Identifica se o produto é um combo com acompanhamento e bebida inclusos
  const isComboProduct = useMemo(() => {
    if (!activeProduct) return false;
    const cat = (activeProduct.category || "").toLowerCase();
    const txt = ((activeProduct.name || "") + " " + (activeProduct.description || "")).toLowerCase();
    return (
      cat === "combos" ||
      txt.includes("combo") ||
      txt.includes("acompanhamento") ||
      txt.includes("batata frita ou polenta") ||
      txt.includes("refrigerante")
    );
  }, [activeProduct]);

  const isKidsProduct = useMemo(() => {
    if (!activeProduct) return false;
    return (activeProduct.name || "").toLowerCase().includes("kids");
  }, [activeProduct]);

  const isLargeDrinkCombo = useMemo(() => {
    if (!activeProduct) return false;
    const txt = ((activeProduct.name || "") + " " + (activeProduct.description || "")).toLowerCase();
    return txt.includes("1,5") || txt.includes("1.5") || txt.includes("garrafa");
  }, [activeProduct]);

  const currentComboSideOptions = useMemo(() => {
    return isKidsProduct ? COMBO_KIDS_SIDE_OPTIONS : COMBO_SIDE_OPTIONS;
  }, [isKidsProduct]);

  const currentComboDrinkOptions = useMemo(() => {
    return isLargeDrinkCombo ? COMBO_DRINK_BOTTLES : COMBO_DRINK_STANDARD;
  }, [isLargeDrinkCombo]);

  // Abertura do Modal de Detalhes
  const openProductDetail = (product: CatalogProduct) => {
    setActiveProduct(product);
    setDetailQuantity(1);
    setSelectedFreeSauces([]);
    setSelectedExtraSauces([]);
    setSelectedUpsells([]);
    setDetailNotes("");

    const cat = (product.category || "").toLowerCase();
    const txt = ((product.name || "") + " " + (product.description || "")).toLowerCase();
    const isCombo = cat === "combos" || txt.includes("combo") || txt.includes("acompanhamento") || txt.includes("refrigerante");
    if (isCombo) {
      const isKids = (product.name || "").toLowerCase().includes("kids");
      setSelectedComboSide(isKids ? COMBO_KIDS_SIDE_OPTIONS[0].name : COMBO_SIDE_OPTIONS[0].name);
      const isLarge = txt.includes("1,5") || txt.includes("1.5") || txt.includes("garrafa");
      setSelectedComboDrink(isLarge ? COMBO_DRINK_BOTTLES[0].name : COMBO_DRINK_STANDARD[0].name);
    } else {
      setSelectedComboSide("");
      setSelectedComboDrink("");
    }
  };

  const closeProductDetail = () => {
    setActiveProduct(null);
  };

  // Alternar molho grátis (com limite máximo de 2)
  const toggleFreeSauce = (sauceName: string) => {
    setSelectedFreeSauces((prev) => {
      if (prev.includes(sauceName)) {
        return prev.filter((s) => s !== sauceName);
      }
      if (prev.length >= 2) {
        return prev; // Limite máximo de 2 molhos grátis atingido
      }
      return [...prev, sauceName];
    });
  };

  // Alternar molho extra pago
  const toggleExtraSauce = (sauce: CustomizationItem) => {
    setSelectedExtraSauces((prev) =>
      prev.some((s) => s.id === sauce.id)
        ? prev.filter((s) => s.id !== sauce.id)
        : [...prev, sauce]
    );
  };

  // Alternar acompanhamento upsell
  const toggleUpsell = (item: CustomizationItem) => {
    setSelectedUpsells((prev) =>
      prev.some((i) => i.id === item.id)
        ? prev.filter((i) => i.id !== item.id)
        : [...prev, item]
    );
  };

  // Preço unitário calculado para o item configurado
  const currentDetailUnitPriceCents = useMemo(() => {
    if (!activeProduct) return 0;
    const extrasTotal = selectedExtraSauces.reduce((sum, s) => sum + s.priceCents, 0);
    const upsellsTotal = selectedUpsells.reduce((sum, u) => sum + u.priceCents, 0);
    return activeProduct.priceCents + extrasTotal + upsellsTotal;
  }, [activeProduct, selectedExtraSauces, selectedUpsells]);

  // Adicionar o item configurado ao carrinho
  const handleAddConfiguredItemToCart = () => {
    if (!activeProduct) return;

    if (isComboProduct) {
      if (!selectedComboSide) {
        alert("Por favor, selecione seu acompanhamento grátis (Batata ou Polenta).");
        return;
      }
      if (!selectedComboDrink) {
        alert("Por favor, selecione sua bebida/refrigerante grátis.");
        return;
      }
    }

    const extrasKey = [
      selectedComboSide ? `side:${selectedComboSide}` : "",
      selectedComboDrink ? `drink:${selectedComboDrink}` : "",
      ...selectedFreeSauces.map((s) => `free:${s}`),
      ...selectedExtraSauces.map((s) => `extra:${s.id}`),
      ...selectedUpsells.map((u) => `up:${u.id}`),
      detailNotes.trim(),
    ].filter(Boolean).join("|");

    const cartItemId = `${activeProduct.id}-${extrasKey}`;

    setCart((prev) => {
      const existingIdx = prev.findIndex((i) => i.cartItemId === cartItemId);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: updated[existingIdx].quantity + detailQuantity,
        };
        return updated;
      }
      return [
        ...prev,
        {
          cartItemId,
          product: activeProduct,
          quantity: detailQuantity,
          selectedSide: selectedComboSide || undefined,
          selectedDrink: selectedComboDrink || undefined,
          freeSauces: selectedFreeSauces,
          extraSauces: selectedExtraSauces,
          upsells: selectedUpsells,
          notes: detailNotes.trim(),
          unitPriceCents: currentDetailUnitPriceCents,
        },
      ];
    });

    closeProductDetail();
  };

  // Quantidade e exclusão no carrinho
  const updateCartQty = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartItemId === cartItemId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeCartItem = (cartItemId: string) => {
    setCart((prev) => prev.filter((i) => i.cartItemId !== cartItemId));
  };

  const cartItemCount = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);
  const subtotalCents = useMemo(
    () => cart.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0),
    [cart]
  );
  const effectiveMaxRadius = deliverySettings?.maxRadiusKm || MAX_DELIVERY_RADIUS_KM;

  const deliveryFeeCents = useMemo(() => {
    if (deliveryType === "RETIRADA") return 0;
    if (deliveryInfo?.tier) return deliveryInfo.tier.feeCents;
    if (deliverySettings?.tiers && deliverySettings.tiers.length > 0) {
      return deliverySettings.tiers[0].feeCents;
    }
    return 499;
  }, [deliveryType, deliveryInfo, deliverySettings]);
  const discountCents = useMemo(() => {
    if (!appliedCoupon) return 0;
    return Math.round(subtotalCents * (appliedCoupon.discountPercent / 100));
  }, [appliedCoupon, subtotalCents]);

  const totalCents = Math.max(0, subtotalCents + deliveryFeeCents - discountCents);

  // Troco calculado
  const changeValueCents = useMemo(() => {
    if (paymentMethod !== "DINHEIRO" || !needsChange) return 0;
    const clean = changeForAmount.replace(/[^0-9]/g, "");
    const givenCents = Number(clean) * 100;
    return givenCents > totalCents ? givenCents - totalCents : 0;
  }, [paymentMethod, needsChange, changeForAmount, totalCents]);

  // Aplicação do Cupom de Desconto com validação por WhatsApp (matrícula)
  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setCouponError("Por favor, digite o código do cupom.");
      return;
    }

    const cleanPhone = customerPhone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setCouponError("Por favor, preencha o seu WhatsApp acima para validar o cupom.");
      return;
    }

    setCouponLoading(true);
    setCouponError(null);

    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          phone: cleanPhone,
          subtotalCents,
        }),
      });
      const data = (await res.json()) as {
        valid?: boolean;
        code?: string;
        discountPercent?: number;
        message?: string;
        remainingUses?: number;
        error?: string;
      };

      if (!res.ok || !data.valid) {
        setCouponError(data.error || "Cupom inválido ou limite de utilizações atingido.");
        setAppliedCoupon(null);
      } else {
        setAppliedCoupon({
          code: data.code || code,
          discountPercent: data.discountPercent || 10,
          discountCents: Math.round(subtotalCents * ((data.discountPercent || 10) / 100)),
          message: data.message || `Cupom ${code} aplicado com sucesso!`,
          remainingUses: data.remainingUses ?? 1,
          validatedPhone: cleanPhone,
        });
        setCouponError(null);
      }
    } catch {
      setCouponError("Falha ao validar cupom. Verifique sua conexão.");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError(null);
  };

  // Revalida automaticamente se o cliente alterar o telefone após aplicar o cupom
  useEffect(() => {
    if (!appliedCoupon) return;
    const cleanCurrent = customerPhone.replace(/\D/g, "");
    if (cleanCurrent && cleanCurrent.length >= 10 && cleanCurrent !== appliedCoupon.validatedPhone) {
      fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: appliedCoupon.code,
          phone: cleanCurrent,
          subtotalCents,
        }),
      })
        .then((r) => r.json())
        .then((data: any) => {
          if (!data.valid) {
            setAppliedCoupon(null);
            setCouponError(data.error || "Cupom indisponível para este novo número de WhatsApp.");
          } else {
            setAppliedCoupon((prev) =>
              prev
                ? {
                    ...prev,
                    validatedPhone: cleanCurrent,
                    remainingUses: data.remainingUses ?? 1,
                    message: data.message || prev.message,
                  }
                : null
            );
          }
        })
        .catch(() => {});
    }
  }, [customerPhone, appliedCoupon, subtotalCents]);

  // Consulta e cálculo dinâmico de taxa e tempo por CEP
  const handleFetchCep = async (inputCep: string) => {
    const cleanCep = inputCep.replace(/\D/g, "");
    setCep(cleanCep);
    setCepError("");

    if (cleanCep.length !== 8) {
      setDeliveryInfo(null);
      if (cleanCep.length > 0 && cleanCep.length < 8) {
        setCepError("Digite os 8 números do CEP para calcular taxa e tempo.");
      }
      return;
    }

    setLoadingCep(true);
    try {
      const result = await fetchCepDeliveryInfo(cleanCep, deliverySettings || undefined);
      if (!result.success) {
        setCepError(result.error || "CEP não encontrado. Preencha o endereço abaixo.");
        setDeliveryInfo(null);
      } else {
        if (result.street) setStreet(result.street);
        if (result.neighborhood) setNeighborhood(result.neighborhood);
        if (result.city) setCityState(`${result.city} - ${result.state}`);
        setDeliveryInfo(result);
        if (!result.isWithinRadius) {
          setCepError(result.error || `Endereço fora do raio de entrega de ${effectiveMaxRadius} km da loja.`);
        }
      }
    } catch {
      setCepError("Não foi possível calcular o CEP automaticamente.");
      setDeliveryInfo(null);
    } finally {
      setLoadingCep(false);
    }
  };

  // Envio do Pedido
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) return alert("Por favor, digite seu nome completo.");
    if (!customerPhone.trim()) return alert("Por favor, informe seu número de WhatsApp.");

    let fullAddressText = "Retirada no Balcão (Rua Fúlvio Aducci, 1074)";
    if (deliveryType === "ENTREGA") {
      if (!cep.trim() || cep.replace(/\D/g, "").length !== 8) {
        return alert(`Por favor, informe seu CEP para calcular a entrega e confirmar se seu endereço está dentro do raio de atendimento de ${effectiveMaxRadius} km.`);
      }
      if (deliveryInfo && !deliveryInfo.isWithinRadius) {
        return alert(`Desculpe, seu endereço está a ${deliveryInfo.distanceKm?.toFixed(1) || ""} km da loja, fora do nosso raio de entrega de ${effectiveMaxRadius} km. Por favor, selecione "Retirar na Loja" para concluir seu pedido!`);
      }
      if (!street.trim()) return alert("Por favor, informe o nome da Rua para a entrega.");
      if (!number.trim()) return alert("Por favor, informe o Número da residência.");
      fullAddressText = `CEP: ${cep || "N/A"} - ${street.trim()}, Nº ${number.trim()}${complement.trim() ? ` (${complement.trim()})` : ""} - Bairro: ${neighborhood.trim() || "Estreito"}, ${cityState || "Florianópolis - SC"}`;
    }

    let paymentDescription = "Pix";
    if (paymentMethod === "CARTAO_CREDITO") paymentDescription = "Cartão de Crédito na Entrega";
    if (paymentMethod === "CARTAO_DEBITO") paymentDescription = "Cartão de Débito na Entrega";
    if (paymentMethod === "DINHEIRO") {
      paymentDescription = needsChange && changeForAmount
        ? `Dinheiro (Troco para R$ ${changeForAmount})`
        : "Dinheiro (Não precisa de troco)";
    }

    const deliveryNote =
      deliveryType === "ENTREGA" && deliveryInfo?.tier
        ? `Taxa de Entrega: ${deliveryInfo.tier.feeFormatted} (~${deliveryInfo.distanceKm?.toFixed(1)} km · ${deliveryInfo.tier.timeMinutes} min)`
        : null;

    const couponNote = appliedCoupon && discountCents > 0
      ? `Cupom: ${appliedCoupon.code} (-${appliedCoupon.discountPercent}% · ${formatMoney(discountCents)})`
      : null;

    const orderNotes = [
      `WhatsApp: ${customerPhone.trim()}`,
      `Modalidade: ${deliveryType === "ENTREGA" ? "Entrega em Domicílio" : "Retirada na Loja"}`,
      ...(deliveryNote ? [deliveryNote] : []),
      `Endereço: ${fullAddressText}`,
      `Pagamento: ${paymentDescription}`,
      ...(couponNote ? [couponNote] : []),
      ...(needsChange && changeValueCents > 0 ? [`Levar troco de: ${formatMoney(changeValueCents)}`] : []),
      ...(orderCustomerNotes.trim() ? [`Observação: ${orderCustomerNotes.trim()}`] : []),
    ].join(" | ");

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          paymentMethod: paymentDescription,
          channel: "SITE_ONLINE",
          deliveryFeeCents: deliveryType === "ENTREGA" ? deliveryFeeCents : 0,
          discountCents: discountCents > 0 ? discountCents : 0,
          couponCode: appliedCoupon?.code || undefined,
          notes: orderNotes,
          items: cart.map((item) => {
            const customParts = [
              item.selectedSide ? `Acompanhamento: ${item.selectedSide}` : null,
              item.selectedDrink ? `Bebida: ${item.selectedDrink}` : null,
              item.freeSauces.length > 0 ? `Molhos Grátis: ${item.freeSauces.join(", ")}` : null,
              item.extraSauces.length > 0 ? `Molhos Extras: ${item.extraSauces.map((s) => s.name).join(", ")}` : null,
              item.upsells.length > 0 ? `Adicionais: ${item.upsells.map((u) => u.name).join(", ")}` : null,
              item.notes ? `Obs: ${item.notes}` : null,
            ].filter(Boolean);

            const fullName = customParts.length > 0 ? `${item.product.name} [${customParts.join(" | ")}]` : item.product.name;

            return {
              productId: item.product.id,
              quantity: item.quantity,
              name: fullName,
              unitPriceCents: item.unitPriceCents,
            };
          }),
        }),
      });

      const data = (await res.json()) as { error?: string; order?: { code: string } };
      if (!res.ok) throw new Error(data.error || "Não foi possível enviar o pedido.");

      const newCode = data.order?.code || "#1042";
      setLatestOrderCode(newCode);
      setCart([]);
      setAppliedCoupon(null);
      setCouponInput("");
      setCouponError(null);
      setOrderCustomerNotes("");
      setShowCartModal(false);
      setTrackQuery(newCode);
      setShowTrackingModal(true);
      try {
        localStorage.setItem("smack_latest_order", newCode);
      } catch {}
      // Busca dados imediatos para o acompanhamento
      fetchOrderStatus(newCode);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao enviar o pedido");
    } finally {
      setSubmitting(false);
    }
  };

  // Buscar status do pedido
  const fetchOrderStatus = async (queryText: string) => {
    if (!queryText.trim()) return;
    setTrackingLoading(true);
    try {
      const param = queryText.startsWith("#") || !queryText.replace(/\D/g, "") ? `code=${encodeURIComponent(queryText.trim())}` : `phone=${encodeURIComponent(queryText.trim())}`;
      const res = await fetch(`/api/orders?${param}`);
      const data = (await res.json()) as { orders?: TrackedOrder[] };
      setTrackedOrders(data.orders || []);
    } catch {
      setTrackedOrders([]);
    } finally {
      setTrackingLoading(false);
    }
  };

  // Atualização em tempo real do acompanhamento enquanto o modal estiver aberto
  useEffect(() => {
    if (!showTrackingModal || !trackQuery.trim()) return;
    const interval = setInterval(() => {
      fetchOrderStatus(trackQuery);
    }, 4000);
    return () => clearInterval(interval);
  }, [showTrackingModal, trackQuery]);

  // Carrega acompanhamento a partir de parâmetros da URL (?track=1042) ou do último código salvo
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        const urlTrack = urlParams.get("track") || urlParams.get("tracking") || urlParams.get("pedido") || urlParams.get("codigo");
        if (urlTrack) {
          const formattedCode = urlTrack.trim().startsWith("#") ? urlTrack.trim() : `#${urlTrack.trim()}`;
          setTrackQuery(formattedCode);
          setShowTrackingModal(true);
          fetchOrderStatus(formattedCode);
          return;
        }
      }

      const saved = localStorage.getItem("smack_latest_order");
      if (saved && !trackQuery) {
        setTrackQuery(saved);
      }
    } catch {}
  }, []);

  // Trava o scroll da tela de fundo quando qualquer janela flutuante estiver aberta
  useEffect(() => {
    const isAnyModalOpen = Boolean(activeProduct) || showCartModal || showTrackingModal;
    if (isAnyModalOpen) {
      const scrollY = window.scrollY;
      document.documentElement.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
    } else {
      const scrollY = document.body.style.top;
      document.documentElement.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || "0", 10) * -1);
      }
    }
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
    };
  }, [activeProduct, showCartModal, showTrackingModal]);


  const activeProducts = useMemo(() => {
    return liveProducts.filter((p) => p.active !== false);
  }, [liveProducts]);

  const categories = useMemo(() => {
    const defaultCats = ["Todos", "Baldes", "Combos", "Lanches", "Marmitas", "Porções", "Bebidas", "Molhos"];
    const seen = new Set<string>(defaultCats);
    activeProducts.forEach((p) => {
      if (p.category) seen.add(p.category);
    });
    return Array.from(seen);
  }, [activeProducts]);

  const filteredProducts = useMemo(() => {
    let list = activeProducts;
    if (selectedCategory !== "Todos") {
      list = list.filter((p) => p.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }
    return list;
  }, [activeProducts, selectedCategory, searchQuery]);

  const carouselRef = useRef<HTMLDivElement>(null);

  const scrollCarousel = (direction: "left" | "right") => {
    if (!carouselRef.current) return;
    const scrollAmount = direction === "left" ? -280 : 280;
    carouselRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
  };

  const featuredProducts = useMemo(() => {
    // Filtra produtos marcados com destaque no admin (featured === true)
    const featured = activeProducts.filter((p) => Boolean(p.featured));
    if (featured.length > 0) return featured;
    // Fallback: primeiros 6 itens do cardápio ativo
    return activeProducts.slice(0, 6);
  }, [activeProducts]);

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
          background-color: #FAF7F2;
          color: #1B1715;
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        /* Top Header */
        .sc-topbar {
          background: #FFFFFF;
          border-bottom: 1px solid #E6DFD6;
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: 0 2px 10px rgba(0,0,0,0.03);
        }
        .sc-topbar-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 12px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .sc-brand-link {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          min-width: 0;
          flex-shrink: 1;
        }
        .sc-brand-logo {
          height: 38px;
          width: auto;
          object-fit: contain;
        }
        .sc-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #EBF8F1;
          border: 1px solid #C4EDD6;
          color: #138C56;
          padding: 4px 10px;
          border-radius: 99px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .sc-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #138C56;
        }

        .sc-topbar-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .sc-btn-track {
          background: #F5F2EC;
          border: 1px solid #E6DFD6;
          color: #1B1715;
          padding: 8px 16px;
          border-radius: 99px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .sc-btn-track:hover {
          background: #EAE5DC;
          border-color: #D3C9BC;
        }
        .sc-btn-cart {
          background: #B70922;
          color: #FFFFFF;
          border: none;
          padding: 8px 18px;
          border-radius: 99px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.15s;
          box-shadow: 0 4px 12px rgba(183, 9, 34, 0.25);
          white-space: nowrap;
        }
        .sc-btn-cart:hover {
          background: #820516;
          transform: translateY(-1px);
        }
        .sc-cart-badge {
          background: #FFC814;
          color: #1B1715;
          font-size: 11px;
          font-weight: 900;
          padding: 2px 7px;
          border-radius: 99px;
        }

        /* Hero Banner */
        .sc-hero-banner {
          background: linear-gradient(135deg, #FAF7F2 0%, #F5F0E6 100%);
          border-bottom: 1px solid #E6DFD6;
          padding: 36px 20px;
        }
        .sc-hero-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 32px;
          align-items: center;
        }
        .sc-hero-eyebrow {
          display: inline-block;
          font-size: 11px;
          font-weight: 900;
          color: #B70922;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin-bottom: 8px;
          position: static;
          transform: none;
          background: transparent;
          box-shadow: none;
          padding: 0;
        }
        .sc-hero-title {
          font-size: clamp(28px, 4vw, 42px);
          font-weight: 900;
          color: #1B1715;
          line-height: 1.12;
          letter-spacing: -0.5px;
          margin-bottom: 12px;
        }
        .sc-hero-title em {
          color: #B70922;
          font-style: italic;
          font-family: Georgia, serif;
          font-weight: 400;
        }
        .sc-hero-desc {
          font-size: 15px;
          color: #706965;
          line-height: 1.55;
          max-width: 520px;
          margin-bottom: 20px;
        }
        .sc-hero-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .sc-badge-item {
          background: #FFFFFF;
          border: 1px solid #E6DFD6;
          padding: 6px 14px;
          border-radius: 99px;
          font-size: 12px;
          font-weight: 700;
          color: #1B1715;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .sc-hero-img-wrap {
          display: flex;
          justify-content: center;
        }
        .sc-hero-showcase-card {
          background: #FFFFFF;
          border: 1px solid #E6DFD6;
          border-radius: 18px;
          padding: 12px;
          box-shadow: 0 12px 30px rgba(0,0,0,0.06);
          max-width: 320px;
          width: 100%;
        }
        .sc-hero-showcase-card img {
          width: 100%;
          height: 190px;
          object-fit: cover;
          border-radius: 12px;
        }
        .sc-hero-showcase-body {
          padding: 10px 4px 4px;
        }
        .sc-hero-showcase-tag {
          font-size: 10px;
          font-weight: 800;
          color: #B70922;
          text-transform: uppercase;
        }
        .sc-hero-showcase-title {
          font-size: 15px;
          font-weight: 800;
          color: #1B1715;
          margin-top: 2px;
        }

        /* Search & Categories */
        .sc-menu-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 32px 20px 100px;
        }
        .sc-filter-bar {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 30px;
        }
        .sc-search-wrap {
          position: relative;
          width: 100%;
          max-width: 500px;
        }
        .sc-search-wrap svg {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: #706965;
        }
        .sc-search-input {
          width: 100%;
          background: #FFFFFF;
          border: 1px solid #E6DFD6;
          border-radius: 99px;
          padding: 12px 20px 12px 46px;
          font-size: 14px;
          color: #1B1715;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .sc-search-input:focus {
          border-color: #B70922;
          box-shadow: 0 0 0 3px rgba(183,9,34,0.08);
        }
        .sc-category-list {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 8px;
          scrollbar-width: thin;
        }
        .sc-cat-btn {
          background: #FFFFFF;
          border: 1px solid #E6DFD6;
          color: #706965;
          padding: 8px 18px;
          border-radius: 99px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
        }
        .sc-cat-btn:hover {
          color: #1B1715;
          border-color: #D3C9BC;
        }
        .sc-cat-btn.active {
          background: #B70922;
          border-color: #B70922;
          color: #FFFFFF;
        }

        /* Carrossel de Destaques / Mais Pedidos */
        .sc-feat-section {
          margin-bottom: 34px;
        }
        .sc-feat-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 14px;
          padding: 0 4px;
        }
        .sc-feat-title-wrap {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .sc-feat-title {
          font-size: 19px;
          font-weight: 900;
          color: #1B1715;
          display: flex;
          align-items: center;
          gap: 8px;
          letter-spacing: -0.3px;
        }
        .sc-feat-sub {
          font-size: 12.5px;
          color: #706965;
          font-weight: 500;
        }
        .sc-feat-nav {
          display: flex;
          gap: 6px;
        }
        .sc-feat-arrow {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 1px solid #E6DFD6;
          background: #FFFFFF;
          color: #1B1715;
          font-size: 18px;
          font-weight: 700;
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: all 0.15s;
          box-shadow: 0 2px 6px rgba(0,0,0,0.04);
        }
        .sc-feat-arrow:hover {
          background: #B70922;
          color: #FFFFFF;
          border-color: #B70922;
        }
        .sc-feat-carousel {
          display: flex;
          gap: 14px;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
          padding: 4px 4px 18px;
          margin: 0 -4px;
          scrollbar-width: none;
        }
        .sc-feat-carousel::-webkit-scrollbar {
          display: none;
        }
        .sc-feat-card {
          scroll-snap-align: start;
          flex: 0 0 255px;
          background: #FFFFFF;
          border: 1.5px solid #E6DFD6;
          border-radius: 16px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          cursor: pointer;
          transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
          box-shadow: 0 4px 14px rgba(0,0,0,0.04);
          position: relative;
        }
        .sc-feat-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 28px rgba(0,0,0,0.09);
          border-color: #B70922;
        }
        .sc-feat-img-wrap {
          height: 145px;
          width: 100%;
          background: #F5F2EC;
          overflow: hidden;
          position: relative;
        }
        .sc-feat-img-wrap img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }
        .sc-feat-card:hover .sc-feat-img-wrap img {
          transform: scale(1.05);
        }
        .sc-feat-badge {
          position: absolute;
          top: 10px;
          left: 10px;
          background: #B70922;
          color: #FFFFFF;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 10.5px;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          box-shadow: 0 2px 8px rgba(183,9,34,0.35);
          letter-spacing: 0.2px;
          z-index: 2;
        }
        .sc-feat-body {
          padding: 12px 14px 14px;
          display: flex;
          flex-direction: column;
          flex: 1;
        }
        .sc-feat-cat {
          font-size: 9.5px;
          font-weight: 800;
          color: #706965;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 2px;
        }
        .sc-feat-name {
          font-size: 14px;
          font-weight: 800;
          color: #1B1715;
          line-height: 1.25;
          margin-bottom: 4px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          min-height: 35px;
        }
        .sc-feat-desc {
          font-size: 11px;
          color: #706965;
          line-height: 1.3;
          margin-bottom: 12px;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .sc-feat-foot {
          margin-top: auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding-top: 8px;
          border-top: 1px solid #F5F2EC;
        }
        .sc-feat-price {
          font-size: 15px;
          font-weight: 900;
          color: #B70922;
        }
        .sc-feat-btn {
          background: #B70922;
          color: #FFFFFF;
          border: none;
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 11.5px;
          font-weight: 800;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: background 0.15s, transform 0.15s;
        }
        .sc-feat-btn:hover {
          background: #820516;
          transform: scale(1.03);
        }
        @media (max-width: 600px) {
          .sc-feat-card {
            flex: 0 0 240px;
          }
          .sc-feat-nav {
            display: none;
          }
          .sc-feat-title {
            font-size: 17px;
          }
          .sc-feat-carousel {
            padding-right: 16px;
          }
        }

        /* Products Grid */
        .sc-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
          gap: 20px;
        }
        .sc-card {
          background: #FFFFFF;
          border: 1px solid #E6DFD6;
          border-radius: 16px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
        }
        .sc-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 24px rgba(0,0,0,0.05);
          border-color: #D3C9BC;
        }
        .sc-card-img-wrap {
          height: 180px;
          width: 100%;
          background: #F5F2EC;
          overflow: hidden;
          position: relative;
        }
        .sc-card-img-wrap img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .sc-card-content {
          padding: 16px;
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .sc-card-title {
          font-size: 16px;
          font-weight: 800;
          color: #1B1715;
          line-height: 1.25;
          margin-bottom: 6px;
        }
        .sc-card-desc {
          font-size: 12.5px;
          color: #706965;
          line-height: 1.45;
          margin-bottom: 16px;
          flex: 1;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .sc-card-foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 12px;
          border-top: 1px solid #F5F2EC;
        }
        .sc-card-price {
          font-size: 17px;
          font-weight: 900;
          color: #B70922;
        }
        .sc-card-add-btn {
          background: #F5F2EC;
          border: 1px solid #E6DFD6;
          color: #1B1715;
          border-radius: 99px;
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
        }
        .sc-card:hover .sc-card-add-btn {
          background: #B70922;
          border-color: #B70922;
          color: #FFFFFF;
        }

        /* Floating Cart Bar */
        .sc-floating-bar {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          width: calc(100% - 40px);
          max-width: 500px;
          background: #B70922;
          color: #FFFFFF;
          border-radius: 99px;
          padding: 14px 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 14px 34px rgba(183, 9, 34, 0.4);
          z-index: 200;
          cursor: pointer;
          transition: transform 0.15s, background 0.15s;
        }
        .sc-floating-bar:hover {
          transform: translateX(-50%) scale(1.02);
          background: #820516;
        }
        .sc-floating-left {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 14px;
          font-weight: 800;
        }
        .sc-floating-badge {
          background: #FFFFFF;
          color: #B70922;
          font-size: 12px;
          font-weight: 900;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: grid;
          place-items: center;
        }
        .sc-floating-price {
          font-size: 16px;
          font-weight: 900;
          color: #FFC814;
        }

        /* Modais */
        .sc-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(27, 23, 21, 0.7);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          padding-top: max(20px, env(safe-area-inset-top));
          padding-bottom: max(20px, env(safe-area-inset-bottom));
          overscroll-behavior: contain;
          touch-action: none;
        }
        .sc-modal-card {
          background: #FFFFFF;
          border-radius: 20px;
          width: 100%;
          max-width: 540px;
          max-height: calc(100dvh - 40px);
          overflow-y: auto;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          touch-action: pan-y;
          box-shadow: 0 20px 50px rgba(0,0,0,0.2);
          display: flex;
          flex-direction: column;
          position: relative;
          scrollbar-width: thin;
          scrollbar-color: #D3C9BC transparent;
        }
        .sc-modal-header {
          position: sticky;
          top: 0;
          background: #FFFFFF;
          z-index: 30;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #E6DFD6;
          border-radius: 20px 20px 0 0;
          flex-shrink: 0;
        }
        .sc-modal-close-btn {
          background: #F5F2EC;
          border: 1px solid #E6DFD6;
          border-radius: 50%;
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          color: #1B1715;
          transition: background 0.15s, transform 0.15s;
          flex-shrink: 0;
        }
        .sc-modal-close-btn:hover, .sc-modal-close-btn:active {
          background: #E6DFD6;
          transform: scale(0.95);
        }
        .sc-modal-body {
          padding: 20px;
          flex: 1;
        }
        .sc-modal-card::-webkit-scrollbar {
          width: 6px;
        }
        .sc-modal-card::-webkit-scrollbar-thumb {
          background-color: #D3C9BC;
          border-radius: 6px;
        }
        .sc-modal-card::-webkit-scrollbar-track {
          background: transparent;
        }

        /* Modal do Produto (iFood Style) */
        .sc-prod-modal-img {
          width: 100%;
          height: 230px;
          object-fit: cover;
          background: #F5F2EC;
        }
        .sc-prod-modal-close {
          position: absolute;
          top: 14px;
          right: 14px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          border: 1px solid rgba(230, 223, 214, 0.9);
          color: #1B1715;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 10;
          transition: transform 0.15s, background 0.15s;
        }
        .sc-prod-modal-close:hover {
          transform: scale(1.08);
          background: #FFFFFF;
        }
        .sc-prod-modal-body {
          padding: 24px 24px 32px;
          flex: 1;
        }
        .sc-prod-title {
          font-size: 22px;
          font-weight: 900;
          color: #1B1715;
          margin-bottom: 4px;
        }
        .sc-prod-price {
          font-size: 20px;
          font-weight: 900;
          color: #B70922;
          margin-bottom: 12px;
        }
        .sc-prod-desc {
          font-size: 14px;
          color: #706965;
          line-height: 1.5;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid #E6DFD6;
        }

        .sc-section-label {
          font-size: 14px;
          font-weight: 800;
          color: #1B1715;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .sc-section-sub {
          font-size: 12px;
          color: #706965;
          margin-bottom: 12px;
        }
        .sc-opt-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 24px;
        }
        .sc-opt-row {
          background: #FAF7F2;
          border: 1px solid #E6DFD6;
          border-radius: 12px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          transition: all 0.15s;
        }
        .sc-opt-row:hover {
          border-color: #D3C9BC;
          background: #F5F2EC;
        }
        .sc-opt-row.selected {
          border-color: #B70922;
          background: #FDF4F5;
        }
        .sc-opt-left {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13.5px;
          font-weight: 700;
          color: #1B1715;
        }
        .sc-opt-price {
          font-size: 13px;
          font-weight: 800;
          color: #B70922;
        }

        .sc-textarea {
          width: 100%;
          background: #FAF7F2;
          border: 1px solid #E6DFD6;
          border-radius: 12px;
          padding: 12px;
          font-size: 13px;
          color: #1B1715;
          outline: none;
          resize: vertical;
          min-height: 70px;
          margin-bottom: 24px;
        }
        .sc-textarea:focus {
          border-color: #B70922;
          background: #FFFFFF;
        }

        .sc-modal-footer {
          position: sticky;
          bottom: 0;
          background: #FFFFFF;
          border-top: 1px solid #E6DFD6;
          padding: 16px 24px;
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .sc-qty-box {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #FAF7F2;
          border: 1px solid #E6DFD6;
          padding: 8px 14px;
          border-radius: 99px;
        }
        .sc-qty-box button {
          background: none;
          border: none;
          color: #1B1715;
          font-size: 18px;
          font-weight: 900;
          cursor: pointer;
          padding: 0 4px;
        }
        .sc-qty-box span {
          font-size: 15px;
          font-weight: 800;
          min-width: 18px;
          text-align: center;
        }
        .sc-btn-primary {
          flex: 1;
          background: #B70922;
          color: #FFFFFF;
          border: none;
          padding: 14px 20px;
          border-radius: 99px;
          font-size: 14px;
          font-weight: 900;
          cursor: pointer;
          transition: background 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .sc-btn-primary:hover {
          background: #820516;
        }
        .sc-btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Formulário Checkout */
        .sc-form-title {
          font-size: 18px;
          font-weight: 900;
          color: #1B1715;
          margin-bottom: 16px;
        }
        .sc-field {
          margin-bottom: 14px;
        }
        .sc-field label {
          display: block;
          font-size: 12px;
          font-weight: 700;
          color: #706965;
          margin-bottom: 6px;
        }
        .sc-input {
          width: 100%;
          background: #FAF7F2;
          border: 1px solid #E6DFD6;
          border-radius: 10px;
          padding: 11px 14px;
          font-size: 14px;
          color: #1B1715;
          outline: none;
        }
        .sc-input:focus {
          border-color: #B70922;
          background: #FFFFFF;
        }

        .sc-type-toggle {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 18px;
        }
        .sc-type-btn {
          background: #FAF7F2;
          border: 1px solid #E6DFD6;
          padding: 12px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 800;
          color: #706965;
          cursor: pointer;
          text-align: center;
          transition: all 0.15s;
        }
        .sc-type-btn.active {
          background: #B70922;
          border-color: #B70922;
          color: #FFFFFF;
        }

        /* Acompanhamento de Pedido (Stepper) */
        .sc-stepper {
          display: flex;
          justify-content: space-between;
          position: relative;
          margin: 28px 0;
        }
        .sc-stepper::before {
          content: "";
          position: absolute;
          top: 15px;
          left: 10%;
          right: 10%;
          height: 2px;
          background: #E6DFD6;
          z-index: 1;
        }
        .sc-step {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .sc-step-circle {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #FAF7F2;
          border: 2px solid #E6DFD6;
          display: grid;
          place-items: center;
          font-size: 12px;
          font-weight: 800;
          color: #706965;
        }
        .sc-step.active .sc-step-circle {
          background: #B70922;
          border-color: #B70922;
          color: #FFFFFF;
        }
        .sc-step.done .sc-step-circle {
          background: #138C56;
          border-color: #138C56;
          color: #FFFFFF;
        }
        .sc-step-label {
          font-size: 11px;
          font-weight: 700;
          color: #706965;
          text-align: center;
        }
        .sc-step.active .sc-step-label {
          color: #B70922;
          font-weight: 800;
        }

        @media (max-width: 768px) {
          .sc-hero-inner {
            grid-template-columns: 1fr;
            text-align: center;
          }
          .sc-hero-desc {
            margin-left: auto;
            margin-right: auto;
          }
          .sc-hero-badges {
            justify-content: center;
          }
          .sc-hero-img-wrap {
            display: none;
          }
        }

        @media (max-width: 640px) {
          .sc-topbar-inner {
            padding: 10px 14px;
            gap: 8px;
          }
          .sc-brand-link {
            gap: 6px;
            min-width: 0;
            flex-shrink: 1;
          }
          .sc-brand-logo {
            height: 28px;
            max-width: 105px;
          }
          /* Oculta o pill "Aberto agora" no header em celular para dar total espaço e evitar qualquer colisão */
          .sc-status-pill {
            display: none !important;
          }
          .sc-topbar-actions {
            gap: 6px;
            flex-shrink: 0;
          }
          .sc-btn-track {
            padding: 7px 11px;
            font-size: 12px;
            gap: 5px;
            white-space: nowrap;
          }
          .sc-btn-track svg {
            width: 14px;
            height: 14px;
          }
          .sc-btn-cart {
            padding: 7px 13px;
            font-size: 12px;
            gap: 6px;
            white-space: nowrap;
          }
          .sc-btn-cart svg {
            width: 14px;
            height: 14px;
          }
          .sc-cart-badge {
            font-size: 10px;
            padding: 1px 6px;
          }

          /* Modais em celular */
          .sc-modal-backdrop {
            padding: 0;
            align-items: flex-end;
            padding-top: max(32px, env(safe-area-inset-top));
          }
          .sc-modal-card {
            max-height: calc(100dvh - max(32px, env(safe-area-inset-top)));
            border-radius: 22px 22px 0 0;
            width: 100%;
            margin-top: auto;
          }
          .sc-modal-header {
            border-radius: 22px 22px 0 0;
            padding: 14px 18px;
          }
          .sc-modal-body {
            padding: 16px;
            padding-bottom: max(28px, env(safe-area-inset-bottom));
          }
          .sc-prod-modal-img {
            height: 180px;
          }
          .sc-prod-modal-body {
            padding: 18px 16px;
          }
          .sc-modal-footer {
            padding: 14px 16px;
          }
        }

        @media (max-width: 380px) {
          .sc-topbar-inner {
            padding: 8px 10px;
            gap: 6px;
          }
          .sc-brand-logo {
            height: 24px;
            max-width: 85px;
          }
          .sc-btn-track {
            padding: 6px 8px;
            font-size: 11px;
            gap: 3px;
          }
          .sc-btn-cart {
            padding: 6px 9px;
            font-size: 11px;
            gap: 4px;
          }
        }
      `}</style>

      <div className="sc-app">
        {/* TOPBAR */}
        <header className="sc-topbar">
          <div className="sc-topbar-inner">
            <a href="#inicio" className="sc-brand-link">
              <img src="/smack-chicken-logo.png" alt="Smack Chicken" className="sc-brand-logo" />
              <span className="sc-status-pill">
                <span className="sc-status-dot"></span> Aberto agora
              </span>
            </a>

            <div className="sc-topbar-actions">
              <a
                href="https://wa.me/5548988786741?text=Ol%C3%A1%2C%20gostaria%20de%20tirar%20uma%20d%C3%BAvida%20sobre%20os%20pedidos%20da%20Smack%20Chicken!"
                target="_blank"
                rel="noreferrer"
                className="sc-btn-track"
                style={{ textDecoration: "none", color: "#138C56", borderColor: "#A7F3D0", background: "#F0FDF4" }}
                title="Tirar dúvidas no WhatsApp (48) 98878-6741"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
                <span>Dúvidas</span>
              </a>

              <button className="sc-btn-track" onClick={() => setShowTrackingModal(true)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span>Acompanhar</span>
              </button>

              <button className="sc-btn-cart" onClick={() => setShowCartModal(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                <span>Sacola</span>
                {cartItemCount > 0 && <span className="sc-cart-badge">{cartItemCount}</span>}
              </button>
            </div>
          </div>
        </header>

        {/* HERO INSTITUCIONAL */}
        <section className="sc-hero-banner" id="inicio">
          <div className="sc-hero-inner">
            <div>
              <span className="sc-hero-eyebrow">CARDÁPIO OFICIAL DE PEDIDOS ONLINE</span>
              <h1 className="sc-hero-title">
                Frango de verdade.
                <br />
                <em>Crocante</em> de verdade.
              </h1>
              <p className="sc-hero-desc">
                Peça direto da nossa cozinha no Estreito. Baldes empanados à mão, lanches artesanais, marmitas bem servidas e combos completos para você e sua família.
              </p>

              <div className="sc-hero-badges">
                <span className="sc-badge-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B70922" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  Entrega em 35 a 50 min
                </span>
                <span className="sc-badge-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B70922" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                  Até 2 molhos grátis por lanche ou balde
                </span>
                <span className="sc-badge-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B70922" strokeWidth="2.5"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                  Pix, Cartão ou Dinheiro
                </span>
              </div>
            </div>

            <div className="sc-hero-img-wrap">
              <div className="sc-hero-showcase-card">
                <img src="/balde-tiras.jpeg" alt="Balde de Frango Crocante" />
                <div className="sc-hero-showcase-body">
                  <span className="sc-hero-showcase-tag">Destaque da Loja</span>
                  <div className="sc-hero-showcase-title">Balde M 500g — Tiras Crocantes</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CARDÁPIO */}
        <main className="sc-menu-container">
          <div className="sc-filter-bar">
            <div className="sc-search-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                type="text"
                className="sc-search-input"
                placeholder="Buscar no cardápio: lanches, baldes, marmitas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="sc-category-list">
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`sc-cat-btn ${selectedCategory === cat ? "active" : ""}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* CARROSSEL DE MAIS PEDIDOS / DESTAQUES */}
          {selectedCategory === "Todos" && !searchQuery.trim() && featuredProducts.length > 0 && (
            <section className="sc-feat-section">
              <div className="sc-feat-header">
                <div className="sc-feat-title-wrap">
                  <div className="sc-feat-title">
                    Os Mais Pedidos da Casa
                  </div>
                  <span className="sc-feat-sub">
                    Os campeões de vendas para pedir rápido e receber quentinho
                  </span>
                </div>
                <div className="sc-feat-nav">
                  <button
                    type="button"
                    className="sc-feat-arrow"
                    onClick={() => scrollCarousel("left")}
                    title="Anterior"
                    aria-label="Anterior"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="sc-feat-arrow"
                    onClick={() => scrollCarousel("right")}
                    title="Próximo"
                    aria-label="Próximo"
                  >
                    ›
                  </button>
                </div>
              </div>

              <div className="sc-feat-carousel" ref={carouselRef}>
                {featuredProducts.map((product, idx) => (
                  <div
                    key={product.id}
                    className="sc-feat-card"
                    onClick={() => openProductDetail(product)}
                  >
                    <div className="sc-feat-img-wrap">
                      <img src={product.image || "/balde-tiras.jpeg"} alt={product.name} />
                      <span className="sc-feat-badge">
                        {idx === 0 ? "Mais Vendido" : "Destaque"}
                      </span>
                    </div>
                    <div className="sc-feat-body">
                      <span className="sc-feat-cat">{product.category}</span>
                      <h4 className="sc-feat-name" title={product.name}>{product.name}</h4>
                      {product.description && (
                        <p className="sc-feat-desc" title={product.description}>{product.description}</p>
                      )}
                      <div className="sc-feat-foot">
                        <span className="sc-feat-price">{formatMoney(product.priceCents)}</span>
                        <button
                          type="button"
                          className="sc-feat-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            openProductDetail(product);
                          }}
                        >
                          <span>+</span> Pedir
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* TÍTULO DA SEÇÃO DO CARDÁPIO */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: "#1B1715" }}>
              {selectedCategory === "Todos" ? "Cardápio Completo" : selectedCategory}
            </h3>
            <span style={{ fontSize: 12, color: "#706965", fontWeight: 600 }}>
              {filteredProducts.length} {filteredProducts.length === 1 ? "item" : "itens"}
            </span>
          </div>

          <div className="sc-grid">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="sc-card"
                onClick={() => openProductDetail(product)}
              >
                <div className="sc-card-img-wrap">
                  <img src={product.image || "/balde-tiras.jpeg"} alt={product.name} />
                </div>
                <div className="sc-card-content">
                  <h3 className="sc-card-title">{product.name}</h3>
                  <p className="sc-card-desc">{product.description}</p>
                  <div className="sc-card-foot">
                    <span className="sc-card-price">{formatMoney(product.priceCents)}</span>
                    <button
                      className="sc-card-add-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        openProductDetail(product);
                      }}
                    >
                      Escolher
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>

        {/* RODAPÉ INFORMATIVO COM CONTATO DA LOJA */}
        <footer
          style={{
            textAlign: "center",
            padding: "36px 16px 80px",
            borderTop: "1px solid #E6DFD6",
            marginTop: 40,
            background: "#FAF7F2",
          }}
        >
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <div style={{ fontWeight: 900, fontSize: 16, color: "#1B1715", marginBottom: 6 }}>
              SMACK CHICKEN
            </div>
            <div style={{ fontSize: 13, color: "#706965", marginBottom: 12, lineHeight: 1.4 }}>
              Rua Fúlvio Aducci, 1074 — Estreito, Florianópolis - SC
            </div>
            <div style={{ fontSize: 13, color: "#706965", marginBottom: 16 }}>
              Dúvidas sobre pedidos ou cardápio?{" "}
              <a
                href="https://wa.me/5548988786741?text=Ol%C3%A1%2C%20tenho%20uma%20d%C3%BAvida%20sobre%20os%20pedidos%20da%20Smack%20Chicken"
                target="_blank"
                rel="noreferrer"
                style={{ color: "#138C56", fontWeight: 800, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <span>WhatsApp: (48) 98878-6741</span>
              </a>
            </div>
            <div style={{ fontSize: 11, color: "#9c918d" }}>
              © {new Date().getFullYear()} Smack Chicken · Todos os direitos reservados.
            </div>
          </div>
        </footer>

        {/* BARRA FLUTUANTE DA SACOLA */}
        {cartItemCount > 0 && !activeProduct && !showCartModal && !showTrackingModal && (
          <div className="sc-floating-bar" onClick={() => setShowCartModal(true)}>
            <div className="sc-floating-left">
              <span className="sc-floating-badge">{cartItemCount}</span>
              <span>Ver sacola</span>
            </div>
            <span className="sc-floating-price">{formatMoney(totalCents)}</span>
          </div>
        )}

        {/* MODAL DE DETALHES DO ITEM (ESTILO IFOOD) */}
        {activeProduct && (
          <div
            className="sc-modal-backdrop"
            onClick={closeProductDetail}
            onTouchMove={(e) => {
              if (e.target === e.currentTarget) e.preventDefault();
            }}
          >
            <div className="sc-modal-card" onClick={(e) => e.stopPropagation()}>
              <div style={{ position: "relative" }}>
                <img src={activeProduct.image || "/balde-tiras.jpeg"} alt={activeProduct.name} className="sc-prod-modal-img" />
                <button className="sc-prod-modal-close" onClick={closeProductDetail}>✕</button>
              </div>

              <div className="sc-prod-modal-body">
                <h2 className="sc-prod-title">{activeProduct.name}</h2>
                <div className="sc-prod-price">{formatMoney(activeProduct.priceCents)}</div>
                <p className="sc-prod-desc">{activeProduct.description}</p>

                {/* ESCOLHA DE ACOMPANHAMENTO E BEBIDA PARA COMBOS */}
                {isComboProduct && (
                  <div style={{ marginBottom: 24 }}>
                    {/* ACOMPANHAMENTO */}
                    <div style={{ marginBottom: 20 }}>
                      <div className="sc-section-label">
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          Escolha o seu Acompanhamento
                        </span>
                        <span style={{ fontSize: 11, background: "#E6F4EA", color: "#137333", padding: "2px 8px", borderRadius: 12, fontWeight: 800 }}>
                          1 Incluso (Grátis)
                        </span>
                      </div>
                      <div className="sc-section-sub">Selecione uma opção inclusa no seu combo sem custo adicional:</div>

                      <div className="sc-opt-list" style={{ marginBottom: 0 }}>
                        {currentComboSideOptions.map((side) => {
                          const isSelected = selectedComboSide === side.name;
                          return (
                            <div
                              key={side.id}
                              className={`sc-opt-row ${isSelected ? "selected" : ""}`}
                              onClick={() => setSelectedComboSide(side.name)}
                              style={{
                                borderColor: isSelected ? "#B70922" : "#E6DFD6",
                                background: isSelected ? "#FFF9FA" : "#FAF7F2",
                              }}
                            >
                              <div className="sc-opt-left">
                                <input
                                  type="radio"
                                  name="combo-side-choice"
                                  checked={isSelected}
                                  onChange={() => setSelectedComboSide(side.name)}
                                  style={{ accentColor: "#B70922", width: 18, height: 18 }}
                                />
                                <div>
                                  <div style={{ fontWeight: isSelected ? 800 : 700, color: isSelected ? "#B70922" : "#1B1715" }}>
                                    {side.name}
                                  </div>
                                  {side.desc && <div style={{ fontSize: 11, color: "#706965", marginTop: 2 }}>{side.desc}</div>}
                                </div>
                              </div>
                              <span className="sc-opt-price" style={{ color: "#138C56", fontWeight: 800 }}>Grátis</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* REFRIGERANTE / BEBIDA */}
                    <div>
                      <div className="sc-section-label">
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          Escolha a Bebida / Refrigerante
                        </span>
                        <span style={{ fontSize: 11, background: "#E6F4EA", color: "#137333", padding: "2px 8px", borderRadius: 12, fontWeight: 800 }}>
                          1 Incluso (Grátis)
                        </span>
                      </div>
                      <div className="sc-section-sub">Selecione o refrigerante ou bebida gelada de sua preferência:</div>

                      <div className="sc-opt-list" style={{ marginBottom: 0 }}>
                        {currentComboDrinkOptions.map((drink) => {
                          const isSelected = selectedComboDrink === drink.name;
                          return (
                            <div
                              key={drink.id}
                              className={`sc-opt-row ${isSelected ? "selected" : ""}`}
                              onClick={() => setSelectedComboDrink(drink.name)}
                              style={{
                                borderColor: isSelected ? "#B70922" : "#E6DFD6",
                                background: isSelected ? "#FFF9FA" : "#FAF7F2",
                              }}
                            >
                              <div className="sc-opt-left">
                                <input
                                  type="radio"
                                  name="combo-drink-choice"
                                  checked={isSelected}
                                  onChange={() => setSelectedComboDrink(drink.name)}
                                  style={{ accentColor: "#B70922", width: 18, height: 18 }}
                                />
                                <div>
                                  <div style={{ fontWeight: isSelected ? 800 : 700, color: isSelected ? "#B70922" : "#1B1715" }}>
                                    {drink.name}
                                  </div>
                                  {drink.desc && <div style={{ fontSize: 11, color: "#706965", marginTop: 2 }}>{drink.desc}</div>}
                                </div>
                              </div>
                              <span className="sc-opt-price" style={{ color: "#138C56", fontWeight: 800 }}>Grátis</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* REGRA DOS 2 MOLHOS GRÁTIS */}
                {productHasFreeSauces && (
                  <div>
                    <div className="sc-section-label">
                      <span>Escolha até 2 molhos grátis da casa</span>
                      <span style={{ fontSize: 12, color: "#B70922", fontWeight: 800 }}>
                        {selectedFreeSauces.length}/2 grátis
                      </span>
                    </div>
                    <div className="sc-section-sub">Incluso no seu item sem custo adicional.</div>

                    <div className="sc-opt-list">
                      {FREE_SAUCE_OPTIONS.map((sauce) => {
                        const isSelected = selectedFreeSauces.includes(sauce.name);
                        return (
                          <div
                            key={sauce.id}
                            className={`sc-opt-row ${isSelected ? "selected" : ""}`}
                            onClick={() => toggleFreeSauce(sauce.name)}
                          >
                            <div className="sc-opt-left">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                style={{ accentColor: "#B70922", width: 17, height: 17 }}
                              />
                              <span>{sauce.name}</span>
                            </div>
                            <span className="sc-opt-price" style={{ color: "#138C56" }}>Grátis</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* MOLHOS EXTRAS COBRADOS */}
                <div>
                  <div className="sc-section-label">
                    <span>Deseja molhos extras?</span>
                    <span style={{ fontSize: 12, color: "#706965" }}>Opcional</span>
                  </div>
                  <div className="sc-section-sub">A partir do 3º molho ou molhos especiais da casa.</div>

                  <div className="sc-opt-list">
                    {EXTRA_SAUCE_OPTIONS.map((extra) => {
                      const isSelected = selectedExtraSauces.some((s) => s.id === extra.id);
                      return (
                        <div
                          key={extra.id}
                          className={`sc-opt-row ${isSelected ? "selected" : ""}`}
                          onClick={() => toggleExtraSauce(extra)}
                        >
                          <div className="sc-opt-left">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              style={{ accentColor: "#B70922", width: 17, height: 17 }}
                            />
                            <span>{extra.name}</span>
                          </div>
                          <span className="sc-opt-price">+{formatMoney(extra.priceCents)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* TURBINE SEU PEDIDO (ACOMPANHAMENTOS) */}
                <div>
                  <div className="sc-section-label">
                    <span>Turbine seu pedido</span>
                    <span style={{ fontSize: 12, color: "#706965" }}>Opcional</span>
                  </div>
                  <div className="sc-section-sub">Acompanhamentos que combinam perfeitamente com seu frango.</div>

                  <div className="sc-opt-list">
                    {RECOMMENDED_UPSELLS.map((upsell) => {
                      const isSelected = selectedUpsells.some((u) => u.id === upsell.id);
                      return (
                        <div
                          key={upsell.id}
                          className={`sc-opt-row ${isSelected ? "selected" : ""}`}
                          onClick={() => toggleUpsell(upsell)}
                        >
                          <div className="sc-opt-left">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              style={{ accentColor: "#B70922", width: 17, height: 17 }}
                            />
                            <span>{upsell.name}</span>
                          </div>
                          <span className="sc-opt-price">+{formatMoney(upsell.priceCents)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* OBSERVAÇÕES */}
                <div>
                  <div className="sc-section-label">
                    <span>Observações para a cozinha</span>
                  </div>
                  <textarea
                    className="sc-textarea"
                    placeholder="Ex: sem molho no lanche, frango bem douradinho, guardanapo extra..."
                    value={detailNotes}
                    onChange={(e) => setDetailNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="sc-modal-footer">
                <div className="sc-qty-box">
                  <button onClick={() => setDetailQuantity((q) => Math.max(1, q - 1))}>−</button>
                  <span>{detailQuantity}</span>
                  <button onClick={() => setDetailQuantity((q) => q + 1)}>+</button>
                </div>

                <button className="sc-btn-primary" onClick={handleAddConfiguredItemToCart}>
                  <span>Adicionar à sacola</span>
                  <span>•</span>
                  <span>{formatMoney(currentDetailUnitPriceCents * detailQuantity)}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DA SACOLA E CHECKOUT */}
        {showCartModal && (
          <div
            className="sc-modal-backdrop"
            onClick={() => setShowCartModal(false)}
            onTouchMove={(e) => {
              if (e.target === e.currentTarget) e.preventDefault();
            }}
          >
            <div className="sc-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="sc-modal-header">
                <h3 style={{ fontSize: 19, fontWeight: 900, margin: 0, color: "#1B1715" }}>Finalizar Pedido</h3>
                <button
                  type="button"
                  className="sc-modal-close-btn"
                  onClick={() => setShowCartModal(false)}
                  aria-label="Fechar"
                >
                  ✕
                </button>
              </div>

              <div className="sc-modal-body">

              {latestOrderCode ? (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#EBF8F1", color: "#138C56", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <h3 style={{ fontSize: 22, fontWeight: 900, color: "#1B1715", marginBottom: 6 }}>Pedido Realizado com Sucesso!</h3>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#B70922", marginBottom: 16 }}>
                    Código: #{latestOrderCode}
                  </div>
                  <p style={{ fontSize: 14, color: "#706965", lineHeight: 1.5, marginBottom: 16 }}>
                    Nossa cozinha já recebeu seu pedido. Você receberá atualizações em tempo real pelo WhatsApp!
                  </p>

                  <div
                    style={{
                      background: "#FAF7F2",
                      border: "1px solid #E6DFD6",
                      borderRadius: 14,
                      padding: "14px 16px",
                      marginBottom: 20,
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: "50%",
                        background: "#FFF0F2",
                        color: "#B70922",
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#1B1715" }}>
                        Tempo de Preparo e Entrega
                      </div>
                      <div style={{ fontSize: 13, color: "#B70922", fontWeight: 800 }}>
                        Tempo médio: aprox. 45 minutos
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <button
                      className="sc-btn-primary"
                      onClick={() => {
                        setShowCartModal(false);
                        setShowTrackingModal(true);
                      }}
                    >
                      Acompanhar Andamento do Pedido
                    </button>
                    <button
                      className="sc-btn-track"
                      style={{ justifyContent: "center" }}
                      onClick={() => {
                        setLatestOrderCode(null);
                        setShowCartModal(false);
                      }}
                    >
                      Voltar ao Cardápio
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitOrder}>
                  {/* ITENS NO CARRINHO */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#706965", textTransform: "uppercase", marginBottom: 12 }}>
                      Itens na sua sacola ({cartItemCount})
                    </div>
                    {cart.length === 0 ? (
                      <p style={{ fontSize: 13, color: "#706965", padding: "16px 0" }}>Sua sacola está vazia.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {cart.map((item) => (
                          <div
                            key={item.cartItemId}
                            style={{
                              background: "#FAF7F2",
                              border: "1px solid #E6DFD6",
                              borderRadius: 12,
                              padding: "12px 14px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                            }}
                          >
                            <div style={{ flex: 1, paddingRight: 12 }}>
                              <div style={{ fontSize: 14, fontWeight: 800, color: "#1B1715" }}>
                                {item.quantity}x {item.product.name}
                              </div>
                              {item.selectedSide && (
                                <div style={{ fontSize: 11, color: "#B70922", fontWeight: 700, marginTop: 2 }}>
                                  Acompanhamento: {item.selectedSide}
                                </div>
                              )}
                              {item.selectedDrink && (
                                <div style={{ fontSize: 11, color: "#1B1715", fontWeight: 700, marginTop: 2 }}>
                                  Bebida: {item.selectedDrink}
                                </div>
                              )}
                              {item.freeSauces.length > 0 && (
                                <div style={{ fontSize: 11, color: "#138C56", fontWeight: 600, marginTop: 2 }}>
                                  Molhos grátis: {item.freeSauces.join(", ")}
                                </div>
                              )}
                              {item.extraSauces.length > 0 && (
                                <div style={{ fontSize: 11, color: "#B70922", fontWeight: 600, marginTop: 2 }}>
                                  Molhos extras: {item.extraSauces.map((s) => s.name).join(", ")}
                                </div>
                              )}
                              {item.upsells.length > 0 && (
                                <div style={{ fontSize: 11, color: "#706965", fontWeight: 600, marginTop: 2 }}>
                                  Adicionais: {item.upsells.map((u) => u.name).join(", ")}
                                </div>
                              )}
                              {item.notes && (
                                <div style={{ fontSize: 11, color: "#706965", fontStyle: "italic", marginTop: 2 }}>
                                  Obs: {item.notes}
                                </div>
                              )}
                              <div style={{ fontSize: 13, fontWeight: 800, color: "#B70922", marginTop: 6 }}>
                                {formatMoney(item.unitPriceCents * item.quantity)}
                              </div>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div className="sc-qty-box" style={{ padding: "4px 8px" }}>
                                <button type="button" onClick={() => updateCartQty(item.cartItemId, -1)}>−</button>
                                <span style={{ fontSize: 13 }}>{item.quantity}</span>
                                <button type="button" onClick={() => updateCartQty(item.cartItemId, 1)}>+</button>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeCartItem(item.cartItemId)}
                                style={{ background: "none", border: "none", color: "#B70922", cursor: "pointer", padding: 4 }}
                                title="Remover item"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* IDENTIFICAÇÃO DO CLIENTE */}
                  <div className="sc-form-title">Seus Dados</div>
                  <div className="sc-field">
                    <label>Nome Completo *</label>
                    <input
                      type="text"
                      required
                      className="sc-input"
                      placeholder="Ex: Lucas Gabriel"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </div>
                  <div className="sc-field">
                    <label>Número de WhatsApp / Celular *</label>
                    <input
                      type="tel"
                      required
                      className="sc-input"
                      placeholder="(48) 99999-9999"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                  </div>

                  {/* TIPO DE ENTREGA */}
                  <div className="sc-form-title" style={{ marginTop: 20 }}>Como deseja receber?</div>
                  <div className="sc-type-toggle">
                    <button
                      type="button"
                      className={`sc-type-btn ${deliveryType === "ENTREGA" ? "active" : ""}`}
                      onClick={() => setDeliveryType("ENTREGA")}
                    >
                      {deliveryInfo?.tier
                        ? `Entrega em Casa (+${deliveryInfo.tier.feeFormatted})`
                        : "Entrega em Casa (a partir de R$ 4,99)"}
                    </button>
                    <button
                      type="button"
                      className={`sc-type-btn ${deliveryType === "RETIRADA" ? "active" : ""}`}
                      onClick={() => setDeliveryType("RETIRADA")}
                    >
                      Retirar na Loja (Grátis)
                    </button>
                  </div>

                  {/* ENDEREÇO DE ENTREGA COM BUSCA POR CEP */}
                  {deliveryType === "ENTREGA" && (
                    <div style={{ background: "#FAF7F2", border: "1px solid #E6DFD6", borderRadius: 14, padding: 16, marginBottom: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#B70922", marginBottom: 12 }}>
                        Endereço de Entrega
                      </div>

                      <div className="sc-field">
                        <label>CEP (Cálculo automático de taxa e distância)</label>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            type="text"
                            maxLength={9}
                            className="sc-input"
                            placeholder="88075-000"
                            value={cep}
                            onChange={(e) => handleFetchCep(e.target.value)}
                          />
                          <button
                            type="button"
                            className="sc-btn-track"
                            style={{ whiteSpace: "nowrap" }}
                            onClick={() => handleFetchCep(cep)}
                          >
                            {loadingCep ? "Calculando..." : "Calcular Taxa"}
                          </button>
                        </div>
                        {cepError && <div style={{ fontSize: 11, color: "#B70922", marginTop: 4 }}>{cepError}</div>}

                        {loadingCep && (
                          <div style={{ fontSize: 12, color: "#B70922", marginTop: 6, fontWeight: 600 }}>
                            ⏳ Localizando CEP e calculando distância da loja...
                          </div>
                        )}

                        {deliveryInfo && deliveryInfo.isWithinRadius && deliveryInfo.tier && (
                          <div
                            style={{
                              background: "#F0FDF4",
                              border: "1px solid #BBF7D0",
                              borderRadius: 10,
                              padding: "10px 14px",
                              marginTop: 10,
                              marginBottom: 4,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 800, color: "#166534" }}>
                                Entrega disponível para seu endereço
                              </span>
                              <span style={{ fontSize: 13, fontWeight: 900, color: "#B70922" }}>
                                Taxa: {deliveryInfo.tier.feeFormatted}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: "#374151", display: "flex", gap: 14, flexWrap: "wrap", marginTop: 4 }}>
                              <span>Distância: <b>~{deliveryInfo.distanceKm?.toFixed(1)} km</b></span>
                              <span>Tempo estimado: <b>~{deliveryInfo.tier.timeMinutes} min</b></span>
                            </div>
                          </div>
                        )}

                        {deliveryInfo && !deliveryInfo.isWithinRadius && (
                          <div
                            style={{
                              background: "#FEF2F2",
                              border: "1px solid #FECACA",
                              borderRadius: 10,
                              padding: "12px 14px",
                              marginTop: 10,
                              marginBottom: 4,
                            }}
                          >
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#991B1B", marginBottom: 4 }}>
                              Endereço fora do raio de entrega de {effectiveMaxRadius} km
                            </div>
                            <div style={{ fontSize: 12, color: "#7F1D1D", lineHeight: 1.4 }}>
                              Seu endereço está a aproximadamente <b>{deliveryInfo.distanceKm?.toFixed(1)} km</b> da nossa loja (Rua Fúlvio Aducci, 1074 — Estreito).
                              Nosso raio máximo de entrega é de {effectiveMaxRadius} km.
                            </div>
                            <button
                              type="button"
                              onClick={() => setDeliveryType("RETIRADA")}
                              style={{
                                marginTop: 8,
                                padding: "7px 12px",
                                background: "#B70922",
                                color: "#FFFFFF",
                                borderRadius: 8,
                                border: "none",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Mudar para Retirar na Loja (Grátis)
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="sc-field">
                        <label>Rua / Logradouro *</label>
                        <input
                          type="text"
                          required
                          className="sc-input"
                          placeholder="Ex: Rua Fúlvio Aducci"
                          value={street}
                          onChange={(e) => setStreet(e.target.value)}
                        />
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div className="sc-field">
                          <label>Número *</label>
                          <input
                            type="text"
                            required
                            className="sc-input"
                            placeholder="Ex: 1074"
                            value={number}
                            onChange={(e) => setNumber(e.target.value)}
                          />
                        </div>
                        <div className="sc-field">
                          <label>Complemento</label>
                          <input
                            type="text"
                            className="sc-input"
                            placeholder="Apt 201, Bloco B..."
                            value={complement}
                            onChange={(e) => setComplement(e.target.value)}
                          />
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div className="sc-field" style={{ marginBottom: 0 }}>
                          <label>Bairro</label>
                          <input
                            type="text"
                            className="sc-input"
                            placeholder="Estreito"
                            value={neighborhood}
                            onChange={(e) => setNeighborhood(e.target.value)}
                          />
                        </div>
                        <div className="sc-field" style={{ marginBottom: 0 }}>
                          <label>Cidade / UF</label>
                          <input
                            type="text"
                            className="sc-input"
                            placeholder="Florianópolis - SC"
                            value={cityState}
                            onChange={(e) => setCityState(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* FORMA DE PAGAMENTO */}
                  <div className="sc-form-title" style={{ marginTop: 20 }}>Forma de Pagamento</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                    <label
                      style={{
                        background: paymentMethod === "PIX" ? "#FDF4F5" : "#FAF7F2",
                        border: `1px solid ${paymentMethod === "PIX" ? "#B70922" : "#E6DFD6"}`,
                        borderRadius: 12,
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: 13.5 }}>
                        <input
                          type="radio"
                          name="payment"
                          checked={paymentMethod === "PIX"}
                          onChange={() => setPaymentMethod("PIX")}
                          style={{ accentColor: "#B70922" }}
                        />
                        <span>Pix (Chave e QR Code instantâneo)</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#138C56" }}>Recomendado</span>
                    </label>

                    <label
                      style={{
                        background: paymentMethod === "CARTAO_CREDITO" ? "#FDF4F5" : "#FAF7F2",
                        border: `1px solid ${paymentMethod === "CARTAO_CREDITO" ? "#B70922" : "#E6DFD6"}`,
                        borderRadius: 12,
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        fontWeight: 700,
                        fontSize: 13.5,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="payment"
                        checked={paymentMethod === "CARTAO_CREDITO"}
                        onChange={() => setPaymentMethod("CARTAO_CREDITO")}
                        style={{ accentColor: "#B70922" }}
                      />
                      <span>Cartão de Crédito (Maquininha na entrega/retirada)</span>
                    </label>

                    <label
                      style={{
                        background: paymentMethod === "CARTAO_DEBITO" ? "#FDF4F5" : "#FAF7F2",
                        border: `1px solid ${paymentMethod === "CARTAO_DEBITO" ? "#B70922" : "#E6DFD6"}`,
                        borderRadius: 12,
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        fontWeight: 700,
                        fontSize: 13.5,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="payment"
                        checked={paymentMethod === "CARTAO_DEBITO"}
                        onChange={() => setPaymentMethod("CARTAO_DEBITO")}
                        style={{ accentColor: "#B70922" }}
                      />
                      <span>Cartão de Débito (Maquininha na entrega/retirada)</span>
                    </label>

                    <label
                      style={{
                        background: paymentMethod === "DINHEIRO" ? "#FDF4F5" : "#FAF7F2",
                        border: `1px solid ${paymentMethod === "DINHEIRO" ? "#B70922" : "#E6DFD6"}`,
                        borderRadius: 12,
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        fontWeight: 700,
                        fontSize: 13.5,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="payment"
                        checked={paymentMethod === "DINHEIRO"}
                        onChange={() => setPaymentMethod("DINHEIRO")}
                        style={{ accentColor: "#B70922" }}
                      />
                      <span>Dinheiro</span>
                    </label>
                  </div>

                  {/* SELEÇÃO DE TROCO QUANDO DINHEIRO FOR ESCOLHIDO */}
                  {paymentMethod === "DINHEIRO" && (
                    <div style={{ background: "#FAF7F2", border: "1px solid #E6DFD6", borderRadius: 12, padding: 14, marginBottom: 18, boxSizing: "border-box" }}>
                      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: "#1B1715" }}>Precisa de troco?</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                        <button
                          type="button"
                          className={`sc-cat-btn ${!needsChange ? "active" : ""}`}
                          style={{
                            padding: "10px 6px",
                            fontSize: 12.5,
                            fontWeight: 800,
                            textAlign: "center",
                            whiteSpace: "normal",
                            lineHeight: 1.25,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 10,
                            width: "100%",
                            boxSizing: "border-box",
                          }}
                          onClick={() => { setNeedsChange(false); setChangeForAmount(""); }}
                        >
                          Não preciso de troco
                        </button>
                        <button
                          type="button"
                          className={`sc-cat-btn ${needsChange ? "active" : ""}`}
                          style={{
                            padding: "10px 6px",
                            fontSize: 12.5,
                            fontWeight: 800,
                            textAlign: "center",
                            whiteSpace: "normal",
                            lineHeight: 1.25,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 10,
                            width: "100%",
                            boxSizing: "border-box",
                          }}
                          onClick={() => setNeedsChange(true)}
                        >
                          Sim, preciso de troco
                        </button>
                      </div>

                      {needsChange && (
                        <div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 10 }}>
                            {["50", "100", "150", "200"].map((val) => (
                              <button
                                key={val}
                                type="button"
                                className="sc-cat-btn"
                                style={{
                                  padding: "8px 2px",
                                  fontSize: 12,
                                  fontWeight: 800,
                                  textAlign: "center",
                                  borderRadius: 8,
                                  width: "100%",
                                  boxSizing: "border-box",
                                  background: changeForAmount === val ? "#B70922" : "#FFFFFF",
                                  color: changeForAmount === val ? "#FFFFFF" : "#1B1715",
                                  borderColor: changeForAmount === val ? "#B70922" : "#E6DFD6",
                                }}
                                onClick={() => setChangeForAmount(val)}
                              >
                                R$ {val}
                              </button>
                            ))}
                          </div>

                          <div className="sc-field" style={{ marginBottom: 6 }}>
                            <label>Troco para quanto?</label>
                            <input
                              type="number"
                              className="sc-input"
                              placeholder="Ex: 50 ou 100"
                              value={changeForAmount}
                              onChange={(e) => setChangeForAmount(e.target.value)}
                              style={{ width: "100%", boxSizing: "border-box" }}
                            />
                          </div>

                          {changeValueCents > 0 && (
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#138C56", marginTop: 4 }}>
                              Troco que levaremos: {formatMoney(changeValueCents)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* OBSERVAÇÕES GERAIS DO PEDIDO */}
                  <div className="sc-field" style={{ marginTop: 20 }}>
                    <label>Observações do Pedido (Opcional)</label>
                    <textarea
                      className="sc-input"
                      style={{ height: 68, resize: "none", paddingTop: 8, fontSize: 13 }}
                      placeholder="Ex: Não colocar cebola / Campainha não funciona / Chamar no portão..."
                      value={orderCustomerNotes}
                      onChange={(e) => setOrderCustomerNotes(e.target.value)}
                    />
                  </div>

                  {/* CUPOM DE DESCONTO COM VINCULAÇÃO AO WHATSAPP */}
                  <div
                    style={{
                      background: "#FAF7F2",
                      border: "1px solid #E6DFD6",
                      borderRadius: 12,
                      padding: 14,
                      marginTop: 18,
                      boxSizing: "border-box",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#1B1715", display: "flex", alignItems: "center", gap: 6 }}>
                        🎟️ Cupom de Desconto
                      </span>
                      {appliedCoupon && (
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#138C56", background: "#EBF8F1", padding: "2px 8px", borderRadius: 6 }}>
                          ATIVO
                        </span>
                      )}
                    </div>

                    {!appliedCoupon ? (
                      <div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            type="text"
                            className="sc-input"
                            placeholder="Ex: VOLTA10"
                            value={couponInput}
                            onChange={(e) => {
                              setCouponInput(e.target.value.toUpperCase());
                              setCouponError(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleApplyCoupon();
                              }
                            }}
                            style={{
                              flex: 1,
                              textTransform: "uppercase",
                              fontWeight: 700,
                              fontSize: 13,
                              padding: "8px 12px",
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleApplyCoupon}
                            disabled={couponLoading || !couponInput.trim()}
                            className="sc-btn-primary"
                            style={{
                              padding: "8px 16px",
                              fontSize: 13,
                              fontWeight: 800,
                              whiteSpace: "nowrap",
                              opacity: !couponInput.trim() || couponLoading ? 0.6 : 1,
                              cursor: !couponInput.trim() || couponLoading ? "not-allowed" : "pointer",
                            }}
                          >
                            {couponLoading ? "Validando..." : "Aplicar"}
                          </button>
                        </div>

                        {couponError && (
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: "#B70922",
                              marginTop: 6,
                              lineHeight: 1.3,
                            }}
                          >
                            ⚠️ {couponError}
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: "#706965", marginTop: 6, lineHeight: 1.25 }}>
                          * O cupom é vinculado ao seu número de WhatsApp informado acima (máximo de 2 usos por número).
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: "#FFFFFF", border: "1.5px solid #138C56", borderRadius: 10, padding: "10px 12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 14, fontWeight: 900, color: "#138C56" }}>
                                {appliedCoupon.code}
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 800, color: "#138C56", background: "#EBF8F1", padding: "1px 6px", borderRadius: 4 }}>
                                -{appliedCoupon.discountPercent}%
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: "#524A45", marginTop: 3 }}>
                              {appliedCoupon.message}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleRemoveCoupon}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#B70922",
                              fontSize: 12,
                              fontWeight: 800,
                              cursor: "pointer",
                              textDecoration: "underline",
                              padding: "4px 8px",
                            }}
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* RESUMO DE VALORES */}
                  <div style={{ borderTop: "1px solid #E6DFD6", paddingTop: 16, marginTop: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#706965", marginBottom: 6 }}>
                      <span>Subtotal dos itens:</span>
                      <span>{formatMoney(subtotalCents)}</span>
                    </div>

                    {appliedCoupon && discountCents > 0 && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 13,
                          color: "#138C56",
                          fontWeight: 700,
                          marginBottom: 6,
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          Desconto cupom ({appliedCoupon.code} -{appliedCoupon.discountPercent}%):
                        </span>
                        <span>− {formatMoney(discountCents)}</span>
                      </div>
                    )}

                    {deliveryType === "ENTREGA" && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#706965", marginBottom: 6 }}>
                        <span>
                          Taxa de entrega
                          {deliveryInfo?.tier
                            ? ` (~${deliveryInfo.distanceKm?.toFixed(1)} km · ${deliveryInfo.tier.timeMinutes} min)`
                            : " (calculada pelo CEP)"}:
                        </span>
                        <span style={{ fontWeight: 700, color: "#1B1715" }}>{formatMoney(deliveryFeeCents)}</span>
                      </div>
                    )}
                    {deliveryType === "RETIRADA" && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#166534", marginBottom: 6 }}>
                        <span>Retirada no balcão:</span>
                        <span style={{ fontWeight: 700 }}>Grátis</span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 900, color: "#B70922", marginTop: 8, marginBottom: 20 }}>
                      <span>Total:</span>
                      <span>{formatMoney(totalCents)}</span>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting || cart.length === 0 || (deliveryType === "ENTREGA" && deliveryInfo?.isWithinRadius === false)}
                      className="sc-btn-primary"
                      style={{
                        width: "100%",
                        padding: "16px",
                        background: (deliveryType === "ENTREGA" && deliveryInfo?.isWithinRadius === false) ? "#9CA3AF" : undefined,
                        cursor: (deliveryType === "ENTREGA" && deliveryInfo?.isWithinRadius === false) ? "not-allowed" : "pointer",
                      }}
                    >
                      {submitting
                        ? "Enviando seu pedido..."
                        : deliveryType === "ENTREGA" && deliveryInfo?.isWithinRadius === false
                        ? `Fora do raio de ${MAX_DELIVERY_RADIUS_KM} km • Escolha Retirada`
                        : `Confirmar Pedido • ${formatMoney(totalCents)}`}
                    </button>
                  </div>
                </form>
              )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE ACOMPANHAR PEDIDO (PAINEL DO CLIENTE AO VIVO) */}
        {showTrackingModal && (
          <div
            className="sc-modal-backdrop"
            onClick={() => setShowTrackingModal(false)}
            onTouchMove={(e) => {
              if (e.target === e.currentTarget) e.preventDefault();
            }}
          >
            <div className="sc-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="sc-modal-header">
                <h3 style={{ fontSize: 19, fontWeight: 900, margin: 0, color: "#1B1715" }}>Acompanhar Pedido</h3>
                <button
                  type="button"
                  className="sc-modal-close-btn"
                  onClick={() => setShowTrackingModal(false)}
                  aria-label="Fechar"
                >
                  ✕
                </button>
              </div>

              <div className="sc-modal-body">
                <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#706965", marginBottom: 6 }}>
                  Digite o código do pedido (ex: #1042) ou seu telefone:
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    className="sc-input"
                    placeholder="#1042 ou 48999999999"
                    value={trackQuery}
                    onChange={(e) => setTrackQuery(e.target.value)}
                  />
                  <button
                    type="button"
                    className="sc-btn-primary"
                    style={{ whiteSpace: "nowrap", flex: "none", padding: "0 20px" }}
                    onClick={() => fetchOrderStatus(trackQuery)}
                  >
                    {trackingLoading ? "..." : "Consultar"}
                  </button>
                </div>
              </div>

              {trackedOrders.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 10px", color: "#706965", fontSize: 13.5 }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#D3C9BC" strokeWidth="1.8" style={{ margin: "0 auto 10px" }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <div>Digite o código para visualizar a etapa do seu pedido em tempo real.</div>
                </div>
              ) : (
                trackedOrders.map((ord) => {
                  const isPreparing = ord.status === "preparing";
                  const isReady = ord.status === "ready";
                  const isCompleted = ord.status === "completed";
                  const isCancelled = ord.status === "cancelled";

                  const motoboyMatch = ord.notes?.match(/(?:motoboy|entregador):\s*([^|]+)/i)?.[1]?.trim() || null;
                  const departureMatch = ord.notes?.match(/(?:sa[íi]da|check-?in):\s*([^|]+)/i)?.[1]?.trim() || null;
                  const deliveredMatch = ord.notes?.match(/(?:entregue [àa]s|check-?out):\s*([^|]+)/i)?.[1]?.trim() || null;

                  const createdAtMs = ord.createdAt ? new Date(ord.createdAt).getTime() : currentTime;
                  const elapsedMs = Math.max(0, currentTime - createdAtMs);
                  const elapsedMinutes = Math.floor(elapsedMs / 60000);
                  const remainingMinutes = Math.max(5, 45 - elapsedMinutes);
                  const progressPercent = isCompleted ? 100 : isReady ? 85 : Math.min(85, Math.max(10, Math.round((elapsedMinutes / 45) * 100)));

                  return (
                    <div
                      key={ord.id}
                      style={{
                        background: "#FAF7F2",
                        border: isCancelled ? "1.5px solid #FCA5A5" : "1px solid #E6DFD6",
                        borderRadius: 16,
                        padding: 18,
                        marginBottom: 16,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 16, fontWeight: 900, color: "#1B1715" }}>Pedido {ord.code}</span>
                            {isCancelled ? (
                              <span style={{ background: "#FEE2E2", color: "#9B1C1C", border: "1px solid #FCA5A5", fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 99 }}>
                                CANCELADO
                              </span>
                            ) : isCompleted ? (
                              <span style={{ background: "#EBF8F1", color: "#138C56", border: "1px solid #C4EDD6", fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 99 }}>
                                ENTREGUE
                              </span>
                            ) : isReady ? (
                              <span style={{ background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 99 }}>
                                PRONTO / SAIU
                              </span>
                            ) : (
                              <span style={{ background: "#FEF3C7", color: "#B45309", border: "1px solid #FDE68A", fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 99 }}>
                                EM PREPARO
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: "#706965", marginTop: 2 }}>Cliente: {ord.customerName}</div>
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: isCancelled ? "#9C918D" : "#B70922", textDecoration: isCancelled ? "line-through" : "none" }}>
                          {formatMoney(ord.totalCents)}
                        </div>
                      </div>

                      {/* BLOCO DE CANCELADO OU STEPPER VISUAL */}
                      {isCancelled ? (
                        <div
                          style={{
                            background: "#FFF5F5",
                            border: "1.5px solid #FCA5A5",
                            borderRadius: 14,
                            padding: "16px 18px",
                            margin: "18px 0",
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 14,
                          }}
                        >
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              background: "#9B1C1C",
                              color: "#FFFFFF",
                              display: "grid",
                              placeItems: "center",
                              fontWeight: 900,
                              fontSize: 18,
                              flexShrink: 0,
                            }}
                          >
                            ✕
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 900, color: "#9B1C1C", marginBottom: 4 }}>
                              Pedido Cancelado
                            </div>
                            <div style={{ fontSize: 13, color: "#7F1D1D", lineHeight: 1.5 }}>
                              Este pedido foi cancelado e não entrará em preparo na cozinha. Se você não solicitou este cancelamento ou tiver qualquer dúvida sobre reembolso, fale diretamente conosco pelo WhatsApp.
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="sc-stepper">
                            <div className={`sc-step ${true ? "done" : ""}`}>
                              <div className="sc-step-circle">✓</div>
                              <div className="sc-step-label">Recebido</div>
                            </div>

                            <div className={`sc-step ${isPreparing ? "active" : isReady || isCompleted ? "done" : ""}`}>
                              <div className="sc-step-circle">{isReady || isCompleted ? "✓" : "2"}</div>
                              <div className="sc-step-label">Em Preparo</div>
                            </div>

                            <div className={`sc-step ${isReady ? "active" : isCompleted ? "done" : ""}`}>
                              <div className="sc-step-circle">{isCompleted ? "✓" : "3"}</div>
                              <div className="sc-step-label">Saiu / Pronto</div>
                            </div>

                            <div className={`sc-step ${isCompleted ? "done" : ""}`}>
                              <div className="sc-step-circle">{isCompleted ? "✓" : "4"}</div>
                              <div className="sc-step-label">Entregue</div>
                            </div>
                          </div>

                          {/* CARD DO TIMER COM TEMPO DE PREPARO (MÉDIA 45 MIN) */}
                          <div
                            style={{
                              background: "#FFFFFF",
                              border: "1px solid #E6DFD6",
                              borderRadius: 14,
                              padding: "14px 16px",
                              margin: "14px 0 16px",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: "50%",
                                    background: isCompleted ? "#EBF8F1" : isReady ? "#EFF6FF" : "#FFF0F2",
                                    color: isCompleted ? "#138C56" : isReady ? "#1D4ED8" : "#B70922",
                                    display: "grid",
                                    placeItems: "center",
                                    flexShrink: 0,
                                  }}
                                >
                                  {isCompleted ? (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                  ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                                    </svg>
                                  )}
                                </div>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 900, color: "#1B1715" }}>
                                    {isCompleted
                                      ? "Pedido Entregue"
                                      : isReady
                                      ? "Pedido Saiu para Entrega"
                                      : "Tempo de Preparo Estimado"}
                                  </div>
                                  <div style={{ fontSize: 11, color: "#706965" }}>
                                    {isCompleted
                                      ? "Aproveite seu frango crocante!"
                                      : isReady
                                      ? "Chegando no seu endereço"
                                      : "Tempo médio da cozinha: 45 min"}
                                  </div>
                                </div>
                              </div>

                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 15, fontWeight: 900, color: isCompleted ? "#138C56" : isReady ? "#1D4ED8" : "#B70922" }}>
                                  {isCompleted
                                    ? "Concluído"
                                    : isReady
                                    ? "~10-15 min"
                                    : remainingMinutes > 5
                                    ? `~${remainingMinutes} min`
                                    : "Quase pronto!"}
                                </div>
                                <div style={{ fontSize: 10, fontWeight: 800, color: "#706965", textTransform: "uppercase" }}>
                                  {isCompleted ? "Finalizado" : isReady ? "Em trânsito" : `${elapsedMinutes} min decorridos`}
                                </div>
                              </div>
                            </div>

                            {/* BARRA DE PROGRESSO DO TEMPO DE PREPARO */}
                            <div style={{ height: 6, background: "#F5F2EC", borderRadius: 99, overflow: "hidden", marginTop: 8 }}>
                              <div
                                style={{
                                  height: "100%",
                                  width: `${progressPercent}%`,
                                  background: isCompleted
                                    ? "#138C56"
                                    : isReady
                                    ? "linear-gradient(90deg, #1A7FE8, #138C56)"
                                    : "linear-gradient(90deg, #B70922, #FFC814)",
                                borderRadius: 99,
                                transition: "width 0.4s ease",
                              }}
                            />
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#706965", marginTop: 6, fontWeight: 600 }}>
                            <span>Pedido às: {fmtOrderTime(ord.createdAt)}</span>
                            <span>Previsão: {fmtEstimatedTime(ord.createdAt, 45)}</span>
                          </div>
                        </div>

                        {/* STATUS DO MOTOBOY / ENTREGA */}
                        {(motoboyMatch || departureMatch || deliveredMatch) && (
                          <div
                            style={{
                              background: isCompleted ? "#F0FDF4" : "#EFF6FF",
                              border: isCompleted ? "1px solid #BBF7D0" : "1px solid #BFDBFE",
                              borderRadius: 12,
                              padding: "10px 14px",
                              margin: "12px 0 14px",
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <div style={{ fontSize: 20 }}>
                              {isCompleted ? "✅" : "🛵"}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 800, color: isCompleted ? "#166534" : "#1E40AF" }}>
                                {isCompleted ? "Entrega concluída com sucesso!" : "Em rota de entrega"}
                              </div>
                              <div style={{ fontSize: 12, color: isCompleted ? "#15803D" : "#1D4ED8", marginTop: 2 }}>
                                {motoboyMatch && <span>Entregador: <strong>{motoboyMatch}</strong></span>}
                                {departureMatch && <span> · Saída: <strong>{departureMatch}</strong></span>}
                                {deliveredMatch && <span> · Entregue às: <strong>{deliveredMatch}</strong></span>}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                      )}

                      {/* ITENS DO PEDIDO */}
                      <div style={{ borderTop: "1px solid #E6DFD6", paddingTop: 12, marginTop: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#706965", marginBottom: 6 }}>Itens:</div>
                        {ord.items.map((it) => (
                          <div key={it.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                            <span>{it.quantity}x {it.name}</span>
                            <span style={{ fontWeight: 700 }}>{formatMoney(it.unitPriceCents * it.quantity)}</span>
                          </div>
                        ))}
                      </div>

                      {/* CONTATO WHATSAPP DA LOJA */}
                      <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #E6DFD6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "#706965" }}>
                          {isCancelled ? "Dúvidas sobre o cancelamento?" : "Dúvidas sobre o pedido?"}
                        </span>
                        <a
                          href={`https://wa.me/5548988786741?text=${encodeURIComponent(
                            isCancelled
                              ? `Olá, gostaria de informações sobre o cancelamento do meu pedido ${ord.code}`
                              : `Olá, gostaria de saber sobre meu pedido ${ord.code}`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            background: isCancelled ? "#9B1C1C" : "#138C56",
                            color: "#FFFFFF",
                            textDecoration: "none",
                            fontSize: 12,
                            fontWeight: 800,
                            padding: "6px 14px",
                            borderRadius: "99px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
                          <span>Falar no WhatsApp</span>
                        </a>
                      </div>
                    </div>
                  );
                })
              )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
