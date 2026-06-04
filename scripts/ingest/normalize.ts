// Claude normalizer: turn a messy auction lot into a clean import row.
//
// Division of labour, to keep with "never fabricate data":
//   - The model does classification and spec extraction (its strength): which
//     equipment class the lot belongs to, and its hours/condition/packaging.
//   - Hard facts (price, currency, date, source URL) stay deterministic from
//     the parsed lot. The model cannot invent a price.
//
// The class list and instructions are a stable prefix, so they are sent with
// prompt caching to cut cost across the many lots in a run.

import type { ClassRef, RawLot } from "./types";

// The import-row shape the /api/import endpoint accepts.
export interface NormalizedRow {
  classId: string;
  price: number;
  cur: "CAD" | "USD";
  type: "auction" | "asking";
  rating?: number;
  hours?: string;
  cond?: string;
  encl?: string;
  config?: string;
  date?: string;
  src: string;
}

const HOURS = ["lt5k", "5to20k", "20to40k", "40to60k", "gt60k", "unknown", "na"];
const CONDITION = ["rebuilt", "running", "idle", "repair", "parts", "unknown"];
const PACKAGING = ["enclosed", "skid", "none", "na"];
const CONFIG = ["complete", "partial", "stripped", "na"];

// Minimal structural type for the Anthropic client, so tests can inject a fake.
// content is unknown[] so the real SDK's Message (ContentBlock[]) also satisfies
// it; we narrow to the tool_use block at the use site.
export interface AnthropicLike {
  messages: {
    create(params: unknown): Promise<{ content: unknown[] }>;
  };
}

interface ToolUseBlock {
  type: "tool_use";
  name: string;
  input: unknown;
}

export interface NormalizeDeps {
  client: AnthropicLike;
  model?: string;
}

interface ClassifyInput {
  classId: string | "none";
  rating?: number | null;
  hoursBand?: string;
  condition?: string;
  packaging?: string;
  config?: string;
}

const TOOL = {
  name: "classify_lot",
  description:
    "Record how an auction lot maps to a known equipment class and its spec attributes. Use classId 'none' when the lot does not clearly match any listed class.",
  input_schema: {
    type: "object",
    properties: {
      classId: {
        type: "string",
        description:
          "The slug of the matching equipment class, or 'none' if there is no confident match.",
      },
      rating: {
        type: ["number", "null"],
        description:
          "The unit's rating in the class unit (kW, HP, or 1 for each), if stated. Null if unknown.",
      },
      hoursBand: { type: "string", enum: HOURS },
      condition: { type: "string", enum: CONDITION },
      packaging: { type: "string", enum: PACKAGING },
      config: { type: "string", enum: CONFIG },
    },
    required: ["classId", "hoursBand", "condition", "packaging", "config"],
  },
} as const;

export function buildSystemPrompt(classes: ClassRef[]): string {
  const lines = classes
    .map(
      (c) =>
        `- ${c.slug}: ${c.name} (${c.sector} / ${c.category}, rated in ${c.unit})`,
    )
    .join("\n");
  return [
    "You classify heavy equipment auction lots for a distressed-asset valuation model.",
    "Map each lot to exactly one of these equipment classes by its slug, or 'none' if it does not clearly belong to any:",
    "",
    lines,
    "",
    "Rules:",
    "- Only return a slug when you are confident the lot is that class. When unsure, return 'none'. Do not guess.",
    "- rating is the unit's size in the class unit (kW for gensets, HP for compression/pumps, 1 for each-priced items). Use null if not stated.",
    "- Map hours, condition, and packaging onto the allowed enum values. Use 'unknown' / 'na' when the lot does not say.",
    "- Do not infer or invent prices, currencies, or dates. Those are handled separately.",
  ].join("\n");
}

function lotText(lot: RawLot): string {
  const parts = [
    `Title: ${lot.title}`,
    lot.description ? `Description: ${lot.description}` : "",
    lot.priceText ? `Price as shown: ${lot.priceText}` : "",
    `Source: ${lot.sourceName}${lot.lotRef ? " " + lot.lotRef : ""}`,
  ];
  return parts.filter(Boolean).join("\n");
}

function buildSourceNote(lot: RawLot): string {
  // Required, non-empty source string. Combines the auctioneer, lot ref, and
  // URL so the point is traceable. CLAUDE.md: every point carries a source.
  return [lot.sourceName, lot.lotRef, lot.title, lot.url]
    .filter(Boolean)
    .join(" | ");
}

// Normalize one lot. Returns null when the lot has no usable price or the model
// cannot confidently map it to a known class.
export async function normalizeLot(
  lot: RawLot,
  classes: ClassRef[],
  deps: NormalizeDeps,
): Promise<NormalizedRow | null> {
  if (!lot.price || lot.price <= 0) return null;

  const knownSlugs = new Set(classes.map((c) => c.slug));
  const model = deps.model ?? process.env.INGEST_MODEL ?? "claude-haiku-4-5";

  const message = await deps.client.messages.create({
    model,
    max_tokens: 512,
    system: [
      {
        type: "text",
        text: buildSystemPrompt(classes),
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: lotText(lot) }],
  });

  const toolUse = message.content.find(
    (b): b is ToolUseBlock =>
      typeof b === "object" &&
      b !== null &&
      (b as { type?: unknown }).type === "tool_use",
  );
  if (!toolUse) return null;

  const input = toolUse.input as ClassifyInput;
  if (!input.classId || input.classId === "none" || !knownSlugs.has(input.classId)) {
    return null;
  }

  const cur: "CAD" | "USD" = lot.currencyHint ?? "USD"; // US sources default to USD
  return {
    classId: input.classId,
    price: lot.price,
    cur,
    type: lot.sourceType ?? "auction",
    rating: input.rating ?? undefined,
    hours: HOURS.includes(input.hoursBand ?? "") ? input.hoursBand : "unknown",
    cond: CONDITION.includes(input.condition ?? "") ? input.condition : "unknown",
    encl: PACKAGING.includes(input.packaging ?? "") ? input.packaging : "na",
    config: CONFIG.includes(input.config ?? "") ? input.config : "na",
    date: lot.saleDate,
    src: buildSourceNote(lot),
  };
}
