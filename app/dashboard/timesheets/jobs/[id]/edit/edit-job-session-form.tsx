"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  editJobSession,
  type EditJobSessionState,
} from "./actions";

type EditJobSessionFormProps = {
  session: {
    id: number;
    started_at: string;
    ended_at: string | null;
  };
};

const initialState: EditJobSessionState = {
  error: null,
};

function toChicagoInputValue(
  dateString: string
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "America/Chicago",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }
    );

  const parts =
    formatter.formatToParts(
      new Date(dateString)
    );

  const getPart = (
    type: string
  ) =>
    parts.find(
      (part) =>
        part.type === type
    )?.value ?? "";

  return `${getPart(
    "year"
  )}-${getPart(
    "month"
  )}-${getPart(
    "day"
  )}T${getPart(
    "hour"
  )}:${getPart(
    "minute"
  )}`;
}

export default function EditJobSessionForm({
  session,
}: EditJobSessionFormProps) {
  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    editJobSession,
    initialState
  );

  return (
    <form
      action={formAction}
      className="space-y-6"
    >
      <input
        type="hidden"
        name="session_id"
        value={session.id}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="started_at">
            Job Start
          </Label>

          <Input
            id="started_at"
            name="started_at"
            type="datetime-local"
            defaultValue={toChicagoInputValue(
              session.started_at
            )}
            required
            disabled={pending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ended_at">
            Job End
          </Label>

          <Input
            id="ended_at"
            name="ended_at"
            type="datetime-local"
            defaultValue={
              session.ended_at
                ? toChicagoInputValue(
                    session.ended_at
                  )
                : ""
            }
            disabled={pending}
          />

          <p className="text-xs text-muted-foreground">
            Leave blank only if this
            job session should remain open.
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
            ? "Saving..."
            : "Save Job Correction"}
        </Button>
      </div>
    </form>
  );
}