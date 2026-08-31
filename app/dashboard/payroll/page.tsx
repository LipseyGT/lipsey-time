import Link from "next/link";
import { requireReportsAdmin } from "../reports/_lib/access";
import {
  formatRangeLabel,
} from "../reports/_lib/report";
import { loadPayrollData } from "./_lib/load-payroll";
import {
  formatPayrollHours,
  normalizePayrollRange,
  OVERTIME_THRESHOLD_HOURS,
} from "./_lib/payroll";

export const dynamic = "force-dynamic";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const { from, to } = normalizePayrollRange(
    params.from,
    params.to,
  );

  const { supabase } = await requireReportsAdmin();

  const payroll = await loadPayrollData({
    supabase,
    from,
    to,
  });

  const exportHref =
    `/dashboard/payroll/export?from=${encodeURIComponent(from)}` +
    `&to=${encodeURIComponent(to)}`;

  const hasIncomplete =
    payroll.summary.incompleteShifts > 0;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          Payroll
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Monday–Sunday payroll summary. The first{" "}
          {OVERTIME_THRESHOLD_HOURS} hours in each workweek are
          regular time; hours beyond that are overtime.
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card p-5">
        <form
          method="get"
          className="flex flex-col gap-4 md:flex-row md:items-end"
        >
          <label className="grid gap-1.5 text-sm font-medium">
            Pay Period From
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
            <span className="text-xs font-normal text-muted-foreground">
              Adjusted to Monday when necessary
            </span>
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            Pay Period To
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
            <span className="text-xs font-normal text-muted-foreground">
              Adjusted to Sunday when necessary
            </span>
          </label>

          <button
            type="submit"
            className="h-10 rounded-md bg-foreground px-5 text-sm font-semibold text-background md:mb-[20px]"
          >
            Run Payroll
          </button>

          <div className="text-sm text-muted-foreground md:ml-auto md:pb-7">
            {formatRangeLabel(from, to)}
          </div>
        </form>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-5">
          <Link
            href={exportHref}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Export Payroll CSV
          </Link>

          <span className="text-xs text-muted-foreground">
            CSV uses this exact pay period and weekly overtime rules.
          </span>
        </div>
      </section>

      {hasIncomplete ? (
        <section className="rounded-lg border border-destructive/40 bg-destructive/5 p-5">
          <div className="font-semibold">
            Payroll contains incomplete shifts
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {payroll.summary.incompleteShifts} open shift
            {payroll.summary.incompleteShifts === 1 ? "" : "s"} overlap
            this pay period. Current totals are preliminary until those
            shifts are closed or corrected.
          </p>
          <Link
            href="/dashboard/timesheets"
            className="mt-3 inline-block text-sm font-medium underline underline-offset-4"
          >
            Review Timesheets
          </Link>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Hours"
          value={`${formatPayrollHours(payroll.summary.totalHours)} hrs`}
          detail={`${payroll.summary.employeeCount} employees`}
        />
        <MetricCard
          label="Regular Hours"
          value={`${formatPayrollHours(payroll.summary.regularHours)} hrs`}
          detail={`Up to ${OVERTIME_THRESHOLD_HOURS} hrs per workweek`}
        />
        <MetricCard
          label="Overtime Hours"
          value={`${formatPayrollHours(payroll.summary.overtimeHours)} hrs`}
          detail={`Hours above ${OVERTIME_THRESHOLD_HOURS} per workweek`}
        />
        <MetricCard
          label="Incomplete Shifts"
          value={String(payroll.summary.incompleteShifts)}
          detail="Open shifts overlapping this period"
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Employee Payroll Summary
          </h2>
          <p className="text-sm text-muted-foreground">
            Overtime is calculated independently for every
            Monday–Sunday workweek in the selected pay period.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-left">
                <tr>
                  <Th>Employee</Th>
                  <Th>Regular Hrs</Th>
                  <Th>OT Hrs</Th>
                  <Th>Total Hrs</Th>
                  <Th>Incomplete</Th>
                </tr>
              </thead>
              <tbody>
                {payroll.employees.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      No payroll hours found for this pay period.
                    </td>
                  </tr>
                ) : (
                  payroll.employees.map((employee) => (
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
                      <Td>
                        {formatPayrollHours(employee.regularHours)}
                      </Td>
                      <Td>
                        {employee.overtimeHours > 0 ? (
                          <span className="font-semibold">
                            {formatPayrollHours(
                              employee.overtimeHours,
                            )}
                          </span>
                        ) : (
                          "0.00"
                        )}
                      </Td>
                      <Td>
                        {formatPayrollHours(employee.totalHours)}
                      </Td>
                      <Td>
                        {employee.incompleteShifts || "—"}
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {payroll.employees.some(
        (employee) => employee.weeks.length > 1,
      ) ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Weekly Overtime Detail
            </h2>
            <p className="text-sm text-muted-foreground">
              Use this section to audit how regular and overtime
              hours were split across multi-week pay periods.
            </p>
          </div>

          <div className="space-y-4">
            {payroll.employees.map((employee) => (
              <article
                key={employee.userId}
                className="rounded-lg border border-border bg-card p-5"
              >
                <div className="font-semibold">
                  {employee.fullName}
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="text-left text-muted-foreground">
                      <tr>
                        <Th>Workweek</Th>
                        <Th>Total</Th>
                        <Th>Regular</Th>
                        <Th>OT</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {employee.weeks.map((week) => (
                        <tr
                          key={week.weekStart}
                          className="border-t border-border"
                        >
                          <Td>
                            {formatRangeLabel(
                              week.weekStart,
                              week.weekEnd,
                            )}
                          </Td>
                          <Td>
                            {formatPayrollHours(week.shiftHours)}
                          </Td>
                          <Td>
                            {formatPayrollHours(
                              week.regularHours,
                            )}
                          </Td>
                          <Td>
                            {formatPayrollHours(
                              week.overtimeHours,
                            )}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
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
      <div className="text-sm font-medium text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {detail}
      </div>
    </article>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 font-medium text-muted-foreground">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3">{children}</td>;
}
