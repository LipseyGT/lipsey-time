import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function EmployeePage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/auth/login?next=/employee");
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select(
      "id, employee_number, full_name, role, active"
    )
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    !profile
  ) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-3xl font-bold">
          Lipsey Time
        </h1>

        <p className="mt-4 text-muted-foreground">
          Your login was successful, but your
          employee profile could not be loaded.
          Please contact an administrator.
        </p>
      </main>
    );
  }

  if (!profile.active) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-3xl font-bold">
          Account Inactive
        </h1>

        <p className="mt-4 text-muted-foreground">
          Your Lipsey Time employee account is
          currently inactive. Please contact an
          administrator.
        </p>
      </main>
    );
  }

  if (profile.role === "admin") {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="rounded-xl border p-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Lipsey Time
        </h1>

        <p className="mt-2 text-lg">
          Welcome, {profile.full_name}.
        </p>

        <div className="mt-6 rounded-lg bg-muted p-5">
          <div className="font-medium">
            Employee #{profile.employee_number}
          </div>

          <p className="mt-2 text-sm text-muted-foreground">
            Your account is active and ready to
            use. Scan the appropriate Lipsey Time
            QR code when clocking in, clocking out,
            starting a job, or changing jobs.
          </p>
        </div>
      </div>
    </main>
  );
}