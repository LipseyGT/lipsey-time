# Lipsey Time — Reports Module (Phase 3.1–3.4)

Creates:

- `app/dashboard/reports/page.tsx`
- `app/dashboard/reports/_lib/access.ts`
- `app/dashboard/reports/_lib/report.ts`

Features:

- Admin-only Reports dashboard
- Central-Time date-range filtering
- Employee labor summary
- Job labor summary
- Direct vs indirect assigned labor
- Unallocated time
- Incomplete/open-shift count
- Correct clipping of shift/job time to the requested date range
- Paged retrieval for shifts and job sessions

No database migration and no npm package are required.

Suggested sidebar addition:

```tsx
<Link
  href="/dashboard/reports"
  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
>
  <BarChart3 className="h-4 w-4" />
  Reports
</Link>
```

Import `BarChart3` from `lucide-react` in the existing dashboard layout.
