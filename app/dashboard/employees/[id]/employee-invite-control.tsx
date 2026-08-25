"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  resendEmployeeInvite,
  type EmployeeInviteState,
} from "./invite-actions";

type EmployeeInviteControlProps = {
  employeeId: string;
  employeeName: string;
  active: boolean;
};

const initialState: EmployeeInviteState = {
  error: null,
  success: null,
};

export default function EmployeeInviteControl({
  employeeId,
  employeeName,
  active,
}: EmployeeInviteControlProps) {
  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    resendEmployeeInvite,
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
          const confirmed =
            window.confirm(
              `Send a new account setup email to ${employeeName}?`
            );

          if (!confirmed) {
            event.preventDefault();
          }
        }}
      >
        <input
          type="hidden"
          name="employee_id"
          value={employeeId}
        />

        <Button
          type="submit"
          variant="outline"
          disabled={
            pending || !active
          }
        >
          <Mail className="mr-2 h-4 w-4" />

          {pending
            ? "Sending..."
            : "Resend Setup Email"}
        </Button>
      </form>

      {!active && (
        <p className="text-xs text-muted-foreground">
          Reactivate this employee before
          sending an account setup email.
        </p>
      )}
    </div>
  );
}