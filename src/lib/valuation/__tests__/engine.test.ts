import { describe, expect, it } from "vitest";
import {
  band,
  classFMV,
  confidence,
  priceCAD,
  recencyWeight,
  toFmvFactor,
  valuateUnit,
} from "../engine";
import { specMult } from "../factors";
import type { Assumptions, DataPoint, EquipmentClass } from "../types";
import { AS_OF, SEED_ASSUMPTIONS, classBySlug } from "./fixtures";

const a = SEED_ASSUMPTIONS;

// ---------------------------------------------------------------------------
// Golden-master tests: reproduce the reference_ui.html numbers for the two
// seeded classes at asOf=2026-06-03. These pin the full port end to end.
// Derivation is documented in each case; values were computed from the exact
// reference formula (priceCAD / specMult / source factor, quality * recency).
// ---------------------------------------------------------------------------
describe("reference numbers: CAT G3516 gas genset", () => {
  const cls = classBySlug("og_gen_g3516");

  it("matches the reference weighted FMV", () => {
    const { fmv } = classFMV(cls, a, AS_OF);
    // 4 asking points, all USD@1.385, equal weight -> mean of FMV-equivalents.
    expect(fmv).toBeCloseTo(166965.0240574643, 4);
  });

  it("produces the reference FLV / OLV / FMV band in CAD", () => {
    const b = band(cls, a, AS_OF)!;
    expect(Math.round(b.fmv)).toBe(166965);
    expect(Math.round(b.olv)).toBe(116876); // FMV * 0.70
    expect(Math.round(b.flv)).toBe(91831); // FMV * 0.55
  });

  it("is asking-only, so confidence is Indicative and never higher", () => {
    const { sold, effN } = classFMV(cls, a, AS_OF);
    expect(sold).toBe(0);
    expect(effN).toBeCloseTo(1.7457946768060837, 6);
    expect(confidence(cls, a, AS_OF)).toBe("indicative");
  });
});

describe("reference numbers: Haul truck CAT 793 class", () => {
  const cls = classBySlug("mn_truck_793");

  it("matches the reference weighted FMV", () => {
    const { fmv } = classFMV(cls, a, AS_OF);
    expect(fmv).toBeCloseTo(1257966.433528428, 4);
  });

  it("produces the reference FLV / OLV / FMV band in CAD", () => {
    const b = band(cls, a, AS_OF)!;
    expect(Math.round(b.fmv)).toBe(1257966);
    expect(Math.round(b.olv)).toBe(880577);
    expect(Math.round(b.flv)).toBe(691882);
  });

  it("is asking-only, so confidence is Indicative", () => {
    expect(classFMV(cls, a, AS_OF).sold).toBe(0);
    expect(confidence(cls, a, AS_OF)).toBe("indicative");
  });
});

// ---------------------------------------------------------------------------
// Unit tests for the individual engine pieces.
// ---------------------------------------------------------------------------
describe("currency", () => {
  it("converts USD at the stored rate and passes CAD through", () => {
    const usd: DataPoint = { price: 1000, currency: "USD", sourceType: "asking" };
    const cad: DataPoint = { price: 1000, currency: "CAD", sourceType: "asking" };
    expect(priceCAD(usd, a)).toBeCloseTo(1385, 6);
    expect(priceCAD(cad, a)).toBe(1000);
  });
});

describe("source to FMV factors", () => {
  it("rescales asking and auction, leaves sold/own at 1.0", () => {
    expect(toFmvFactor("asking", a)).toBe(a.askToFmv);
    expect(toFmvFactor("auction", a)).toBe(a.auctionToFmv);
    expect(toFmvFactor("sold_private", a)).toBe(1.0);
    expect(toFmvFactor("sisp", a)).toBe(1.0);
    expect(toFmvFactor("own_close", a)).toBe(1.0);
  });
});

describe("spec multiplier", () => {
  it("multiplies the four lookups, defaulting missing keys to 1", () => {
    expect(specMult({ hoursBand: "5to20k", condition: "running", packaging: "skid", config: "complete" })).toBeCloseTo(1.0, 9);
    expect(specMult({ hoursBand: "lt5k", condition: "rebuilt", packaging: "enclosed", config: "complete" })).toBeCloseTo(1.6445, 9);
    // Unknown keys fall back to 1.0 rather than blowing up.
    expect(specMult({ hoursBand: "???", condition: "???" })).toBe(1.0);
  });
});

describe("recency weight", () => {
  it("is full weight with no date or a future date", () => {
    expect(recencyWeight({ price: 1, currency: "CAD", sourceType: "asking" }, a, AS_OF)).toBe(1);
    expect(recencyWeight({ price: 1, currency: "CAD", sourceType: "asking", saleDate: "2027-01-01" }, a, AS_OF)).toBe(1);
  });
  it("decays toward the 0.3 floor for old points", () => {
    const ancient: DataPoint = { price: 1, currency: "CAD", sourceType: "asking", saleDate: "2000-01-01" };
    expect(recencyWeight(ancient, a, AS_OF)).toBe(0.3);
  });
});

describe("empty class", () => {
  const empty: EquipmentClass = { refRating: 1000, points: [] };
  it("never produces a band or a number (no guess)", () => {
    expect(classFMV(empty, a, AS_OF).fmv).toBeNull();
    expect(band(empty, a, AS_OF)).toBeNull();
    expect(confidence(empty, a, AS_OF)).toBe("none");
    expect(valuateUnit(empty, { rating: 1000 }, a, AS_OF)).toBeNull();
  });
});

describe("confidence tiers", () => {
  const ref = 1000;
  const mk = (overrides: Partial<DataPoint>): DataPoint => ({
    price: 100000,
    currency: "CAD",
    sourceType: "auction",
    rating: ref,
    hoursBand: "5to20k",
    condition: "running",
    packaging: "skid",
    config: "complete",
    saleDate: AS_OF,
    ...overrides,
  });

  it("asking-only stays Indicative regardless of count", () => {
    const cls: EquipmentClass = {
      refRating: ref,
      points: [mk({ sourceType: "asking" }), mk({ sourceType: "asking" }), mk({ sourceType: "asking" }), mk({ sourceType: "asking" })],
    };
    expect(confidence(cls, a, AS_OF)).toBe("indicative");
  });

  it("one verified sold point reads Medium", () => {
    const cls: EquipmentClass = { refRating: ref, points: [mk({ sourceType: "auction" })] };
    expect(confidence(cls, a, AS_OF)).toBe("medium");
  });

  it("three verified recent points with enough weight read High", () => {
    // own_close has quality 1.0; three recent points -> effN ~3.0 >= 2.5.
    const cls: EquipmentClass = {
      refRating: ref,
      points: [mk({ sourceType: "own_close" }), mk({ sourceType: "own_close" }), mk({ sourceType: "own_close" })],
    };
    const { sold, effN } = classFMV(cls, a, AS_OF);
    expect(sold).toBe(3);
    expect(effN).toBeGreaterThanOrEqual(2.5);
    expect(confidence(cls, a, AS_OF)).toBe("high");
  });

  it("three verified points with thin weight stay Medium", () => {
    // Old auction points decay below the High weight threshold.
    const old = { saleDate: "2010-01-01", sourceType: "auction" as const };
    const cls: EquipmentClass = { refRating: ref, points: [mk(old), mk(old), mk(old)] };
    const { effN } = classFMV(cls, a, AS_OF);
    expect(effN).toBeLessThan(2.5);
    expect(confidence(cls, a, AS_OF)).toBe("medium");
  });
});

describe("valuate a subject unit", () => {
  const cls = classBySlug("og_gen_g3516");

  it("scales the class FMV by rating and the subject spec multiplier", () => {
    const ref = classFMV(cls, a, AS_OF).fmv!;
    const v = valuateUnit(cls, { rating: 1000, hoursBand: "5to20k", condition: "running", packaging: "skid", config: "complete" }, a, AS_OF)!;
    // Reference spec (all multipliers 1.0) at the reference rating returns the class FMV.
    expect(v.scale).toBe(1);
    expect(v.specMult).toBeCloseTo(1.0, 9);
    expect(v.fmv).toBeCloseTo(ref, 6);
    expect(v.olv).toBeCloseTo(ref * a.olvRatio, 6);
    expect(v.flv).toBeCloseTo(ref * a.flvRatio, 6);
    expect(v.askOnly).toBe(true);
    expect(v.confidence).toBe("indicative");
  });

  it("doubling the rating doubles the FMV (linear scaling)", () => {
    const base = valuateUnit(cls, { rating: 1000 }, a, AS_OF)!;
    const big = valuateUnit(cls, { rating: 2000 }, a, AS_OF)!;
    expect(big.fmv).toBeCloseTo(base.fmv * 2, 6);
  });

  it("deducts transport only from the indicative spread", () => {
    const v = valuateUnit(cls, { rating: 1000, transport: 5000 }, a, AS_OF)!;
    expect(v.transport).toBe(5000);
    expect(v.spread).toBeCloseTo(v.fmv - v.olv - 5000, 6);
  });
});
