import Link from "next/link";
import { AutoRefresh } from "./_components/auto-refresh";
import { requireShiftsAdmin } from "./_lib/access";

export const dynamic = "force-dynamic";

const TIME_ZONE = "America/Chicago";
const LONG_OPEN_SHIFT_HOURS = 16;
const RECENT_LOOKBACK_HOURS = 36;

type ShiftRow = {
  id: number;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string;
  employee_number: string;
  active: boolean;
};

type JobSessionRow = {
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
};

function hoursBetween(start: string | Date, end: string | Date) {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return 0;
  }

  return (endMs - startMs) / 3_600_000;
}

function formatHours(value: number) {
  return value.toFixed(2);
}

function formatCentralDateKey(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));

  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";

  return `${year}-${month}-${day}`;
}

function formatCentralDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatCentralDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCentralTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function shiftJobHours(
  shift: ShiftRow,
  sessions: JobSessionRow[],
  now: Date,
) {
  const shiftStartMs = new Date(shift.clock_in).getTime();
  const shiftEndMs = new Date(shift.clock_out ?? now).getTime();

  return sessions.reduce((total, session) => {
    const rawStartMs = new Date(session.started_at).getTime();
    const rawEndMs = new Date(session.ended_at ?? shift.clock_out ?? now).getTime();

    const effectiveStartMs = Math.max(rawStartMs, shiftStartMs);
    const effectiveEndMs = Math.min(rawEndMs, shiftEndMs);

    if (
      !Number.isFinite(effectiveStartMs) ||
      !Number.isFinite(effectiveEndMs) ||
      effectiveEndMs <= effectiveStartMs
    ) {
      return total;
    }

    return total + (effectiveEndMs - effectiveStartMs) / 3_600_000;
  }, 0);
}

function statusBadge(
  label: string,
  tone: "normal" | "warning" | "danger" = "normal",
) {
  const toneClass =
    tone === "danger"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : tone === "warning"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "border-border bg-muted text-muted-foreground";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass}`}
    >
      {label}
    </span>
  );
}

export default async function ShiftsPage() {
  const { supabase } = await requireShiftsAdmin();
  const now = new Date();
  const todayKey = formatCentralDateKey(now);
  const recentCutoff = new Date(
    now.getTime() - RECENT_LOOKBACK_HOURS * 3_600_000,
  ).toISOString();

  const [openResult, recentResult] = await Promise.all([
    supabase
      .from("shifts")
      .select("id, user_id, clock_in, clock_out")
      .is("clock_out", null)
      .order("clock_in", { ascending: true }),
    supabase
      .from("shifts")
      .select("id, user_id, clock_in, clock_out")
      .gte("clock_in", recentCutoff)
      .order("clock_in", { ascending: false }),
  ]);

  if (openResult.error) {
    throw new Error(`Unable to load open shifts: ${openResult.error.message}`);
  }

  if (recentResult.error) {
    throw new Error(`Unable to load recent shifts: ${recentResult.error.message}`);
  }

  const shiftsById = new Map<number, ShiftRow>();

  for (const shift of [
    ...((openResult.data ?? []) as ShiftRow[]),
    ...((recentResult.data ?? []) as ShiftRow[]),
  ]) {
    shiftsById.set(shift.id, shift);
  }

  const allRelevantShifts = Array.from(shiftsById.values());
  const openShifts = allRelevantShifts
    .filter((shift) => !shift.clock_out)
    .sort(
      (a, b) =>
        new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime(),
    );

  const todayShifts = allRelevantShifts
    .filter((shift) => formatCentralDateKey(shift.clock_in) === todayKey)
    .sort(
      (a, b) =>
        new Date(b.clock_in).getTime() - new Date(a.clock_in).getTime(),
    );

  const relevantShiftIds = allRelevantShifts.map((shift) => shift.id);
  const relevantUserIds = Array.from(
    new Set(allRelevantShifts.map((shift) => shift.user_id)),
  );

  let profiles: ProfileRow[] = [];
  let jobSessions: JobSessionRow[] = [];

  if (relevantUserIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, employee_number, active")
      .in("id", relevantUserIds);

    if (error) {
      throw new Error(`Unable to load employee profiles: ${error.message}`);
    }

    profiles = (data ?? []) as ProfileRow[];
  }

  if (relevantShiftIds.length > 0) {
    const { data, error } = await supabase
      .from("job_sessions")
      .select("id, shift_id, user_id, job_id, started_at, ended_at")
      .in("shift_id", relevantShiftIds)
      .order("started_at", { ascending: true });

    if (error) {
      throw new Error(`Unable to load job sessions: ${error.message}`);
    }

    jobSessions = (data ?? []) as JobSessionRow[];
  }

  const jobIds = Array.from(new Set(jobSessions.map((session) => session.job_id)));
  let jobs: JobRow[] = [];

  if (jobIds.length > 0) {
    const { data, error } = await supabase
      .from("jobs")
      .select("id, job_number, customer")
      .in("id", jobIds);

    if (error) {
      throw new Error(`Unable to load jobs: ${error.message}`);
    }

    jobs = (data ?? []) as JobRow[];
  }

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const sessionsByShift = new Map<number, JobSessionRow[]>();

  for (const session of jobSessions) {
    const existing = sessionsByShift.get(session.shift_id) ?? [];
    existing.push(session);
    sessionsByShift.set(session.shift_id, existing);
  }

  const workingNow = openShifts.map((shift) => {
    const sessions = sessionsByShift.get(shift.id) ?? [];
    const openSessions = sessions
      .filter((session) => !session.ended_at)
      .sort(
        (a, b) =>
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
      );

    const currentSession = openSessions[0] ?? null;
    const currentJob = currentSession
      ? jobById.get(currentSession.job_id) ?? null
      : null;

    const elapsedHours = hoursBetween(shift.clock_in, now);
    const startedToday = formatCentralDateKey(shift.clock_in) === todayKey;

    return {
      shift,
      profile: profileById.get(shift.user_id) ?? null,
      currentSession,
      currentJob,
      openSessionCount: openSessions.length,
      elapsedHours,
      startedToday,
      isLong: elapsedHours >= LONG_OPEN_SHIFT_HOURS,
    };
  });

  const onJobNowCount = workingNow.filter((item) => item.currentSession).length;
  const noActiveJobCount = workingNow.length - onJobNowCount;
  const longOpenCount = workingNow.filter((item) => item.isLong).length;

  const todayRows = todayShifts.map((shift) => {
    const sessions = sessionsByShift.get(shift.id) ?? [];
    const shiftHours = hoursBetween(shift.clock_in, shift.clock_out ?? now);
    const jobHours = shiftJobHours(shift, sessions, now);
    const unallocatedHours = Math.max(0, shiftHours - jobHours);
    const overAllocated = jobHours - shiftHours > 0.02;
    const hasOpenJobSession = sessions.some((session) => !session.ended_at);

    return {
      shift,
      profile: profileById.get(shift.user_id) ?? null,
      shiftHours,
      jobHours,
      unallocatedHours,
      overAllocated,
      hasOpenJobSession,
    };
  });

  const totalTodayShiftHours = todayRows.reduce(
    (total, row) => total + row.shiftHours,
    0,
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <AutoRefresh />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Shifts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live attendance and job-allocation view. Times are shown in Central
            Time.
          </p>
        </div>

        <div className="text-sm text-muted-foreground">
          {formatCentralDate(now)} · refreshes every 60 seconds
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Clocked in now" value={workingNow.length} />
        <SummaryCard label="On a job now" value={onJobNowCount} />
        <SummaryCard label="No active job" value={noActiveJobCount} />
        <SummaryCard label="Long open shifts" value={longOpenCount} />
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Who&apos;s Working Now
          </h2>
          <p className="text-sm text-muted-foreground">
            Open shifts, current job assignment, and attendance warnings.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {workingNow.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No employees are currently clocked in.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Clocked In</th>
                    <th className="px-4 py-3">Elapsed</th>
                    <th className="px-4 py-3">Current Job</th>
                    <th className="px-4 py-3">Job Since</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {workingNow.map((item) => {
                    const employeeName =
                      item.profile?.full_name ?? "Unknown employee";
                    const employeeNumber = item.profile?.employee_number ?? "—";

                    let status = statusBadge("Working");

                    if (item.openSessionCount > 1) {
                      status = statusBadge("Multiple open jobs", "danger");
                    } else if (!item.currentSession) {
                      status = statusBadge("No active job", "warning");
                    } else if (item.isLong) {
                      status = statusBadge("Long open shift", "danger");
                    } else if (!item.startedToday) {
                      status = statusBadge("Started before today", "warning");
                    }

                    return (
                      <tr key={item.shift.id} className="align-top">
                        <td className="px-4 py-4">
                          <div className="font-medium">{employeeName}</div>
                          <div className="text-xs text-muted-foreground">
                            Employee {employeeNumber}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div>{formatCentralDateTime(item.shift.clock_in)}</div>
                        </td>
                        <td className="px-4 py-4 font-medium">
                          {formatHours(item.elapsedHours)} hrs
                        </td>
                        <td className="px-4 py-4">
                          {item.currentJob ? (
                            <>
                              <Link
                                href={`/dashboard/jobs/${item.currentJob.id}`}
                                className="font-medium underline-offset-4 hover:underline"
                              >
                                {item.currentJob.job_number}
                              </Link>
                              {item.currentJob.customer ? (
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                  {item.currentJob.customer}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {item.currentSession ? (
                            formatCentralDateTime(item.currentSession.started_at)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">{status}</td>
                        <td className="px-4 py-4 text-right">
                          <Link
                            href={`/dashboard/timesheets/shifts/${item.shift.id}/edit`}
                            className="font-medium underline-offset-4 hover:underline"
                          >
                            Timesheet
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Today&apos;s Shifts
            </h2>
            <p className="text-sm text-muted-foreground">
              Shifts that began today in Central Time.
            </p>
          </div>

          <div className="text-sm text-muted-foreground">
            Total shift time:{" "}
            <span className="font-medium text-foreground">
              {formatHours(totalTodayShiftHours)} hrs
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {todayRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No shifts have started today.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Clock In</th>
                    <th className="px-4 py-3">Clock Out</th>
                    <th className="px-4 py-3 text-right">Shift Hrs</th>
                    <th className="px-4 py-3 text-right">Job Hrs</th>
                    <th className="px-4 py-3 text-right">Unallocated</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {todayRows.map((row) => {
                    const employeeName =
                      row.profile?.full_name ?? "Unknown employee";
                    const employeeNumber =
                      row.profile?.employee_number ?? "—";

                    let status = row.shift.clock_out
                      ? statusBadge("Completed")
                      : statusBadge("Open");

                    if (row.overAllocated) {
                      status = statusBadge("Job time > shift", "danger");
                    } else if (
                      row.shift.clock_out &&
                      row.hasOpenJobSession
                    ) {
                      status = statusBadge("Open job on closed shift", "danger");
                    } else if (row.unallocatedHours > 0.05) {
                      status = statusBadge("Has unallocated time", "warning");
                    }

                    return (
                      <tr key={row.shift.id}>
                        <td className="px-4 py-4">
                          <div className="font-medium">{employeeName}</div>
                          <div className="text-xs text-muted-foreground">
                            Employee {employeeNumber}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {formatCentralTime(row.shift.clock_in)}
                        </td>
                        <td className="px-4 py-4">
                          {row.shift.clock_out ? (
                            formatCentralTime(row.shift.clock_out)
                          ) : (
                            <span className="font-medium">In progress</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right font-medium">
                          {formatHours(row.shiftHours)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          {formatHours(row.jobHours)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span
                            className={
                              row.unallocatedHours > 0.05
                                ? "font-semibold text-amber-700 dark:text-amber-300"
                                : ""
                            }
                          >
                            {formatHours(row.unallocatedHours)}
                          </span>
                        </td>
                        <td className="px-4 py-4">{status}</td>
                        <td className="px-4 py-4 text-right">
                          <Link
                            href={`/dashboard/timesheets/shifts/${row.shift.id}/edit`}
                            className="font-medium underline-offset-4 hover:underline"
                          >
                            Review
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        Shifts is an operational monitoring screen. Historical corrections are
        intentionally handled through Timesheets so there is one authoritative
        place to edit attendance and job time.
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
