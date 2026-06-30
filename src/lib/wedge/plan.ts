// Wedge planner: turn a buyer's minimum inputs into an indicative, engine-backed
// read. It maps MW + stage onto representative equipment archetypes, prices and
// times each through the transport engine over two honest lanes (a domestic-fast
// lane and a global lane), and returns hard-rounded bands. It never names a
// source, never shows a precise number, and never touches the supply registry.
//
// The archetypes are standard equipment classes, not real inventory: they drive
// the cost/time model the same way class-default weights do in the engine. Real
// units, when matched, only sharpen this privately with a principal.

import { estimate } from "@/lib/transport/engine";
import { type DestRegion, type OriginCode, type UnitInput } from "@/lib/transport/schema";
import market from "@/lib/market/context.json";
import {
  type Band,
  type GridGap,
  type ProvinceCode,
  type StageOption,
  type WedgeInput,
  type WedgeRead,
} from "./schema";

// ---- editable planning config ------------------------------------------------

// Representative archetype per stage. mw is the per-unit rating used to size the
// count; valueUsd feeds marine insurance only (taxes are excluded from the band).
const ARCHETYPE = {
  bridge: { model: "Containerized gas genset", cls: "A" as const, mw: 2.5, valueUsd: 1_200_000 },
  prime_aero: { model: "Aeroderivative turbine", cls: "B" as const, mw: 40, valueUsd: 12_000_000 },
  prime_frame: { model: "Heavy-frame turbine", cls: "C" as const, mw: 40, valueUsd: 9_000_000 },
};

// Above this MW a prime build uses heavy-frame turbines rather than aeros.
const FRAME_THRESHOLD_MW = 120;

// The two lanes we bound every option between: fastest credible domestic supply,
// and a representative global lane into the province. The band between them is
// the honest spread while supply is still being located.
const FAST_ORIGIN: OriginCode = "US";
const GLOBAL_ORIGIN: Record<ProvinceCode, OriginCode> = { AB: "AE", ON: "AE", QC: "AE" };

const DETAILS_HANDLED = [
  "Customs, duty and HS classification",
  "Heavy-haul, route survey and permits",
  "Port handling and heavy-lift",
  "Escorts and winter routing",
  "FX and full landed cost",
];

// ---- helpers -----------------------------------------------------------------

function repUnit(
  a: { model: string; cls: "A" | "B" | "C"; mw: number; valueUsd: number },
  origin: OriginCode,
): UnitInput {
  return { model: a.model, cls: a.cls, mw: a.mw, origin, valueUsd: a.valueUsd, winter: false, waterfront: false };
}

// Round a raw figure out to a coarse band step so no precise number ever shows.
function roundStep(n: number): number {
  const step = n < 100_000 ? 10_000 : n < 1_000_000 ? 50_000 : 250_000;
  return Math.round(n / step) * step;
}

// Build one stage option: size the count, price/time it across both lanes, and
// widen to the honest [fast-low, global-high] band.
function buildOption(
  archetype: { model: string; cls: "A" | "B" | "C"; mw: number; valueUsd: number },
  stage: "Bridge" | "Prime",
  headline: string,
  mw: number,
  province: ProvinceCode,
  recommended: boolean,
  note: string,
): StageOption {
  const dest = province as DestRegion;
  const fast = estimate(repUnit(archetype, FAST_ORIGIN), dest);
  const global = estimate(repUnit(archetype, GLOBAL_ORIGIN[province]), dest);
  if ("infeasible" in fast.internal || "infeasible" in global.internal) {
    throw new Error("infeasible lane");
  }

  const count = Math.max(1, Math.ceil(mw / archetype.mw));

  // Per-unit spread: fastest domestic lane low to global lane high.
  const deliveredBandUsd: Band = [
    roundStep(fast.internal.logisticsUsd[0] * count),
    roundStep(global.internal.logisticsUsd[1] * count),
  ];

  // Weeks: fastest lane low to global lane high. The equipment-to-pad slice.
  const weeksToPad: Band = [fast.internal.weeksToSite[0], global.internal.weeksToSite[1]];

  const config = `${count} x ${archetype.model.toLowerCase()}${count > 1 ? "s" : ""}`;

  return { stage, headline, config, unitCount: count, weeksToPad, deliveredBandUsd, recommended, note };
}

// ---- public ------------------------------------------------------------------

export function gridGapFor(province: ProvinceCode): GridGap {
  const p = market.provinces[province];
  return {
    province: p.name,
    headline: p.headline,
    detail: p.detail,
    stance: p.stance,
    source: p.source,
    verified: p.verified,
    asOf: market.asOf,
  };
}

export function planRead(input: WedgeInput): WedgeRead {
  const { mw, province, mode, timeframe, gas } = input;

  const primeArchetype = mw > FRAME_THRESHOLD_MW ? ARCHETYPE.prime_frame : ARCHETYPE.prime_aero;

  // Always show both stages so the buyer sees the fit-to-project tradeoff. The
  // selected mode (and urgency) decides which one we recommend.
  const wantsFast = mode === "bridge" || timeframe === "asap";
  const bridge = buildOption(
    ARCHETYPE.bridge,
    "Bridge",
    "Fastest power on the pad",
    mw,
    province,
    wantsFast,
    "Containerized gas gensets. The quickest credible route to live load while the permanent plant is built.",
  );
  const prime = buildOption(
    primeArchetype,
    "Prime",
    "Permanent on-site generation",
    mw,
    province,
    !wantsFast,
    "Turbine generation sized to carry the site. Longer to land, lower cost per MW over the life of the build.",
  );

  const gasNote =
    gas === "no"
      ? " Gas supply to the pad is on the critical path; we factor it into the plan."
      : gas === "unsure"
        ? " We confirm gas availability to the pad as part of the assessment."
        : "";

  const confidence =
    "Indicative. Equipment-to-pad weeks and a hard-rounded delivered band, on representative units and lanes." +
    " Site works and permitting are the rest of the path to energized; we map the full critical path with you." +
    gasNote;

  return {
    mw,
    province,
    gap: gridGapFor(province),
    options: [bridge, prime],
    detailsHandled: DETAILS_HANDLED,
    confidence,
    disclaimer: market.disclaimer,
  };
}
