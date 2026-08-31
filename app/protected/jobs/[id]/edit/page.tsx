import Link from "next/link";
import { notFound } from "next/navigation";
import { updateJob } from "../../actions";
import { JobForm } from "../../_components/job-form";
import { requireJobsAdmin } from "../../_lib/access";

export const dynamic = "force-dynamic";

export default async function EditJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id: idParam } = await params;
  const query = await searchParams;
  const id = Number(idParam);

  if (!Number.isInteger(id) || id <= 0) notFound();

  const { supabase } = await requireJobsAdmin();

  const { data: job, error } = await supabase
    .from("jobs")
    .select("id, job_number, customer, description, category, active")
    .eq("id", id)
    .single();

  if (error || !job) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <Link
          href={`/protected/jobs/${job.id}`}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Back to {job.job_number}
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Edit Job</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update job information or remove it from the active job list.
        </p>
      </div>

      {query.error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {query.error}
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <JobForm action={updateJob} submitLabel="Save Changes" values={job} />
      </div>
    </div>
  );
}
