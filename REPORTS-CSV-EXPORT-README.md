# Lipsey Time — Reports CSV Export (Phase 3.5)

Adds:

- `app/dashboard/reports/_lib/load-report.ts`
- `app/dashboard/reports/export/route.ts`
- replaces `app/dashboard/reports/page.tsx`

Features:

- Employee Labor CSV export
- Job Labor CSV export
- Uses the same report loader/calculation engine as the page
- Respects current Central-Time report date range
- UTF-8 BOM for Excel compatibility
- Spreadsheet formula-injection protection for text cells
- Admin-only
- No database migration
- No npm dependency

Expected download names:

- `lipsey-employee-labor-YYYY-MM-DD-to-YYYY-MM-DD.csv`
- `lipsey-job-labor-YYYY-MM-DD-to-YYYY-MM-DD.csv`
