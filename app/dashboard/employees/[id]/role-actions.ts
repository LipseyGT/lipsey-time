"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type EmployeeRoleState = {
  error: string | null;
  success: string | null;
};

export async function changeEmployeeRole(
  previousState: EmployeeRoleState,
  formData: FormData
): Promise<EmployeeRoleState> {
  const employeeId = String(
    formData.get("employee_id") ?? ""
  ).trim();

  const requestedRole = String(
    formData.get("role") ?? ""
  ).trim();

  if (!employeeId) {
    return {
      error: "Employee ID is missing.",
      success: null,
    };
  }

  if (
    requestedRole !== "employee" &&
    requestedRole !== "admin"
  ) {
    return {
      error: "Invalid employee role.",
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
   * Do not allow administrators to modify
   * their own role from this screen.
   */
  if (employeeId === user.id) {
    return {
      error:
        "You cannot change your own administrator role. Another administrator must make that change.",
      success: null,
    };
  }

  /*
   * STEP 2
   * Create elevated server-only client.
   */
  const admin = createAdminClient();

  const {
    data: employee,
    error: employeeError,
  } = await admin
    .from("profiles")
    .select(
      "id, full_name, role, active"
    )
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
   * Nothing needs to change.
   */
  if (employee.role === requestedRole) {
    return {
      error: null,
      success:
        `${employee.full_name} already has that role.`,
    };
  }

  /*
   * Do not promote inactive accounts.
   *
   * Reactivate them first so we do not end up with
   * inactive administrator accounts.
   */
  if (
    requestedRole === "admin" &&
    !employee.active
  ) {
    return {
      error:
        "Reactivate this employee before promoting them to Administrator.",
      success: null,
    };
  }

  /*
   * LAST ADMIN SAFEGUARD
   *
   * If we are demoting an active administrator,
   * make sure at least one OTHER active
   * administrator will remain.
   */
  if (
    employee.role === "admin" &&
    requestedRole === "employee" &&
    employee.active
  ) {
    const {
      count: activeAdminCount,
      error: adminCountError,
    } = await admin
      .from("profiles")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("role", "admin")
      .eq("active", true);

    if (adminCountError) {
      return {
        error:
          "The administrator count could not be verified.",
        success: null,
      };
    }

    if (
      activeAdminCount === null ||
      activeAdminCount <= 1
    ) {
      return {
        error:
          "This administrator cannot be demoted because Lipsey Time must always have at least one active administrator.",
        success: null,
      };
    }
  }

  /*
   * Update the employee role.
   */
  const {
    error: updateError,
  } = await admin
    .from("profiles")
    .update({
      role: requestedRole,
    })
    .eq("id", employeeId);

  if (updateError) {
    return {
      error:
        updateError.message ??
        "The employee role could not be updated.",
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
      requestedRole === "admin"
        ? `${employee.full_name} is now an Administrator.`
        : `${employee.full_name} is now an Employee.`,
  };
}