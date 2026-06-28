import { describe, expect, it } from "vitest";
import { estimate } from "../engine";
import { isInfeasible, type UnitInput } from "../schema";

// Golden values captured from the reference prototype transport_estimator.py
// (v2). These lock the TypeScript port to the Python output, figure for figure,
// so the rate tables can move without the logic silently drifting.

function unit(p: Partial<UnitInput> & Pick<UnitInput, "model" | "cls" | "origin" | "valueUsd">): UnitInput {
  return { mw: 0, winter: false, waterfront: false, ...p };
}

describe("estimate - parity with the Python prototype", () => {
  it("Class A genset, US -> AB (overland, no ocean)", () => {
    const { internal, buyer } = estimate(
      unit({ model: "MTU 20V4000 GS genset", cls: "A", origin: "US", valueUsd: 1_200_000, madeIn: "DE", mw: 2.5 }),
      "AB",
    );
    if (isInfeasible(internal)) throw new Error("should be feasible");
    expect(internal.stackUsd.origin_prep).toEqual([5_000, 25_000]);
    expect(internal.stackUsd.inland_haul).toEqual([5_850, 10_400]);
    expect(internal.stackUsd.escorts).toEqual([2_275, 2_275]);
    expect(internal.stackUsd.gst_provincial).toEqual([61_000, 61_000]);
    expect(internal.logisticsUsd).toEqual([18_725, 56_075]);
    expect(internal.taxesUsd).toEqual([61_000, 61_000]);
    expect(internal.deliveredWithTaxUsd).toEqual([79_725, 117_075]);
    expect(internal.weeksToSite).toEqual([6, 9]);
    expect(buyer!.indicativeLogisticsBandUsd).toEqual([10_000, 60_000]);
    // The HS 8502 / CETA flag must surface on every Class A genset.
    expect(internal.flags.some((f) => f.includes("HS 8502"))).toBe(true);
  });

  it("Class B aero, UAE -> AB (ocean via Vancouver, Gulf surcharge, heavy lift)", () => {
    const { internal, buyer } = estimate(
      unit({ model: "Siemens SGT-500 (UAE)", cls: "B", origin: "AE", valueUsd: 6_000_000, madeIn: "DE", mw: 18.5 }),
      "AB",
    );
    if (isInfeasible(internal)) throw new Error("should be feasible");
    expect(internal.stackUsd.ocean_freight).toEqual([9_315, 24_840]);
    expect(internal.stackUsd.heavy_lift_surcharge).toEqual([27_000, 108_000]);
    expect(internal.stackUsd.marine_insurance).toEqual([6_000, 30_000]);
    expect(internal.logisticsUsd).toEqual([108_678, 390_378]);
    expect(internal.weeksToSite).toEqual([13, 16]);
    expect(buyer!.indicativeLogisticsBandUsd).toEqual([100_000, 400_000]);
  });

  it("Class B aero, Japan -> AB (Prince Rupert)", () => {
    const { internal, buyer } = estimate(
      unit({ model: "Kawasaki L30A (Japan)", cls: "B", origin: "JP", valueUsd: 12_000_000, madeIn: "JP", mw: 34 }),
      "AB",
    );
    if (isInfeasible(internal)) throw new Error("should be feasible");
    expect(internal.logisticsUsd).toEqual([114_925, 419_175]);
    expect(internal.weeksToSite).toEqual([11, 14]);
    expect(buyer!.indicativeLogisticsBandUsd).toEqual([100_000, 450_000]);
  });

  it("Class C frame, US -> AB, winter (banker's rounding on the haul)", () => {
    const { internal } = estimate(
      unit({ model: "GE Frame 6B (US West)", cls: "C", origin: "US", valueUsd: 9_000_000, madeIn: "US", winter: true, mw: 40 }),
      "AB",
    );
    if (isInfeasible(internal)) throw new Error("should be feasible");
    // 1300 * 5 * 1.125 = 7312.5 -> 7312 (half to even), not 7313.
    expect(internal.stackUsd.inland_haul).toEqual([7_312, 21_938]);
    expect(internal.logisticsUsd).toEqual([140_522, 438_468]);
    expect(internal.weeksToSite).toEqual([13, 16]);
  });

  it("Class C frame, Saudi -> ON (charter flag on the heaviest piece)", () => {
    const { internal, buyer } = estimate(
      unit({ model: "ABB GT10B (Saudi)", cls: "C", origin: "SA", valueUsd: 5_000_000, madeIn: "SE", mw: 24 }),
      "ON",
    );
    if (isInfeasible(internal)) throw new Error("should be feasible");
    expect(internal.logisticsUsd).toEqual([212_075, 692_670]);
    expect(internal.weeksToSite).toEqual([16, 19]);
    expect(buyer!.indicativeLogisticsBandUsd).toEqual([200_000, 700_000]);
    expect(internal.flags.some((f) => f.includes("charter"))).toBe(true);
  });

  it("Class D barge to an inland site is infeasible, not a low number", () => {
    const { internal, buyer } = estimate(
      unit({ model: "GE Frame 5 Power Barge", cls: "D", origin: "US", valueUsd: 15_000_000, madeIn: "US", mw: 160 }),
      "AB",
    );
    expect(isInfeasible(internal)).toBe(true);
    expect(buyer).toBeNull();
  });

  it("buyer band never carries the precise internal logistics figure", () => {
    const { internal, buyer } = estimate(
      unit({ model: "x", cls: "B", origin: "AE", valueUsd: 6_000_000 }),
      "AB",
    );
    if (isInfeasible(internal)) throw new Error("should be feasible");
    // Coarse band must bracket but not equal the precise stack.
    expect(buyer!.indicativeLogisticsBandUsd[0]).not.toEqual(internal.logisticsUsd[0]);
    expect(buyer!.indicativeLogisticsBandUsd[1]).not.toEqual(internal.logisticsUsd[1]);
  });
});
