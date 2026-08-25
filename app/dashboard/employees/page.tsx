import {
  BriefcaseBusiness,
  Clock3,
  HardHat,
  Plus,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";

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
  role: string;
  active: boolean;
  created_at: string;
};

type OpenShift = {
  id: number;
  user_id: string;
  clock_in: string;
};

type OpenJobSession = {
  id: number;
  user_id: string;
  job_id: number;
  started_at: string;
};

type Job = {
  id: number;
  job_number: string;
  customer: string | null;
  description: string | null;
  active: boolean;
};

function formatTime(dateString: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dateString));
}

export default async function EmployeesPage() {
  const supabase = await createClient();

  const [
    profilesResult,
    shiftsResult,
    jobSessionsResult,
    jobsResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, employee_number, full_name, role, active, created_at"
      )
      .order("full_name", { ascending: true }),

    supabase
      .from("shifts")
      .select("id, user_id, clock_in")
      .is("clock_out", null)
      .order("clock_in", { ascending: true }),

    supabase
      .from("job_sessions")
      .select("id, user_id, job_id, started_at")
      .is("ended_at", null)
      .order("started_at", { ascending: false }),

    supabase
      .from("jobs")
      .select(
        "id, job_number, customer, description, active"
      )
      .order("job_number", { ascending: true }),
  ]);

  const employees =
    (profilesResult.data ?? []) as EmployeeProfile[];

  const openShifts =
    (shiftsResult.data ?? []) as OpenShift[];

  const openJobSessions =
    (jobSessionsResult.data ?? []) as OpenJobSession[];

  const jobs =
    (jobsResult.data ?? []) as Job[];

  const hasQueryError = Boolean(
    profilesResult.error ||
      shiftsResult.error ||
      jobSessionsResult.error ||
      jobsResult.error
  );

  const activeEmployees = employees.filter(
    (employee) => employee.active
  );

  const inactiveEmployees = employees.filter(
    (employee) => !employee.active
  );

  const openShiftByUser = new Map<string, OpenShift>();

  for (const shift of openShifts) {
    openShiftByUser.set(shift.user_id, shift);
  }

  const openJobSessionByUser =
    new Map<string, OpenJobSession>();

  for (const session of openJobSessions) {
    if (!openJobSessionByUser.has(session.user_id)) {
      openJobSessionByUser.set(
        session.user_id,
        session
      );
    }
  }

  const jobById = new Map<number, Job>();

  for (const job of jobs) {
    jobById.set(job.id, job);
  }

  const employeesWorkingOnJobs =
    employees.filter((employee) => {
      const openShift =
        openShiftByUser.get(employee.id);

      const openSession =
        openJobSessionByUser.get(employee.id);

      return Boolean(openShift && openSession);
    }).length;

  return (
    <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
            <h1 className="text-3xl font-bold tracking-tight">
             Employees
            </h1>

            <p className="mt-1 text-muted-foreground">
            View employee status, clock activity, and
            current job assignments.
            </p>
        </div>

        <Button asChild>
            <Link href="/dashboard/employees/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Employee
            </Link>
        </Button>
        </div>

      {hasQueryError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
          Some employee information could not be loaded.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">
              Total Employees
            </CardTitle>

            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-bold">
              {employees.length}
            </div>

            <CardDescription className="mt-2">
              Employee profiles in the system
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">
              Active Employees
            </CardTitle>

            <UserRound className="h-5 w-5 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-bold">
              {activeEmployees.length}
            </div>

            <CardDescription className="mt-2">
              Employees currently enabled
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">
              Clocked In
            </CardTitle>

            <Clock3 className="h-5 w-5 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-bold">
              {openShifts.length}
            </div>

            <CardDescription className="mt-2">
              Employees currently on shift
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">
              Working on Jobs
            </CardTitle>

            <HardHat className="h-5 w-5 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-bold">
              {employeesWorkingOnJobs}
            </div>

            <CardDescription className="mt-2">
              Employees with active job sessions
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">
              Inactive Employees
            </CardTitle>

            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-bold">
              {inactiveEmployees.length}
            </div>

            <CardDescription className="mt-2">
              Employees currently disabled
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employee Directory</CardTitle>

          <CardDescription>
            Live employee, clock, and job status.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {employees.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center">
              <div className="text-sm font-medium">
                No employees found.
              </div>

              <div className="mt-1 text-sm text-muted-foreground">
                Employee profiles will appear here after
                they are created.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">
                      Employee
                    </th>

                    <th className="pb-3 pr-4 font-medium">
                      Employee #
                    </th>

                    <th className="pb-3 pr-4 font-medium">
                      Role
                    </th>

                    <th className="pb-3 pr-4 font-medium">
                      System Status
                    </th>

                    <th className="pb-3 pr-4 font-medium">
                      Clock Status
                    </th>

                    <th className="pb-3 pr-4 font-medium">
                      Clocked In
                    </th>

                    <th className="pb-3 pr-4 font-medium">
                      Current Job
                    </th>

                    <th className="pb-3 font-medium">
                      Job Since
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {employees.map((employee) => {
                    const openShift =
                      openShiftByUser.get(employee.id);

                    const openJobSession =
                      openJobSessionByUser.get(
                        employee.id
                      );

                    const isClockedIn =
                      Boolean(openShift);

                    const currentJob =
                      isClockedIn && openJobSession
                        ? jobById.get(
                            openJobSession.job_id
                          )
                        : undefined;

                    return (
                      <tr
                        key={employee.id}
                        className="border-b last:border-0"
                      >
                        <td className="py-4 pr-4">
                          <Link
                            href={`/dashboard/employees/${employee.id}`}
                            className="font-medium underline-offset-4 hover:underline"
                          >
                            {employee.full_name}
                          </Link>
                        </td>

                        <td className="py-4 pr-4">
                          {employee.employee_number}
                        </td>

                        <td className="py-4 pr-4">
                          <Badge variant="outline">
                            {employee.role === "admin"
                              ? "Administrator"
                              : "Employee"}
                          </Badge>
                        </td>

                        <td className="py-4 pr-4">
                          {employee.active ? (
                            <Badge>Active</Badge>
                          ) : (
                            <Badge variant="secondary">
                              Inactive
                            </Badge>
                          )}
                        </td>

                        <td className="py-4 pr-4">
                          {isClockedIn ? (
                            <Badge>
                              Clocked In
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              Clocked Out
                            </Badge>
                          )}
                        </td>

                        <td className="py-4 pr-4">
                          {openShift ? (
                            <span className="font-medium">
                              {formatTime(
                                openShift.clock_in
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              —
                            </span>
                          )}
                        </td>

                        <td className="py-4 pr-4">
                          {currentJob ? (
                            <div>
                              <div className="flex items-center gap-2 font-medium">
                                <BriefcaseBusiness className="h-4 w-4 text-muted-foreground" />

                                Job{" "}
                                {currentJob.job_number}
                              </div>

                              <div className="mt-1 text-xs text-muted-foreground">
                                {currentJob.customer ??
                                  currentJob.description ??
                                  "No description"}
                              </div>
                            </div>
                          ) : isClockedIn ? (
                            <span className="text-muted-foreground">
                              No active job
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              —
                            </span>
                          )}
                        </td>

                        <td className="py-4">
                          {currentJob &&
                          openJobSession ? (
                            <span className="font-medium">
                              {formatTime(
                                openJobSession.started_at
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              —
                            </span>
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
    </div>
  );
}