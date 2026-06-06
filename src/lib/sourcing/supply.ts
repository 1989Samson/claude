// Supply discovery: given an equipment need, find real available used/rebuilt
// units on the market right now, with cited source URLs. This is the engine's
// edge - supply omniscience + speed. The Anthropic client is injected so the
// logic is unit-testable without a key; live runs use web search on deploy.

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
  region?: string; // e.g. "North America"
}

export interface FindSupplyDeps {
  client: SupplyClient;
  model?: string;
}

function textOf(content: unknown[]): string {
  return content
    .filter(
      (b): b is { type: "text"; text: string } =>
        typeof b === "object" &&
        b !== null &&
        (b as { type?: unknown }).type === "text" &&
        typeof (b as { text?: unknown }).text === "string",
    )
    .map((b) => b.text)
    .join("\n");
}

export function buildSupplyPrompt(input: FindSupplyInput): string {
  const models = input.targetModels?.length
    ? `Prefer these makes/models: ${input.targetModels.join(", ")}.`
    : "";
  return [
    "You find verified used or OEM-rebuilt heavy equipment available for sale right now.",
    "Search dealer listings, used-equipment marketplaces (MachineryTrader, Mascus, Machinio, Rock & Dirt), auction listings, and OEM-certified-used pages.",
    `Find currently available units of: ${input.item}.`,
    input.sizeSpec ? `Spec: ${input.sizeSpec}.` : "",
    models,
    input.region ? `Prefer ${input.region}, but include strong options anywhere.` : "",
    "",
    "Hard rules:",
    "- Every candidate MUST include a real source URL you actually retrieved via search. Never invent listings, prices, hours, or URLs.",
    "- Prefer real, current listings with specs. If you cannot find real ones, return an empty list.",
    "- Capture price as text (it is often 'call for price').",
    "",
    'Return ONLY a single JSON object: {"candidates": [',
    '  {"description": str, "make": str?, "model": str?, "year": int?, "hours": num?, "priceText": str?, "currency": "CAD"|"USD"?, "location": str?, "condition": str?, "sourceName": str, "url": str, "notes": str?}',
    "]}",
  ]
    .filter(Boolean)
    .join("\n");
}

// Validate and keep only candidates with a usable source URL.
export function sanitizeCandidates(raw: unknown[]): SupplyCandidate[] {
  const out: SupplyCandidate[] = [];
  for (const r of raw) {
    const parsed = supplyCandidateSchema.safeParse(r);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

// Robustly pull candidate objects out of the model's text. We brace-match and
// JSON.parse each object individually, so a missing comma, stray token, or a
// truncated final object does NOT throw away the whole result (the strict
// approach was failing the entire run on one formatting glitch).
export function parseCandidatesLoose(text: string): unknown[] {
  const key = text.indexOf('"candidates"');
  const start = text.indexOf("[", key === -1 ? 0 : key);
  if (start === -1) return [];

  const out: unknown[] = [];
  let i = start + 1;
  while (i < text.length) {
    while (i < text.length && /[\s,]/.test(text[i]!)) i++; // skip whitespace/commas
    if (i >= text.length || text[i] === "]") break;
    if (text[i] !== "{") {
      // stray token between objects: jump to the next object if there is one
      const next = text.indexOf("{", i);
      if (next === -1) break;
      i = next;
    }
    // brace-match one object, respecting strings/escapes
    let depth = 0;
    let j = i;
    let inStr = false;
    let esc = false;
    for (; j < text.length; j++) {
      const ch = text[j]!;
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
    }
    if (depth !== 0) break; // truncated final object: keep what we have
    try {
      out.push(JSON.parse(text.slice(i, j)));
    } catch {
      /* skip a malformed object, keep the rest */
    }
    i = j;
  }
  return out;
}

export async function findSupply(
  input: FindSupplyInput,
  deps: FindSupplyDeps,
): Promise<SupplyCandidate[]> {
  const model = deps.model ?? process.env.RESEARCH_MODEL ?? "claude-sonnet-4-6";

  const message = await deps.client.messages.create({
    model,
    max_tokens: 6000,
    system: buildSupplyPrompt(input),
    // 3 searches keeps the run comfortably inside the function time limit.
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
    messages: [
      {
        role: "user",
        content: `Find available units now for: ${input.item}${input.sizeSpec ? ` (${input.sizeSpec})` : ""}. Return at most 8 of the best, as the JSON object.`,
      },
    ],
  });

  return sanitizeCandidates(parseCandidatesLoose(textOf(message.content)));
}
