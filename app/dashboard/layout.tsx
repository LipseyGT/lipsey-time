import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BriefcaseBusiness,
  Clock3,
  QrCode,
  FileText,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/auth/login?next=${encodeURIComponent("/dashboard")}`
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, active")
    .eq("id", user.id)
    .single();

if (!profile) {
  redirect("/auth/login");
}

if (!profile.active) {
  redirect("/employee");
}

if (profile.role !== "admin") {
  redirect("/employee");
}

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        <aside className="hidden w-64 shrink-0 border-r bg-background lg:block">
          <div className="flex h-full flex-col">
            <div className="border-b px-6 py-6">
              <div className="text-xl font-bold tracking-tight">
                Lipsey Time
              </div>

              <div className="mt-1 text-sm text-muted-foreground">
                Administration
              </div>
            </div>

            <nav className="flex-1 space-y-1 p-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-3 rounded-lg bg-accent px-3 py-2 text-sm font-medium"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>

              <div className="mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Time
              </div>

              <Link
  href="/dashboard/employees"
  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
>
  <Users className="h-4 w-4" />
  Employees
</Link>

<Link
  href="/dashboard/timesheets"
  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
>
  <Clock3 className="h-4 w-4" />
  Timesheets
</Link>

<Link
  href="/dashboard/shifts"
  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
>
  <Clock3 className="h-4 w-4" />
  Shifts
</Link>

              <div className="mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Work
              </div>

              <Link
  href="/dashboard/jobs"
  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
>
  <BriefcaseBusiness className="h-4 w-4" />
  Jobs
</Link>

              <Link
  href="/dashboard/qr-codes"
  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
>
  <QrCode className="h-4 w-4" />
  QR Codes
</Link>

              <div className="mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Reporting
              </div>

              <Link
  href="/dashboard/reports"
  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
>
  <FileText className="h-4 w-4" />
  Reports
</Link>
            </nav>

            <div className="border-t p-4">
              <div className="text-sm font-medium">
                {profile.full_name}
              </div>

              <div className="text-xs text-muted-foreground">
                Administrator
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="border-b bg-background px-4 py-4 lg:hidden">
            <div className="font-bold">Lipsey Time</div>
            <div className="text-xs text-muted-foreground">
              Admin Dashboard
            </div>
          </div>

          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}