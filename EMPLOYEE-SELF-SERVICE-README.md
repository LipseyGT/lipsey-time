# Lipsey Time — Employee Self-Service

Creates/replaces:

- `app/employee/page.tsx`
- `app/employee/actions.ts`
- `app/employee/_lib/access.ts`
- `app/employee/_lib/time.ts`
- `app/employee/_components/auto-refresh.tsx`
- `app/protected/page.tsx`

Features:

- Separate employee-facing route: `/employee`
- Read-only
- Uses the logged-in user's existing RLS permissions
- Current clocked-in / clocked-out status
- Current active job
- Today's shift hours
- Today's assigned job hours
- Today's unallocated time
- Five recent completed shifts
- Sign out button
- 30-second auto refresh
- Central Time
- Admins can visit `/employee` for testing and get a link back to `/dashboard`
- `/protected` becomes a role-aware landing route:
  - admin -> `/dashboard`
  - employee -> `/employee`
- QR-login `next=/q/[token]` behavior remains unchanged because this module does not alter the login action.

No database migration.
No new npm package.
