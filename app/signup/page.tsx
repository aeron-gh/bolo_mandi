import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/app/_auth/auth-card.tsx";
import { AuthForm } from "@/app/_auth/auth-form.tsx";
import { googleConfig } from "@/lib/google.ts";
import { signedInShop } from "@/lib/server.ts";

export const metadata: Metadata = { title: "Account banao · Bolo" };
// Reads cookies and settings on every request, so it is never prerendered.
export const instant = false;

export default async function SignupPage() {
  const shop = await signedInShop();
  if (shop?.mode === "user") redirect("/app");
  return (
    <AuthCard
      title="Apni dukaan banaiye"
      lead="Har account ki apni alag dukaan. Aapka hisaab sirf aapka."
      google={googleConfig(process.env) !== null}
      footer={<>Pehle se account hai? <Link href="/login">Login</Link></>}
    >
      <AuthForm mode="signup" />
    </AuthCard>
  );
}
