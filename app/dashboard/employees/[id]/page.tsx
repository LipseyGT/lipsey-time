import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  HardHat,
  History,
  Pencil,
  Timer,
  UserRound,
} from "lucide-react";

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
import EmployeeStatusControl from "./employee-status-control";

type EmployeeProfile = {
  id: string;
  employee_number: string;
  full_name: string;
  role: string;
  active: boolean;
  created_at: string;
};

type Shift = {
  id: number;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
};

type JobSession = {
  id: number;
  shift_id: number;
  user_id: string;
  job_id: number;
  started_at: string;
  ended_at: string | null;
};

type Job = {
  id: number;
  job_number: string;
  customer: string | null;
  description: string | null;
  category: string;
  active: boolean;
};

function formatTime(dateString: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dateString));
}

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateString));
}

function getChicagoDateKey(dateString: string | Date) {
  const date =
    typeof dateString === "string"
      ? new Date(dateString)
      : dateString;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find(
    (part) => part.type === "year"
  )?.value;

  const month = parts.find(
    (part) => part.type === "month"
  )?.value;

  const day = parts.find(
    (part) => part.type === "day"
  )?.value;

  return `${year}-${month}-${day}`;
}

function getDurationMilliseconds(
  start: string,
  end: string | null
) {
  const startTime = new Date(start).getTime();

  const endTime = end
    ? new Date(end).getTime()
    : Date.now();

  return Math.max(0, endTime - startTime);
}

function formatDuration(milliseconds: number) {
  const totalMinutes = Math.floor(
    milliseconds / 60000
  );

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

export default async function EmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const [
    profileResult,
    shiftsResult,
    sessionsResult,
    jobsResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, employee_number, full_name, role, active, created_at"
      )
      .eq("id", id)
      .single(),

    supabase
      .from("shifts")
      .select(
        "id, user_id, clock_in, clock_out"
      )
      .eq("user_id", id)
      .order("clock_in", { ascending: false })
      .limit(100),

    supabase
      .from("job_sessions")
      .select(
        "id, shift_id, user_id, job_id, started_at, ended_at"
      )
      .eq("user_id", id)
      .order("started_at", { ascending: false })
      .limit(100),

    supabase
      .from("jobs")
      .select(
        "id, job_number, customer, description, category, active"
      )
      .order("job_number", { ascending: true }),
  ]);

  if (
    profileResult.error ||
    !profileResult.data
  ) {
    notFound();
  }

  const employee =
    profileResult.data as EmployeeProfile;

  const shifts =
    (shiftsResult.data ?? []) as Shift[];

  const jobSessions =
    (sessionsResult.data ?? []) as JobSession[];

  const jobs =
    (jobsResult.data ?? []) as Job[];

  const hasQueryError = Boolean(
    shiftsResult.error ||
      sessionsResult.error ||
      jobsResult.error
  );

  const jobById = new Map<number, Job>();

  for (const job of jobs) {
    jobById.set(job.id, job);
  }

  const openShift = shifts.find(
    (shift) => shift.clock_out === null
  );

  const openJobSession = jobSessions.find(
    (session) => session.ended_at === null
  );

  const currentJob =
    openShift && openJobSession
      ? jobById.get(openJobSession.job_id)
      : undefined;

  const todayKey = getChicagoDateKey(new Date());

  const todaysShifts = shifts.filter(
    (shift) =>
      getChicagoDateKey(shift.clock_in) ===
      todayKey
  );

  const todaysJobSessions = jobSessions.filter(
    (session) =>
      getChicagoDateKey(session.started_at) ===
      todayKey
  );

  const totalShiftMilliseconds =
    todaysShifts.reduce(
      (total, shift) =>
        total +
        getDurationMilliseconds(
          shift.clock_in,
          shift.clock_out
        ),
      0
    );

  const totalJobMilliseconds =
    todaysJobSessions.reduce(
      (total, session) =>
        total +
        getDurationMilliseconds(
          session.started_at,
          session.ended_at
        ),
      0
    );

  const currentShiftDuration = openShift
    ? getDurationMilliseconds(
        openShift.clock_in,
        null
      )
    : 0;

  const currentJobDuration =
    openJobSession
      ? getDurationMilliseconds(
          openJobSession.started_at,
          null
        )
      : 0;

  const recentShifts = shifts.slice(0, 14);
  const recentJobSessions = jobSessions.slice(0, 25);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/employees"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Employees
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
  <div>
    <h1 className="text-3xl font-bold tracking-tight">
      {employee.full_name}
    </h1>

    <p className="mt-1 text-muted-foreground">
      Employee #{employee.employee_number}
    </p>

    <div className="mt-3 flex gap-2">
      <Badge variant="outline">
        {employee.role === "admin"
          ? "Administrator"
          : "Employee"}
      </Badge>

      {employee.active ? (
        <Badge>Active</Badge>
      ) : (
        <Badge variant="secondary">
          Inactive
        </Badge>
      )}
    </div>
  </div>

  <Button
    variant="outline"
    asChild
  >
    <Link
      href={`/dashboard/employees/${employee.id}/edit`}
    >
      <Pencil className="mr-2 h-4 w-4" />
      Edit Employee
    </Link>
  </Button>
</div>

      {hasQueryError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
          Some employee activity could not be loaded.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">
              Clock Status
            </CardTitle>

            <Clock3 className="h-5 w-5 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-bold">
              {openShift
                ? "Clocked In"
                : "Clocked Out"}
            </div>

            <CardDescription className="mt-2">
              {openShift
                ? `Since ${formatTime(
                    openShift.clock_in
                  )}`
                : "No open shift"}
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">
              Current Shift
            </CardTitle>

            <Timer className="h-5 w-5 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-bold">
              {openShift
                ? formatDuration(
                    currentShiftDuration
                  )
                : "—"}
            </div>

            <CardDescription className="mt-2">
              Current shift duration
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">
              Today&apos;s Shift Time
            </CardTitle>

            <UserRound className="h-5 w-5 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(
                totalShiftMilliseconds
              )}
            </div>

            <CardDescription className="mt-2">
              Total clocked time today
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">
              Today&apos;s Job Time
            </CardTitle>

            <HardHat className="h-5 w-5 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(
                totalJobMilliseconds
              )}
            </div>

            <CardDescription className="mt-2">
              Time assigned to jobs today
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Assignment</CardTitle>

          <CardDescription>
            The employee&apos;s active job assignment.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {openShift && currentJob && openJobSession ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <div className="text-sm text-muted-foreground">
                  Job Number
                </div>

                <div className="mt-1 flex items-center gap-2 font-semibold">
                  <BriefcaseBusiness className="h-4 w-4" />
                  {currentJob.job_number}
                </div>
              </div>

              <div>
                <div className="text-sm text-muted-foreground">
                  Customer
                </div>

                <div className="mt-1 font-medium">
                  {currentJob.customer ?? "—"}
                </div>
              </div>

              <div>
                <div className="text-sm text-muted-foreground">
                  Started
                </div>

                <div className="mt-1 font-medium">
                  {formatTime(
                    openJobSession.started_at
                  )}
                </div>
              </div>

              <div>
                <div className="text-sm text-muted-foreground">
                  Job Duration
                </div>

                <div className="mt-1 font-medium">
                  {formatDuration(
                    currentJobDuration
                  )}
                </div>
              </div>

              {currentJob.description && (
                <div className="sm:col-span-2 xl:col-span-4">
                  <div className="text-sm text-muted-foreground">
                    Description
                  </div>

                  <div className="mt-1 font-medium">
                    {currentJob.description}
                  </div>
                </div>
              )}
            </div>
          ) : openShift ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <div className="font-medium">
                No active job assignment
              </div>

              <div className="mt-1 text-sm text-muted-foreground">
                This employee is clocked in but is not
                currently assigned to a job.
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <div className="font-medium">
                Employee is clocked out
              </div>

              <div className="mt-1 text-sm text-muted-foreground">
                No current job assignment.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Job Activity</CardTitle>

          <CardDescription>
            Job sessions recorded for this employee today.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {todaysJobSessions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <div className="font-medium">
                No job activity today
              </div>

              <div className="mt-1 text-sm text-muted-foreground">
                Job sessions will appear here after the
                employee scans a job QR code.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">
                      Job
                    </th>

                    <th className="pb-3 pr-4 font-medium">
                      Customer
                    </th>

                    <th className="pb-3 pr-4 font-medium">
                      Start
                    </th>

                    <th className="pb-3 pr-4 font-medium">
                      End
                    </th>

                    <th className="pb-3 font-medium">
                      Duration
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {todaysJobSessions.map(
                    (session) => {
                      const job = jobById.get(
                        session.job_id
                      );

                      return (
                        <tr
                          key={session.id}
                          className="border-b last:border-0"
                        >
                          <td className="py-4 pr-4">
                            <div className="font-medium">
                              {job
                                ? `Job ${job.job_number}`
                                : `Job ID ${session.job_id}`}
                            </div>

                            {job?.description && (
                              <div className="mt-1 text-xs text-muted-foreground">
                                {job.description}
                              </div>
                            )}
                          </td>

                          <td className="py-4 pr-4">
                            {job?.customer ?? "—"}
                          </td>

                          <td className="py-4 pr-4">
                            {formatTime(
                              session.started_at
                            )}
                          </td>

                          <td className="py-4 pr-4">
                            {session.ended_at
                              ? formatTime(
                                  session.ended_at
                                )
                              : "Present"}
                          </td>

                          <td className="py-4 font-medium">
                            {formatDuration(
                              getDurationMilliseconds(
                                session.started_at,
                                session.ended_at
                              )
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
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border">
              <CalendarDays className="h-5 w-5" />
            </div>

            <div>
              <CardTitle>Recent Shift History</CardTitle>

              <CardDescription>
                The employee&apos;s 14 most recent shifts.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {recentShifts.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <div className="font-medium">
                No shift history
              </div>

              <div className="mt-1 text-sm text-muted-foreground">
                Shifts will appear here after this employee
                begins using Lipsey Time.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">
                      Date
                    </th>

                    <th className="pb-3 pr-4 font-medium">
                      Clock In
                    </th>

                    <th className="pb-3 pr-4 font-medium">
                      Clock Out
                    </th>

                    <th className="pb-3 pr-4 font-medium">
                      Duration
                    </th>

                    <th className="pb-3 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {recentShifts.map((shift) => {
                    const isOpen =
                      shift.clock_out === null;

                    const duration =
                      getDurationMilliseconds(
                        shift.clock_in,
                        shift.clock_out
                      );

                    return (
                      <tr
                        key={shift.id}
                        className="border-b last:border-0"
                      >
                        <td className="py-4 pr-4 font-medium">
                          {formatDate(
                            shift.clock_in
                          )}
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

                        <td className="py-4 pr-4 font-medium">
                          {formatDuration(
                            duration
                          )}
                        </td>

                        <td className="py-4">
                          {isOpen ? (
                            <Badge>
                              Open
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              Completed
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
            <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border">
              <History className="h-5 w-5" />
            </div>

            <div>
              <CardTitle>Recent Job History</CardTitle>

              <CardDescription>
                The employee&apos;s 25 most recent job sessions.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {recentJobSessions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <div className="font-medium">
                No job history
              </div>

              <div className="mt-1 text-sm text-muted-foreground">
                Job sessions will appear here after this
                employee begins scanning job QR codes.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">
                      Date
                    </th>

                    <th className="pb-3 pr-4 font-medium">
                      Job
                    </th>

                    <th className="pb-3 pr-4 font-medium">
                      Customer
                    </th>

                    <th className="pb-3 pr-4 font-medium">
                      Start
                    </th>

                    <th className="pb-3 pr-4 font-medium">
                      End
                    </th>

                    <th className="pb-3 pr-4 font-medium">
                      Duration
                    </th>

                    <th className="pb-3 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {recentJobSessions.map((session) => {
                    const job = jobById.get(
                      session.job_id
                    );

                    const isOpen =
                      session.ended_at === null;

                    const duration =
                      getDurationMilliseconds(
                        session.started_at,
                        session.ended_at
                      );

                    return (
                      <tr
                        key={session.id}
                        className="border-b last:border-0"
                      >
                        <td className="py-4 pr-4 font-medium">
                          {formatDate(
                            session.started_at
                          )}
                        </td>

                        <td className="py-4 pr-4">
                          <div className="font-medium">
                            {job
                              ? `Job ${job.job_number}`
                              : `Job ID ${session.job_id}`}
                          </div>

                          {job?.description && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {job.description}
                            </div>
                          )}
                        </td>

                        <td className="py-4 pr-4">
                          {job?.customer ?? "—"}
                        </td>

                        <td className="py-4 pr-4">
                          {formatTime(
                            session.started_at
                          )}
                        </td>

                        <td className="py-4 pr-4">
                          {session.ended_at
                            ? formatTime(
                                session.ended_at
                              )
                            : "Present"}
                        </td>

                        <td className="py-4 pr-4 font-medium">
                          {formatDuration(
                            duration
                          )}
                        </td>

                        <td className="py-4">
                          {isOpen ? (
                            <Badge>
                              Open
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              Completed
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
                <Card>
        <CardHeader>
          <CardTitle>
            Account Administration
          </CardTitle>

          <CardDescription>
            Control whether this employee can use
            Lipsey Time.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex flex-col gap-6 rounded-lg border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-medium">
                {employee.active
                  ? "Employee account is active"
                  : "Employee account is inactive"}
              </div>

              <div className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {employee.active
                  ? "Deactivating this employee will end any open job session, end any open shift, and disable access to Lipsey Time."
                  : "Reactivating this employee restores account access. The employee will remain clocked out until they scan the Clock In QR code."}
              </div>
            </div>

            <div className="shrink-0">
              <EmployeeStatusControl
                employeeId={employee.id}
                employeeName={employee.full_name}
                active={employee.active}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}