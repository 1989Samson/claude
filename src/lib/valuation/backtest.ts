// Leave-one-out backtest. For each verified sold point in a class, predict its
// value from the rest of the class data and compare to what it actually
// realized. Reports the median absolute percent error: the model's own error,
// stated only once verified sold data exists (CLAUDE.md).
//
// Predicted and actual are both expressed as the point's implied class FMV
// (pointFmvEq), which is algebraically identical to comparing the predicted
// realized price against the actual realized price, but reuses the engine
// directly.

import { classFMV, pointFmvEq } from "./engine";
import { isVerifiedSold } from "./factors";
import type { Assumptions, DataPoint, EquipmentClass } from "./types";

export interface ClassBacktest {
  nPoints: number; // verified sold points actually evaluated
  medianAbsPctError: number | null; // null when too few points to evaluate
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

export function backtestClass(
  cls: EquipmentClass,
  a: Assumptions,
  asOf: Date | string | number = Date.now(),
): ClassBacktest {
  const verifiedIdx = cls.points
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => isVerifiedSold(p.sourceType));

  const errors: number[] = [];
  for (const { p: held, i } of verifiedIdx) {
    const rest: DataPoint[] = cls.points.filter((_, j) => j !== i);
    if (rest.length === 0) continue; // nothing to predict from

    const predicted = classFMV({ refRating: cls.refRating, points: rest }, a, asOf).fmv;
    if (predicted === null) continue;

    const actual = pointFmvEq(held, cls.refRating, a);
    if (actual <= 0) continue;

    errors.push(Math.abs(predicted - actual) / actual);
  }

  return { nPoints: errors.length, medianAbsPctError: median(errors) };
}
