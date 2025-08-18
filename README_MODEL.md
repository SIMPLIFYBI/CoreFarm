# CoreFarm data model (initial)

Run `supabase/schema.sql` in the Supabase SQL Editor.

Tables
- holes: drill hole records
- tasks: catalog of possible tasks
- hole_tasks: tasks required per hole with status and optional assignee
- activity: actions for productivity metrics

Notes
- RLS is basic to start; will refine per roles (admin vs user) later.
- Consider a `profiles` table (user metadata) and `orgs`/`memberships` for multi-tenant in future.
