import type { Metadata } from "next";
import { draftKey } from "@/app/_bill/draft-store.ts";
import { ProfileForms } from "@/app/_app/profile-forms.tsx";
import { currentShop } from "@/lib/server.ts";
import { getRates, getShop } from "@/lib/shop.ts";

export const metadata: Metadata = { title: "Profile · Bolo" };

// The owner's own page: account, shop details, prices and PIN.
export default async function ProfilePage() {
  const { db, mode, user, key } = await currentShop();
  return <ProfileForms shop={getShop(db)} rates={getRates(db)} demo={mode === "demo"} user={user} draftKey={draftKey(key)} />;
}
