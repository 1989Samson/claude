import { describe, expect, it } from "vitest";
import { gridGapFor, planRead } from "../plan";
import { type WedgeInput } from "../schema";

function input(p: Partial<WedgeInput>): WedgeInput {
  return { mw: 50, province: "AB", mode: "unsure", timeframe: "asap", gas: "unsure", ...p };
}

describe("planRead", () => {
  it("returns both stage options, bridge and prime", () => {
    const r = planRead(input({}));
    expect(r.options.map((o) => o.stage)).toEqual(["Bridge", "Prime"]);
  });

  it("sizes the bridge count to cover the MW with gensets", () => {
    const r = planRead(input({ mw: 50 }));
    const bridge = r.options.find((o) => o.stage === "Bridge")!;
    // 50 MW / 2.5 MW per genset = 20 units.
    expect(bridge.unitCount).toBe(20);
    expect(bridge.config).toContain("20 x");
  });

  it("recommends the fast bridge option when timeframe is ASAP", () => {
    const r = planRead(input({ timeframe: "asap" }));
    expect(r.options.find((o) => o.stage === "Bridge")!.recommended).toBe(true);
    expect(r.options.find((o) => o.stage === "Prime")!.recommended).toBe(false);
  });

  it("recommends prime when the buyer asks for prime and is not in a rush", () => {
    const r = planRead(input({ mode: "prime", timeframe: "12mo_plus" }));
    expect(r.options.find((o) => o.stage === "Prime")!.recommended).toBe(true);
  });

  it("gives an honest widening band: low below high, both hard-rounded", () => {
    const r = planRead(input({ mw: 50 }));
    for (const o of r.options) {
      expect(o.deliveredBandUsd[0]).toBeLessThan(o.deliveredBandUsd[1]);
      expect(o.weeksToPad[0]).toBeLessThanOrEqual(o.weeksToPad[1]);
      // hard-rounded: no precise figures leak.
      expect(o.deliveredBandUsd[0] % 10_000).toBe(0);
      expect(o.deliveredBandUsd[1] % 10_000).toBe(0);
    }
  });

  it("uses heavy-frame turbines for very large prime builds", () => {
    const r = planRead(input({ mw: 200, mode: "prime" }));
    const prime = r.options.find((o) => o.stage === "Prime")!;
    expect(prime.config).toContain("heavy-frame");
  });

  it("carries the verified Alberta grid gap with its source", () => {
    const gap = gridGapFor("AB");
    expect(gap.verified).toBe(true);
    expect(gap.source).toContain("cbc.ca");
    expect(gap.headline.length).toBeGreaterThan(0);
  });

  it("keeps Ontario honest: no fabricated queue numbers, marked unverified", () => {
    const gap = gridGapFor("ON");
    expect(gap.verified).toBe(false);
    expect(gap.source).toBeNull();
  });

  it("flags gas on the critical path when the buyer has no gas", () => {
    const r = planRead(input({ gas: "no" }));
    expect(r.confidence).toContain("critical path");
  });
});
