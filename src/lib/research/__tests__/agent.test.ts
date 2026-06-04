import { describe, expect, it, vi } from "vitest";
import { extractJson, researchAsset, sanitizeComps, type ResearchClient } from "../agent";

function fakeClient(jsonText: string): ResearchClient {
  return {
    messages: {
      create: vi.fn(async () => ({ content: [{ type: "text", text: jsonText }] })),
    },
  };
}

const goodComp = {
  description: "CAT 3516 1000kW genset, 2013, 28k hrs",
  price: 95000,
  currency: "USD",
  type: "auction",
  sourceName: "Superior Energy Auctioneers",
  url: "https://superiorauctioneers.com/archive/lot/123",
  date: "2026-04-10",
};

describe("extractJson", () => {
  it("reads fenced and bare JSON", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('noise {"a":2} trailing')).toEqual({ a: 2 });
  });
  it("throws when there is no object", () => {
    expect(() => extractJson("no json here")).toThrow();
  });
});

describe("sanitizeComps", () => {
  it("keeps only comps with a valid source URL and price", () => {
    const comps = sanitizeComps([
      goodComp,
      { ...goodComp, url: "" }, // no url -> dropped
      { ...goodComp, url: "not-a-url" }, // bad url -> dropped
      { ...goodComp, price: 0 }, // no price -> dropped
    ]);
    expect(comps).toHaveLength(1);
    expect(comps[0]!.url).toContain("superiorauctioneers");
  });
});

describe("researchAsset", () => {
  const input = { description: "CAT G3516 1000kW genset", fxRate: 1.385 };

  it("returns a cited band when comps are real", async () => {
    const client = fakeClient(
      JSON.stringify({
        band: { fmvCAD: 170000, olvCAD: 119000, flvCAD: 93500 },
        confidence: "medium",
        comps: [goodComp, { ...goodComp, price: 110000, type: "asking", url: "https://machinerytrader.com/x" }],
        reasoning: "Two recent comps.",
        caveats: "Thin sample.",
      }),
    );
    const res = await researchAsset(input, { client });
    expect(res.band?.fmvCAD).toBe(170000);
    expect(res.comps).toHaveLength(2);
    expect(res.confidence).toBe("medium");
  });

  it("nulls an uncited band: a band with no surviving comp is not defensible", async () => {
    const client = fakeClient(
      JSON.stringify({
        band: { fmvCAD: 170000, olvCAD: 119000, flvCAD: 93500 },
        confidence: "high",
        comps: [{ ...goodComp, url: "" }], // dropped by guardrail
        reasoning: "Claimed a band.",
        caveats: "",
      }),
    );
    const res = await researchAsset(input, { client });
    expect(res.band).toBeNull();
    expect(res.confidence).toBe("low");
    expect(res.comps).toHaveLength(0);
    expect(res.caveats).toMatch(/source-URL/i);
  });

  it("passes through an honest no-evidence result", async () => {
    const client = fakeClient(
      JSON.stringify({
        band: null,
        confidence: "low",
        comps: [],
        reasoning: "No comps found.",
        caveats: "No realized data for this class.",
      }),
    );
    const res = await researchAsset(input, { client });
    expect(res.band).toBeNull();
    expect(res.comps).toEqual([]);
  });
});
