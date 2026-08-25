import Link from "next/link";
import {
  notFound,
} from "next/navigation";
import {
  ArrowLeft,
  Clock3,
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

import EditShiftForm from "./edit-shift-form";

type Shift = {
  id: number;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
};

type Employee = {
  id: string;
  full_name: string;
  employee_number: string;
};

export default async function EditShiftPage({
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
    data: shiftData,
    error: shiftError,
  } = await supabase
    .from("shifts")
    .select(
      "id, user_id, clock_in, clock_out"
    )
    .eq("id", id)
    .single();

  if (
    shiftError ||
    !shiftData
  ) {
    notFound();
  }

  const shift =
    shiftData as Shift;

  const {
    data: employeeData,
  } = await supabase
    .from("profiles")
    .select(
      "id, full_name, employee_number"
    )
    .eq(
      "id",
      shift.user_id
    )
    .single();

  const employee =
    employeeData as
      | Employee
      | null;

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
          Edit Shift
        </h1>

        <p className="mt-1 text-muted-foreground">
          {employee
            ? `${employee.full_name} — Employee #${employee.employee_number}`
            : "Employee shift correction"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border">
              <Clock3 className="h-5 w-5" />
            </div>

            <div>
              <CardTitle>
                Shift Times
              </CardTitle>

              <CardDescription>
                Enter the corrected
                clock-in and clock-out
                times.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <EditShiftForm
            shift={shift}
          />
        </CardContent>
      </Card>
    </div>
  );
}