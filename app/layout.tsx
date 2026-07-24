import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SMACK CHICKEN — Frango crocante no Estreito",
  description: "Peça frango crocante no Estreito, Florianópolis. Consumo no local e entrega pelo iFood.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
