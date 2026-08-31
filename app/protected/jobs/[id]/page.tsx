import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setJobActive } from "../actions";
import { requireJobsAdmin } from "../_lib/access";

export const dynamic = "force-dynamic";

const centralDateTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    created?: string;
    updated?: string;
    status?: string;
    error?: string;
  }>;
}) {
  const { id: idParam } = await params;
  const query = await searchParams;
  const id = Number(idParam);

  if (!Number.isInteger(id) || id <= 0) notFound();

  const { supabase } = await requireJobsAdmin();

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, job_number, customer, description, category, active, created_at")
    .eq("id", id)
    .single();

  if (jobError || !job) notFound();

  const { data: sessions, error: sessionsError } = await supabase
    .from("job_sessions")
    .select("id, user_id, shift_id, started_at, ended_at")
    .eq("job_id", id)
    .order("started_at", { ascending: false });

  if (sessionsError) {
    throw new Error(`Unable to load job labor: ${sessionsError.message}`);
  }

  const userIds = Array.from(new Set((sessions ?? []).map((session) => session.user_id)));
  const profileMap = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    for (const profile of profiles ?? []) {
      profileMap.set(profile.id, profile.full_name);
    }
  }

  const now = Date.now();
  const laborRows = (sessions ?? []).map((session) => {
    const start = new Date(session.started_at).getTime();
    const end = session.ended_at ? new Date(session.ended_at).getTime() : now;
    const hours = Math.max(0, end - start) / 3_600_000;

    return {
      ...session,
      hours,
      employee: profileMap.get(session.user_id) ?? "Employee",
    };
  });

  const totalHours = laborRows.reduce((sum, row) => sum + row.hours, 0);
  const employeeCount = new Set(laborRows.map((row) => row.user_id)).size;
  const openCount = laborRows.filter((row) => !row.ended_at).length;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/protected/jobs"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            ← Back to Jobs
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">
              {job.job_number}
            </h1>
            <StatusBadge active={job.active} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {job.customer || "No customer assigned"}
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/protected/jobs/${job.id}/edit`}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Edit Job
          </Link>
          <form action={setJobActive}>
            <input type="hidden" name="id" value={job.id} />
            <input
              type="hidden"
              name="active"
              value={job.active ? "false" : "true"}
            />
            <button
              type="submit"
              className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              {job.active ? "Deactivate" : "Reactivate"}
            </button>
          </form>
        </div>
      </div>

      {query.created ? <SuccessMessage>Job created.</SuccessMessage> : null}
      {query.updated ? <SuccessMessage>Job updated.</SuccessMessage> : null}
      {query.status ? <SuccessMessage>Job status updated.</SuccessMessage> : null}
      {query.error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {query.error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-semibold">Job information</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Info label="Job number" value={job.job_number} />
            <Info label="Customer" value={job.customer || "—"} />
            <Info label="Category" value={capitalize(job.category)} />
            <Info
              label="Created"
              value={centralDateTime.format(new Date(job.created_at))}
            />
            <div className="sm:col-span-2">
              <Info label="Description" value={job.description || "—"} />
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-semibold">Labor summary</h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Stat label="Total hours" value={totalHours.toFixed(2)} />
            <Stat label="Employees" value={String(employeeCount)} />
            <Stat label="Labor entries" value={String(laborRows.length)} />
            <Stat label="Open entries" value={String(openCount)} />
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold">Labor activity</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Time employees have charged to this job.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Start</th>
                <th className="px-4 py-3 font-medium">End</th>
                <th className="px-4 py-3 font-medium">Shift</th>
                <th className="px-4 py-3 text-right font-medium">Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {laborRows.slice(0, 100).map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-medium">{row.employee}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {centralDateTime.format(new Date(row.started_at))}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.ended_at ? (
                      centralDateTime.format(new Date(row.ended_at))
                    ) : (
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">
                        In progress
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    #{row.shift_id}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {row.hours.toFixed(2)}
                  </td>
                </tr>
              ))}

              {laborRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No labor has been charged to this job yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SuccessMessage({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={
        active
          ? "inline-flex rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"
          : "inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
      }
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
