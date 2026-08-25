"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AddEmployeeState = {
  error: string | null;
};

export async function addEmployee(
  previousState: AddEmployeeState,
  formData: FormData
): Promise<AddEmployeeState> {
  const fullName = String(
    formData.get("full_name") ?? ""
  ).trim();

  const employeeNumber = String(
    formData.get("employee_number") ?? ""
  ).trim();

  const email = String(
    formData.get("email") ?? ""
  )
    .trim()
    .toLowerCase();

  const requestedRole = String(
    formData.get("role") ?? "employee"
  );

  const role =
    requestedRole === "admin"
      ? "admin"
      : "employee";

  if (!fullName) {
    return {
      error: "Employee name is required.",
    };
  }

  if (!employeeNumber) {
    return {
      error: "Employee number is required.",
    };
  }

  if (
    !email ||
    !email.includes("@")
  ) {
    return {
      error: "Enter a valid employee email address.",
    };
  }

  /*
   * SECURITY CHECK #1
   *
   * First identify the person making this request
   * using the normal logged-in Supabase client.
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
   * SECURITY CHECK #2
   *
   * Do not trust the fact that somebody reached
   * the dashboard page. Verify their admin role again
   * inside the write operation itself.
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
   * We have now authenticated and authorized
   * the person making the request.
   *
   * Only now do we create the elevated client.
   */
  const admin = createAdminClient();

  /*
   * Check employee number before creating an Auth user.
   */
  const {
    data: existingEmployeeNumber,
    error: numberCheckError,
  } = await admin
    .from("profiles")
    .select("id")
    .eq("employee_number", employeeNumber)
    .maybeSingle();

  if (numberCheckError) {
    return {
      error:
        "The employee number could not be checked.",
    };
  }

  if (existingEmployeeNumber) {
    return {
      error:
        "That employee number is already in use.",
    };
  }

  /*
   * Create the Supabase Auth user and send an invite.
   *
   * Supabase returns the ID that will connect
   * auth.users to public.profiles.
   */
  const {
    data: inviteData,
    error: inviteError,
  } =
    await admin.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          full_name: fullName,
        },
      }
    );

  if (
    inviteError ||
    !inviteData.user
  ) {
    return {
      error:
        inviteError?.message ??
        "The employee invitation could not be created.",
    };
  }

  const newUserId =
    inviteData.user.id;

  /*
   * Create the matching employee profile.
   */
  const {
    error: profileError,
  } = await admin
    .from("profiles")
    .insert({
      id: newUserId,
      employee_number: employeeNumber,
      full_name: fullName,
      role,
      active: true,
    });

  if (profileError) {
    /*
     * The Auth account was created but the profile failed.
     * Roll the Auth user back so we don't leave an orphan
     * account in the system.
     */
    const {
      error: rollbackError,
    } =
      await admin.auth.admin.deleteUser(
        newUserId
      );

    if (rollbackError) {
      return {
        error:
          "The Auth user was created, but the employee profile failed and automatic cleanup also failed. Do not try again yet; this account needs manual review.",
      };
    }

    return {
      error:
        "The employee profile could not be created. The incomplete Auth account was removed.",
    };
  }

  revalidatePath(
    "/dashboard/employees"
  );

  redirect(
    "/dashboard/employees"
  );
}