# Lipsey Time — Jobs Module

This package adds the admin Jobs management screens for the existing Lipsey Time Next.js app.

## Included routes

- `/protected/jobs` — searchable/filterable Jobs list
- `/protected/jobs/new` — create a job
- `/protected/jobs/[id]` — job detail + labor summary/activity
- `/protected/jobs/[id]/edit` — edit or activate/deactivate a job

## Existing database objects used

- `public.jobs`
- `public.job_sessions`
- `public.profiles`

No new table is created by this package. The live Supabase project already has the required admin INSERT/UPDATE policies on `public.jobs` and indexes for the Jobs/Shifts job-session lookup paths.

## Install

From the root of the Lipsey Time repository, copy the included `app/protected/jobs` folder to:

`app/protected/jobs`

The module expects the existing server client at:

`@/lib/supabase/server`

and uses the existing `profiles.role = 'admin'` authorization model.

## Test

From PowerShell in the project root:

```powershell
npm.cmd run build
npm.cmd run dev
```

Then open:

`http://localhost:3000/protected/jobs`

Test in this order:

1. Confirm Jobs 267–271 appear.
2. Open Job 267 and confirm the detail page renders.
3. Create a temporary job.
4. Edit the temporary job.
5. Deactivate it and confirm it moves to Inactive.
6. Reactivate it.

Jobs are intentionally deactivated rather than deleted so historical `job_sessions` remain intact.
