import { describe, expect, it, vi } from "vitest";
import { buildSupplyPrompt, findSupply, sanitizeCandidates, type SupplyClient } from "../supply";

function fakeClient(jsonText: string): SupplyClient {
  return {
    messages: {
      create: vi.fn(async () => ({ content: [{ type: "text", text: jsonText }] })),
    },
  };
}

const good = {
  description: "2016 CAT R1700G LHD, low-profile, rebuilt",
  make: "CAT",
  model: "R1700G",
  year: 2016,
  hours: 12000,
  priceText: "US $385,000",
  currency: "USD",
  location: "Elko, NV",
  condition: "rebuilt",
  sourceName: "MachineryTrader",
  url: "https://www.machinerytrader.com/listing/123",
};

describe("buildSupplyPrompt", () => {
  it("includes the item, spec, and target models", () => {
    const p = buildSupplyPrompt({ item: "Underground LHD", sizeSpec: "6-10 yd3", targetModels: ["CAT R1700"] });
    expect(p).toContain("Underground LHD");
    expect(p).toContain("6-10 yd3");
    expect(p).toContain("CAT R1700");
    expect(p).toContain("real source URL");
  });
});

describe("sanitizeCandidates", () => {
  it("keeps only candidates with a valid source URL", () => {
    const out = sanitizeCandidates([
      good,
      { ...good, url: "" }, // no url -> dropped
      { ...good, url: "not-a-url" }, // bad url -> dropped
      { ...good, sourceName: "" }, // no source -> dropped
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.model).toBe("R1700G");
  });
});

describe("findSupply", () => {
  it("returns cited candidates from the {candidates:[...]} payload", async () => {
    const client = fakeClient(
      JSON.stringify({ candidates: [good, { ...good, model: "LH514", sourceName: "Mascus", url: "https://mascus.com/x" }] }),
    );
    const res = await findSupply({ item: "Underground LHD" }, { client });
    expect(res).toHaveLength(2);
    expect(res[0]!.url).toContain("machinerytrader");
  });

  it("returns empty when the agent finds nothing", async () => {
    const client = fakeClient(JSON.stringify({ candidates: [] }));
    expect(await findSupply({ item: "Ball mill" }, { client })).toEqual([]);
  });

  it("drops uncited listings even if the agent returns them", async () => {
    const client = fakeClient(JSON.stringify({ candidates: [{ ...good, url: "" }] }));
    expect(await findSupply({ item: "Dozer" }, { client })).toEqual([]);
  });
});
