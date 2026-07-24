import Storefront from "./storefront";
import StorePanel from "./store-panel";

export const dynamic = "force-dynamic";

export default function Home() {
  return process.env.SMACK_MODE === "panel" ? <StorePanel /> : <Storefront />;
}
