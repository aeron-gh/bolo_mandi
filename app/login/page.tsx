import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/app/_auth/auth-card.tsx";
import { AuthForm } from "@/app/_auth/auth-form.tsx";
import { googleConfig } from "@/lib/google.ts";
import { signedInShop } from "@/lib/server.ts";

export const metadata: Metadata = { title: "Login · Bolo" };
// Reads cookies and settings on every request, so it is never prerendered.
export const instant = false;

const ERRORS: Record<string, string> = {
  google: "Google sign-in didn't work. Please try again.",
  google_off: "Google sign-in is not set up yet. Please log in with email.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const shop = await signedInShop();
  if (shop?.mode === "user") redirect("/app");
  const { error } = await searchParams;
  return (
    <AuthCard
      title="Open your shop"
      lead={shop?.mode === "demo" ? "You are in the demo shop. Log in to your own account." : "Bills, ledger and accounts in one place."}
      google={googleConfig(process.env) !== null}
      error={typeof error === "string" ? ERRORS[error] : undefined}
      footer={<>New here? <Link href="/signup">Create an account</Link></>}
    >
      <AuthForm mode="login" />
    </AuthCard>
  );
}
