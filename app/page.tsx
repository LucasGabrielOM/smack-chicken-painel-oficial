import { headers } from "next/headers";
import Storefront from "./storefront";
import StorePanel from "./store-panel";
import OnlineOrderManager from "./admin/online-order-manager";
import OnlineOrderingSystem from "./online-ordering-system";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ admin?: string; mode?: string }> }) {
  const params = await searchParams;
  const headerList = await headers();
  const host = (headerList.get("host") || headerList.get("x-forwarded-host") || "").toLowerCase();

  const isStorePanel = process.env.SMACK_MODE === "panel" || host.includes("painel");
  const isOnlineAdmin = params.admin !== undefined || params.mode === "admin" || host.includes("admin");
  const isVercelVitrine = (host.includes("vercel") && !host.includes("pedidos")) || params.mode === "vitrine";

  if (isStorePanel) return <StorePanel />;
  if (isOnlineAdmin) return <OnlineOrderManager />;
  if (isVercelVitrine) return <Storefront />;

  // Padrão para o Cloudflare Workers (https://smack-chicken-pedidos.lucasgabrielwww2218.workers.dev): Sistema de Pedidos Online
  return <OnlineOrderingSystem />;
}
