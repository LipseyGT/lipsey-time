import { NextRequest, NextResponse } from "next/server";
import { requireReportsAdmin } from "../_lib/access";
import { loadReportData } from "../_lib/load-report";
import {
  formatHours,
  normalizeReportRange,
} from "../_lib/report";

export const dynamic = "force-dynamic";

type ExportType = "employees" | "jobs";

function csvCell(value: string | number | boolean | null | undefined) {
  let text = value == null ? "" : String(value);

  // Prevent spreadsheet formula execution when a text cell begins with
  // a formula-control character.
  if (/^\s*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(values: Array<string | number | boolean | null | undefined>) {
  return values.map(csvCell).join(",");
}

function csvResponse(csv: string, filename: string) {
  // UTF-8 BOM improves Excel compatibility for names/customer text.
  const body = `\uFEFF${csv}`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function employeeCsv(
  report: Awaited<ReturnType<typeof loadReportData>>,
  from: string,
  to: string,
) {
  const lines = [
    csvRow([
      "Employee Number",
      "Employee",
      "Active",
      "Shifts",
      "Shift Hours",
      "Job Hours",
      "Direct Hours",
      "Indirect Hours",
      "Unallocated Hours",
      "Incomplete Shifts",
      "Report From",
      "Report To",
    ]),
  ];

  for (const employee of report.employees) {
    lines.push(
      csvRow([
        employee.employeeNumber,
        employee.fullName,
        employee.active ? "Yes" : "No",
        employee.shiftCount,
        formatHours(employee.shiftHours),
        formatHours(employee.jobHours),
        formatHours(employee.directHours),
        formatHours(employee.indirectHours),
        formatHours(employee.unallocatedHours),
        employee.incompleteShifts,
        from,
        to,
      ]),
    );
  }

  return lines.join("\r\n");
}

function jobCsv(
  report: Awaited<ReturnType<typeof loadReportData>>,
  from: string,
  to: string,
) {
  const lines = [
    csvRow([
      "Job Number",
      "Customer",
      "Category",
      "Active",
      "Labor Hours",
      "Employees",
      "Sessions",
      "Report From",
      "Report To",
    ]),
  ];

  for (const job of report.jobs) {
    lines.push(
      csvRow([
        job.jobNumber,
        job.customer,
        job.category,
        job.active ? "Yes" : "No",
        formatHours(job.laborHours),
        job.employeeCount,
        job.sessionCount,
        from,
        to,
      ]),
    );
  }

  return lines.join("\r\n");
}

export async function GET(request: NextRequest) {
  const typeParam = request.nextUrl.searchParams.get("type");
  const exportType: ExportType =
    typeParam === "jobs" ? "jobs" : "employees";

  const { from, to } = normalizeReportRange(
    request.nextUrl.searchParams.get("from") ?? undefined,
    request.nextUrl.searchParams.get("to") ?? undefined,
  );

  const { supabase } = await requireReportsAdmin();

  const report = await loadReportData({
    supabase,
    from,
    to,
  });

  if (exportType === "jobs") {
    return csvResponse(
      jobCsv(report, from, to),
      `lipsey-job-labor-${from}-to-${to}.csv`,
    );
  }

  return csvResponse(
    employeeCsv(report, from, to),
    `lipsey-employee-labor-${from}-to-${to}.csv`,
  );
}
