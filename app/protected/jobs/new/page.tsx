import Link from "next/link";
import { createJob } from "../actions";
import { JobForm } from "../_components/job-form";
import { requireJobsAdmin } from "../_lib/access";

export const dynamic = "force-dynamic";

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  await requireJobsAdmin();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <Link
          href="/protected/jobs"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Back to Jobs
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">New Job</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a job employees can select and charge time against.
        </p>
      </div>

      {params.error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {params.error}
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <JobForm action={createJob} submitLabel="Create Job" />
      </div>
    </div>
  );
}
