"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  addEmployee,
  type AddEmployeeState,
} from "./actions";

const initialState: AddEmployeeState = {
  error: null,
};

export default function AddEmployeeForm() {
  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    addEmployee,
    initialState
  );

  return (
    <form
      action={formAction}
      className="space-y-6"
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="full_name">
            Full Name
          </Label>

          <Input
            id="full_name"
            name="full_name"
            placeholder="John Smith"
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
            placeholder="001"
            required
            disabled={pending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">
            Email Address
          </Label>

          <Input
            id="email"
            name="email"
            type="email"
            placeholder="john@example.com"
            required
            disabled={pending}
          />

          <p className="text-xs text-muted-foreground">
            An account invitation will be sent to
            this address.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">
            Account Role
          </Label>

          <select
            id="role"
            name="role"
            defaultValue="employee"
            disabled={pending}
            className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="employee">
              Employee
            </option>

            <option value="admin">
              Administrator
            </option>
          </select>

          <p className="text-xs text-muted-foreground">
            Administrators can access company-wide
            employee and time data.
          </p>
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
            ? "Creating Employee..."
            : "Create Employee & Send Invite"}
        </Button>
      </div>
    </form>
  );
}