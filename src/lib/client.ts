// Tiny browser-side API client used by the tab components.
import type { AssumptionsView, ClassMeta, MatrixRow } from "@/lib/types";
import type { AssumptionsInput } from "@/lib/validation";
import type { UnitValuation } from "@/lib/valuation";

async function jsonOrThrow(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return body;
}

export async function fetchMatrix(): Promise<{
  matrix: MatrixRow[];
  assumptions: AssumptionsView;
}> {
  return jsonOrThrow(await fetch("/api/matrix", { cache: "no-store" }));
}

export async function addPoint(input: {
  classSlug: string;
  price: number;
  currency: "CAD" | "USD";
  sourceType: string;
  rating?: number | null;
  hoursBand?: string;
  condition?: string;
  packaging?: string;
  config?: string;
  saleDate?: string;
  sourceNote: string;
}): Promise<void> {
  await jsonOrThrow(
    await fetch("/api/points", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function importPoints(rows: unknown[]): Promise<{
  imported: number;
  skipped: number;
  errors: string[];
}> {
  return jsonOrThrow(
    await fetch("/api/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(rows),
    }),
  );
}

export async function saveAssumptions(
  input: AssumptionsInput,
): Promise<AssumptionsView> {
  return jsonOrThrow(
    await fetch("/api/assumptions", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function valuate(input: {
  classSlug: string;
  rating: number;
  hoursBand?: string;
  condition?: string;
  packaging?: string;
  config?: string;
  transport?: number;
}): Promise<{ meta: ClassMeta; valuation: UnitValuation | null }> {
  return jsonOrThrow(
    await fetch("/api/valuate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}
