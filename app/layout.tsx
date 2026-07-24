import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.RENDER_EXTERNAL_URL || "https://smack-chicken.onrender.com"),
  title: process.env.SMACK_MODE === "panel"
    ? "SMACK Operação — Painel da loja"
    : "SMACK CHICKEN — Frango crocante no Estreito",
  description: process.env.SMACK_MODE === "panel"
    ? "Painel privado de caixa, cozinha, pedidos e gestão financeira da SMACK CHICKEN."
    : "Frango crocante no Estreito, Florianópolis. Consumo no local e entrega pelo iFood.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/smack-chicken-mark.png",
  },
  openGraph: {
    title: "SMACK CHICKEN — Frango crocante. Sem conversa.",
    description: "O crunch que Florianópolis merecia. Rua Fúlvio Aducci, 1074 — Estreito.",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "SMACK CHICKEN — frango crocante no Estreito" }],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SMACK CHICKEN — Frango crocante. Sem conversa.",
    description: "O crunch que Florianópolis merecia.",
    images: ["/og.jpg"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
