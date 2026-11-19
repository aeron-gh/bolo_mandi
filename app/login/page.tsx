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
  google: "Google login nahi hua. Dobara try karein.",
  google_off: "Google login abhi chalu nahi hai. Email se login karein.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const shop = await signedInShop();
  if (shop?.mode === "user") redirect("/app");
  const { error } = await searchParams;
  return (
    <AuthCard
      title="Apni dukaan kholiye"
      lead={shop?.mode === "demo" ? "Abhi demo chal raha hai. Apne account se login karein." : "Bill, khata aur hisaab, sab ek jagah."}
      google={googleConfig(process.env) !== null}
      error={typeof error === "string" ? ERRORS[error] : undefined}
      footer={<>Naya account? <Link href="/signup">Account banao</Link></>}
    >
      <AuthForm mode="login" />
    </AuthCard>
  );
}
