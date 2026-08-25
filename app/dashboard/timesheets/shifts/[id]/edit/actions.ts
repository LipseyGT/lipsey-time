"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type EditShiftState = {
  error: string | null;
};

function chicagoLocalToUtc(
  localDateTime: string
) {
  const match = localDateTime.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
  );

  if (!match) {
    return null;
  }

  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
  ] = match;

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);

  const targetWallTime = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    0
  );

  const formatter =
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });

  let guess = targetWallTime;

  for (let i = 0; i < 3; i++) {
    const parts =
      formatter.formatToParts(
        new Date(guess)
      );

    const getPart = (
      type: string
    ) =>
      Number(
        parts.find(
          (part) =>
            part.type === type
        )?.value ?? 0
      );

    const wallTimeAsUtc =
      Date.UTC(
        getPart("year"),
        getPart("month") - 1,
        getPart("day"),
        getPart("hour"),
        getPart("minute"),
        getPart("second")
      );

    const offset =
      wallTimeAsUtc - guess;

    guess =
      targetWallTime - offset;
  }

  return new Date(guess);
}

export async function editShift(
  _previousState: EditShiftState,
  formData: FormData
): Promise<EditShiftState> {
  const shiftId = String(
    formData.get("shift_id") ?? ""
  ).trim();

  const clockInValue = String(
    formData.get("clock_in") ?? ""
  ).trim();

  const clockOutValue = String(
    formData.get("clock_out") ?? ""
  ).trim();

  if (!shiftId) {
    return {
      error: "Shift ID is missing.",
    };
  }

  if (!clockInValue) {
    return {
      error: "Clock-in time is required.",
    };
  }

  const clockIn =
    chicagoLocalToUtc(
      clockInValue
    );

  const clockOut =
    clockOutValue
      ? chicagoLocalToUtc(
          clockOutValue
        )
      : null;

  if (!clockIn) {
    return {
      error: "Clock-in time is invalid.",
    };
  }

  if (
    clockOutValue &&
    !clockOut
  ) {
    return {
      error: "Clock-out time is invalid.",
    };
  }

  if (
    clockOut &&
    clockOut.getTime() <=
      clockIn.getTime()
  ) {
    return {
      error:
        "Clock-out must be later than clock-in.",
    };
  }

  const supabase =
    await createClient();

  const {
    data: { user },
    error: userError,
  } =
    await supabase.auth.getUser();

  if (
    userError ||
    !user
  ) {
    return {
      error:
        "Your login session could not be verified.",
    };
  }

  const {
    data: administrator,
    error: administratorError,
  } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .single();

  if (
    administratorError ||
    !administrator ||
    administrator.role !==
      "admin" ||
    !administrator.active
  ) {
    return {
      error:
        "Administrator permission is required.",
    };
  }

  const admin =
    createAdminClient();

  const {
    data: shift,
    error: shiftError,
  } = await admin
    .from("shifts")
    .select("id")
    .eq("id", shiftId)
    .maybeSingle();

  if (
    shiftError ||
    !shift
  ) {
    return {
      error:
        "The shift could not be found.",
    };
  }

  const {
    error: updateError,
  } = await admin
    .from("shifts")
    .update({
      clock_in:
        clockIn.toISOString(),
      clock_out:
        clockOut
          ? clockOut.toISOString()
          : null,
    })
    .eq("id", shiftId);

  if (updateError) {
    return {
      error:
        updateError.message ??
        "The shift could not be updated.",
    };
  }

  revalidatePath(
    "/dashboard"
  );

  revalidatePath(
    "/dashboard/timesheets"
  );

  redirect(
    "/dashboard/timesheets"
  );
}