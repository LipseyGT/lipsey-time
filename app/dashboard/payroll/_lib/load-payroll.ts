import {
  buildPayroll,
  payrollWeeks,
  type PayrollData,
} from "./payroll";
import type {
  ProfileRow,
  ShiftRow,
} from "../../reports/_lib/report";

const PAGE_SIZE = 1000;

async function fetchAllShifts(
  supabase: any,
  startIso: string,
  endIso: string,
) {
  const rows: ShiftRow[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("shifts")
      .select("id, user_id, clock_in, clock_out")
      .lt("clock_in", endIso)
      .or(`clock_out.is.null,clock_out.gte.${startIso}`)
      .order("clock_in", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Unable to load payroll shifts: ${error.message}`);
    }

    const batch = (data ?? []) as ShiftRow[];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) break;
  }

  return rows;
}

export async function loadPayrollData({
  supabase,
  from,
  to,
}: {
  supabase: any;
  from: string;
  to: string;
}): Promise<PayrollData> {
  const weeks = payrollWeeks(from, to);
  const start = weeks[0]?.start;
  const endExclusive = weeks.at(-1)?.endExclusive;

  if (!start || !endExclusive) {
    return {
      employees: [],
      summary: {
        employeeCount: 0,
        regularHours: 0,
        overtimeHours: 0,
        totalHours: 0,
        incompleteShifts: 0,
      },
    };
  }

  const [
    { data: profilesData, error: profilesError },
    shifts,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, employee_number, full_name, role, active")
      .order("full_name"),
    fetchAllShifts(
      supabase,
      start.toISOString(),
      endExclusive.toISOString(),
    ),
  ]);

  if (profilesError) {
    throw new Error(
      `Unable to load payroll employees: ${profilesError.message}`,
    );
  }

  return buildPayroll({
    profiles: (profilesData ?? []) as ProfileRow[],
    shifts,
    from,
    to,
  });
}
