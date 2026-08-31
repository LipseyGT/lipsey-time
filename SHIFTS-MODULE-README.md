# Lipsey Time — Shifts Module

Install this folder into the root of the `lipsey-time` project.

Creates:

- `app/dashboard/shifts/page.tsx`
- `app/dashboard/shifts/_lib/access.ts`
- `app/dashboard/shifts/_components/auto-refresh.tsx`

This module is read-only. Corrections link to the existing Timesheets shift editor.

No database migration is required for this version. It uses the existing:

- `shifts`
- `job_sessions`
- `profiles`
- `jobs`

The page is admin-only and refreshes every 60 seconds.
