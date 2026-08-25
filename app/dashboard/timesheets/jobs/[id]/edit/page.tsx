import Link from "next/link";
import {
  notFound,
} from "next/navigation";
import {
  ArrowLeft,
  BriefcaseBusiness,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createClient,
} from "@/lib/supabase/server";

import EditJobSessionForm from "./edit-job-session-form";

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

export default async function EditJobSessionPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } =
    await params;

  const supabase =
    await createClient();

  const {
    data: sessionData,
    error: sessionError,
  } = await supabase
    .from("job_sessions")
    .select(
      "id, shift_id, user_id, job_id, started_at, ended_at"
    )
    .eq("id", id)
    .single();

  if (
    sessionError ||
    !sessionData
  ) {
    notFound();
  }

  const session =
    sessionData as JobSession;

  const [
    employeeResult,
    jobResult,
    shiftResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "full_name, employee_number"
      )
      .eq(
        "id",
        session.user_id
      )
      .single(),

    supabase
      .from("jobs")
      .select(
        "job_number, customer, description"
      )
      .eq(
        "id",
        session.job_id
      )
      .single(),

    supabase
      .from("shifts")
      .select(
        "clock_in, clock_out"
      )
      .eq(
        "id",
        session.shift_id
      )
      .single(),
  ]);

  const employee =
    employeeResult.data;

  const job =
    jobResult.data;

  const shift =
    shiftResult.data;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/timesheets"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Timesheets
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Edit Job Session
        </h1>

        <p className="mt-1 text-muted-foreground">
          {employee
            ? `${employee.full_name} — Employee #${employee.employee_number}`
            : "Job session correction"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>

            <div>
              <CardTitle>
                {job
                  ? `Job ${job.job_number}`
                  : "Job Session"}
              </CardTitle>

              <CardDescription>
                {job?.customer ??
                  job?.description ??
                  "Correct job start and end times."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {shift && (
            <div className="rounded-lg border p-4 text-sm">
              <div className="font-medium">
                Related Shift
              </div>

              <div className="mt-1 text-muted-foreground">
                Clock In:{" "}
                {new Date(
                  shift.clock_in
                ).toLocaleString(
                  "en-US",
                  {
                    timeZone:
                      "America/Chicago",
                  }
                )}
              </div>

              <div className="text-muted-foreground">
                Clock Out:{" "}
                {shift.clock_out
                  ? new Date(
                      shift.clock_out
                    ).toLocaleString(
                      "en-US",
                      {
                        timeZone:
                          "America/Chicago",
                      }
                    )
                  : "Present"}
              </div>
            </div>
          )}

          <EditJobSessionForm
            session={session}
          />
        </CardContent>
      </Card>
    </div>
  );
}