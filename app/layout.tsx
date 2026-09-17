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
    : "SMACK CHICKEN — Frango Crocante & Burgers no Estreito",
  description: process.env.SMACK_MODE === "panel"
    ? "Painel privado de caixa, cozinha, pedidos e gestão financeira da SMACK CHICKEN."
    : "O autêntico frango frito crocante e smash burgers no Estreito, Florianópolis.",
  icons: {
    icon: "/smack-favicon.png",
    shortcut: "/smack-favicon.png",
    apple: "/smack-favicon.png",
  },
  openGraph: {
    title: "SMACK CHICKEN — Frango Crocante & Burgers",
    description: "Peça online seu frango crocante e smash burger. Rua Fúlvio Aducci, 1074 — Estreito.",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "SMACK CHICKEN" }],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SMACK CHICKEN — Frango Crocante & Burgers",
    description: "Peça online seu frango crocante e smash burger. Rua Fúlvio Aducci, 1074 — Estreito.",
    images: ["/og.jpg"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
