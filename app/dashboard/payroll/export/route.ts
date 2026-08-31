import { NextRequest, NextResponse } from "next/server";
import { requireReportsAdmin } from "../../reports/_lib/access";
import {
  formatRangeLabel,
} from "../../reports/_lib/report";
import { loadPayrollData } from "../_lib/load-payroll";
import {
  formatPayrollHours,
  normalizePayrollRange,
  OVERTIME_THRESHOLD_HOURS,
} from "../_lib/payroll";

export const dynamic = "force-dynamic";

function csvCell(
  value: string | number | boolean | null | undefined,
) {
  let text = value == null ? "" : String(value);

  if (/^\s*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(
  values: Array<
    string | number | boolean | null | undefined
  >,
) {
  return values.map(csvCell).join(",");
}

function csvResponse(csv: string, filename: string) {
  return new NextResponse(`\uFEFF${csv}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(request: NextRequest) {
  const { from, to } = normalizePayrollRange(
    request.nextUrl.searchParams.get("from") ?? undefined,
    request.nextUrl.searchParams.get("to") ?? undefined,
  );

  const { supabase } = await requireReportsAdmin();

  const payroll = await loadPayrollData({
    supabase,
    from,
    to,
  });

  const lines = [
    csvRow([
      "Employee Number",
      "Employee",
      "Active",
      "Regular Hours",
      "Overtime Hours",
      "Total Hours",
      "Incomplete Shifts",
      "Pay Period From",
      "Pay Period To",
      "Workweek",
      "OT Threshold",
    ]),
  ];

  for (const employee of payroll.employees) {
    const weekDetail = employee.weeks
      .map(
        (week) =>
          `${formatRangeLabel(
            week.weekStart,
            week.weekEnd,
          )}: ${formatPayrollHours(
            week.shiftHours,
          )} total / ${formatPayrollHours(
            week.regularHours,
          )} regular / ${formatPayrollHours(
            week.overtimeHours,
          )} OT`,
      )
      .join(" | ");

    lines.push(
      csvRow([
        employee.employeeNumber,
        employee.fullName,
        employee.active ? "Yes" : "No",
        formatPayrollHours(employee.regularHours),
        formatPayrollHours(employee.overtimeHours),
        formatPayrollHours(employee.totalHours),
        employee.incompleteShifts,
        from,
        to,
        weekDetail,
        `${OVERTIME_THRESHOLD_HOURS} hours/week`,
      ]),
    );
  }

  return csvResponse(
    lines.join("\r\n"),
    `lipsey-payroll-${from}-to-${to}.csv`,
  );
}
