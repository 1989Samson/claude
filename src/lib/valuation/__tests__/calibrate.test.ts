import { describe, expect, it } from "vitest";
import { calibrateClass, calibratePooled } from "../calibrate";
import type { DataPoint, EquipmentClass } from "../types";
import { SEED_ASSUMPTIONS } from "./fixtures";

const a = SEED_ASSUMPTIONS;

// All points at the reference rating with all-1.0 spec multipliers, CAD, so a
// point's normalized level equals its price. This lets us pin the calibration.
const pt = (price: number, sourceType: DataPoint["sourceType"]): DataPoint => ({
  price,
  currency: "CAD",
  sourceType,
  rating: 1000,
  hoursBand: "5to20k",
  condition: "running",
  packaging: "skid",
  config: "complete",
  saleDate: "2026-05-01",
});

describe("calibrateClass", () => {
  it("fits ask-to-FMV as sold level over asking level", () => {
    // Sold (FMV anchor) median 100k; asking median 125k -> factor 0.80.
    const cls: EquipmentClass = {
      refRating: 1000,
      points: [
        pt(100000, "own_close"),
        pt(100000, "sold_private"),
        pt(120000, "asking"),
        pt(130000, "asking"),
      ],
    };
    const cal = calibrateClass(cls, a);
    expect(cal.askToFmv).toBeCloseTo(0.8, 6); // 100000 / 125000
    expect(cal.nAnchor).toBe(2);
    expect(cal.nAsking).toBe(2);
  });

  it("fits auction-to-FMV as sold level over auction level (gross-up > 1)", () => {
    const cls: EquipmentClass = {
      refRating: 1000,
      points: [pt(100000, "sisp"), pt(70000, "auction")],
    };
    const cal = calibrateClass(cls, a);
    expect(cal.auctionToFmv).toBeCloseTo(100000 / 70000, 6); // ~1.43
  });

  it("returns null factors when there is no FMV anchor", () => {
    const cls: EquipmentClass = {
      refRating: 1000,
      points: [pt(120000, "asking"), pt(130000, "asking")],
    };
    const cal = calibrateClass(cls, a);
    expect(cal.askToFmv).toBeNull();
    expect(cal.auctionToFmv).toBeNull();
  });
});

describe("calibratePooled", () => {
  it("pools within-class ratios and needs enough observations", () => {
    const c1: EquipmentClass = {
      refRating: 1000,
      points: [pt(100000, "own_close"), pt(125000, "asking"), pt(125000, "asking")],
    };
    // Different price scale; within-class normalization should still give 0.8.
    const c2: EquipmentClass = {
      refRating: 1,
      points: [
        { ...pt(1000000, "own_close"), rating: 1 },
        { ...pt(1250000, "asking"), rating: 1 },
      ],
    };
    const cal = calibratePooled([c1, c2], a);
    expect(cal.askToFmv).toBeCloseTo(0.8, 6);
    expect(cal.nAsking).toBe(3);
  });

  it("withholds a factor below the minimum observation count", () => {
    const c1: EquipmentClass = {
      refRating: 1000,
      points: [pt(100000, "own_close"), pt(125000, "asking")],
    };
    const cal = calibratePooled([c1], a, 3);
    expect(cal.askToFmv).toBeNull(); // only 1 asking observation
  });
});
