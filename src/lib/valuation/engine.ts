// The valuation engine: a faithful port of the math in reference_ui.html.
//
// The only intentional change from the browser prototype is that recency is
// evaluated against an explicit `asOf` instant instead of Date.now(), so the
// output is deterministic and backtests are reproducible. Default asOf is "now".

import {
  MS_PER_MONTH,
  RECENCY_FLOOR,
  isVerifiedSold,
  sourceQuality,
  specMult,
} from "./factors";
import type {
  Assumptions,
  Band,
  ClassFMV,
  ConfidenceLevel,
  DataPoint,
  EquipmentClass,
  SubjectUnit,
  UnitValuation,
} from "./types";

function asOfMs(asOf: Date | string | number): number {
  if (asOf instanceof Date) return asOf.getTime();
  if (typeof asOf === "number") return asOf;
  return new Date(asOf).getTime();
}

// reference priceCAD: USD converts at the stored rate, CAD passes through.
export function priceCAD(point: DataPoint, a: Assumptions): number {
  return point.currency === "USD" ? point.price * a.fxRate : point.price;
}

// reference toFMVfactor: asking and auction are rescaled to FMV; sold/own = 1.
export function toFmvFactor(type: DataPoint["sourceType"], a: Assumptions): number {
  if (type === "asking") return a.askToFmv;
  if (type === "auction") return a.auctionToFmv;
  return 1.0;
}

// reference recencyW: linear decay by point age toward RECENCY_FLOOR over the
// horizon. No date => full weight. Future dates => full weight.
export function recencyWeight(
  point: DataPoint,
  a: Assumptions,
  asOf: Date | string | number = Date.now(),
): number {
  if (!point.saleDate) return 1;
  const months = (asOfMs(asOf) - new Date(point.saleDate).getTime()) / MS_PER_MONTH;
  if (months <= 0) return 1;
  return Math.max(RECENCY_FLOOR, 1 - months / a.recencyHorizonMonths);
}

// reference classFMV: weighted mean of each point's FMV-equivalent.
// Each point is converted to CAD, scaled linearly to the class reference rating,
// normalized by dividing out its own spec multiplier, then rescaled to an FMV
// estimate by source type. Weight = source quality * recency.
export function classFMV(
  cls: EquipmentClass,
  a: Assumptions,
  asOf: Date | string | number = Date.now(),
): ClassFMV {
  if (cls.points.length === 0) return { fmv: null, effN: 0, sold: 0 };

  let weight = 0;
  let value = 0;
  let sold = 0;

  for (const p of cls.points) {
    const m = specMult(p) || 1;
    const rating = p.rating || cls.refRating;
    const cadRef = (priceCAD(p, a) / rating) * cls.refRating;
    const fmvEq = (cadRef / m) * toFmvFactor(p.sourceType, a);
    const w = sourceQuality(p.sourceType) * recencyWeight(p, a, asOf);
    weight += w;
    value += fmvEq * w;
    if (isVerifiedSold(p.sourceType)) sold++;
  }

  return { fmv: weight ? value / weight : null, effN: weight, sold };
}

// reference conf: none -> indicative -> medium -> high.
// High requires at least 3 verified sold points AND summed weight >= 2.5.
export function confidence(
  cls: EquipmentClass,
  a: Assumptions,
  asOf: Date | string | number = Date.now(),
): ConfidenceLevel {
  const { fmv, sold, effN } = classFMV(cls, a, asOf);
  if (fmv === null) return "none";
  if (sold >= 3 && effN >= 2.5) return "high";
  if (sold >= 1) return "medium";
  return "indicative";
}

// reference band: OLV and FLV follow FMV by the stored ratios. Null for an
// empty class. CLAUDE.md: never output a band for a class with no data.
export function band(
  cls: EquipmentClass,
  a: Assumptions,
  asOf: Date | string | number = Date.now(),
): Band | null {
  const { fmv } = classFMV(cls, a, asOf);
  if (fmv === null) return null;
  return { fmv, olv: fmv * a.olvRatio, flv: fmv * a.flvRatio };
}

// reference valuate(): value a specific subject unit against its class.
// Class FMV reference, scaled linearly by rating, re-adjusted for the subject's
// own spec. Returns null when the class has no data (no guess).
export function valuateUnit(
  cls: EquipmentClass,
  subject: SubjectUnit,
  a: Assumptions,
  asOf: Date | string | number = Date.now(),
): UnitValuation | null {
  const cf = classFMV(cls, a, asOf);
  if (cf.fmv === null) return null;

  const m = specMult(subject) || 1;
  const scale = subject.rating / cls.refRating;
  const fmv = cf.fmv * scale * m;
  const olv = fmv * a.olvRatio;
  const flv = fmv * a.flvRatio;
  const transport = subject.transport || 0;

  return {
    classFmvRef: cf.fmv,
    rating: subject.rating,
    scale,
    specMult: m,
    fmv,
    olv,
    flv,
    spread: fmv - olv - transport,
    transport,
    confidence: confidence(cls, a, asOf),
    askOnly: cf.sold === 0,
  };
}
