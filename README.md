# Auric Axis - Equipment Sourcing

A focused tool for sourcing heavy equipment for mine restarts and expansions.

1. **Build the equipment universe** - describe a mine/restart (name, location,
   scope) and it produces the complete equipment list the project needs: plant,
   mobile fleet, power, dewatering, support.
2. **Hunt the live market** - for any line (or the whole universe at once), it
   searches the web for real available used/rebuilt units, **nearest the site
   first**, each with a source link, deduped and sorted local to international.

The output is the map; you work the reps and win the spread.

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

- `src/components/SourcingApp.tsx` - the single-page UI.
- `src/lib/sourcing/demand.ts` - equipment-universe generator.
- `src/lib/sourcing/supply.ts` - geo-tiered supply hunt.
- `src/lib/sourcing/parse.ts` - tolerant JSON extraction.
- `src/app/api/sourcing/{universe,find}` - the two endpoints.
