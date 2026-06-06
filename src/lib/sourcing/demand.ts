// Demand universe generator: turn a mine / restart / project into the COMPLETE
// equipment list it needs - the whole facility plus the full fleet - so the
// supply hunt can run against every line. The client is injected for testing.

import { parseObjectArray, textOf } from "./parse";
import { demandItemSchema, type DemandItem, type DemandUniverse } from "./schema";

export interface DemandClient {
  messages: {
    create(params: unknown): Promise<{ content: unknown[] }>;
  };
}

export interface BuildUniverseInput {
  project: string; // mine / project name
  location?: string;
  notes?: string; // commodity, throughput, restart scope, or pasted disclosure
}

export interface BuildUniverseDeps {
  client: DemandClient;
  model?: string;
}

export function buildUniversePrompt(): string {
  return [
    "You are a mining and heavy-industrial equipment specialist. Given a mine, restart, or project, list the COMPLETE universe of major equipment it needs to operate - the entire facility/plant AND the full mobile fleet AND infrastructure. Be exhaustive and concrete; this is a procurement target list.",
    "",
    "Cover every relevant area:",
    "- plant / process (crushing, grinding/mills, classification, separation, leach/CIL, roaster or process-specific units, thickeners, pumps, conveyors)",
    "- underground mobile fleet (LHDs, trucks, jumbos, bolters, shotcrete, utility) when underground",
    "- open-pit / surface fleet (haul trucks, excavators/shovels, loaders, dozers, graders, blasthole drills, water trucks) when open pit",
    "- power generation and electrical, dewatering and water, and shop/support equipment",
    "",
    "For each line give a clear item name, a size/spec, typical target makes/models, a used-suitability of high|medium|low (how feasible verified used is for that item), and a short note. Group sensibly via the category field.",
    "",
    'Return ONLY a single JSON object: {"items": [',
    '  {"item": str, "category": str, "sizeSpec": str, "usedSuitability": "high"|"medium"|"low", "targetModels": [str], "priority": str, "notes": str}',
    "]}",
  ].join("\n");
}

export function sanitizeItems(raw: unknown[]): DemandItem[] {
  const out: DemandItem[] = [];
  for (const r of raw) {
    const parsed = demandItemSchema.safeParse(r);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export async function buildUniverse(
  input: BuildUniverseInput,
  deps: BuildUniverseDeps,
): Promise<DemandUniverse> {
  const model = deps.model ?? process.env.RESEARCH_MODEL ?? "claude-sonnet-4-6";

  const message = await deps.client.messages.create({
    model,
    max_tokens: 8000,
    system: buildUniversePrompt(),
    messages: [
      {
        role: "user",
        content:
          `Project: ${input.project}\n` +
          (input.location ? `Location: ${input.location}\n` : "") +
          (input.notes ? `Details: ${input.notes}\n` : "") +
          "List the complete equipment universe as the JSON object.",
      },
    ],
  });

  const items = sanitizeItems(parseObjectArray(textOf(message.content), "items"));
  return { project: input.project, location: input.location, items };
}
