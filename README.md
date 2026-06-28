# Auric Axis - Equipment Sourcing

A focused tool for sourcing heavy equipment for mine restarts and expansions.
Two tabs:

## Sourcing

1. **Build the equipment universe** - describe a mine/restart (name, location,
   scope) and it produces the complete equipment list the project needs: plant,
   mobile fleet, power, dewatering, support.
2. **Hunt the live market** - for any line (or the whole universe at once), it
   searches the web for real available used/rebuilt units, **nearest the site
   first**, each with a source link, deduped and sorted local to international.

The output is the map; you work the reps and win the spread.

## Transport

Delivered-cost and time-to-site estimator for moving 60 Hz generation iron from
a global source into a Canadian build. Given a unit (class, origin, value,
weights) and a destination province, it returns a **two-tier** result:

- a **buyer view**, a deliberately coarse logistics band plus weeks-to-site,
  rounded hard so a buyer cannot back into your margin, and
- an **internal cost stack** on request, the real landed logistics number plus
  the recoverable tax line, for building your quote.

The engine is a faithful TypeScript port of the `transport_estimator.py`
prototype (v2). It is **pure and deterministic**: it runs in the browser, so it
needs no API key, has no rate limit, and costs nothing. It never invents a
number, every figure falls out of the unit, the corridor, and the editable rate
tables. The reference spec and prototype live in `docs/transport/`.

## Stack

Next.js (App Router, TypeScript) on Vercel. The Claude API does the work: a
demand-universe generator (Sonnet) and a geo-tiered supply hunt with web search
(Haiku, for low cost). No database required.

## Run it

- Set `ANTHROPIC_API_KEY` (see `.env.example`). That's the only requirement.
- `npm install`
- `npm run dev` then open http://localhost:3000
- `npm test` runs the unit tests; `npm run build` for production.

## Deploy (Vercel)

Import the repo, set `ANTHROPIC_API_KEY` in Environment Variables, deploy. The
app needs no database. Optionally turn on Vercel Authentication (Settings ->
Deployment Protection) so only your team can open it.

## Cost

Supply runs on Claude Haiku with web search: roughly **$0.08-0.15 per equipment
line** searched. A full ~30-line universe is a few dollars. Anthropic credit is
prepaid, so spend is hard-capped. Override the model with `SUPPLY_MODEL` /
`RESEARCH_MODEL`.

## Layout

- `src/components/AppShell.tsx` - header plus the Sourcing / Transport tabs.
- `src/components/SourcingApp.tsx` - the sourcing UI.
- `src/components/TransportApp.tsx` - the transport calculator UI.
- `src/lib/sourcing/demand.ts` - equipment-universe generator.
- `src/lib/sourcing/supply.ts` - geo-tiered supply hunt.
- `src/lib/sourcing/parse.ts` - tolerant JSON extraction.
- `src/app/api/sourcing/{universe,find}` - the two endpoints.
- `src/lib/transport/engine.ts` - the delivered-cost engine (pure, no API).
- `src/lib/transport/rates.json` - editable, versioned rate tables.
- `src/lib/transport/schema.ts` - transport types and zod schemas.
- `docs/transport/` - the reference spec and Python prototype.
