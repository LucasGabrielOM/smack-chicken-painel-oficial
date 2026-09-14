import { headers } from "next/headers";
import Storefront from "./storefront";
import StorePanel from "./store-panel";
import OnlineOrderManager from "./admin/online-order-manager";
import OnlineOrderingSystem from "./online-ordering-system";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ admin?: string; mode?: string }> }) {
  const params = await searchParams;
  const headerList = await headers();
  const host = headerList.get("host") || "";

  const isStorePanel = process.env.SMACK_MODE === "panel" || host.includes("painel");
  const isOnlineAdmin = params.admin !== undefined || params.mode === "admin" || host.includes("admin");
  const isVitrine = params.mode === "vitrine" || host.includes("vitrine");

  if (isStorePanel) return <StorePanel />;
  if (isOnlineAdmin) return <OnlineOrderManager />;
  if (isVitrine) return <Storefront />;

  return <OnlineOrderingSystem />;
}
