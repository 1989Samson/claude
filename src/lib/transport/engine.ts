// Delivered-cost and time-to-site estimator. A faithful TypeScript port of
// transport_estimator.py (v2): estimates the landed (DDP) cost and the transport
// portion of the energized date for moving 60 Hz generation iron from a global
// source to a Canadian data center site.
//
// Design rules unchanged from the prototype: directional not precise, two-tier
// output (internal stack plus margin-safe buyer band), rate tables are editable
// data (rates.json), not buried in the logic. The engine never invents a number;
// every figure falls out of the unit, the corridor, and the rate tables.

import ratesJson from "./rates.json";
import {
  type Band,
  type BuyerEstimate,
  type DestRegion,
  type EstimateResult,
  type InternalEstimate,
  type TransportClass,
  type UnitInput,
} from "./schema";

type Pair = [number, number];

// The rate tables are editable data (rates.json). JSON infers arrays as number[],
// so we pin the shape here once; the engine then reads strongly-typed tables.
interface Corridor {
  entry: string;
  ocean_days: number;
  inland_miles: number;
  jurisdictions: number;
}
interface Rates {
  version: string;
  asOf: string;
  currency: string;
  inland_usd_per_mile: Record<string, Pair>;
  short_haul_miles: number;
  short_haul_mult: number;
  winter_surcharge: number;
  pilot_usd_per_mile: number;
  police_usd_per_hour: number;
  police_min_hours: number;
  permit_oversize: Pair;
  permit_superload: Pair;
  ocean_usd_per_rt: Pair;
  flat_rack_max_tonnes: number;
  flat_rack_discount: number;
  gulf_lane_surcharge: number;
  heavy_lift_piece_t: number;
  heavy_lift_usd_per_t: Pair;
  charter_flag_piece_t: number;
  marine_insurance: Pair;
  port_handling: Record<string, Pair>;
  crane_usd_per_day: Record<string, Pair>;
  rig_days: Record<string, number>;
  origin_prep: Record<string, Pair>;
  duty_rate_turbine: number;
  duty_rate_genset: number;
  gst: number;
  provincial_tax: Record<string, number>;
  class_weight: Record<string, Pair>;
  class_load: Record<string, string>;
  class_pilots: Record<string, number>;
  prep_weeks: Record<string, number>;
  corridors: Record<string, Corridor>;
}
const rates = ratesJson as unknown as Rates;

export const CURRENCY = rates.currency;
export const RATES_VERSION = rates.version;
export const RATES_AS_OF = rates.asOf;

// Match Python's round() (banker's rounding, half to even) so the port is exact.
function pyRound(x: number): number {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (Math.abs(diff - 0.5) < 1e-9) {
    return floor % 2 === 0 ? floor : floor + 1;
  }
  return Math.round(x);
}

function band(lo: number, hi: number): Band {
  return [pyRound(lo), pyRound(hi)];
}

function classWeights(unit: UnitInput): { totalT: number; pieceT: number } {
  const d = rates.class_weight[unit.cls]!;
  return { totalT: unit.totalT ?? d[0], pieceT: unit.pieceT ?? d[1] };
}

export function corridorKey(origin: string, dest: string): string {
  return `${origin}>${dest}`;
}

export function estimate(unit: UnitInput, dest: DestRegion): EstimateResult {
  const flags: string[] = [];

  // Feasibility guard: a floating barge cannot reach a landlocked site.
  if (unit.cls === "D" && !unit.waterfront) {
    return {
      internal: {
        model: unit.model,
        infeasible:
          "Class D barge needs a waterfront site; not viable for an inland location",
      },
      buyer: null,
    };
  }

  const { totalT, pieceT } = classWeights(unit);
  const corr = rates.corridors[corridorKey(unit.origin, dest)];
  if (!corr) {
    throw new Error(`no corridor for ${unit.origin} -> ${dest}`);
  }

  const stack: Record<string, Band> = {};
  stack.origin_prep = band(...(rates.origin_prep[unit.cls]!));

  // Ocean leg (overseas origins only).
  if (corr.ocean_days > 0 && unit.cls !== "D") {
    const rt = totalT; // dense machinery: tonnes >= cubic meters, RT = tonnes
    let [lo, hi] = rates.ocean_usd_per_rt;
    if (pieceT <= rates.flat_rack_max_tonnes) {
      lo *= rates.flat_rack_discount;
      hi *= rates.flat_rack_discount;
    }
    let ocean: Pair = [rt * lo, rt * hi];
    if (unit.origin === "SA" || unit.origin === "AE") {
      ocean = [
        ocean[0] * (1 + rates.gulf_lane_surcharge),
        ocean[1] * (1 + rates.gulf_lane_surcharge),
      ];
    }
    stack.ocean_freight = band(ocean[0], ocean[1]);

    // Heavy-lift surcharge on the heaviest piece.
    if (pieceT > rates.heavy_lift_piece_t) {
      const [hlLo, hlHi] = rates.heavy_lift_usd_per_t;
      stack.heavy_lift_surcharge = band(pieceT * hlLo, pieceT * hlHi);
    }
    if (pieceT > rates.charter_flag_piece_t) {
      flags.push(
        `largest piece ~${pieceT.toFixed(0)}t: dedicated/charter likely, ` +
          "price ocean as a lumpsum quote, not per-ton",
      );
    }
    const [miLo, miHi] = rates.marine_insurance;
    stack.marine_insurance = band(unit.valueUsd * miLo, unit.valueUsd * miHi);

    const ph = rates.port_handling[unit.cls]!;
    stack.port_handling = band(ph[0] * 2, ph[1] * 2);
  } else if (corr.ocean_days === 0) {
    const ph = rates.port_handling[unit.cls]!;
    stack.port_handling = band(ph[0], ph[1]);
  }

  // Inland heavy-haul to site.
  const miles = corr.inland_miles;
  const classLoad = rates.class_load[unit.cls]!;
  let [hLo, hHi] = rates.inland_usd_per_mile[classLoad]!;
  if (miles < rates.short_haul_miles) {
    hLo *= rates.short_haul_mult;
    hHi *= rates.short_haul_mult;
  }
  let haul: Pair = [miles * hLo, miles * hHi];
  if (unit.winter) {
    haul = [haul[0] * (1 + rates.winter_surcharge), haul[1] * (1 + rates.winter_surcharge)];
  }
  stack.inland_haul = band(haul[0], haul[1]);

  // Escorts.
  const pilots = rates.class_pilots[unit.cls]!;
  let escLo = 0;
  let escHi = 0;
  if (pilots) {
    escLo += pilots * miles * rates.pilot_usd_per_mile;
    escHi += pilots * miles * rates.pilot_usd_per_mile;
  }
  if (classLoad === "superload") {
    escLo += rates.police_min_hours * rates.police_usd_per_hour;
    escHi += rates.police_min_hours * 3 * rates.police_usd_per_hour;
  }
  if (escHi) {
    stack.escorts = band(escLo, escHi);
  }

  // Permits.
  const j = corr.jurisdictions;
  const permit = classLoad === "superload"
    ? rates.permit_superload
    : rates.permit_oversize;
  stack.permits = band(j * permit[0], j * permit[1]);

  // Crane plus rigging at site.
  const cr = rates.crane_usd_per_day[unit.cls]!;
  const days = rates.rig_days[unit.cls]!;
  if (days) {
    stack.crane_rigging = band(cr[0] * days, cr[1] * days);
  }

  // Duty + GST on the IMPORT value only (goods + international freight + duty).
  // Domestic Canadian legs (inland haul, crane) are out of the import value.
  const importKeys = new Set([
    "origin_prep",
    "ocean_freight",
    "heavy_lift_surcharge",
    "marine_insurance",
    "port_handling",
  ]);
  const importLo = sumBy(stack, importKeys, 0);
  const importHi = sumBy(stack, importKeys, 1);
  const importLogi = (importLo + importHi) / 2;
  const valueForDuty = unit.valueUsd + importLogi;
  const dutyRate = unit.cls === "A" ? rates.duty_rate_genset : rates.duty_rate_turbine;
  if (unit.cls === "A") {
    flags.push(
      "Class A genset is HS 8502 (not 8411); confirm MFN rate and CETA " +
        "origin (MTU is German-made) with a broker",
    );
  }
  const prov = rates.provincial_tax[dest] ?? 0;
  const duty = valueForDuty * dutyRate;
  const taxes = (valueForDuty + duty) * (rates.gst + prov);
  stack.duty = band(duty, duty);
  stack.gst_provincial = band(taxes, taxes);

  // Totals: logistics separate from recoverable taxes.
  const taxKeys = new Set(["duty", "gst_provincial"]);
  const logistics: Pair = [
    sumByExcept(stack, taxKeys, 0),
    sumByExcept(stack, taxKeys, 1),
  ];
  const taxesTotal: Pair = [sumBy(stack, taxKeys, 0), sumBy(stack, taxKeys, 1)];
  const total: Pair = [
    logistics[0] + taxesTotal[0],
    logistics[1] + taxesTotal[1],
  ];

  // Lead time (weeks): transport portion of the energized date.
  const prepWk = rates.prep_weeks[unit.cls]!;
  const oceanWk = corr.ocean_days ? pyRound(corr.ocean_days / 7) : 0;
  const customsWk = corr.ocean_days ? 1 : 0;
  const permitWk = classLoad === "superload" ? 3 : 1;
  const haulWk = Math.max(1, pyRound(miles / 500));
  const weeksLo = prepWk + oceanWk + customsWk + permitWk + haulWk;
  const weeksHi = weeksLo + 3;

  const internal: InternalEstimate = {
    model: unit.model,
    cls: unit.cls as TransportClass,
    corridor: corr.entry,
    weightsT: { total: totalT, largestPiece: pieceT },
    stackUsd: stack,
    logisticsUsd: band(logistics[0], logistics[1]),
    taxesUsd: band(taxesTotal[0], taxesTotal[1]),
    deliveredWithTaxUsd: band(total[0], total[1]),
    weeksToSite: [weeksLo, weeksHi],
    flags,
    currency: CURRENCY,
  };

  // Buyer band: round logistics hard so a buyer cannot back into the margin.
  let step: number;
  if (logistics[1] < 100_000) step = 10_000;
  else if (logistics[1] < 250_000) step = 25_000;
  else step = 50_000;
  const buyerLo = Math.max(step, Math.floor(logistics[0] / step) * step);
  const buyerHi = Math.ceil(logistics[1] / step) * step;
  const buyer: BuyerEstimate = {
    model: unit.model,
    indicativeLogisticsBandUsd: [buyerLo, buyerHi],
    estimatedWeeksToSite: [weeksLo, weeksHi],
    note:
      "Indicative logistics only, excludes duty and taxes. " +
      "Firm delivered price on request once site is confirmed.",
  };

  return { internal, buyer };
}

function sumBy(stack: Record<string, Band>, keys: Set<string>, idx: 0 | 1): number {
  let s = 0;
  for (const [k, v] of Object.entries(stack)) {
    if (keys.has(k)) s += v[idx];
  }
  return s;
}

function sumByExcept(
  stack: Record<string, Band>,
  keys: Set<string>,
  idx: 0 | 1,
): number {
  let s = 0;
  for (const [k, v] of Object.entries(stack)) {
    if (!keys.has(k)) s += v[idx];
  }
  return s;
}
