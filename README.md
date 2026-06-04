# Auric Iron Matrix

Internal heavy-equipment valuation engine for oil and gas and mining
distressed-asset work. For each equipment class it holds data points (asking,
auction, private sold, SISP, own close), normalizes them to a class reference,
and outputs three value premises in CAD: FLV, OLV, FMV. It is used to qualify
distressed files and produce a defensible day-one base band.

This is the production build of the `reference_ui.html` prototype: a real
multi-user app with a shared Postgres database, scheduled ingestion of verified
public auction sales, and a backtest that reports the model's own error.

## What it does

- **Valuation engine** (`src/lib/valuation/`): a pure, deterministic port of the
  prototype's math. Each point is converted to CAD, scaled to the class
  reference rating, normalized by dividing out its own hours/condition/
  packaging/config multipliers, then rescaled to an FMV estimate by source type
  (asking x0.85, auction x1.43, sold/own x1.0). Class FMV is the recency- and
  quality-weighted mean; OLV = FMV x0.70, FLV = FMV x0.55. Confidence is None /
  Indicative / Medium / High and never exceeds Indicative on asking-only data.
- **Five-tab UI** (`src/app`, `src/components`): Matrix, Valuate Unit, Add Data
  Point, Assumptions / FX, Method.
- **Ingestion** (`scripts/ingest/`): a JSON import endpoint plus a scheduled
  GovPlanet pull that normalizes each lot with the Claude API into the schema.
- **Backtest** (`src/lib/valuation/backtest.ts`): leave-one-out on verified sold
  points, reporting median absolute percent error.

## Honest model state

The seed holds real asking signals on two classes (CAT G3516, CAT 793) and
nothing fabricated. It contains zero verified sold prices out of the box, so it
cannot yet state its own error, and every band reads Indicative until verified
sold or auction data is added and the model is validated against it. Not a
certified appraisal. The FLV ratio and the asking-to-FMV factor are uncalibrated
assumptions, flagged as such in the UI.

## Stack

Next.js (App Router, TypeScript) on Vercel, Supabase (Postgres + Auth),
GitHub Actions for scheduled ingestion, Claude API (Haiku) for normalizing messy
listing text. The valuation engine is a standalone module shared by the API and
the backtest script.

The server talks to Postgres directly via `DATABASE_URL` (the same code path runs
against local Postgres in dev and the Supabase pooler in prod); Supabase JS is
used for auth.

## Deploy (zero cost)

Everything runs on free tiers: Vercel (Hobby) + Supabase (free) + GitHub Actions.
The only metered cost is the Claude API for the research agent and ingestion
(small, pay-per-use). Full detail in DEPLOY.md; the short path:

1. **Supabase (free):** create a project. Either add the **Supabase integration**
   from the Vercel marketplace (it provisions the DB and injects env vars), or
   create it manually and copy the URL + anon key + service-role key + the
   pooler `DATABASE_URL`.
2. **Schema + seed:** with `DATABASE_URL` pointed at the project, run
   `npm run db:migrate && npm run db:seed`.
3. **Vercel:** import this repo (set the production branch to your working
   branch), and set env vars:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (pooler), `INGEST_API_TOKEN`,
   and `ANTHROPIC_API_KEY` (required for the Research Asset tab).
4. **Auth:** in Supabase, disable public sign-ups and add your team under
   Authentication > Users.
5. Deploy. Open the app, sign in, and run an asset through **Research Asset**.

Note: the research agent is tuned to finish inside Vercel Hobby's 60s function
limit; very heavy research may need Vercel Pro (300s).

## Develop locally

```bash
npm install
# Point DATABASE_URL at a local Postgres (see .env.example)
npm run db:migrate
npm run db:seed
npm run dev          # http://localhost:3000
```

Without Supabase env vars the app runs unauthenticated against the local DB.
With them set it enforces team auth. See DEPLOY.md.

## Commands

| Command | Purpose |
| --- | --- |
| `npm test` | Run the Vitest suite (engine, backtest, ingestion) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Production build |
| `npm run db:migrate` | Apply SQL migrations |
| `npm run db:seed` | Load `seed_data.json` (`-- --reset` restores the sourced seed) |
| `npm run backtest` | Leave-one-out backtest against the DB |
| `npm run ingest:govplanet` | Run the auction ingestion (needs APP_URL + keys) |

## Tests

The engine suite reproduces the prototype's exact numbers as golden masters:
G3516 FMV 166,965 / OLV 116,876 / FLV 91,831 and CAT 793 FMV 1,257,966 /
OLV 880,577 / FLV 691,882, both Indicative. Recency is evaluated against an
explicit `asOf` (default now) so output is deterministic and backtests reproduce.
