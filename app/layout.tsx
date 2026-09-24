import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.SITE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    "https://smack-chicken-pedidos.lucasgabrielwww2218.workers.dev"
  ),
  title: process.env.SMACK_MODE === "panel"
    ? "SMACK Operação — Painel da loja"
    : "SMACK CHICKEN — Frango Frito no Balde & Smash Burgers no Estreito, Florianópolis",
  description: process.env.SMACK_MODE === "panel"
    ? "Painel privado de caixa, cozinha, pedidos e gestão financeira da SMACK CHICKEN."
    : "O melhor frango frito crocante no balde e hambúrgueres artesanais de Florianópolis. Rua Fúlvio Aducci, 1074 — Estreito. Peça online no delivery!",
  keywords: [
    "frango frito florianopolis",
    "frango no balde florianopolis",
    "frango frito estreito",
    "smack chicken",
    "delivery frango frito",
    "smash burger florianopolis",
    "marmita estreito florianopolis",
    "comida estreito florianopolis",
    "frango crocante estreito",
    "restaurante estreito florianopolis"
  ],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
  verification: {
    google: "COLOQUE_SEU_CODIGO_DO_SEARCH_CONSOLE_AQUI",
  },
  other: {
    "geo.region": "BR-SC",
    "geo.placename": "Florianópolis",
    "geo.position": "-27.5878;-48.5794",
    ICBM: "-27.5878, -48.5794",
  },
  icons: {
    icon: "/smack-favicon.png",
    shortcut: "/smack-favicon.png",
    apple: "/smack-favicon.png",
  },
  openGraph: {
    title: "SMACK CHICKEN — Frango Crocante & Smash Burgers",
    description: "Peça online seu frango crocante no balde e smash burger. Rua Fúlvio Aducci, 1074 — Estreito, Florianópolis.",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "SMACK CHICKEN" }],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SMACK CHICKEN — Frango Crocante & Burgers",
    description: "Peça online seu frango crocante no balde e smash burger. Rua Fúlvio Aducci, 1074 — Estreito, Florianópolis.",
    images: ["/og.jpg"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["Restaurant", "FastFoodRestaurant"],
      "@id": "https://smack-chicken-pedidos.lucasgabrielwww2218.workers.dev/#restaurant",
      name: "SMACK CHICKEN — Frango Crocante & Burgers",
      alternateName: ["Smack Chicken", "Smack Chicken Estreito", "Smack Frango Frito"],
      image: "https://smack-chicken-pedidos.lucasgabrielwww2218.workers.dev/og.jpg",
      logo: "https://smack-chicken-pedidos.lucasgabrielwww2218.workers.dev/smack-chicken-logo.png",
      url: "https://smack-chicken-pedidos.lucasgabrielwww2218.workers.dev/",
      telephone: "+55-48-93500-5396",
      priceRange: "$$",
      servesCuisine: ["Fast Food", "Chicken", "Burgers", "American"],
      currenciesAccepted: "BRL",
      paymentAccepted: "Pix, Dinheiro, Cartão de Crédito, Cartão de Débito",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Rua Fúlvio Aducci, 1074",
        addressLocality: "Florianópolis",
        addressRegion: "SC",
        postalCode: "88075-000",
        addressCountry: "BR",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: -27.5878,
        longitude: -48.5794,
      },
      hasMap: "https://maps.app.goo.gl/f6Rk7JtTgcCMzCSr9",
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
          opens: "17:00",
          closes: "23:00",
        },
      ],
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "5.0",
        reviewCount: "8",
        bestRating: "5",
        worstRating: "1",
      },
      sameAs: [
        "https://www.instagram.com/smack.chicken",
        "https://maps.app.goo.gl/f6Rk7JtTgcCMzCSr9",
      ],
    },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
