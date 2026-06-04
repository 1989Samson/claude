import { describe, expect, it, vi } from "vitest";
import {
  buildSystemPrompt,
  normalizeLot,
  type AnthropicLike,
} from "../normalize";
import type { ClassRef, RawLot } from "../types";

const CLASSES: ClassRef[] = [
  {
    slug: "og_gen_g3516",
    name: "CAT G3516 gas genset",
    sector: "Oil & Gas",
    category: "Power generation",
    unit: "kW",
  },
  {
    slug: "mn_truck_793",
    name: "Haul truck CAT 793 class",
    sector: "Mining",
    category: "Mobile fleet",
    unit: "each",
  },
];

// A fake Anthropic client that returns a forced tool_use with the given input.
function fakeClient(input: unknown): AnthropicLike {
  return {
    messages: {
      create: vi.fn(async () => ({
        content: [{ type: "tool_use", name: "classify_lot", input }],
      })),
    },
  };
}

const soldLot: RawLot = {
  title: "2014 CAT 3516 1000 kW Natural Gas Generator Set",
  description: "Open skid, running, ~30,000 hours",
  price: 92000,
  priceText: "USD 92000",
  currencyHint: "USD",
  saleDate: "2026-05-15",
  url: "https://www.govplanet.com/item/412",
  lotRef: "Lot 412",
  sourceName: "GovPlanet",
};

describe("buildSystemPrompt", () => {
  it("lists every class slug for the model to choose from", () => {
    const sys = buildSystemPrompt(CLASSES);
    expect(sys).toContain("og_gen_g3516");
    expect(sys).toContain("mn_truck_793");
    expect(sys).toContain("return 'none'");
  });
});

describe("normalizeLot", () => {
  it("maps a confident classification to an import row, keeping price deterministic", async () => {
    const client = fakeClient({
      classId: "og_gen_g3516",
      rating: 1000,
      hoursBand: "20to40k",
      condition: "running",
      packaging: "skid",
      config: "complete",
    });
    const row = await normalizeLot(soldLot, CLASSES, { client });
    expect(row).not.toBeNull();
    expect(row!.classId).toBe("og_gen_g3516");
    // Hard facts come from the lot, not the model.
    expect(row!.price).toBe(92000);
    expect(row!.cur).toBe("USD");
    expect(row!.type).toBe("auction");
    expect(row!.date).toBe("2026-05-15");
    expect(row!.rating).toBe(1000);
    expect(row!.hours).toBe("20to40k");
    // Source note is non-empty and traceable.
    expect(row!.src).toContain("GovPlanet");
    expect(row!.src).toContain("https://www.govplanet.com/item/412");
  });

  it("returns null when the model declines to match (classId 'none')", async () => {
    const client = fakeClient({
      classId: "none",
      hoursBand: "unknown",
      condition: "unknown",
      packaging: "na",
      config: "na",
    });
    expect(await normalizeLot(soldLot, CLASSES, { client })).toBeNull();
  });

  it("returns null for an unknown slug the model hallucinated", async () => {
    const client = fakeClient({
      classId: "not_a_real_slug",
      hoursBand: "unknown",
      condition: "unknown",
      packaging: "na",
      config: "na",
    });
    expect(await normalizeLot(soldLot, CLASSES, { client })).toBeNull();
  });

  it("skips a lot with no usable price without calling the model", async () => {
    const client = fakeClient({ classId: "og_gen_g3516" });
    const noPrice = { ...soldLot, price: 0 };
    const row = await normalizeLot(noPrice, CLASSES, { client });
    expect(row).toBeNull();
    expect(client.messages.create).not.toHaveBeenCalled();
  });

  it("coerces out-of-enum spec values to safe defaults", async () => {
    const client = fakeClient({
      classId: "og_gen_g3516",
      rating: null,
      hoursBand: "garbage",
      condition: "garbage",
      packaging: "garbage",
      config: "garbage",
    });
    const row = await normalizeLot(soldLot, CLASSES, { client });
    expect(row!.hours).toBe("unknown");
    expect(row!.cond).toBe("unknown");
    expect(row!.encl).toBe("na");
    expect(row!.config).toBe("na");
    expect(row!.rating).toBeUndefined();
  });
});
