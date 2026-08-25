"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import {
  changeEmployeeStatus,
  type EmployeeStatusState,
} from "./status-actions";

type EmployeeStatusControlProps = {
  employeeId: string;
  employeeName: string;
  active: boolean;
};

const initialState: EmployeeStatusState = {
  error: null,
  success: null,
};

export default function EmployeeStatusControl({
  employeeId,
  employeeName,
  active,
}: EmployeeStatusControlProps) {
  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    changeEmployeeStatus,
    initialState
  );

  return (
    <div className="space-y-3">
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
        onSubmit={(event) => {
          if (active) {
            const confirmed = window.confirm(
              `Deactivate ${employeeName}?\n\nThis will end any open shift and job session and prevent the employee from logging in.`
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

        <input
          type="hidden"
          name="action"
          value={
            active
              ? "deactivate"
              : "activate"
          }
        />

        <Button
          type="submit"
          variant={
            active
              ? "destructive"
              : "default"
          }
          disabled={pending}
        >
          {pending
            ? active
              ? "Deactivating..."
              : "Reactivating..."
            : active
              ? "Deactivate Employee"
              : "Reactivate Employee"}
        </Button>
      </form>
    </div>
  );
}