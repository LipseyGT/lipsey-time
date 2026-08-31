# Lipsey Time — Payroll Module (Phase 3.6)

Creates:

- `app/dashboard/payroll/page.tsx`
- `app/dashboard/payroll/_lib/payroll.ts`
- `app/dashboard/payroll/_lib/load-payroll.ts`
- `app/dashboard/payroll/export/route.ts`

Rules:

- Workweek: Monday through Sunday
- Regular time: first 40.00 hours in each workweek
- Overtime: hours above 40.00 in each workweek
- Payroll periods are normalized to complete Monday-Sunday weeks
- Multi-week pay periods calculate overtime separately per workweek
- Open shifts are included to current time but prominently flagged as incomplete/preliminary
- Hours are based on shifts (attendance), not job-session allocation
- Central Time (`America/Chicago`)
- Admin-only
- CSV export included
- No database migration
- No npm dependency

Sidebar suggestion:

```tsx
<Link
  href="/dashboard/payroll"
  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
>
  <DollarSign className="h-4 w-4" />
  Payroll
</Link>
```

Add `DollarSign` to the existing `lucide-react` import if it is not already imported.
