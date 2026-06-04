# Deploying Auric Iron Matrix

The app is Next.js on Vercel with a Supabase Postgres database and Supabase Auth.
Scheduled ingestion runs in GitHub Actions. This container cannot reach Supabase
or Vercel, so the steps below are run from your own machine / accounts.

## 1. Supabase project

1. Create a Supabase project. Note the project URL and the `anon` and
   `service_role` keys (Project Settings > API).
2. Apply the schema and seed. From a checkout with `DATABASE_URL` pointing at the
   project's direct connection string (Project Settings > Database):

   ```bash
   export DATABASE_URL='postgres://postgres:<password>@db.<ref>.supabase.co:5432/postgres'
   npm ci
   npm run db:migrate     # applies supabase/migrations/0001_init.sql
   npm run db:seed        # loads the 16 classes and the sourced seed points
   ```

   The migration creates the `authenticated`/`anon` roles only if missing, so it
   is safe on Supabase (where they already exist).

3. Auth: disable public sign-ups (Authentication > Providers > Email, turn off
   "Enable sign ups"). Add each team member under Authentication > Users. Single
   shared workspace: every authenticated user sees and edits the same matrix.

## 2. Vercel

1. Import the GitHub repo into Vercel (framework auto-detected as Next.js).
2. Set environment variables (Production and Preview):

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | the service_role key (server only) |
   | `DATABASE_URL` | the **connection pooler** URL (port 6543, `?pgbouncer=true`) |
   | `INGEST_API_TOKEN` | a long random string |

   Use the pooler URL for `DATABASE_URL` on Vercel: serverless functions open
   many short-lived connections and the pooler prevents exhausting Postgres.

3. Deploy. Once Supabase env vars are present, the app enforces auth: every page
   redirects to `/login` and every `/api/*` route returns 401 without a session,
   except `/api/import`, which is guarded by `INGEST_API_TOKEN`.

## 3. Scheduled ingestion (GitHub Actions)

The workflow `.github/workflows/ingest.yml` runs daily. Configure in the repo:

- Secrets: `APP_URL` (the Vercel URL), `INGEST_API_TOKEN` (same value as Vercel),
  `ANTHROPIC_API_KEY`.
- Variables (optional): `INGEST_MODEL` (default `claude-haiku-4-5`),
  `GOVPLANET_RESULTS_URLS` (comma-separated override), `MAX_LOTS` (default 50).

Trigger a manual run with the "Run workflow" button (use the dry-run input first
to see normalized rows without importing). The job fetches GovPlanet results,
normalizes each lot with Claude, and posts mapped rows to `/api/import`.

Note: GovPlanet's live anti-bot posture could not be verified from the build
container. The source is pluggable (`scripts/ingest/sources/`): if the runner is
blocked, swap in another adapter without touching the rest of the pipeline.

## 4. Backtest

Run the backtest from the Matrix tab ("Run backtest") or on a schedule/CLI:

```bash
DATABASE_URL=... npm run backtest
```

It performs leave-one-out on verified sold points per class and stores the
median absolute percent error, which the matrix then displays. Classes without
verified sold data are never scored and never claim an error.
