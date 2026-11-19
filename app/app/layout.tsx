import { AppShell } from "@/app/_app/app-shell.tsx";
import { currentShop } from "@/lib/server.ts";
import { getShop } from "@/lib/shop.ts";

// Every /app page belongs to the signed-in shop, so none of them is prerendered.
export const instant = false;

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const { db, mode, user } = await currentShop();
  const shop = getShop(db);
  const title = mode === "demo" ? "Demo shop" : shop.shopName || "My shop";
  const subtitle = mode === "demo" ? "Sample customers" : shop.ownerName || user?.name || "";
  return <AppShell title={title} subtitle={subtitle} demo={mode === "demo"}>{children}</AppShell>;
}
