import {
  BriefcaseBusiness,
  Clock3,
  HardHat,
  Users,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Profile = {
  id: string;
  employee_number: string;
  full_name: string;
  active: boolean;
};

type Job = {
  id: number;
  job_number: string;
  customer: string | null;
  description: string | null;
  active: boolean;
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

type AuditEvent = {
  id: number;
  user_id: string;
  event_type: string;
  job_id: number | null;
  occurred_at: string;
};

function formatTime(dateString: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dateString));
}

function formatDuration(dateString: string) {
  const started = new Date(dateString).getTime();
  const now = Date.now();

  const totalMinutes = Math.max(
    0,
    Math.floor((now - started) / 60000)
  );

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

function describeEvent(
  event: AuditEvent,
  employeeName: string,
  jobNumber?: string
) {
  switch (event.event_type) {
    case "clock_in":
      return `${employeeName} clocked in`;

    case "clock_out":
      return `${employeeName} clocked out`;

    case "job_start":
      return jobNumber
        ? `${employeeName} started Job ${jobNumber}`
        : `${employeeName} started a job`;

    case "job_stop":
      return jobNumber
        ? `${employeeName} stopped Job ${jobNumber}`
        : `${employeeName} stopped a job`;

    default:
      return `${employeeName}: ${event.event_type}`;
  }
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    profilesResult,
    jobsResult,
    shiftsResult,
    sessionsResult,
    eventsResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, employee_number, full_name, active")
      .order("full_name"),

    supabase
      .from("jobs")
      .select(
        "id, job_number, customer, description, active"
      )
      .order("job_number"),

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
      .from("audit_events")
      .select(
        "id, user_id, event_type, job_id, occurred_at"
      )
      .order("occurred_at", { ascending: false })
      .limit(10),
  ]);

  const profiles =
    (profilesResult.data ?? []) as Profile[];

  const jobs =
    (jobsResult.data ?? []) as Job[];

  const openShifts =
    (shiftsResult.data ?? []) as OpenShift[];

  const openSessions =
    (sessionsResult.data ?? []) as OpenJobSession[];

  const recentEvents =
    (eventsResult.data ?? []) as AuditEvent[];

  const hasQueryError = Boolean(
    profilesResult.error ||
      jobsResult.error ||
      shiftsResult.error ||
      sessionsResult.error ||
      eventsResult.error
  );

  const activeProfiles = profiles.filter(
    (profile) => profile.active
  );

  const activeJobs = jobs.filter((job) => job.active);

  const profileMap = new Map(
    profiles.map((profile) => [profile.id, profile])
  );

  const jobMap = new Map(
    jobs.map((job) => [job.id, job])
  );

  const currentSessionByUser =
    new Map<string, OpenJobSession>();

  for (const session of openSessions) {
    if (!currentSessionByUser.has(session.user_id)) {
      currentSessionByUser.set(
        session.user_id,
        session
      );
    }
  }

  const currentWorkers = openShifts.map((shift) => {
    const employee = profileMap.get(shift.user_id);

    const session =
      currentSessionByUser.get(shift.user_id);

    const job = session
      ? jobMap.get(session.job_id)
      : undefined;

    return {
      shift,
      employee,
      session,
      job,
    };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Dashboard
        </h1>

        <p className="mt-1 text-muted-foreground">
          Live overview of employee time and active jobs.
        </p>
      </div>

      {hasQueryError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
          Some dashboard information could not be loaded.
          Check the VS Code terminal for the database error.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
              Active Jobs
            </CardTitle>

            <BriefcaseBusiness className="h-5 w-5 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-bold">
              {activeJobs.length}
            </div>

            <CardDescription className="mt-2">
              Jobs currently available
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
              {openSessions.length}
            </div>

            <CardDescription className="mt-2">
              Active job sessions
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">
              Active Employees
            </CardTitle>

            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-bold">
              {activeProfiles.length}
            </div>

            <CardDescription className="mt-2">
              Employees enabled in the system
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Currently Working</CardTitle>

            <CardDescription>
              Employees who are currently clocked in.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {currentWorkers.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                Nobody is currently clocked in.
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
                        Current Job
                      </th>

                      <th className="pb-3 pr-4 font-medium">
                        Started
                      </th>

                      <th className="pb-3 font-medium">
                        Duration
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {currentWorkers.map(
                      ({
                        shift,
                        employee,
                        session,
                        job,
                      }) => {
                        const startTime =
                          session?.started_at ??
                          shift.clock_in;

                        return (
                          <tr
                            key={shift.id}
                            className="border-b last:border-0"
                          >
                            <td className="py-4 pr-4">
                              <div className="font-medium">
                                {employee?.full_name ??
                                  "Unknown employee"}
                              </div>

                              {employee?.employee_number && (
                                <div className="text-xs text-muted-foreground">
                                  Employee #
                                  {
                                    employee.employee_number
                                  }
                                </div>
                              )}
                            </td>

                            <td className="py-4 pr-4">
                              {job ? (
                                <>
                                  <div className="font-medium">
                                    Job {job.job_number}
                                  </div>

                                  <div className="text-xs text-muted-foreground">
                                    {job.customer ??
                                      job.description ??
                                      "No description"}
                                  </div>
                                </>
                              ) : (
                                <span className="text-muted-foreground">
                                  Clocked in — no active
                                  job
                                </span>
                              )}
                            </td>

                            <td className="py-4 pr-4">
                              {formatTime(startTime)}
                            </td>

                            <td className="py-4 font-medium">
                              {formatDuration(startTime)}
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
            <CardTitle>Recent Activity</CardTitle>

            <CardDescription>
              Latest clock and job activity.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {recentEvents.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No recent activity.
              </div>
            ) : (
              <div className="space-y-4">
                {recentEvents.map((event) => {
                  const employee =
                    profileMap.get(event.user_id);

                  const job = event.job_id
                    ? jobMap.get(event.job_id)
                    : undefined;

                  return (
                    <div
                      key={event.id}
                      className="flex gap-3"
                    >
                      <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-foreground" />

                      <div className="min-w-0">
                        <div className="text-sm">
                          {describeEvent(
                            event,
                            employee?.full_name ??
                              "Unknown employee",
                            job?.job_number
                          )}
                        </div>

                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatTime(
                            event.occurred_at
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}