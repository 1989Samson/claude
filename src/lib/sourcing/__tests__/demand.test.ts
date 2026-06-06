import { describe, expect, it, vi } from "vitest";
import { buildUniverse, sanitizeItems, type DemandClient } from "../demand";

function fakeClient(jsonText: string): DemandClient {
  return {
    messages: { create: vi.fn(async () => ({ content: [{ type: "text", text: jsonText }] })) },
  };
}

describe("sanitizeItems", () => {
  it("keeps items with a name, tolerating odd categories and a missing comma", () => {
    const out = sanitizeItems([
      { item: "Underground LHD", category: "underground_mobile", usedSuitability: "high" },
      { item: "Ball mill", category: "whatever_made_up" }, // odd category still kept
      { category: "no name" }, // dropped: no item
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]!.item).toBe("Underground LHD");
  });
});

describe("buildUniverse", () => {
  it("parses the items array from the model and returns a universe", async () => {
    const client = fakeClient(
      JSON.stringify({
        items: [
          { item: "Cone crusher", category: "plant", sizeSpec: "4.25 ft", usedSuitability: "medium", targetModels: ["Symons"] },
          { item: "Haul truck", category: "open_pit", usedSuitability: "high" },
        ],
      }),
    );
    const u = await buildUniverse({ project: "Test Mine", location: "Nevada" }, { client });
    expect(u.project).toBe("Test Mine");
    expect(u.location).toBe("Nevada");
    expect(u.items).toHaveLength(2);
    expect(u.items[0]!.item).toBe("Cone crusher");
  });

  it("recovers items despite a missing comma between objects", async () => {
    const client = fakeClient(
      `{"items":[{"item":"A","category":"plant"} {"item":"B","category":"support"}]}`,
    );
    const u = await buildUniverse({ project: "X" }, { client });
    expect(u.items).toHaveLength(2);
  });
});
