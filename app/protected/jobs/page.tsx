import Link from "next/link";
import { requireJobsAdmin } from "./_lib/access";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  status?: string;
  category?: string;
  error?: string;
}>;

export default async function JobsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const { supabase } = await requireJobsAdmin();

  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("id, job_number, customer, description, category, active, created_at")
    .order("active", { ascending: false })
    .order("job_number", { ascending: true });

  if (error) {
    throw new Error(`Unable to load jobs: ${error.message}`);
  }

  const q = (params.q ?? "").trim().toLowerCase();
  const status = params.status ?? "all";
  const category = params.category ?? "all";

  const visibleJobs = (jobs ?? []).filter((job) => {
    const matchesSearch =
      !q ||
      job.job_number.toLowerCase().includes(q) ||
      (job.customer ?? "").toLowerCase().includes(q) ||
      (job.description ?? "").toLowerCase().includes(q);

    const matchesStatus =
      status === "all" ||
      (status === "active" && job.active) ||
      (status === "inactive" && !job.active);

    const matchesCategory = category === "all" || job.category === category;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const activeCount = (jobs ?? []).filter((job) => job.active).length;
  const inactiveCount = (jobs ?? []).length - activeCount;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Jobs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the jobs employees can charge labor against.
          </p>
        </div>

        <Link
          href="/protected/jobs/new"
          className="inline-flex items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
        >
          + New Job
        </Link>
      </div>

      {params.error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {params.error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Total jobs" value={(jobs ?? []).length} />
        <SummaryCard label="Active" value={activeCount} />
        <SummaryCard label="Inactive" value={inactiveCount} />
      </div>

      <form
        method="get"
        className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_180px_180px_auto]"
      >
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search job, customer, description..."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/10"
        />

        <select
          name="status"
          defaultValue={status}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <select
          name="category"
          defaultValue={category}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="all">All categories</option>
          <option value="direct">Direct</option>
          <option value="indirect">Indirect</option>
        </select>

        <button
          type="submit"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Filter
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleJobs.map((job) => (
                <tr key={job.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{job.job_number}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {job.customer || "—"}
                  </td>
                  <td className="max-w-md truncate px-4 py-3 text-muted-foreground">
                    {job.description || "—"}
                  </td>
                  <td className="px-4 py-3 capitalize">{job.category}</td>
                  <td className="px-4 py-3">
                    <StatusBadge active={job.active} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/protected/jobs/${job.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}

              {visibleJobs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No jobs match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
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
