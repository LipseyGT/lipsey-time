import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

import EditEmployeeForm from "./edit-employee-form";

type EmployeeProfile = {
  id: string;
  employee_number: string;
  full_name: string;
  role: string;
  active: boolean;
};

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("profiles")
    .select(
      "id, employee_number, full_name, role, active"
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    notFound();
  }

  const employee =
    data as EmployeeProfile;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/dashboard/employees/${employee.id}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Employee
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Edit Employee
        </h1>

        <p className="mt-1 text-muted-foreground">
          Update {employee.full_name}&apos;s
          basic employee information.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border">
              <Pencil className="h-5 w-5" />
            </div>

            <div>
              <CardTitle>
                Employee Information
              </CardTitle>

              <CardDescription>
                Update the employee&apos;s name or
                employee number.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <EditEmployeeForm
            employee={employee}
          />
        </CardContent>
      </Card>
    </div>
  );
}