import { headers } from "next/headers";
import Storefront from "./storefront";
import StorePanel from "./store-panel";

export const dynamic = "force-dynamic";

export default async function Home() {
  const host = (await headers()).get("host") || "";
  const isPanel = process.env.SMACK_MODE === "panel" || host.includes("painel");
  return isPanel ? <StorePanel /> : <Storefront />;
}
