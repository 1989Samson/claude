// Browser API client for the sourcing tool.
import type { DemandItem, DemandUniverse, SupplyCandidate } from "@/lib/sourcing/schema";

async function jsonOrThrow(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return body;
}

export type { DemandItem, SupplyCandidate };

export async function buildUniverse(input: {
  project: string;
  location?: string;
  notes?: string;
}): Promise<DemandUniverse> {
  return jsonOrThrow(
    await fetch("/api/sourcing/universe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function findSupply(input: {
  item: string;
  sizeSpec?: string;
  targetModels?: string[];
  location?: string;
}): Promise<{ candidates: SupplyCandidate[] }> {
  return jsonOrThrow(
    await fetch("/api/sourcing/find", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}
