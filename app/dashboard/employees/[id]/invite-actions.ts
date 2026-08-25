"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type EmployeeInviteState = {
  error: string | null;
  success: string | null;
};

export async function resendEmployeeInvite(
  previousState: EmployeeInviteState,
  formData: FormData
): Promise<EmployeeInviteState> {
  const employeeId = String(
    formData.get("employee_id") ?? ""
  ).trim();

  if (!employeeId) {
    return {
      error: "Employee ID is missing.",
      success: null,
    };
  }

  /*
   * STEP 1
   * Verify the person making this request.
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

  /*
   * STEP 2
   * Verify that the logged-in person is an
   * active administrator.
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
      success: null,
    };
  }

  /*
   * STEP 3
   * Now create the elevated server-only client.
   */
  const admin = createAdminClient();

  /*
   * Verify the employee profile exists.
   */
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
   * Do not send setup invitations to inactive
   * employee accounts.
   */
  if (!employee.active) {
    return {
      error:
        "Reactivate this employee before sending an account setup email.",
      success: null,
    };
  }

  /*
   * STEP 4
   * Retrieve the matching Supabase Auth user.
   *
   * profiles.id and auth.users.id are the same ID.
   */
  const {
    data: authUserResult,
    error: authUserError,
  } =
    await admin.auth.admin.getUserById(
      employeeId
    );

  if (
    authUserError ||
    !authUserResult.user
  ) {
    return {
      error:
        "The employee's login account could not be found.",
      success: null,
    };
  }

  const authUser =
    authUserResult.user;

  const employeeEmail =
    authUser.email;

  if (!employeeEmail) {
    return {
      error:
        "This employee does not have an email address associated with their login.",
      success: null,
    };
  }

  /*
   * STEP 5
   *
   * If email_confirmed_at exists, the employee has
   * already completed the invitation/confirmation
   * portion of account setup.
   *
   * Do not try to invite a confirmed account again.
   */
  if (authUser.email_confirmed_at) {
    return {
      error:
        "This employee has already completed account setup. A new invitation is not needed.",
      success: null,
    };
  }

  /*
   * STEP 6
   * Send a fresh invitation.
   *
   * Supabase will use the Invite User email template
   * configured in the project.
   */
  const {
    error: inviteError,
  } =
    await admin.auth.admin.inviteUserByEmail(
      employeeEmail,
      {
        data: {
          full_name:
            employee.full_name,
        },
      }
    );

  if (inviteError) {
    return {
      error:
        inviteError.message ??
        "The invitation could not be sent.",
      success: null,
    };
  }

  return {
    error: null,
    success:
      `A new account setup email was sent to ${employeeEmail}.`,
  };
}