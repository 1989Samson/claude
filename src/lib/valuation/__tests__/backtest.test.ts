import { describe, expect, it } from "vitest";
import { backtestClass, median } from "../backtest";
import type { DataPoint, EquipmentClass } from "../types";
import { AS_OF, SEED_ASSUMPTIONS } from "./fixtures";

const a = SEED_ASSUMPTIONS;

// Two own_close points (factor 1.0), reference rating, all spec multipliers 1.0,
// dated AS_OF so recency is full. Their FMV-equivalents are just their CAD price.
const mk = (price: number): DataPoint => ({
  price,
  currency: "CAD",
  sourceType: "own_close",
  rating: 1000,
  hoursBand: "5to20k",
  condition: "running",
  packaging: "skid",
  config: "complete",
  saleDate: AS_OF,
});

describe("median", () => {
  it("handles odd and even lengths and empty", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("backtestClass", () => {
  it("computes leave-one-out median absolute percent error", () => {
    const cls: EquipmentClass = { refRating: 1000, points: [mk(100000), mk(120000)] };
    // Leave out 100k -> predict from 120k -> error |120k-100k|/100k = 0.20
    // Leave out 120k -> predict from 100k -> error |100k-120k|/120k = 0.16667
    // median = 0.18333
    const res = backtestClass(cls, a, AS_OF);
    expect(res.nPoints).toBe(2);
    expect(res.medianAbsPctError).toBeCloseTo(0.18333, 4);
  });

  it("perfect agreement yields zero error", () => {
    const cls: EquipmentClass = { refRating: 1000, points: [mk(100000), mk(100000)] };
    const res = backtestClass(cls, a, AS_OF);
    expect(res.medianAbsPctError).toBe(0);
  });

  it("does not hold out asking points, only verified sold", () => {
    const asking: DataPoint = { ...mk(500000), sourceType: "asking" };
    const cls: EquipmentClass = {
      refRating: 1000,
      points: [mk(100000), mk(120000), asking],
    };
    // Still 2 verified sold points evaluated; the asking point stays in training.
    const res = backtestClass(cls, a, AS_OF);
    expect(res.nPoints).toBe(2);
  });

  it("returns null error for a class with no verified sold points", () => {
    const asking: DataPoint = { ...mk(500000), sourceType: "asking" };
    const cls: EquipmentClass = { refRating: 1000, points: [asking] };
    const res = backtestClass(cls, a, AS_OF);
    expect(res.nPoints).toBe(0);
    expect(res.medianAbsPctError).toBeNull();
  });

  it("skips a lone point with nothing to predict from", () => {
    const cls: EquipmentClass = { refRating: 1000, points: [mk(100000)] };
    const res = backtestClass(cls, a, AS_OF);
    expect(res.nPoints).toBe(0);
    expect(res.medianAbsPctError).toBeNull();
  });
});
