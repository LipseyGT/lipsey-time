import Link from "next/link";
import QRCode from "qrcode";
import { setQrActive } from "./actions";
import { requireQrAdmin } from "./_lib/access";

export const dynamic = "force-dynamic";

const SITE_URL = "https://time.lipseygintech.com";

type QrRow = {
  token: string;
  action_type: "clock_in" | "clock_out" | "job_start";
  job_id: number | null;
  label: string;
  active: boolean;
  created_at: string;
};

type JobRow = {
  id: number;
  job_number: string;
  customer: string | null;
  active: boolean;
};

function actionTitle(row: QrRow, job?: JobRow) {
  if (row.action_type === "clock_in") return "CLOCK IN";
  if (row.action_type === "clock_out") return "CLOCK OUT";
  return job?.job_number ?? row.label;
}

function actionDescription(row: QrRow, job?: JobRow) {
  if (row.action_type === "clock_in") {
    return "Employees scan this code when beginning their workday.";
  }

  if (row.action_type === "clock_out") {
    return "Employees scan this code when ending their workday.";
  }

  if (job?.customer) {
    return job.customer;
  }

  return "Scan to start or switch work to this job.";
}

export default async function QrCodesPage() {
  const { supabase } = await requireQrAdmin();

  const [{ data: qrData, error: qrError }, { data: jobsData, error: jobsError }] =
    await Promise.all([
      supabase
        .from("qr_codes")
        .select("token, action_type, job_id, label, active, created_at")
        .order("created_at", { ascending: true }),
      supabase
        .from("jobs")
        .select("id, job_number, customer, active")
        .order("id", { ascending: true }),
    ]);

  if (qrError) {
    throw new Error(`Unable to load QR codes: ${qrError.message}`);
  }

  if (jobsError) {
    throw new Error(`Unable to load jobs: ${jobsError.message}`);
  }

  const qrRows = (qrData ?? []) as QrRow[];
  const jobs = (jobsData ?? []) as JobRow[];
  const jobById = new Map(jobs.map((job) => [job.id, job]));

  const enriched = await Promise.all(
    qrRows.map(async (row) => {
      const scanUrl = `${SITE_URL}/q/${row.token}`;
      const qrImage = await QRCode.toDataURL(scanUrl, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 260,
      });

      return {
        row,
        scanUrl,
        qrImage,
        job: row.job_id ? jobById.get(row.job_id) : undefined,
      };
    }),
  );

  const timeCodes = enriched.filter(
    (item) =>
      item.row.action_type === "clock_in" ||
      item.row.action_type === "clock_out",
  );

  const activeJobCodes = enriched.filter(
    (item) =>
      item.row.action_type === "job_start" &&
      item.row.active &&
      item.job?.active !== false,
  );

  const inactiveJobCodes = enriched.filter(
    (item) =>
      item.row.action_type === "job_start" &&
      (!item.row.active || item.job?.active === false),
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">QR Codes</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Manage the physical codes employees scan for clocking in, clocking
          out, and starting jobs. Printed job codes keep the same token when a
          job is deactivated and later reactivated.
        </p>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Time Clock</h2>
          <p className="text-sm text-muted-foreground">
            Permanent Clock In and Clock Out signs.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {timeCodes.map((item) => (
            <QrCard
              key={item.row.token}
              row={item.row}
              job={item.job}
              scanUrl={item.scanUrl}
              qrImage={item.qrImage}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Active Jobs</h2>
            <p className="text-sm text-muted-foreground">
              New jobs receive a QR automatically.
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            {activeJobCodes.length} active job code
            {activeJobCodes.length === 1 ? "" : "s"}
          </div>
        </div>

        {activeJobCodes.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No active job QR codes.
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {activeJobCodes.map((item) => (
              <QrCard
                key={item.row.token}
                row={item.row}
                job={item.job}
                scanUrl={item.scanUrl}
                qrImage={item.qrImage}
              />
            ))}
          </div>
        )}
      </section>

      {inactiveJobCodes.length > 0 ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Inactive Job Codes
            </h2>
            <p className="text-sm text-muted-foreground">
              These tokens are retained so an old printed sign can be reused if
              the job is reactivated.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {inactiveJobCodes.map((item) => (
              <QrCard
                key={item.row.token}
                row={item.row}
                job={item.job}
                scanUrl={item.scanUrl}
                qrImage={item.qrImage}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function QrCard({
  row,
  job,
  scanUrl,
  qrImage,
}: {
  row: QrRow;
  job?: JobRow;
  scanUrl: string;
  qrImage: string;
}) {
  const title = actionTitle(row, job);
  const description = actionDescription(row, job);

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-col gap-5 p-5 sm:flex-row">
        <div className="shrink-0 rounded-md border border-border bg-white p-2">
          <img
            src={qrImage}
            alt={`QR code for ${title}`}
            width={180}
            height={180}
            className="h-[180px] w-[180px]"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-xl font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            </div>

            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                row.active
                  ? "border-border bg-muted text-foreground"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}
            >
              {row.active ? "Active" : "Inactive"}
            </span>
          </div>

          <div className="mt-4 space-y-1 text-xs text-muted-foreground">
            <div className="truncate" title={scanUrl}>
              {scanUrl}
            </div>
            {job ? <div>Database job ID: {job.id}</div> : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={`/dashboard/qr-codes/${row.token}/print`}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              Print Sign
            </Link>

            <form action={setQrActive}>
              <input type="hidden" name="token" value={row.token} />
              <input
                type="hidden"
                name="active"
                value={row.active ? "false" : "true"}
              />
              <button
                type="submit"
                className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                {row.active ? "Deactivate Code" : "Activate Code"}
              </button>
            </form>

            {job ? (
              <Link
                href={`/dashboard/jobs/${job.id}`}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Open Job
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
