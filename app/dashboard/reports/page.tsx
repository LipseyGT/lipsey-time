import Link from "next/link";
import { requireReportsAdmin } from "./_lib/access";
import { loadReportData } from "./_lib/load-report";
import {
  formatHours,
  formatRangeLabel,
  normalizeReportRange,
} from "./_lib/report";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const { from, to } = normalizeReportRange(params.from, params.to);
  const { supabase } = await requireReportsAdmin();

  const report = await loadReportData({
    supabase,
    from,
    to,
  });

  const directPercent =
    report.summary.jobHours > 0
      ? (report.summary.directHours / report.summary.jobHours) * 100
      : 0;

  const employeeExportHref =
    `/dashboard/reports/export?type=employees&from=${encodeURIComponent(from)}` +
    `&to=${encodeURIComponent(to)}`;

  const jobExportHref =
    `/dashboard/reports/export?type=jobs&from=${encodeURIComponent(from)}` +
    `&to=${encodeURIComponent(to)}`;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <header className="space-y-2">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Employee and job labor reporting from recorded shifts and job
            sessions. Report boundaries use Central Time.
          </p>
        </div>
      </header>

      <section className="rounded-lg border border-border bg-card p-5">
        <form
          method="get"
          className="flex flex-col gap-4 md:flex-row md:items-end"
        >
          <label className="grid gap-1.5 text-sm font-medium">
            From
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            To
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>

          <button
            type="submit"
            className="h-10 rounded-md bg-foreground px-5 text-sm font-semibold text-background"
          >
            Run Report
          </button>

          <div className="text-sm text-muted-foreground md:ml-auto md:pb-2">
            {formatRangeLabel(from, to)}
          </div>
        </form>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-5">
          <Link
            href={employeeExportHref}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Export Employee CSV
          </Link>

          <Link
            href={jobExportHref}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Export Job CSV
          </Link>

          <p className="basis-full text-xs text-muted-foreground">
            Exports use the currently selected report dates.
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Employee Hours"
          value={`${formatHours(report.summary.shiftHours)} hrs`}
          detail={`${report.summary.employeeCount} employees`}
        />
        <MetricCard
          label="Job Hours"
          value={`${formatHours(report.summary.jobHours)} hrs`}
          detail={`${report.summary.jobCount} jobs`}
        />
        <MetricCard
          label="Unallocated"
          value={`${formatHours(report.summary.unallocatedHours)} hrs`}
          detail="Shift time not assigned to a job"
        />
        <MetricCard
          label="Incomplete Shifts"
          value={String(report.summary.incompleteShifts)}
          detail="Open shifts in this report period"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <MetricCard
          label="Direct Labor"
          value={`${formatHours(report.summary.directHours)} hrs`}
          detail={`${directPercent.toFixed(1)}% of assigned job hours`}
        />
        <MetricCard
          label="Indirect Labor"
          value={`${formatHours(report.summary.indirectHours)} hrs`}
          detail="Assigned to indirect jobs"
        />
        <MetricCard
          label="Assigned vs Shift"
          value={
            report.summary.shiftHours > 0
              ? `${(
                  (report.summary.jobHours / report.summary.shiftHours) *
                  100
                ).toFixed(1)}%`
              : "0.0%"
          }
          detail="Share of employee time assigned to jobs"
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Employee Labor
          </h2>
          <p className="text-sm text-muted-foreground">
            Shift time, assigned job time, and unallocated time by employee.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-left">
                <tr>
                  <Th>Employee</Th>
                  <Th>Shifts</Th>
                  <Th>Shift Hrs</Th>
                  <Th>Job Hrs</Th>
                  <Th>Direct</Th>
                  <Th>Indirect</Th>
                  <Th>Unallocated</Th>
                  <Th>Open</Th>
                </tr>
              </thead>
              <tbody>
                {report.employees.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      No employee labor found for this date range.
                    </td>
                  </tr>
                ) : (
                  report.employees.map((employee) => (
                    <tr
                      key={employee.userId}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/employees/${employee.userId}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {employee.fullName}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          #{employee.employeeNumber}
                          {!employee.active ? " · Inactive" : ""}
                        </div>
                      </td>
                      <Td>{employee.shiftCount}</Td>
                      <Td>{formatHours(employee.shiftHours)}</Td>
                      <Td>{formatHours(employee.jobHours)}</Td>
                      <Td>{formatHours(employee.directHours)}</Td>
                      <Td>{formatHours(employee.indirectHours)}</Td>
                      <Td>{formatHours(employee.unallocatedHours)}</Td>
                      <Td>
                        {employee.incompleteShifts > 0 ? (
                          <span className="font-medium">
                            {employee.incompleteShifts}
                          </span>
                        ) : (
                          "—"
                        )}
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Job Labor</h2>
          <p className="text-sm text-muted-foreground">
            Assigned labor by job for the selected period.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-left">
                <tr>
                  <Th>Job</Th>
                  <Th>Category</Th>
                  <Th>Labor Hrs</Th>
                  <Th>Employees</Th>
                  <Th>Sessions</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {report.jobs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      No job labor found for this date range.
                    </td>
                  </tr>
                ) : (
                  report.jobs.map((job) => (
                    <tr
                      key={job.jobId}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/jobs/${job.jobId}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {job.jobNumber}
                        </Link>
                        {job.customer ? (
                          <div className="text-xs text-muted-foreground">
                            {job.customer}
                          </div>
                        ) : null}
                      </td>
                      <Td className="capitalize">{job.category}</Td>
                      <Td>{formatHours(job.laborHours)}</Td>
                      <Td>{job.employeeCount}</Td>
                      <Td>{job.sessionCount}</Td>
                      <Td>{job.active ? "Active" : "Inactive"}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </article>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 font-medium text-muted-foreground">{children}</th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
