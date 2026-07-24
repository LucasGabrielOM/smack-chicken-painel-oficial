import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: process.env.SMACK_MODE === "panel"
    ? "SMACK Operação — Painel da loja"
    : "SMACK CHICKEN — Frango crocante no Estreito",
  description: process.env.SMACK_MODE === "panel"
    ? "Painel privado de caixa, cozinha, pedidos e gestão financeira da SMACK CHICKEN."
    : "Frango crocante no Estreito, Florianópolis. Consumo no local e entrega pelo iFood.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
