import Link from "next/link";
import {
  ArrowLeft,
  UserPlus,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import AddEmployeeForm from "./add-employee-form";

export default function NewEmployeePage() {
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

      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Add Employee
        </h1>

        <p className="mt-1 text-muted-foreground">
          Create a Lipsey Time employee account
          and send the employee an invitation.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border">
              <UserPlus className="h-5 w-5" />
            </div>

            <div>
              <CardTitle>
                Employee Information
              </CardTitle>

              <CardDescription>
                The employee will receive an email
                to finish setting up their account.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <AddEmployeeForm />
        </CardContent>
      </Card>
    </div>
  );
}