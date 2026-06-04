import type { SourceAdapter } from "../types";
import { GovDealsSource } from "./govdeals";
import { GovPlanetSource } from "./govplanet";
import { GsaAuctionsSource } from "./gsa";
import { SalvexSource } from "./salvex";

// Source registry. SOURCE may be a single name or a comma-separated list, run in
// order and aggregated. Default is the free official GSA API. GovDeals and
// Salvex pull publicly-viewable results (legally defensible under hiQ); enable
// them with SOURCE=govdeals,salvex,gsa once their result URLs are confirmed.
// GovPlanet remains available but must not be used for scheduled scraping (RB
// terms prohibit automated access).
const REGISTRY: Record<string, () => SourceAdapter> = {
  gsa: () => new GsaAuctionsSource(),
  govdeals: () => new GovDealsSource(),
  salvex: () => new SalvexSource(),
  govplanet: () => new GovPlanetSource(),
};

export function getSources(spec = process.env.SOURCE ?? "gsa"): SourceAdapter[] {
  const names = spec.split(",").map((s) => s.trim()).filter(Boolean);
  return names.map((name) => {
    const make = REGISTRY[name.toLowerCase()];
    if (!make) {
      throw new Error(
        `Unknown SOURCE "${name}". Known: ${Object.keys(REGISTRY).join(", ")}`,
      );
    }
    return make();
  });
}

// Convenience: the first configured source.
export function getSource(name?: string): SourceAdapter {
  return getSources(name ?? process.env.SOURCE ?? "gsa")[0]!;
}
