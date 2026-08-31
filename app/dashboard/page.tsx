import Link from "next/link";
import { DashboardAutoRefresh } from "./_components/auto-refresh";
import { requireReportsAdmin } from "./reports/_lib/access";
import {
  centralToday,
  formatHours,
  formatRangeLabel,
  reportBounds,
  type JobRow,
  type JobSessionRow,
  type ProfileRow,
  type ShiftRow,
} from "./reports/_lib/report";
import { loadReportData } from "./reports/_lib/load-report";
import { loadPayrollData } from "./payroll/_lib/load-payroll";
import {
  mondayForDate,
  sundayForMonday,
} from "./payroll/_lib/payroll";

export const dynamic = "force-dynamic";

type CurrentWorker = {
  shiftId: number;
  userId: string;
  employeeName: string;
  employeeNumber: string;
  clockIn: string;
  currentJobId: number | null;
  currentJobNumber: string | null;
  jobStartedAt: string | null;
};

function formatCentralTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function elapsedLabel(value: string) {
  const ms = Math.max(0, Date.now() - new Date(value).getTime());
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

export default async function DashboardPage() {
  const { supabase } = await requireReportsAdmin();

  const today = centralToday();
  const weekStart = mondayForDate(today);
  const weekEnd = sundayForMonday(weekStart);
  const { start: todayStart, endExclusive: tomorrowStart } =
    reportBounds(today, today);

  const [
    todayReport,
    weekPayroll,
    { data: profilesData, error: profilesError },
    { data: jobsData, error: jobsError },
    { data: openShiftsData, error: openShiftsError },
    { data: openSessionsData, error: openSessionsError },
  ] = await Promise.all([
    loadReportData({
      supabase,
      from: today,
      to: today,
    }),
    loadPayrollData({
      supabase,
      from: weekStart,
      to: weekEnd,
    }),
    supabase
      .from("profiles")
      .select("id, employee_number, full_name, role, active"),
    supabase
      .from("jobs")
      .select("id, job_number, customer, description, category, active")
      .eq("active", true)
      .order("job_number"),
    supabase
      .from("shifts")
      .select("id, user_id, clock_in, clock_out")
      .is("clock_out", null)
      .gte("clock_in", todayStart.toISOString())
      .lt("clock_in", tomorrowStart.toISOString())
      .order("clock_in", { ascending: true }),
    supabase
      .from("job_sessions")
      .select("id, shift_id, user_id, job_id, started_at, ended_at")
      .is("ended_at", null)
      .gte("started_at", todayStart.toISOString())
      .lt("started_at", tomorrowStart.toISOString())
      .order("started_at", { ascending: false }),
  ]);

  if (profilesError) {
    throw new Error(`Unable to load dashboard employees: ${profilesError.message}`);
  }

  if (jobsError) {
    throw new Error(`Unable to load dashboard jobs: ${jobsError.message}`);
  }

  if (openShiftsError) {
    throw new Error(`Unable to load open shifts: ${openShiftsError.message}`);
  }

  if (openSessionsError) {
    throw new Error(
      `Unable to load open job sessions: ${openSessionsError.message}`,
    );
  }

  const profiles = (profilesData ?? []) as ProfileRow[];
  const jobs = (jobsData ?? []) as JobRow[];
  const openShifts = (openShiftsData ?? []) as ShiftRow[];
  const openSessions = (openSessionsData ?? []) as JobSessionRow[];

  const profileById = new Map(
    profiles.map((profile) => [profile.id, profile]),
  );
  const jobById = new Map(jobs.map((job) => [job.id, job]));

  const openSessionByShift = new Map<number, JobSessionRow>();

  for (const session of openSessions) {
    if (!openSessionByShift.has(session.shift_id)) {
      openSessionByShift.set(session.shift_id, session);
    }
  }

  const currentWorkers: CurrentWorker[] = openShifts
    .map((shift) => {
      const profile = profileById.get(shift.user_id);
      const session = openSessionByShift.get(shift.id);
      const job = session ? jobById.get(session.job_id) : undefined;

      return {
        shiftId: shift.id,
        userId: shift.user_id,
        employeeName: profile?.full_name ?? "Unknown employee",
        employeeNumber: profile?.employee_number ?? "—",
        clockIn: shift.clock_in,
        currentJobId: job?.id ?? null,
        currentJobNumber: job?.job_number ?? null,
        jobStartedAt: session?.started_at ?? null,
      };
    })
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  const topJobs = [...todayReport.jobs]
    .sort((a, b) => b.laborHours - a.laborHours)
    .slice(0, 6);

  const workingWithoutJob = currentWorkers.filter(
    (worker) => !worker.currentJobId,
  ).length;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <DashboardAutoRefresh />

      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Operations Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live overview for {formatRangeLabel(today, today)}. Updates every
            60 seconds.
          </p>
        </div>

        <div className="text-sm text-muted-foreground">
          Workweek: {formatRangeLabel(weekStart, weekEnd)}
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Working Now"
          value={String(currentWorkers.length)}
          detail={
            workingWithoutJob > 0
              ? `${workingWithoutJob} without an active job`
              : "All current workers assigned"
          }
        />
        <MetricCard
          label="Active Jobs"
          value={String(jobs.length)}
          detail="Available for employee job scans"
        />
        <MetricCard
          label="Hours Today"
          value={`${formatHours(todayReport.summary.shiftHours)} hrs`}
          detail={`${todayReport.summary.employeeCount} employees recorded`}
        />
        <MetricCard
          label="Job Hours Today"
          value={`${formatHours(todayReport.summary.jobHours)} hrs`}
          detail={`${formatHours(todayReport.summary.unallocatedHours)} hrs unallocated`}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <article className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border p-5">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Currently Working
              </h2>
              <p className="text-sm text-muted-foreground">
                Employees with an open shift today.
              </p>
            </div>

            <Link
              href="/dashboard/shifts"
              className="text-sm font-medium underline-offset-4 hover:underline"
            >
              View Shifts
            </Link>
          </div>

          {currentWorkers.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No employees are currently clocked in.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {currentWorkers.map((worker) => (
                <div
                  key={worker.shiftId}
                  className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div>
                    <Link
                      href={`/dashboard/employees/${worker.userId}`}
                      className="font-semibold underline-offset-4 hover:underline"
                    >
                      {worker.employeeName}
                    </Link>
                    <div className="mt-1 text-sm text-muted-foreground">
                      #{worker.employeeNumber} · Clocked in{" "}
                      {formatCentralTime(worker.clockIn)} ·{" "}
                      {elapsedLabel(worker.clockIn)}
                    </div>
                  </div>

                  <div className="sm:text-right">
                    {worker.currentJobId && worker.currentJobNumber ? (
                      <>
                        <Link
                          href={`/dashboard/jobs/${worker.currentJobId}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {worker.currentJobNumber}
                        </Link>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {worker.jobStartedAt
                            ? `Since ${formatCentralTime(worker.jobStartedAt)}`
                            : "Current job"}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="font-medium">No active job</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Time is currently unallocated
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                This Workweek
              </h2>
              <p className="text-sm text-muted-foreground">
                Monday–Sunday payroll status.
              </p>
            </div>

            <Link
              href={`/dashboard/payroll?from=${weekStart}&to=${weekEnd}`}
              className="text-sm font-medium underline-offset-4 hover:underline"
            >
              Payroll
            </Link>
          </div>

          <dl className="mt-6 space-y-4">
            <StatRow
              label="Total hours"
              value={`${formatHours(weekPayroll.summary.totalHours)} hrs`}
            />
            <StatRow
              label="Regular"
              value={`${formatHours(weekPayroll.summary.regularHours)} hrs`}
            />
            <StatRow
              label="Overtime"
              value={`${formatHours(weekPayroll.summary.overtimeHours)} hrs`}
            />
            <StatRow
              label="Incomplete shifts"
              value={String(weekPayroll.summary.incompleteShifts)}
            />
            <StatRow
              label="Today's unallocated"
              value={`${formatHours(todayReport.summary.unallocatedHours)} hrs`}
            />
          </dl>

          {weekPayroll.summary.incompleteShifts > 0 ? (
            <div className="mt-6 rounded-md border border-border bg-muted/40 p-3 text-sm">
              Payroll is preliminary while open shifts remain.
            </div>
          ) : null}
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.45fr]">
        <article className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border p-5">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Today's Job Labor
              </h2>
              <p className="text-sm text-muted-foreground">
                Assigned labor hours by job today.
              </p>
            </div>

            <Link
              href={`/dashboard/reports?from=${today}&to=${today}`}
              className="text-sm font-medium underline-offset-4 hover:underline"
            >
              Full Report
            </Link>
          </div>

          {topJobs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No job labor has been recorded today.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {topJobs.map((job) => (
                <div
                  key={job.jobId}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <div>
                    <Link
                      href={`/dashboard/jobs/${job.jobId}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {job.jobNumber}
                    </Link>
                    <div className="mt-1 text-xs capitalize text-muted-foreground">
                      {job.category}
                      {job.customer ? ` · ${job.customer}` : ""}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-semibold">
                      {formatHours(job.laborHours)} hrs
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {job.employeeCount} employee
                      {job.employeeCount === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-xl font-semibold tracking-tight">
            Quick Actions
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Common administrative views.
          </p>

          <div className="mt-5 grid gap-2">
            <QuickLink href="/dashboard/shifts">View Live Shifts</QuickLink>
            <QuickLink href="/dashboard/timesheets">
              Review Timesheets
            </QuickLink>
            <QuickLink href="/dashboard/jobs">Manage Jobs</QuickLink>
            <QuickLink href="/dashboard/qr-codes">QR Codes</QuickLink>
            <QuickLink href="/dashboard/reports">Reports</QuickLink>
            <QuickLink href="/dashboard/payroll">Payroll</QuickLink>
          </div>
        </article>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </article>
  );
}

function StatRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function QuickLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-md border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
    >
      {children}
    </Link>
  );
}
