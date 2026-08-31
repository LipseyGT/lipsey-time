import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProtectedLandingPage() {
  const supabase = await createClient();

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    redirect("/auth/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    redirect("/auth/login");
  }

  if (profile.role === "admin") {
    redirect("/dashboard");
  }

  redirect("/employee");
}
