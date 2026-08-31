import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireEmployeeSelfService() {
  const supabase = await createClient();

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    redirect("/auth/login?next=/employee");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, employee_number, full_name, role, active")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    redirect("/auth/login");
  }

  return {
    supabase,
    userId,
    profile: {
      id: profile.id as string,
      employee_number: profile.employee_number as string,
      full_name: profile.full_name as string,
      role: profile.role as string,
      active: profile.active as boolean,
    },
  };
}
