import Link from "next/link";
import { EmployeeAutoRefresh } from "./_components/auto-refresh";
import { employeeSignOut } from "./actions";
import { requireEmployeeSelfService } from "./_lib/access";
import {
  clippedDurationHours,
  durationHours,
  elapsedLabel,
  formatCentralDate,
  formatCentralDateTime,
  formatCentralTime,
  formatHours,
  todayBounds,
} from "./_lib/time";

export const dynamic = "force-dynamic";

type ShiftRow = {
  id: number;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
};

type SessionRow = {
  id: number;
  shift_id: number;
  user_id: string;
  job_id: number;
  started_at: string;
  ended_at: string | null;
};

type JobRow = {
  id: number;
  job_number: string;
  customer: string | null;
  active: boolean;
};

export default async function EmployeePage() {
  const { supabase, userId, profile } =
    await requireEmployeeSelfService();

  const { today, start, endExclusive } = todayBounds();
  const now = new Date();

  const [
    { data: shiftsData, error: shiftsError },
    { data: sessionsData, error: sessionsError },
    { data: jobsData, error: jobsError },
  ] = await Promise.all([
    supabase
      .from("shifts")
      .select("id, user_id, clock_in, clock_out")
      .eq("user_id", userId)
      .lt("clock_in", endExclusive.toISOString())
      .or(`clock_out.is.null,clock_out.gte.${start.toISOString()}`)
      .order("clock_in", { ascending: false })
      .limit(20),
    supabase
      .from("job_sessions")
      .select("id, shift_id, user_id, job_id, started_at, ended_at")
      .eq("user_id", userId)
      .lt("started_at", endExclusive.toISOString())
      .or(`ended_at.is.null,ended_at.gte.${start.toISOString()}`)
      .order("started_at", { ascending: false })
      .limit(100),
    supabase
      .from("jobs")
      .select("id, job_number, customer, active")
      .eq("active", true)
      .order("job_number"),
  ]);

  if (shiftsError) {
    throw new Error(`Unable to load your shifts: ${shiftsError.message}`);
  }

  if (sessionsError) {
    throw new Error(`Unable to load your job time: ${sessionsError.message}`);
  }

  if (jobsError) {
    throw new Error(`Unable to load jobs: ${jobsError.message}`);
  }

  const shifts = (shiftsData ?? []) as ShiftRow[];
  const sessions = (sessionsData ?? []) as SessionRow[];
  const jobs = (jobsData ?? []) as JobRow[];
  const jobById = new Map(jobs.map((job) => [job.id, job]));

  const openShift =
    shifts.find(
      (shift) =>
        !shift.clock_out &&
        new Date(shift.clock_in).getTime() >= start.getTime() &&
        new Date(shift.clock_in).getTime() < endExclusive.getTime(),
    ) ?? null;

  const openSession =
    sessions.find(
      (session) =>
        !session.ended_at &&
        openShift &&
        session.shift_id === openShift.id,
    ) ?? null;

  const currentJob = openSession
    ? jobById.get(openSession.job_id) ?? null
    : null;

  const todayShiftHours = shifts.reduce(
    (sum, shift) =>
      sum +
      clippedDurationHours(
        shift.clock_in,
        shift.clock_out,
        start,
        endExclusive,
        now,
      ),
    0,
  );

  const todayJobHours = sessions.reduce(
    (sum, session) =>
      sum +
      clippedDurationHours(
        session.started_at,
        session.ended_at,
        start,
        endExclusive,
        now,
      ),
    0,
  );

  const todayUnallocated = Math.max(
    0,
    todayShiftHours - todayJobHours,
  );

  const recentCompleted = shifts
    .filter((shift) => shift.clock_out)
    .slice(0, 5);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <EmployeeAutoRefresh />

      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="flex items-start justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Lipsey Gin Tech
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {profile.full_name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Employee #{profile.employee_number}
            </p>
          </div>

          <form action={employeeSignOut}>
            <button
              type="submit"
              className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              Sign Out
            </button>
          </form>
        </header>

        {!profile.active ? (
          <section className="mt-6 rounded-lg border border-destructive/40 bg-destructive/5 p-5">
            <h2 className="font-semibold">Account inactive</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your employee profile is currently inactive. Contact a
              supervisor before recording additional time.
            </p>
          </section>
        ) : null}

        <section className="mt-6 rounded-xl border border-border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">
            Current Status
          </div>

          {openShift ? (
            <>
              <div className="mt-2 text-4xl font-semibold tracking-tight">
                CLOCKED IN
              </div>

              <div className="mt-3 text-sm text-muted-foreground">
                Since {formatCentralTime(openShift.clock_in)} ·{" "}
                {elapsedLabel(openShift.clock_in)}
              </div>

              <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Current Job
                </div>

                {openSession ? (
                  <>
                    <div className="mt-2 text-2xl font-semibold">
                      {currentJob?.job_number ?? "Active job"}
                    </div>

                    {currentJob?.customer ? (
                      <div className="mt-1 text-sm text-muted-foreground">
                        {currentJob.customer}
                      </div>
                    ) : null}

                    <div className="mt-2 text-sm text-muted-foreground">
                      Since {formatCentralTime(openSession.started_at)}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-2 text-2xl font-semibold">
                      No active job
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      Scan a job QR code to assign your work time.
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="mt-2 text-4xl font-semibold tracking-tight">
                CLOCKED OUT
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Scan the CLOCK IN QR code when you begin work.
              </p>
            </>
          )}
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <Metric
            label="Worked Today"
            value={`${formatHours(todayShiftHours)} hrs`}
          />
          <Metric
            label="Assigned Today"
            value={`${formatHours(todayJobHours)} hrs`}
          />
          <Metric
            label="Unallocated"
            value={`${formatHours(todayUnallocated)} hrs`}
          />
        </section>

        {todayUnallocated >= 0.1 ? (
          <section className="mt-4 rounded-lg border border-border bg-muted/30 p-4 text-sm">
            You currently have {formatHours(todayUnallocated)} hours today
            that are not assigned to a job.
          </section>
        ) : null}

        <section className="mt-8">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Recent Shifts
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your five most recent completed shifts visible to this account.
            </p>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
            {recentCompleted.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No completed shifts available.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentCompleted.map((shift) => (
                  <div
                    key={shift.id}
                    className="flex items-center justify-between gap-4 p-4"
                  >
                    <div>
                      <div className="font-medium">
                        {formatCentralDate(shift.clock_in)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatCentralTime(shift.clock_in)} –{" "}
                        {shift.clock_out
                          ? formatCentralTime(shift.clock_out)
                          : "Open"}
                      </div>
                    </div>

                    <div className="text-right font-semibold">
                      {formatHours(
                        durationHours(
                          shift.clock_in,
                          shift.clock_out,
                          now,
                        ),
                      )}{" "}
                      hrs
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-8 rounded-lg border border-border bg-card p-5">
          <h2 className="font-semibold">Using the time system</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Continue using the posted physical QR codes to clock in, switch
            jobs, and clock out. This page is read-only and is provided so you
            can confirm what the system currently has recorded.
          </p>
        </section>

        {profile.role === "admin" ? (
          <div className="mt-6 text-center">
            <Link
              href="/dashboard"
              className="text-sm font-medium underline underline-offset-4"
            >
              Return to Admin Dashboard
            </Link>
          </div>
        ) : null}

        <footer className="mt-10 border-t border-border pt-5 text-center text-xs text-muted-foreground">
          Today: {today} · Automatically refreshes every 30 seconds
        </footer>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <div className="text-sm font-medium text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">
        {value}
      </div>
    </article>
  );
}
