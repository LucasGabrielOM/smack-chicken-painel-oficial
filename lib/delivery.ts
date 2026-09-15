// Regras oficiais de entrega e raio de atendimento SMACK CHICKEN
// Loja física: Rua Fúlvio Aducci, 1074 — Estreito, Florianópolis - SC (CEP 88075-000)

export const STORE_COORDINATES = {
  lat: -27.587326,
  lng: -48.578321,
  address: "Rua Fúlvio Aducci, 1074 — Estreito, Florianópolis - SC",
  cep: "88075-000",
} as const;

export const MAX_DELIVERY_RADIUS_KM = 6.0;

export interface DeliveryTier {
  maxKm: number;
  timeMinutes: number;
  feeCents: number;
  feeFormatted: string;
}

export const DELIVERY_TIERS: DeliveryTier[] = [
  { maxKm: 0.5, timeMinutes: 36, feeCents: 499, feeFormatted: "R$ 4,99" },
  { maxKm: 1.0, timeMinutes: 40, feeCents: 499, feeFormatted: "R$ 4,99" },
  { maxKm: 1.5, timeMinutes: 42, feeCents: 699, feeFormatted: "R$ 6,99" },
  { maxKm: 2.0, timeMinutes: 44, feeCents: 699, feeFormatted: "R$ 6,99" },
  { maxKm: 2.5, timeMinutes: 46, feeCents: 799, feeFormatted: "R$ 7,99" },
  { maxKm: 3.0, timeMinutes: 48, feeCents: 799, feeFormatted: "R$ 7,99" },
  { maxKm: 3.5, timeMinutes: 50, feeCents: 899, feeFormatted: "R$ 8,99" },
  { maxKm: 4.0, timeMinutes: 52, feeCents: 899, feeFormatted: "R$ 8,99" },
  { maxKm: 4.5, timeMinutes: 54, feeCents: 999, feeFormatted: "R$ 9,99" },
  { maxKm: 5.0, timeMinutes: 55, feeCents: 1099, feeFormatted: "R$ 10,99" },
  { maxKm: 5.5, timeMinutes: 58, feeCents: 1199, feeFormatted: "R$ 11,99" },
  { maxKm: 6.0, timeMinutes: 60, feeCents: 1299, feeFormatted: "R$ 12,99" },
];

/**
 * Fórmula de Haversine para calcular a distância esférica entre dois pontos em quilômetros.
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getDeliveryTier(
  distanceKm: number,
  customSettings?: { maxRadiusKm?: number; tiers?: DeliveryTier[] }
): {
  tier: DeliveryTier | null;
  isWithinRadius: boolean;
  distanceKm: number;
} {
  const maxRadius = customSettings?.maxRadiusKm ?? MAX_DELIVERY_RADIUS_KM;
  const tiers = customSettings?.tiers && customSettings.tiers.length > 0 ? customSettings.tiers : DELIVERY_TIERS;

  // Pequena tolerância para imprecisões de arredondamento de float
  if (distanceKm > maxRadius + 0.05) {
    return { tier: null, isWithinRadius: false, distanceKm };
  }

  for (const tier of tiers) {
    if (distanceKm <= tier.maxKm) {
      return { tier, isWithinRadius: true, distanceKm };
    }
  }

  const lastTier = tiers[tiers.length - 1];
  return { tier: lastTier, isWithinRadius: true, distanceKm };
}

// Tabela de bairros conhecidos na região continental e adjacências para fallback de contingência
const NEIGHBORHOOD_FALLBACK_KM: Record<string, number> = {
  estreito: 0.6,
  balneario: 1.2,
  balneário: 1.2,
  canto: 1.4,
  coqueiros: 1.8,
  capoeiras: 2.2,
  abraao: 2.4,
  abraão: 2.4,
  centro: 2.5,
  coloninha: 2.8,
  "monte cristo": 3.0,
  "jardim atlantico": 3.2,
  "jardim atlântico": 3.2,
  kobrasol: 3.5,
  campinas: 3.7,
  itaguacu: 3.8,
  itaguaçu: 3.8,
  "praia comprida": 4.2,
  barreiros: 4.6,
  "bela vista": 4.8,
  floresta: 4.9,
};

export interface CepDeliveryResult {
  success: boolean;
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  lat?: number;
  lng?: number;
  distanceKm?: number;
  isWithinRadius: boolean;
  tier: DeliveryTier | null;
  error?: string;
}

/**
 * Consulta CEP e calcula distância georreferenciada da loja física
 */
export async function fetchCepDeliveryInfo(
  rawCep: string,
  customSettings?: { maxRadiusKm?: number; tiers?: DeliveryTier[] }
): Promise<CepDeliveryResult> {
  const cleanCep = rawCep.replace(/\D/g, "");
  if (cleanCep.length !== 8) {
    return {
      success: false,
      cep: cleanCep,
      street: "",
      neighborhood: "",
      city: "",
      state: "",
      isWithinRadius: false,
      tier: null,
      error: "CEP deve conter 8 dígitos.",
    };
  }

  let street = "";
  let neighborhood = "";
  let city = "Florianópolis";
  let state = "SC";
  let lat: number | undefined;
  let lng: number | undefined;

  // 1. Tentar AwesomeAPI (retorna coordenadas lat/lng sem token de API)
  try {
    const res = await fetch(`https://cep.awesomeapi.com.br/json/${cleanCep}`, {
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        address?: string;
        district?: string;
        city?: string;
        state?: string;
        lat?: string;
        lng?: string;
      };
      if (data.address || data.district) {
        street = data.address || "";
        neighborhood = data.district || "";
        city = data.city || "Florianópolis";
        state = data.state || "SC";
        if (data.lat && data.lng) {
          const pLat = parseFloat(data.lat);
          const pLng = parseFloat(data.lng);
          if (!isNaN(pLat) && !isNaN(pLng)) {
            lat = pLat;
            lng = pLng;
          }
        }
      }
    }
  } catch {}

  // 2. Tentar BrasilAPI v2 caso AwesomeAPI não tenha coordenadas
  if (lat === undefined || lng === undefined) {
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`);
      if (res.ok) {
        const data = (await res.json()) as {
          street?: string;
          neighborhood?: string;
          city?: string;
          state?: string;
          location?: { coordinates?: { latitude?: string | number; longitude?: string | number } };
        };
        if (!street && data.street) street = data.street;
        if (!neighborhood && data.neighborhood) neighborhood = data.neighborhood;
        if (data.city) city = data.city;
        if (data.state) state = data.state;
        const cLat = Number(data.location?.coordinates?.latitude);
        const cLng = Number(data.location?.coordinates?.longitude);
        if (!isNaN(cLat) && !isNaN(cLng) && cLat !== 0 && cLng !== 0) {
          lat = cLat;
          lng = cLng;
        }
      }
    } catch {}
  }

  // 3. Fallback para ViaCEP se ainda não tiver logradouro/bairro
  if (!street && !neighborhood) {
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (res.ok) {
        const data = (await res.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
        if (!data.erro) {
          street = data.logradouro || "";
          neighborhood = data.bairro || "";
          city = data.localidade || city;
          state = data.uf || state;
        }
      }
    } catch {}
  }

  // Se não foi possível localizar rua nem bairro em nenhum serviço
  if (!street && !neighborhood) {
    return {
      success: false,
      cep: cleanCep,
      street: "",
      neighborhood: "",
      city: "",
      state: "",
      isWithinRadius: false,
      tier: null,
      error: "CEP não encontrado nos serviços de localização.",
    };
  }

  // 4. Calcular distância a partir das coordenadas
  let distanceKm: number;

  if (lat !== undefined && lng !== undefined) {
    distanceKm = calculateDistanceKm(STORE_COORDINATES.lat, STORE_COORDINATES.lng, lat, lng);
  } else {
    // Se não obteve coordenadas exatas, usa tabela de contingência por bairro
    const normNeigh = (neighborhood || "").trim().toLowerCase();
    const fallbackDist = NEIGHBORHOOD_FALLBACK_KM[normNeigh];
    if (fallbackDist !== undefined) {
      distanceKm = fallbackDist;
    } else {
      // Se for Florianópolis ou São José desconhecido, estima no limite médio (3.0 km)
      const normCity = city.toLowerCase();
      if (normCity.includes("florian") || normCity.includes("josé") || normCity.includes("jose")) {
        distanceKm = 3.0;
      } else {
        // Outra cidade (ex: Palhoça, Biguaçu, outras regiões distantes) -> fora de 5 km
        distanceKm = 12.0;
      }
    }
  }

  const { tier, isWithinRadius } = getDeliveryTier(distanceKm, customSettings);
  const maxRadius = customSettings?.maxRadiusKm ?? MAX_DELIVERY_RADIUS_KM;

  return {
    success: true,
    cep: cleanCep,
    street,
    neighborhood,
    city,
    state,
    lat,
    lng,
    distanceKm,
    isWithinRadius,
    tier,
    error: isWithinRadius
      ? undefined
      : `O endereço informado fica a cerca de ${distanceKm.toFixed(1)} km da loja, fora do nosso raio de entrega de ${maxRadius.toFixed(0)} km. Escolha "Retirar na Loja".`,
  };
}
