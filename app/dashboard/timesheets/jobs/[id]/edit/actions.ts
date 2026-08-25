"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type EditJobSessionState = {
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

export async function editJobSession(
  _previousState: EditJobSessionState,
  formData: FormData
): Promise<EditJobSessionState> {
  const sessionId = String(
    formData.get("session_id") ?? ""
  ).trim();

  const startedAtValue = String(
    formData.get("started_at") ?? ""
  ).trim();

  const endedAtValue = String(
    formData.get("ended_at") ?? ""
  ).trim();

  if (!sessionId) {
    return {
      error: "Job session ID is missing.",
    };
  }

  if (!startedAtValue) {
    return {
      error: "Job start time is required.",
    };
  }

  const startedAt =
    chicagoLocalToUtc(
      startedAtValue
    );

  const endedAt =
    endedAtValue
      ? chicagoLocalToUtc(
          endedAtValue
        )
      : null;

  if (!startedAt) {
    return {
      error: "Job start time is invalid.",
    };
  }

  if (
    endedAtValue &&
    !endedAt
  ) {
    return {
      error: "Job end time is invalid.",
    };
  }

  if (
    endedAt &&
    endedAt.getTime() <=
      startedAt.getTime()
  ) {
    return {
      error:
        "Job end time must be later than job start time.",
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
    data: session,
    error: sessionError,
  } = await admin
    .from("job_sessions")
    .select(
      "id, shift_id, user_id"
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (
    sessionError ||
    !session
  ) {
    return {
      error:
        "The job session could not be found.",
    };
  }

  const {
    data: shift,
    error: shiftError,
  } = await admin
    .from("shifts")
    .select(
      "id, clock_in, clock_out"
    )
    .eq(
      "id",
      session.shift_id
    )
    .maybeSingle();

  if (
    shiftError ||
    !shift
  ) {
    return {
      error:
        "The related shift could not be found.",
    };
  }

  const shiftStart =
    new Date(
      shift.clock_in
    );

  const shiftEnd =
    shift.clock_out
      ? new Date(
          shift.clock_out
        )
      : null;

  if (
    startedAt.getTime() <
    shiftStart.getTime()
  ) {
    return {
      error:
        "Job start time cannot be before the employee's clock-in time.",
    };
  }

  if (
    shiftEnd &&
    startedAt.getTime() >
      shiftEnd.getTime()
  ) {
    return {
      error:
        "Job start time cannot be after the employee's clock-out time.",
    };
  }

  if (
    endedAt &&
    shiftEnd &&
    endedAt.getTime() >
      shiftEnd.getTime()
  ) {
    return {
      error:
        "Job end time cannot be after the employee's clock-out time.",
    };
  }

  if (
    shiftEnd &&
    !endedAt
  ) {
    return {
      error:
        "A completed shift cannot contain an open job session. Enter a job end time.",
    };
  }

  const {
    error: updateError,
  } = await admin
    .from("job_sessions")
    .update({
      started_at:
        startedAt.toISOString(),
      ended_at:
        endedAt
          ? endedAt.toISOString()
          : null,
    })
    .eq("id", sessionId);

  if (updateError) {
    return {
      error:
        updateError.message ??
        "The job session could not be updated.",
    };
  }

  revalidatePath(
    "/dashboard"
  );

  revalidatePath(
    "/dashboard/timesheets"
  );

  revalidatePath(
    `/dashboard/employees/${session.user_id}`
  );

  redirect(
    "/dashboard/timesheets"
  );
}