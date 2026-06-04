// Self-calibration. The asking-to-FMV and auction-to-FMV factors ship as
// uncalibrated assumptions (flagged in the UI). Once a class holds verified sold
// points, those factors can be fitted to the firm's own data instead of guessed.
//
// Method: for each point compute its normalized CAD level at the reference
// rating, BEFORE the source factor (priceCAD / rating-scaled / spec multiplier).
// Verified non-auction sold points (own_close, sold_private, sisp) carry factor
// 1.0, so their level is the true FMV anchor. The calibrated factor that maps an
// asking (or auction) level onto FMV is anchor_level / observed_level. We pool
// these ratios within each class (which removes price-scale differences) and
// take the median across classes.

import { priceCAD } from "./engine";
import { specMult } from "./factors";
import { median } from "./backtest";
import type { Assumptions, DataPoint, EquipmentClass } from "./types";

const SOLD_ANCHOR = new Set(["own_close", "sold_private", "sisp"]);

function normalizedLevel(p: DataPoint, refRating: number, a: Assumptions): number {
  const m = specMult(p) || 1;
  const rating = p.rating || refRating;
  return ((priceCAD(p, a) / rating) * refRating) / m;
}

export interface Calibration {
  askToFmv: number | null;
  auctionToFmv: number | null;
  nAsking: number;
  nAuction: number;
  nAnchor: number; // verified non-auction sold points used as FMV anchors
}

// Per-class calibration (needs an FMV anchor and observations in the class).
export function calibrateClass(cls: EquipmentClass, a: Assumptions): Calibration {
  const anchors = cls.points.filter((p) => SOLD_ANCHOR.has(p.sourceType));
  const anchor = median(anchors.map((p) => normalizedLevel(p, cls.refRating, a)));
  const asking = cls.points.filter((p) => p.sourceType === "asking");
  const auction = cls.points.filter((p) => p.sourceType === "auction");

  const askLevel = median(asking.map((p) => normalizedLevel(p, cls.refRating, a)));
  const aucLevel = median(auction.map((p) => normalizedLevel(p, cls.refRating, a)));

  return {
    askToFmv: anchor && askLevel ? anchor / askLevel : null,
    auctionToFmv: anchor && aucLevel ? anchor / aucLevel : null,
    nAsking: asking.length,
    nAuction: auction.length,
    nAnchor: anchors.length,
  };
}

// Pooled calibration across classes. Within each class with an FMV anchor, every
// asking/auction point contributes a ratio anchor/level; ratios are pooled and
// the median taken. Factors are only returned with enough observations.
export function calibratePooled(
  classes: EquipmentClass[],
  a: Assumptions,
  minObservations = 3,
): Calibration {
  const askRatios: number[] = [];
  const aucRatios: number[] = [];
  let nAnchor = 0;

  for (const cls of classes) {
    const anchors = cls.points.filter((p) => SOLD_ANCHOR.has(p.sourceType));
    const anchor = median(anchors.map((p) => normalizedLevel(p, cls.refRating, a)));
    if (!anchor) continue;
    nAnchor += anchors.length;

    for (const p of cls.points) {
      const level = normalizedLevel(p, cls.refRating, a);
      if (level <= 0) continue;
      if (p.sourceType === "asking") askRatios.push(anchor / level);
      else if (p.sourceType === "auction") aucRatios.push(anchor / level);
    }
  }

  return {
    askToFmv: askRatios.length >= minObservations ? median(askRatios) : null,
    auctionToFmv: aucRatios.length >= minObservations ? median(aucRatios) : null,
    nAsking: askRatios.length,
    nAuction: aucRatios.length,
    nAnchor,
  };
}
