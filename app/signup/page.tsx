import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/app/_auth/auth-card.tsx";
import { AuthForm } from "@/app/_auth/auth-form.tsx";
import { googleConfig } from "@/lib/google.ts";
import { signedInShop } from "@/lib/server.ts";

export const metadata: Metadata = { title: "Create account · Bolo" };
// Reads cookies and settings on every request, so it is never prerendered.
export const instant = false;

export default async function SignupPage() {
  const shop = await signedInShop();
  if (shop?.mode === "user") redirect("/app");
  return (
    <AuthCard
      title="Set up your shop"
      lead="Every account gets its own shop. Your accounts stay yours."
      google={googleConfig(process.env) !== null}
      footer={<>Already have an account? <Link href="/login">Log in</Link></>}
    >
      <AuthForm mode="signup" />
    </AuthCard>
  );
}
