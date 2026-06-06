// Geo-tiered, exhaustive supply discovery: given an equipment need and the mine
// location, find real available used/rebuilt units, LOCAL FIRST then expanding
// outward, each cited to a source URL. The client is injected so the logic is
// unit-testable without a key; live runs use web search on deploy.

import { parseObjectArray, textOf } from "./parse";
import { supplyCandidateSchema, type SupplyCandidate } from "./schema";

export interface SupplyClient {
  messages: {
    create(params: unknown): Promise<{ content: unknown[] }>;
  };
}

export interface FindSupplyInput {
  item: string; // e.g. "underground LHD / scooptram"
  sizeSpec?: string; // e.g. "6-10 yd3, low-profile"
  targetModels?: string[]; // e.g. ["CAT R1700", "Sandvik LH514"]
  location?: string; // the mine location; supply is searched local-first
}

export interface FindSupplyDeps {
  client: SupplyClient;
  model?: string;
}

export function buildSupplyPrompt(input: FindSupplyInput): string {
  const models = input.targetModels?.length
    ? `Prefer these makes/models: ${input.targetModels.join(", ")}.`
    : "";
  const geo = input.location
    ? [
        `The buyer's site is: ${input.location}.`,
        "Search LOCAL FIRST, then expand outward in rings until you have a strong, extensive list:",
        "  1) local (same state/province/region), 2) national (same country), 3) continental, 4) international.",
        'Tag each unit with "tier": one of "local", "regional", "national", "international", and put the location in "location". Transport cost matters, so nearer units are more valuable.',
      ].join("\n")
    : "Search broadly across North America and beyond.";
  return [
    "You find verified used or OEM-rebuilt heavy equipment available for sale right now.",
    "Search dealer listings, used-equipment marketplaces (MachineryTrader, Mascus, Machinio, Rock & Dirt, IronPlanet, Ritchie Bros listings), OEM-certified-used pages, and regional dealers.",
    `Find currently available units of: ${input.item}.`,
    input.sizeSpec ? `Spec: ${input.sizeSpec}.` : "",
    models,
    geo,
    "",
    "Hard rules:",
    "- Every candidate MUST include a real source URL you actually retrieved via search. Never invent listings, prices, hours, or URLs.",
    "- Prefer real, current listings with specs. Used/rebuilt over new. If you cannot find real ones, return an empty list.",
    "- Capture price as text (it is often 'call for price'). Be exhaustive: return every distinct real unit you find.",
    "",
    'Return ONLY a single JSON object: {"candidates": [',
    '  {"description": str, "make": str?, "model": str?, "year": int?, "hours": num?, "priceText": str?, "currency": "CAD"|"USD"?, "location": str?, "tier": str?, "condition": str?, "sourceName": str, "url": str, "notes": str?}',
    "]}",
  ]
    .filter(Boolean)
    .join("\n");
}

// Validate and keep only candidates with a usable source URL.
export function sanitizeCandidates(raw: unknown[]): SupplyCandidate[] {
  const out: SupplyCandidate[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const parsed = supplyCandidateSchema.safeParse(r);
    if (!parsed.success) continue;
    const key = parsed.data.url.toLowerCase();
    if (seen.has(key)) continue; // dedupe by source URL
    seen.add(key);
    out.push(parsed.data);
  }
  return out;
}

// Kept for tests / callers: tolerant extraction of the candidates array.
export function parseCandidatesLoose(text: string): unknown[] {
  return parseObjectArray(text, "candidates");
}

const TIER_ORDER: Record<string, number> = {
  local: 0,
  regional: 1,
  national: 2,
  international: 3,
};

export async function findSupply(
  input: FindSupplyInput,
  deps: FindSupplyDeps,
): Promise<SupplyCandidate[]> {
  // Sonnet: Haiku was too weak here - it returned units without clean source
  // URLs (dropped by the cite-or-shut-up guard) and searched less effectively,
  // yielding "no cited units". Sonnet reliably finds and cites. Override with
  // SUPPLY_MODEL if you want to trade quality for cost.
  const model = deps.model ?? process.env.SUPPLY_MODEL ?? "claude-sonnet-4-6";

  const message = await deps.client.messages.create({
    model,
    max_tokens: 5000,
    system: buildSupplyPrompt(input),
    // 2 searches: best balance for a low-tier account - enough for Sonnet to
    // find and cite units, while keeping input tokens under the per-minute cap
    // so a single hunt completes instead of 429-looping into a timeout.
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 2 }],
    messages: [
      {
        role: "user",
        content: `Find every available unit you can for: ${input.item}${input.sizeSpec ? ` (${input.sizeSpec})` : ""}${input.location ? `, nearest ${input.location} first` : ""}. Return the JSON object.`,
      },
    ],
  });

  const candidates = sanitizeCandidates(parseCandidatesLoose(textOf(message.content)));
  // Sort nearest-first when tiers are present.
  return candidates.sort(
    (a, b) =>
      (TIER_ORDER[(a.tier ?? "").toLowerCase()] ?? 9) -
      (TIER_ORDER[(b.tier ?? "").toLowerCase()] ?? 9),
  );
}
