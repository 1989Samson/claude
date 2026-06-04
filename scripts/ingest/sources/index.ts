import type { SourceAdapter } from "../types";
import { GovPlanetSource } from "./govplanet";
import { GsaAuctionsSource } from "./gsa";

// Source registry. Select with the SOURCE env var. Default is GSA Auctions: the
// only free, ToS-permissible automated source. GovPlanet remains available but
// is not the default, since the Ritchie Bros family prohibits automated access.
const REGISTRY: Record<string, () => SourceAdapter> = {
  gsa: () => new GsaAuctionsSource(),
  govplanet: () => new GovPlanetSource(),
};

export function getSource(name = process.env.SOURCE ?? "gsa"): SourceAdapter {
  const make = REGISTRY[name.toLowerCase()];
  if (!make) {
    throw new Error(
      `Unknown SOURCE "${name}". Known: ${Object.keys(REGISTRY).join(", ")}`,
    );
  }
  return make();
}
