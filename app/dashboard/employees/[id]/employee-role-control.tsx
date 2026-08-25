"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import {
  changeEmployeeRole,
  type EmployeeRoleState,
} from "./role-actions";

type EmployeeRoleControlProps = {
  employeeId: string;
  employeeName: string;
  currentRole: string;
  active: boolean;
};

const initialState: EmployeeRoleState = {
  error: null,
  success: null,
};

export default function EmployeeRoleControl({
  employeeId,
  employeeName,
  currentRole,
  active,
}: EmployeeRoleControlProps) {
  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    changeEmployeeRole,
    initialState
  );

  return (
    <div className="space-y-4">
      {state.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
          {state.error}
        </div>
      )}

      {state.success && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm">
          {state.success}
        </div>
      )}

      <form
        action={formAction}
        className="space-y-4"
        onSubmit={(event) => {
          const form =
            event.currentTarget;

          const formData =
            new FormData(form);

          const newRole =
            String(
              formData.get("role")
            );

          if (
            currentRole === "admin" &&
            newRole === "employee"
          ) {
            const confirmed =
              window.confirm(
                `Remove administrator access from ${employeeName}?\n\nThis person will no longer be able to access company-wide administration features.`
              );

            if (!confirmed) {
              event.preventDefault();
            }
          }
        }}
      >
        <input
          type="hidden"
          name="employee_id"
          value={employeeId}
        />

        <div className="space-y-2">
          <Label htmlFor="employee-role">
            Account Role
          </Label>

          <select
            id="employee-role"
            name="role"
            defaultValue={currentRole}
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
        </div>

        {!active && (
          <p className="text-xs text-muted-foreground">
            Inactive employees must be reactivated
            before they can be promoted to Administrator.
          </p>
        )}

        <Button
          type="submit"
          variant="outline"
          disabled={pending}
        >
          {pending
            ? "Updating Role..."
            : "Update Role"}
        </Button>
      </form>
    </div>
  );
}