# Lipsey Time — Operations Dashboard Overhaul

Creates/replaces:

- `app/dashboard/page.tsx`
- `app/dashboard/_components/auto-refresh.tsx`

Features:

- Live "Working Now" count
- Active jobs count
- Today's total shift hours
- Today's assigned job hours
- Today's unallocated time
- Currently-working employee list with current job
- Current Monday-Sunday payroll snapshot
- Today's top job labor
- Quick links to Shifts, Timesheets, Jobs, QR Codes, Reports, and Payroll
- Central Time
- 60-second auto refresh
- Reuses the existing validated Reports and Payroll calculation engines
- Admin-only through existing Reports access helper
- No database migration
- No new npm dependency
