# Auric Iron Matrix - Project Rules

This is a heavy-equipment valuation engine for oil and gas and mining
distressed-asset work. It produces FLV / OLV / FMV bands per equipment class.

## Non-negotiable rules
- Never fabricate data. A class with no data points shows nothing, not a guess.
- Every data point must carry a source string. Reject any point without one.
- Every price carries its own currency. USD converts to CAD at the stored
  rate. Never mix currencies silently.
- The code does only what it claims. If a feature is described, it is built,
  not stubbed.
- A class stays "Indicative" until it holds verified sold or auction points.
  Asking-only data never reads above Indicative.
- The model must expose its own confidence, and once sold data exists, its
  backtested error. It states what it does not know.
- No em dashes in any UI text or output.

## Stack
Next.js on Vercel, Supabase (Postgres + auth), scheduled ingestion via GitHub
Actions, Claude API for normalizing messy listing text. TypeScript valuation
engine shared by the API and the backtest script.

## Working style
Build in the phases given. Commit after each phase. Run tests before moving on.
Ask before adding scope. Keep it simple, this is a small internal tool.
