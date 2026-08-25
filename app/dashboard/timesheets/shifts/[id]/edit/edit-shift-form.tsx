"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  editShift,
  type EditShiftState,
} from "./actions";

type EditShiftFormProps = {
  shift: {
    id: number;
    clock_in: string;
    clock_out: string | null;
  };
};

const initialState: EditShiftState = {
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

export default function EditShiftForm({
  shift,
}: EditShiftFormProps) {
  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    editShift,
    initialState
  );

  return (
    <form
      action={formAction}
      className="space-y-6"
    >
      <input
        type="hidden"
        name="shift_id"
        value={shift.id}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="clock_in">
            Clock In
          </Label>

          <Input
            id="clock_in"
            name="clock_in"
            type="datetime-local"
            defaultValue={toChicagoInputValue(
              shift.clock_in
            )}
            required
            disabled={pending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="clock_out">
            Clock Out
          </Label>

          <Input
            id="clock_out"
            name="clock_out"
            type="datetime-local"
            defaultValue={
              shift.clock_out
                ? toChicagoInputValue(
                    shift.clock_out
                  )
                : ""
            }
            disabled={pending}
          />

          <p className="text-xs text-muted-foreground">
            Leave blank only if this
            shift should remain open.
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
            : "Save Shift Correction"}
        </Button>
      </div>
    </form>
  );
}