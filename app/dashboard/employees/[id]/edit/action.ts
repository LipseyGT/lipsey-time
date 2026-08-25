"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type EditEmployeeState = {
  error: string | null;
};

export async function editEmployee(
  previousState: EditEmployeeState,
  formData: FormData
): Promise<EditEmployeeState> {
  const employeeId = String(
    formData.get("employee_id") ?? ""
  ).trim();

  const fullName = String(
    formData.get("full_name") ?? ""
  ).trim();

  const employeeNumber = String(
    formData.get("employee_number") ?? ""
  ).trim();

  if (!employeeId) {
    return {
      error: "Employee ID is missing.",
    };
  }

  if (!fullName) {
    return {
      error: "Employee name is required.",
    };
  }

  if (fullName.length > 100) {
    return {
      error: "Employee name is too long.",
    };
  }

  if (!employeeNumber) {
    return {
      error: "Employee number is required.",
    };
  }

  if (employeeNumber.length > 50) {
    return {
      error: "Employee number is too long.",
    };
  }

  /*
   * Verify who is making this request.
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
    };
  }

  /*
   * Verify that the logged-in user is
   * actually an active administrator.
   */
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
    };
  }

  /*
   * Now that authorization has been verified,
   * create the elevated server-only client.
   */
  const admin = createAdminClient();

  /*
   * Make sure the employee actually exists.
   */
  const {
    data: existingEmployee,
    error: employeeLookupError,
  } = await admin
    .from("profiles")
    .select("id")
    .eq("id", employeeId)
    .maybeSingle();

  if (employeeLookupError) {
    return {
      error:
        "The employee record could not be checked.",
    };
  }

  if (!existingEmployee) {
    return {
      error:
        "The employee could not be found.",
    };
  }

  /*
   * Make sure another employee is not already
   * using the requested employee number.
   */
  const {
    data: duplicateEmployeeNumber,
    error: duplicateCheckError,
  } = await admin
    .from("profiles")
    .select("id")
    .eq("employee_number", employeeNumber)
    .neq("id", employeeId)
    .maybeSingle();

  if (duplicateCheckError) {
    return {
      error:
        "The employee number could not be checked.",
    };
  }

  if (duplicateEmployeeNumber) {
    return {
      error:
        "That employee number is already assigned to another employee.",
    };
  }

  /*
   * Update only the fields handled by Phase 2.9B.
   *
   * Role, active status, email, and authentication
   * information are deliberately left untouched.
   */
  const {
    error: updateError,
  } = await admin
    .from("profiles")
    .update({
      full_name: fullName,
      employee_number: employeeNumber,
    })
    .eq("id", employeeId);

  if (updateError) {
    return {
      error:
        updateError.message ??
        "The employee could not be updated.",
    };
  }

  /*
   * Tell Next.js that pages containing employee
   * data should be refreshed.
   */
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/employees");
  revalidatePath(
    `/dashboard/employees/${employeeId}`
  );

  /*
   * Return to the employee's detail page.
   */
  redirect(
    `/dashboard/employees/${employeeId}`
  );
}