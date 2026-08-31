import {
  addCalendarDays,
  centralMidnightToUtc,
  centralToday,
  formatDateInput,
  formatHours,
  isValidDateInput,
  type ProfileRow,
  type ShiftRow,
} from "../../reports/_lib/report";

export const OVERTIME_THRESHOLD_HOURS = 40;
export const PAYROLL_TIME_ZONE = "America/Chicago";

export type PayrollWeek = {
  weekStart: string;
  weekEnd: string;
  shiftHours: number;
  regularHours: number;
  overtimeHours: number;
};

export type PayrollEmployeeRow = {
  userId: string;
  employeeNumber: string;
  fullName: string;
  active: boolean;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  incompleteShifts: number;
  weeks: PayrollWeek[];
};

export type PayrollSummary = {
  employeeCount: number;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  incompleteShifts: number;
};

export type PayrollData = {
  employees: PayrollEmployeeRow[];
  summary: PayrollSummary;
};

function roundHours(value: number) {
  return Math.round(value * 100) / 100;
}

function dateFromText(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dayOfWeek(value: string) {
  return dateFromText(value).getUTCDay();
}

export function isMonday(value: string) {
  return isValidDateInput(value) && dayOfWeek(value) === 1;
}

export function isSunday(value: string) {
  return isValidDateInput(value) && dayOfWeek(value) === 0;
}

export function mondayForDate(value: string) {
  const date = dateFromText(value);
  const dow = date.getUTCDay();
  const daysSinceMonday = (dow + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return formatDateInput(date);
}

export function sundayForMonday(monday: string) {
  return addCalendarDays(monday, 6);
}

export function defaultPayrollRange() {
  const today = centralToday();
  const from = mondayForDate(today);
  const to = sundayForMonday(from);
  return { from, to };
}

export function normalizePayrollRange(
  fromValue: string | undefined,
  toValue: string | undefined,
) {
  const defaults = defaultPayrollRange();

  let from =
    fromValue && isValidDateInput(fromValue)
      ? fromValue
      : defaults.from;

  let to =
    toValue && isValidDateInput(toValue)
      ? toValue
      : defaults.to;

  // Payroll reports must cover complete Monday-Sunday workweeks.
  if (!isMonday(from)) {
    from = mondayForDate(from);
  }

  if (!isSunday(to)) {
    const toMonday = mondayForDate(to);
    to = sundayForMonday(toMonday);
  }

  if (from > to) {
    const originalFrom = from;
    from = mondayForDate(to);
    to = sundayForMonday(originalFrom);
  }

  return { from, to };
}

export function payrollWeeks(from: string, to: string) {
  const weeks: Array<{
    weekStart: string;
    weekEnd: string;
    start: Date;
    endExclusive: Date;
  }> = [];

  let cursor = from;

  while (cursor <= to) {
    const weekEnd = sundayForMonday(cursor);
    const start = centralMidnightToUtc(cursor);
    const endExclusive = centralMidnightToUtc(
      addCalendarDays(cursor, 7),
    );

    weeks.push({
      weekStart: cursor,
      weekEnd,
      start,
      endExclusive,
    });

    cursor = addCalendarDays(cursor, 7);
  }

  return weeks;
}

function clippedMs(
  shift: ShiftRow,
  start: Date,
  endExclusive: Date,
  now: Date,
) {
  const shiftStart = new Date(shift.clock_in).getTime();
  const shiftEnd = shift.clock_out
    ? new Date(shift.clock_out).getTime()
    : now.getTime();

  const clippedStart = Math.max(shiftStart, start.getTime());
  const clippedEnd = Math.min(shiftEnd, endExclusive.getTime());

  return Math.max(0, clippedEnd - clippedStart);
}

export function buildPayroll({
  profiles,
  shifts,
  from,
  to,
  now = new Date(),
}: {
  profiles: ProfileRow[];
  shifts: ShiftRow[];
  from: string;
  to: string;
  now?: Date;
}): PayrollData {
  const profileById = new Map(
    profiles.map((profile) => [profile.id, profile]),
  );

  const weeks = payrollWeeks(from, to);

  const hoursByEmployeeWeek = new Map<string, Map<string, number>>();
  const incompleteByEmployee = new Map<string, Set<number>>();

  for (const shift of shifts) {
    for (const week of weeks) {
      const ms = clippedMs(
        shift,
        week.start,
        week.endExclusive,
        now,
      );

      if (ms <= 0) continue;

      const employeeWeeks =
        hoursByEmployeeWeek.get(shift.user_id) ??
        new Map<string, number>();

      employeeWeeks.set(
        week.weekStart,
        (employeeWeeks.get(week.weekStart) ?? 0) +
          ms / 3_600_000,
      );

      hoursByEmployeeWeek.set(shift.user_id, employeeWeeks);

      if (!shift.clock_out) {
        const ids =
          incompleteByEmployee.get(shift.user_id) ??
          new Set<number>();
        ids.add(shift.id);
        incompleteByEmployee.set(shift.user_id, ids);
      }
    }
  }

  const employees: PayrollEmployeeRow[] = Array.from(
    hoursByEmployeeWeek.entries(),
  )
    .map(([userId, weeklyHours]) => {
      const profile = profileById.get(userId);

      const weekRows: PayrollWeek[] = weeks
        .map((week) => {
          const total = weeklyHours.get(week.weekStart) ?? 0;
          const regular = Math.min(
            total,
            OVERTIME_THRESHOLD_HOURS,
          );
          const overtime = Math.max(
            0,
            total - OVERTIME_THRESHOLD_HOURS,
          );

          return {
            weekStart: week.weekStart,
            weekEnd: week.weekEnd,
            shiftHours: roundHours(total),
            regularHours: roundHours(regular),
            overtimeHours: roundHours(overtime),
          };
        })
        .filter((week) => week.shiftHours > 0);

      const regularHours = roundHours(
        weekRows.reduce(
          (sum, week) => sum + week.regularHours,
          0,
        ),
      );

      const overtimeHours = roundHours(
        weekRows.reduce(
          (sum, week) => sum + week.overtimeHours,
          0,
        ),
      );

      return {
        userId,
        employeeNumber: profile?.employee_number ?? "—",
        fullName: profile?.full_name ?? "Unknown employee",
        active: profile?.active ?? false,
        regularHours,
        overtimeHours,
        totalHours: roundHours(regularHours + overtimeHours),
        incompleteShifts:
          incompleteByEmployee.get(userId)?.size ?? 0,
        weeks: weekRows,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const summary = employees.reduce<PayrollSummary>(
    (total, employee) => {
      total.regularHours += employee.regularHours;
      total.overtimeHours += employee.overtimeHours;
      total.totalHours += employee.totalHours;
      total.incompleteShifts += employee.incompleteShifts;
      return total;
    },
    {
      employeeCount: employees.length,
      regularHours: 0,
      overtimeHours: 0,
      totalHours: 0,
      incompleteShifts: 0,
    },
  );

  summary.regularHours = roundHours(summary.regularHours);
  summary.overtimeHours = roundHours(summary.overtimeHours);
  summary.totalHours = roundHours(summary.totalHours);

  return { employees, summary };
}

export function formatPayrollHours(value: number) {
  return formatHours(value);
}
