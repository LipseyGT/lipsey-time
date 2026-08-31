import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getJobsAccess() {
  const supabase = await createClient();

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    redirect("/auth/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    redirect("/protected");
  }

  return {
    supabase,
    userId,
    isAdmin: profile.role === "admin",
  };
}

export async function requireJobsAdmin() {
  const access = await getJobsAccess();

  if (!access.isAdmin) {
    redirect("/protected/jobs");
  }

  return access;
}
