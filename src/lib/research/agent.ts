// Per-asset AI valuation agent.
//
// Given an asset description, Claude does live web research (current asks, recent
// auction results, and Canadian oil & gas receivership / SISP sale results where
// relevant) and returns a reasoned FLV/OLV/FMV band in CAD with cited comps.
//
// Guardrails (CLAUDE.md):
//   - cite-or-shut-up: every comp must carry a real source URL; comps without
//     one are dropped here, before display or storage.
//   - never fabricate: if the agent finds no evidence, it returns band null and
//     low confidence rather than a guess.
// The Anthropic client is injected so this is unit-testable without a key.

import { compSchema, researchResultSchema, type Comp, type ResearchResult } from "./schema";

export interface ResearchClient {
  messages: {
    create(params: unknown): Promise<{ content: unknown[] }>;
  };
}

export interface ResearchInput {
  description: string; // e.g. "CAT G3516 1000 kW natural gas genset, 2014, ~30,000 hrs, running, Alberta"
  className?: string; // human class name for context
  unit?: string; // kW, HP, each
  fxRate: number; // USD -> CAD, from assumptions, so conversions are consistent
}

export interface ResearchDeps {
  client: ResearchClient;
  model?: string;
}

export function buildSystemPrompt(fxRate: number): string {
  return [
    "You are a heavy-equipment valuation analyst for a distressed-asset firm in Canada.",
    "Value a single asset and output three premises in CAD: FMV (fair market, motivated buyer), OLV (orderly liquidation), FLV (forced liquidation).",
    "",
    "Use web search to gather real evidence:",
    "- current asking listings (MachineryTrader, Mascus, dealer sites),",
    "- recent auction / realized results (auctioneer result pages, specialist oilfield auctioneers),",
    "- Canadian oil & gas receivership / SISP sale results where relevant (BOE Report, DOB Energy, receiver case sites, CanLII). These forced/orderly realizations are the best evidence for OLV and FLV.",
    "",
    "Hard rules:",
    `- Convert USD to CAD at ${fxRate}. State each comp in its original currency.`,
    "- Every comp MUST include a real source URL you actually retrieved. Do not invent comps, prices, dates, or URLs.",
    "- If you cannot find real evidence, return band = null with confidence \"low\" and explain why. Never output a guessed band with no comps.",
    "- Prefer realized sold/auction comps over asking. If only asking data exists, say so and keep confidence low.",
    "",
    "Return ONLY a single JSON object, no prose around it, of the form:",
    '{"band": {"fmvCAD": number, "olvCAD": number, "flvCAD": number} | null,',
    ' "confidence": "low"|"medium"|"high",',
    ' "comps": [{"description": str, "price": num, "currency": "CAD"|"USD", "type": "asking"|"auction"|"sold_private"|"sisp"|"own_close", "sourceName": str, "url": str, "date": "YYYY-MM-DD"?}],',
    ' "reasoning": str, "caveats": str}',
  ].join("\n");
}

// Pull the concatenated assistant text out of the message content blocks.
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

// Extract the JSON object from the model's text (fenced or bare).
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1]! : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in agent response");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

// Validate and keep only comps that carry a usable source URL.
export function sanitizeComps(raw: unknown[]): Comp[] {
  const comps: Comp[] = [];
  for (const r of raw) {
    const parsed = compSchema.safeParse(r);
    if (parsed.success) comps.push(parsed.data);
  }
  return comps;
}

export async function researchAsset(
  input: ResearchInput,
  deps: ResearchDeps,
): Promise<ResearchResult> {
  const model = deps.model ?? process.env.RESEARCH_MODEL ?? "claude-sonnet-4-6";

  const message = await deps.client.messages.create({
    model,
    max_tokens: 4096,
    system: buildSystemPrompt(input.fxRate),
    // Tuned to finish within the Vercel free-tier 60s function ceiling.
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
    messages: [
      {
        role: "user",
        content:
          `Value this asset and return the JSON.\n` +
          `Asset: ${input.description}\n` +
          (input.className ? `Class: ${input.className}\n` : "") +
          (input.unit ? `Rated in: ${input.unit}\n` : ""),
      },
    ],
  });

  const parsed = researchResultSchema.parse(extractJson(textOf(message.content)));
  const comps = sanitizeComps(parsed.comps);

  // If the model returned a band but no comp survived the URL guardrail, the
  // band is unsupported. Drop it and flag, rather than show an uncited number.
  let band = parsed.band;
  let caveats = parsed.caveats;
  let confidence = parsed.confidence;
  if (band && comps.length === 0) {
    band = null;
    confidence = "low";
    caveats =
      "No comp survived the source-URL check, so no defensible band is shown. " +
      caveats;
  }

  return { band, confidence, comps, reasoning: parsed.reasoning, caveats };
}
