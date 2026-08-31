import {
  buildReport,
  reportBounds,
  type JobReportRow,
  type JobRow,
  type JobSessionRow,
  type EmployeeReportRow,
  type ProfileRow,
  type ReportSummary,
  type ShiftRow,
} from "./report";

const PAGE_SIZE = 1000;

export type LoadedReport = {
  employees: EmployeeReportRow[];
  jobs: JobReportRow[];
  summary: ReportSummary;
};

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
      throw new Error(`Unable to load shifts: ${error.message}`);
    }

    const batch = (data ?? []) as ShiftRow[];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) break;
  }

  return rows;
}

async function fetchAllSessions(
  supabase: any,
  startIso: string,
  endIso: string,
) {
  const rows: JobSessionRow[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("job_sessions")
      .select("id, shift_id, user_id, job_id, started_at, ended_at")
      .lt("started_at", endIso)
      .or(`ended_at.is.null,ended_at.gte.${startIso}`)
      .order("started_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Unable to load job sessions: ${error.message}`);
    }

    const batch = (data ?? []) as JobSessionRow[];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) break;
  }

  return rows;
}

export async function loadReportData({
  supabase,
  from,
  to,
}: {
  supabase: any;
  from: string;
  to: string;
}): Promise<LoadedReport> {
  const { start, endExclusive } = reportBounds(from, to);

  const [
    { data: profilesData, error: profilesError },
    { data: jobsData, error: jobsError },
    shifts,
    sessions,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, employee_number, full_name, role, active")
      .order("full_name"),
    supabase
      .from("jobs")
      .select("id, job_number, customer, description, category, active")
      .order("job_number"),
    fetchAllShifts(supabase, start.toISOString(), endExclusive.toISOString()),
    fetchAllSessions(
      supabase,
      start.toISOString(),
      endExclusive.toISOString(),
    ),
  ]);

  if (profilesError) {
    throw new Error(`Unable to load employees: ${profilesError.message}`);
  }

  if (jobsError) {
    throw new Error(`Unable to load jobs: ${jobsError.message}`);
  }

  return buildReport({
    profiles: (profilesData ?? []) as ProfileRow[],
    jobs: (jobsData ?? []) as JobRow[],
    shifts,
    sessions,
    rangeStart: start,
    rangeEndExclusive: endExclusive,
  });
}
