"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  editEmployee,
  type EditEmployeeState,
} from "./actions";

type EditEmployeeFormProps = {
  employee: {
    id: string;
    full_name: string;
    employee_number: string;
  };
};

const initialState: EditEmployeeState = {
  error: null,
};

export default function EditEmployeeForm({
  employee,
}: EditEmployeeFormProps) {
  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    editEmployee,
    initialState
  );

  return (
    <form
      action={formAction}
      className="space-y-6"
    >
      <input
        type="hidden"
        name="employee_id"
        value={employee.id}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="full_name">
            Full Name
          </Label>

          <Input
            id="full_name"
            name="full_name"
            defaultValue={employee.full_name}
            required
            disabled={pending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="employee_number">
            Employee Number
          </Label>

          <Input
            id="employee_number"
            name="employee_number"
            defaultValue={
              employee.employee_number
            }
            required
            disabled={pending}
          />
        </div>
      </div>

      {state.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
          {state.error}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={pending}
        >
          {pending
            ? "Saving Changes..."
            : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}