# McCord Investments - Time to Power

Power for Canadian builds, sourced globally and placed in Canada, faster than the
grid queue. The site has two surfaces: a **public wedge** and an **internal desk**.

## Public: Time to Power (`/`)

The buyer-facing front door. A developer or data centre operator gives the
minimum a serious enquiry needs (MW, province, when, power type, gas on site) and
gets an indicative, engine-backed read:

- **The grid gap they face**, stated honestly per province (verified facts as of
  mid-2026, sourced; Ontario stays general because no firm queue number is
  published).
- **Options to fit the stage**: a fast Bridge option and a permanent Prime
  option, each with **equipment-to-pad weeks** (the slice of the path McCord
  controls) and a **hard-rounded delivered band**. Every figure is Indicative.
- **The annoying details, already handled**: customs, HS, heavy-haul, permits,
  port, FX. The moat, made visible.
- A **principal handoff**: a structured enquiry goes straight to a principal.

It runs entirely client side on the transport engine, so it needs no API key and
costs nothing, and it imports **no internal data**, so supply and sources can
never reach the public bundle. It never shows a source or a precise number.

## Internal: the desk (`/desk`)

Sourcing, Transport, and the protected Supply registry. **Protect this route in
deployment** (Vercel Deployment Protection); it reads internal data.

- **Sourcing** - build a project's equipment universe, then hunt the live market
  for available used units, nearest first, each with a source link (Claude API).
- **Transport** - the delivered-cost and time-to-site estimator, two-tier output
  (coarse buyer band, full internal stack on request). Faithful TypeScript port
  of `transport_estimator.py` (v2); reference in `docs/transport/`.
- **Supply** - the protected registry of real units you can source. Grow it as
  you go by editing `src/lib/supply/registry.json` (version controlled, no
  database yet). Run any unit through the transport engine to a province. Origin
  and source notes stay internal and never reach the public wedge.

## Stack

Next.js (App Router, TypeScript) on Vercel. The transport and wedge engines are
pure TypeScript (no API, no cost). The internal Sourcing tools use the Claude
API: a demand-universe generator and a geo-tiered supply hunt with web search.
No database required yet.

## Run it

- `npm install`
- `npm run dev` then open http://localhost:3000 (public wedge) and
  http://localhost:3000/desk (internal desk).
- `npm test` runs the unit tests; `npm run build` for production.
- The internal Sourcing tabs need `ANTHROPIC_API_KEY` (see `.env.example`). The
  public wedge and the Transport engine do not.

## Deploy (Vercel)

Import the repo, deploy. Set `ANTHROPIC_API_KEY` if you use the Sourcing tabs.
Turn on Vercel Authentication (Settings -> Deployment Protection) and scope it so
**`/desk` is protected** while `/` stays public.

## Layout

- `src/app/page.tsx` - public Time to Power wedge.
- `src/app/desk/page.tsx` - internal desk (reads the supply registry server side).
- `src/components/TimeToPower.tsx` - the public wedge UI.
- `src/components/AppShell.tsx` - internal Sourcing / Transport / Supply tabs.
- `src/lib/wedge/plan.ts` - inputs to engine-backed options (the read).
- `src/lib/market/context.json` - verified, dated province grid-gap facts.
- `src/lib/transport/engine.ts` - the delivered-cost engine (pure, no API).
- `src/lib/transport/rates.json` - editable, versioned rate tables.
- `src/lib/supply/registry.json` - the protected supply registry (internal only).
- `src/lib/sourcing/*` - the Claude-API demand and supply engines.
- `docs/transport/` - the reference spec and Python prototype.
