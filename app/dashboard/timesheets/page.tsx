import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

type EmployeeProfile = {
  id: string;
  employee_number: string;
  full_name: string;
  active: boolean;
};

type Shift = {
  id: number;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
};

type JobSession = {
  id: number;
  user_id: string;
  job_id: number;
  started_at: string;
  ended_at: string | null;
};

type EmployeeSummary = {
  employee: EmployeeProfile;
  shiftMilliseconds: number;
  jobMilliseconds: number;
  shiftCount: number;
  openShiftCount: number;
};

const TIME_ZONE = "America/Chicago";

const chicagoDateFormatter =
  new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

const chicagoDateTimePartsFormatter =
  new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

function getChicagoDateKey(date = new Date()) {
  const parts =
    chicagoDateFormatter.formatToParts(date);

  const year =
    parts.find(
      (part) => part.type === "year"
    )?.value ?? "";

  const month =
    parts.find(
      (part) => part.type === "month"
    )?.value ?? "";

  const day =
    parts.find(
      (part) => part.type === "day"
    )?.value ?? "";

  return `${year}-${month}-${day}`;
}

function addDays(
  dateKey: string,
  days: number
) {
  const [year, month, day] =
    dateKey.split("-").map(Number);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day + days
    )
  );

  return date
    .toISOString()
    .slice(0, 10);
}

function getMonday(dateKey: string) {
  const [year, month, day] =
    dateKey.split("-").map(Number);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  );

  const dayOfWeek =
    date.getUTCDay();

  const difference =
    dayOfWeek === 0
      ? -6
      : 1 - dayOfWeek;

  return addDays(
    dateKey,
    difference
  );
}

function isValidDateKey(
  value: string | undefined
) {
  if (!value) {
    return false;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(
    value
  );
}

/*
 * Convert midnight in America/Chicago
 * into the correct UTC timestamp.
 *
 * This handles CST/CDT rather than
 * hard-coding -05:00 or -06:00.
 */
function chicagoMidnightToUtc(
  dateKey: string
) {
  const [year, month, day] =
    dateKey.split("-").map(Number);

  const targetWallTime =
    Date.UTC(
      year,
      month - 1,
      day,
      0,
      0,
      0
    );

  let guess =
    targetWallTime;

  for (
    let iteration = 0;
    iteration < 2;
    iteration++
  ) {
    const parts =
      chicagoDateTimePartsFormatter
        .formatToParts(
          new Date(guess)
        );

    const getPart = (
      type: string
    ) =>
      Number(
        parts.find(
          (part) =>
            part.type === type
        )?.value ?? 0
      );

    const wallTimeAsUtc =
      Date.UTC(
        getPart("year"),
        getPart("month") - 1,
        getPart("day"),
        getPart("hour"),
        getPart("minute"),
        getPart("second")
      );

    const offset =
      wallTimeAsUtc - guess;

    guess =
      targetWallTime - offset;
  }

  return new Date(guess);
}

function getOverlapMilliseconds(
  startedAt: string,
  endedAt: string | null,
  rangeStart: Date,
  rangeEnd: Date,
  now: Date
) {
  const start =
    new Date(startedAt);

  const end =
    endedAt
      ? new Date(endedAt)
      : now;

  const effectiveStart =
    Math.max(
      start.getTime(),
      rangeStart.getTime()
    );

  const effectiveEnd =
    Math.min(
      end.getTime(),
      rangeEnd.getTime()
    );

  return Math.max(
    0,
    effectiveEnd -
      effectiveStart
  );
}

function formatDate(
  dateString: string
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: TIME_ZONE,
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  ).format(
    new Date(dateString)
  );
}

function formatTime(
  dateString: string
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: TIME_ZONE,
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(
    new Date(dateString)
  );
}

function formatHours(
  milliseconds: number
) {
  return (
    milliseconds /
    3_600_000
  ).toFixed(2);
}

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{
    start?: string;
    end?: string;
    employee?: string;
  }>;
}) {
  const params =
    await searchParams;

  const today =
    getChicagoDateKey();

  const defaultStart =
    getMonday(today);

  const defaultEnd =
    addDays(
      defaultStart,
      6
    );

  let startDate =
    isValidDateKey(params.start)
      ? params.start!
      : defaultStart;

  let endDate =
    isValidDateKey(params.end)
      ? params.end!
      : defaultEnd;

  /*
   * Prevent an invalid reversed range.
   */
  if (endDate < startDate) {
    startDate =
      defaultStart;

    endDate =
      defaultEnd;
  }

  const selectedEmployeeId =
    params.employee ?? "all";

  /*
   * End date is inclusive in the UI.
   * Database calculations use an
   * exclusive midnight boundary.
   */
  const rangeStart =
    chicagoMidnightToUtc(
      startDate
    );

  const rangeEnd =
    chicagoMidnightToUtc(
      addDays(
        endDate,
        1
      )
    );

  const now =
    new Date();

  const supabase =
    await createClient();

  const profilesRequest =
    supabase
      .from("profiles")
      .select(
        "id, employee_number, full_name, active"
      )
      .order(
        "full_name",
        {
          ascending: true,
        }
      );

  let shiftsRequest =
    supabase
      .from("shifts")
      .select(
        "id, user_id, clock_in, clock_out"
      )
      .lt(
        "clock_in",
        rangeEnd.toISOString()
      )
      .or(
        `clock_out.gte.${rangeStart.toISOString()},clock_out.is.null`
      )
      .order(
        "clock_in",
        {
          ascending: false,
        }
      );

  let jobSessionsRequest =
    supabase
      .from("job_sessions")
      .select(
        "id, user_id, job_id, started_at, ended_at"
      )
      .lt(
        "started_at",
        rangeEnd.toISOString()
      )
      .or(
        `ended_at.gte.${rangeStart.toISOString()},ended_at.is.null`
      );

  if (
    selectedEmployeeId !== "all"
  ) {
    shiftsRequest =
      shiftsRequest.eq(
        "user_id",
        selectedEmployeeId
      );

    jobSessionsRequest =
      jobSessionsRequest.eq(
        "user_id",
        selectedEmployeeId
      );
  }

  const [
    profilesResult,
    shiftsResult,
    jobSessionsResult,
  ] =
    await Promise.all([
      profilesRequest,
      shiftsRequest,
      jobSessionsRequest,
    ]);

  const profiles =
    (profilesResult.data ??
      []) as EmployeeProfile[];

  const shifts =
    (shiftsResult.data ??
      []) as Shift[];

  const jobSessions =
    (jobSessionsResult.data ??
      []) as JobSession[];

  const hasError =
    Boolean(
      profilesResult.error ||
        shiftsResult.error ||
        jobSessionsResult.error
    );

  const profileById =
    new Map(
      profiles.map(
        (profile) => [
          profile.id,
          profile,
        ]
      )
    );

  const summaryByUser =
    new Map<
      string,
      EmployeeSummary
    >();

  for (
    const employee of profiles
  ) {
    summaryByUser.set(
      employee.id,
      {
        employee,
        shiftMilliseconds: 0,
        jobMilliseconds: 0,
        shiftCount: 0,
        openShiftCount: 0,
      }
    );
  }

  const visibleShifts =
    shifts.filter(
      (shift) => {
        const milliseconds =
          getOverlapMilliseconds(
            shift.clock_in,
            shift.clock_out,
            rangeStart,
            rangeEnd,
            now
          );

        if (
          milliseconds <= 0
        ) {
          return false;
        }

        const summary =
          summaryByUser.get(
            shift.user_id
          );

        if (summary) {
          summary.shiftMilliseconds +=
            milliseconds;

          summary.shiftCount += 1;

          if (
            shift.clock_out === null
          ) {
            summary.openShiftCount +=
              1;
          }
        }

        return true;
      }
    );

  for (
    const session of jobSessions
  ) {
    const milliseconds =
      getOverlapMilliseconds(
        session.started_at,
        session.ended_at,
        rangeStart,
        rangeEnd,
        now
      );

    const summary =
      summaryByUser.get(
        session.user_id
      );

    if (summary) {
      summary.jobMilliseconds +=
        milliseconds;
    }
  }

  let summaries =
    Array.from(
      summaryByUser.values()
    );

  if (
    selectedEmployeeId !== "all"
  ) {
    summaries =
      summaries.filter(
        (summary) =>
          summary.employee.id ===
          selectedEmployeeId
      );
  } else {
    summaries =
      summaries.filter(
        (summary) =>
          summary.shiftMilliseconds >
            0 ||
          summary.jobMilliseconds >
            0
      );
  }

  const totalShiftMilliseconds =
    summaries.reduce(
      (total, summary) =>
        total +
        summary.shiftMilliseconds,
      0
    );

  const totalJobMilliseconds =
    summaries.reduce(
      (total, summary) =>
        total +
        summary.jobMilliseconds,
      0
    );

  const totalUnassignedMilliseconds =
    summaries.reduce(
      (total, summary) =>
        total +
        Math.max(
          0,
          summary.shiftMilliseconds -
            summary.jobMilliseconds
        ),
      0
    );

  const totalOpenShifts =
    summaries.reduce(
      (total, summary) =>
        total +
        summary.openShiftCount,
      0
    );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Timesheets
        </h1>

        <p className="mt-1 text-muted-foreground">
          Review employee shift time and job
          allocation.
        </p>
      </div>

      {hasError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
          Some timesheet data could not be
          loaded. Refresh the page or check
          the Supabase query if this
          continues.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Timesheet Filters
          </CardTitle>

          <CardDescription>
            Select a date range and optionally
            filter to one employee.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            method="get"
            className="grid gap-4 lg:grid-cols-[1fr_1fr_1.5fr_auto_auto] lg:items-end"
          >
            <div className="space-y-2">
              <label
                htmlFor="start"
                className="text-sm font-medium"
              >
                Start Date
              </label>

              <input
                id="start"
                name="start"
                type="date"
                defaultValue={
                  startDate
                }
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="end"
                className="text-sm font-medium"
              >
                End Date
              </label>

              <input
                id="end"
                name="end"
                type="date"
                defaultValue={
                  endDate
                }
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="employee"
                className="text-sm font-medium"
              >
                Employee
              </label>

              <select
                id="employee"
                name="employee"
                defaultValue={
                  selectedEmployeeId
                }
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="all">
                  All Employees
                </option>

                {profiles.map(
                  (employee) => (
                    <option
                      key={
                        employee.id
                      }
                      value={
                        employee.id
                      }
                    >
                      {
                        employee.full_name
                      }{" "}
                      (#
                      {
                        employee.employee_number
                      }
                      )
                    </option>
                  )
                )}
              </select>
            </div>

            <Button type="submit">
              Apply
            </Button>

            <Button
              type="button"
              variant="outline"
              asChild
            >
              <a href="/dashboard/timesheets">
                Reset
              </a>
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              Shift Hours
            </CardDescription>

            <CardTitle className="text-3xl">
              {formatHours(
                totalShiftMilliseconds
              )}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              Job Hours
            </CardDescription>

            <CardTitle className="text-3xl">
              {formatHours(
                totalJobMilliseconds
              )}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              Unassigned Hours
            </CardDescription>

            <CardTitle className="text-3xl">
              {formatHours(
                totalUnassignedMilliseconds
              )}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              Open Shifts
            </CardDescription>

            <CardTitle className="text-3xl">
              {totalOpenShifts}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Employee Summary
          </CardTitle>

          <CardDescription>
            Hours are displayed as decimal
            hours for the selected period.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {summaries.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No time was recorded during
              this period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-3 pr-4">
                      Employee
                    </th>

                    <th className="py-3 pr-4">
                      #
                    </th>

                    <th className="py-3 pr-4">
                      Shifts
                    </th>

                    <th className="py-3 pr-4">
                      Shift Hours
                    </th>

                    <th className="py-3 pr-4">
                      Job Hours
                    </th>

                    <th className="py-3 pr-4">
                      Unassigned
                    </th>

                    <th className="py-3">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {summaries.map(
                    (summary) => {
                      const unassigned =
                        Math.max(
                          0,
                          summary.shiftMilliseconds -
                            summary.jobMilliseconds
                        );

                      return (
                        <tr
                          key={
                            summary.employee
                              .id
                          }
                          className="border-b last:border-0"
                        >
                          <td className="py-4 pr-4 font-medium">
                            {
                              summary.employee
                                .full_name
                            }
                          </td>

                          <td className="py-4 pr-4">
                            {
                              summary.employee
                                .employee_number
                            }
                          </td>

                          <td className="py-4 pr-4">
                            {
                              summary.shiftCount
                            }
                          </td>

                          <td className="py-4 pr-4">
                            {formatHours(
                              summary.shiftMilliseconds
                            )}
                          </td>

                          <td className="py-4 pr-4">
                            {formatHours(
                              summary.jobMilliseconds
                            )}
                          </td>

                          <td className="py-4 pr-4">
                            {formatHours(
                              unassigned
                            )}
                          </td>

                          <td className="py-4">
                            {summary.openShiftCount >
                            0 ? (
                              <Badge>
                                Open Shift
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                Complete
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Shift Detail
          </CardTitle>

          <CardDescription>
            Individual clock-in and clock-out
            records for the selected period.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {visibleShifts.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No shifts were recorded during
              this period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-3 pr-4">
                      Date
                    </th>

                    <th className="py-3 pr-4">
                      Employee
                    </th>

                    <th className="py-3 pr-4">
                      Clock In
                    </th>

                    <th className="py-3 pr-4">
                      Clock Out
                    </th>

                    <th className="py-3 pr-4">
                      Hours
                    </th>

                    <th className="py-3 pr-4">
                        Status
                    </th>

                    <th className="py-3">
                        Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {visibleShifts.map(
                    (shift) => {
                      const employee =
                        profileById.get(
                          shift.user_id
                        );

                      const milliseconds =
                        getOverlapMilliseconds(
                          shift.clock_in,
                          shift.clock_out,
                          rangeStart,
                          rangeEnd,
                          now
                        );

                      return (
                        <tr
                          key={
                            shift.id
                          }
                          className="border-b last:border-0"
                        >
                          <td className="py-4 pr-4">
                            {formatDate(
                              shift.clock_in
                            )}
                          </td>

                          <td className="py-4 pr-4 font-medium">
                            {employee
                              ?.full_name ??
                              "Unknown Employee"}
                          </td>

                          <td className="py-4 pr-4">
                            {formatTime(
                              shift.clock_in
                            )}
                          </td>

                          <td className="py-4 pr-4">
                            {shift.clock_out
                              ? formatTime(
                                  shift.clock_out
                                )
                              : "Present"}
                          </td>

                          <td className="py-4 pr-4">
                            {formatHours(
                              milliseconds
                            )}
                          </td>

                          <td className="py-4 pr-4">
                            {shift.clock_out ===
                            null ? (
                                <Badge>
                                 Open
                                </Badge>
                            ) : (
                                <Badge variant="outline">
                                 Completed
                                </Badge>
                            )}
                          </td>

<td className="py-4">
  <Button
    variant="outline"
    size="sm"
    asChild
  >
    <Link
      href={`/dashboard/timesheets/shifts/${shift.id}/edit`}
    >
      Edit
    </Link>
  </Button>
</td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}