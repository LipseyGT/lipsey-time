"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type EmployeeStatusState = {
  error: string | null;
  success: string | null;
};

export async function changeEmployeeStatus(
  previousState: EmployeeStatusState,
  formData: FormData
): Promise<EmployeeStatusState> {
  const employeeId = String(
    formData.get("employee_id") ?? ""
  ).trim();

  const requestedAction = String(
    formData.get("action") ?? ""
  ).trim();

  if (!employeeId) {
    return {
      error: "Employee ID is missing.",
      success: null,
    };
  }

  if (
    requestedAction !== "activate" &&
    requestedAction !== "deactivate"
  ) {
    return {
      error: "Invalid employee status action.",
      success: null,
    };
  }

  /*
   * STEP 1
   * Verify the administrator making the request.
   */
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      error:
        "Your login session could not be verified.",
      success: null,
    };
  }

  const {
    data: administratorProfile,
    error: administratorError,
  } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .single();

  if (
    administratorError ||
    !administratorProfile ||
    administratorProfile.role !== "admin" ||
    !administratorProfile.active
  ) {
    return {
      error:
        "Administrator permission is required.",
      success: null,
    };
  }

  /*
   * SAFEGUARD
   *
   * An administrator cannot deactivate their own
   * account from this screen.
   */
  if (
    requestedAction === "deactivate" &&
    employeeId === user.id
  ) {
    return {
      error:
        "You cannot deactivate your own administrator account.",
      success: null,
    };
  }

  /*
   * STEP 2
   * Create the elevated server-only client.
   */
  const admin = createAdminClient();

  const {
    data: employee,
    error: employeeError,
  } = await admin
    .from("profiles")
    .select("id, full_name, active")
    .eq("id", employeeId)
    .maybeSingle();

  if (employeeError) {
    return {
      error:
        "The employee record could not be checked.",
      success: null,
    };
  }

  if (!employee) {
    return {
      error: "Employee not found.",
      success: null,
    };
  }

  /*
   * ==================================================
   * DEACTIVATE
   * ==================================================
   */
  if (requestedAction === "deactivate") {
    if (!employee.active) {
      return {
        error: null,
        success:
          `${employee.full_name} is already inactive.`,
      };
    }

    const now = new Date().toISOString();

    /*
     * Close every open job session.
     *
     * Normally there should only be one, but using
     * a broad update also cleans up stale test data.
     */
    const {
      error: sessionCloseError,
    } = await admin
      .from("job_sessions")
      .update({
        ended_at: now,
      })
      .eq("user_id", employeeId)
      .is("ended_at", null);

    if (sessionCloseError) {
      return {
        error:
          "The employee's open job session could not be closed.",
        success: null,
      };
    }

    /*
     * Close every open shift.
     */
    const {
      error: shiftCloseError,
    } = await admin
      .from("shifts")
      .update({
        clock_out: now,
      })
      .eq("user_id", employeeId)
      .is("clock_out", null);

    if (shiftCloseError) {
      return {
        error:
          "The employee's open shift could not be closed.",
        success: null,
      };
    }

    /*
     * Mark the application's profile inactive.
     *
     * This immediately blocks process_scan(),
     * even if an old Auth session still exists.
     */
    const {
      error: profileUpdateError,
    } = await admin
      .from("profiles")
      .update({
        active: false,
      })
      .eq("id", employeeId);

    if (profileUpdateError) {
      return {
        error:
          "The employee profile could not be deactivated.",
        success: null,
      };
    }

    /*
     * Ban future Supabase Auth sign-ins.
     *
     * 876000 hours is approximately 100 years.
     * Reactivation removes this ban.
     */
    const {
      error: banError,
    } =
      await admin.auth.admin.updateUserById(
        employeeId,
        {
          ban_duration: "876000h",
        }
      );

    if (banError) {
      return {
        error:
          "The employee was deactivated in Lipsey Time, but the login ban could not be applied. The employee remains blocked from QR activity, but the Auth account needs review.",
        success: null,
      };
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/employees");
    revalidatePath(
      `/dashboard/employees/${employeeId}`
    );

    return {
      error: null,
      success:
        `${employee.full_name} has been deactivated.`,
    };
  }

  /*
   * ==================================================
   * REACTIVATE
   * ==================================================
   */

  if (employee.active) {
    return {
      error: null,
      success:
        `${employee.full_name} is already active.`,
    };
  }

  /*
   * Remove Supabase Auth ban.
   */
  const {
    error: unbanError,
  } =
    await admin.auth.admin.updateUserById(
      employeeId,
      {
        ban_duration: "none",
      }
    );

  if (unbanError) {
    return {
      error:
        "The employee login could not be reactivated.",
      success: null,
    };
  }

  /*
   * Restore application access.
   */
  const {
    error: profileActivateError,
  } = await admin
    .from("profiles")
    .update({
      active: true,
    })
    .eq("id", employeeId);

  if (profileActivateError) {
    /*
     * Attempt to restore the ban if the database
     * update unexpectedly failed.
     */
    await admin.auth.admin.updateUserById(
      employeeId,
      {
        ban_duration: "876000h",
      }
    );

    return {
      error:
        "The employee profile could not be reactivated.",
      success: null,
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/employees");
  revalidatePath(
    `/dashboard/employees/${employeeId}`
  );

  return {
    error: null,
    success:
      `${employee.full_name} has been reactivated.`,
  };
}