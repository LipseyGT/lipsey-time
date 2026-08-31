export const REPORT_TIME_ZONE = "America/Chicago";

export type ProfileRow = {
  id: string;
  employee_number: string;
  full_name: string;
  role: string;
  active: boolean;
};

export type ShiftRow = {
  id: number;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
};

export type JobSessionRow = {
  id: number;
  shift_id: number;
  user_id: string;
  job_id: number;
  started_at: string;
  ended_at: string | null;
};

export type JobRow = {
  id: number;
  job_number: string;
  customer: string | null;
  description: string | null;
  category: "direct" | "indirect";
  active: boolean;
};

export type EmployeeReportRow = {
  userId: string;
  employeeNumber: string;
  fullName: string;
  active: boolean;
  shiftCount: number;
  shiftHours: number;
  jobHours: number;
  directHours: number;
  indirectHours: number;
  unallocatedHours: number;
  incompleteShifts: number;
};

export type JobReportRow = {
  jobId: number;
  jobNumber: string;
  customer: string | null;
  category: "direct" | "indirect";
  active: boolean;
  laborHours: number;
  employeeCount: number;
  sessionCount: number;
};

export type ReportSummary = {
  shiftHours: number;
  jobHours: number;
  directHours: number;
  indirectHours: number;
  unallocatedHours: number;
  incompleteShifts: number;
  employeeCount: number;
  jobCount: number;
};

export type ReportData = {
  employees: EmployeeReportRow[];
  jobs: JobReportRow[];
  summary: ReportSummary;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatDateInput(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )}`;
}

export function addCalendarDays(dateText: string, days: number) {
  const [year, month, day] = dateText.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return formatDateInput(date);
}

export function centralToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function defaultReportRange() {
  const to = centralToday();
  const from = addCalendarDays(to, -6);
  return { from, to };
}

export function isValidDateInput(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const test = new Date(Date.UTC(year, month - 1, day));

  return (
    test.getUTCFullYear() === year &&
    test.getUTCMonth() === month - 1 &&
    test.getUTCDate() === day
  );
}

export function normalizeReportRange(
  fromValue: string | undefined,
  toValue: string | undefined,
) {
  const defaults = defaultReportRange();

  const from = isValidDateInput(fromValue) ? fromValue! : defaults.from;
  const to = isValidDateInput(toValue) ? toValue! : defaults.to;

  if (from > to) {
    return {
      from: to,
      to: from,
    };
  }

  return { from, to };
}

function partsInZone(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const map = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
    second: map.second,
  };
}

export function centralMidnightToUtc(dateText: string) {
  const [year, month, day] = dateText.split("-").map(Number);

  const desiredAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  let guess = new Date(desiredAsUtc);

  // Iteratively reconcile the target Central wall-clock midnight with UTC.
  for (let i = 0; i < 3; i += 1) {
    const actual = partsInZone(guess);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );

    guess = new Date(guess.getTime() + (desiredAsUtc - actualAsUtc));
  }

  return guess;
}

export function reportBounds(from: string, to: string) {
  const start = centralMidnightToUtc(from);
  const endExclusive = centralMidnightToUtc(addCalendarDays(to, 1));

  return { start, endExclusive };
}

export function clipDurationMs(
  startValue: string,
  endValue: string | null,
  rangeStart: Date,
  rangeEndExclusive: Date,
  now: Date,
) {
  const start = Math.max(
    new Date(startValue).getTime(),
    rangeStart.getTime(),
  );

  const effectiveEnd = endValue ? new Date(endValue) : now;
  const end = Math.min(
    effectiveEnd.getTime(),
    rangeEndExclusive.getTime(),
  );

  return Math.max(0, end - start);
}

function hours(ms: number) {
  return ms / 3_600_000;
}

function roundHours(value: number) {
  return Math.round(value * 100) / 100;
}

export function buildReport({
  profiles,
  shifts,
  sessions,
  jobs,
  rangeStart,
  rangeEndExclusive,
  now = new Date(),
}: {
  profiles: ProfileRow[];
  shifts: ShiftRow[];
  sessions: JobSessionRow[];
  jobs: JobRow[];
  rangeStart: Date;
  rangeEndExclusive: Date;
  now?: Date;
}): ReportData {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const shiftById = new Map(shifts.map((shift) => [shift.id, shift]));

  const employeeAccumulator = new Map<
    string,
    {
      shiftCount: number;
      shiftMs: number;
      jobMs: number;
      directMs: number;
      indirectMs: number;
      incompleteShifts: number;
    }
  >();

  for (const shift of shifts) {
    const duration = clipDurationMs(
      shift.clock_in,
      shift.clock_out,
      rangeStart,
      rangeEndExclusive,
      now,
    );

    if (duration <= 0) continue;

    const current = employeeAccumulator.get(shift.user_id) ?? {
      shiftCount: 0,
      shiftMs: 0,
      jobMs: 0,
      directMs: 0,
      indirectMs: 0,
      incompleteShifts: 0,
    };

    current.shiftCount += 1;
    current.shiftMs += duration;

    if (!shift.clock_out) {
      current.incompleteShifts += 1;
    }

    employeeAccumulator.set(shift.user_id, current);
  }

  const jobAccumulator = new Map<
    number,
    {
      laborMs: number;
      sessionCount: number;
      employees: Set<string>;
    }
  >();

  for (const session of sessions) {
    const shift = shiftById.get(session.shift_id);
    if (!shift) continue;

    const job = jobById.get(session.job_id);
    if (!job) continue;

    const sessionStartMs = Math.max(
      new Date(session.started_at).getTime(),
      new Date(shift.clock_in).getTime(),
      rangeStart.getTime(),
    );

    const rawSessionEnd = session.ended_at
      ? new Date(session.ended_at).getTime()
      : now.getTime();

    const rawShiftEnd = shift.clock_out
      ? new Date(shift.clock_out).getTime()
      : now.getTime();

    const sessionEndMs = Math.min(
      rawSessionEnd,
      rawShiftEnd,
      rangeEndExclusive.getTime(),
    );

    const duration = Math.max(0, sessionEndMs - sessionStartMs);
    if (duration <= 0) continue;

    const employee = employeeAccumulator.get(session.user_id) ?? {
      shiftCount: 0,
      shiftMs: 0,
      jobMs: 0,
      directMs: 0,
      indirectMs: 0,
      incompleteShifts: 0,
    };

    employee.jobMs += duration;

    if (job.category === "indirect") {
      employee.indirectMs += duration;
    } else {
      employee.directMs += duration;
    }

    employeeAccumulator.set(session.user_id, employee);

    const jobCurrent = jobAccumulator.get(job.id) ?? {
      laborMs: 0,
      sessionCount: 0,
      employees: new Set<string>(),
    };

    jobCurrent.laborMs += duration;
    jobCurrent.sessionCount += 1;
    jobCurrent.employees.add(session.user_id);

    jobAccumulator.set(job.id, jobCurrent);
  }

  const employees: EmployeeReportRow[] = Array.from(
    employeeAccumulator.entries(),
  )
    .map(([userId, values]) => {
      const profile = profileById.get(userId);

      return {
        userId,
        employeeNumber: profile?.employee_number ?? "—",
        fullName: profile?.full_name ?? "Unknown employee",
        active: profile?.active ?? false,
        shiftCount: values.shiftCount,
        shiftHours: roundHours(hours(values.shiftMs)),
        jobHours: roundHours(hours(values.jobMs)),
        directHours: roundHours(hours(values.directMs)),
        indirectHours: roundHours(hours(values.indirectMs)),
        unallocatedHours: roundHours(
          Math.max(0, hours(values.shiftMs - values.jobMs)),
        ),
        incompleteShifts: values.incompleteShifts,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const jobRows: JobReportRow[] = Array.from(jobAccumulator.entries())
    .map(([jobId, values]) => {
      const job = jobById.get(jobId)!;

      return {
        jobId,
        jobNumber: job.job_number,
        customer: job.customer,
        category: job.category,
        active: job.active,
        laborHours: roundHours(hours(values.laborMs)),
        employeeCount: values.employees.size,
        sessionCount: values.sessionCount,
      };
    })
    .sort((a, b) => {
      if (b.laborHours !== a.laborHours) {
        return b.laborHours - a.laborHours;
      }

      return a.jobNumber.localeCompare(b.jobNumber);
    });

  const summary = employees.reduce<ReportSummary>(
    (total, employee) => {
      total.shiftHours += employee.shiftHours;
      total.jobHours += employee.jobHours;
      total.directHours += employee.directHours;
      total.indirectHours += employee.indirectHours;
      total.unallocatedHours += employee.unallocatedHours;
      total.incompleteShifts += employee.incompleteShifts;
      return total;
    },
    {
      shiftHours: 0,
      jobHours: 0,
      directHours: 0,
      indirectHours: 0,
      unallocatedHours: 0,
      incompleteShifts: 0,
      employeeCount: employees.length,
      jobCount: jobRows.length,
    },
  );

  summary.shiftHours = roundHours(summary.shiftHours);
  summary.jobHours = roundHours(summary.jobHours);
  summary.directHours = roundHours(summary.directHours);
  summary.indirectHours = roundHours(summary.indirectHours);
  summary.unallocatedHours = roundHours(summary.unallocatedHours);

  return {
    employees,
    jobs: jobRows,
    summary,
  };
}

export function formatHours(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatRangeLabel(from: string, to: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  const start = formatter.format(new Date(`${from}T12:00:00Z`));
  const end = formatter.format(new Date(`${to}T12:00:00Z`));

  return from === to ? start : `${start} – ${end}`;
}
