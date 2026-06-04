import { describe, expect, it } from "vitest";
import { parseGsaItems } from "../sources/gsa";

describe("parseGsaItems", () => {
  it("labels an awarded/sold lot as a realized auction price", () => {
    const json = {
      auctions: [
        {
          itemName: "Caterpillar 3516 1000kW Generator Set",
          awardPrice: "88000",
          auctionStatus: "Awarded",
          closeDate: "2026-05-18",
          url: "https://gsaauctions.gov/auctions/123",
          auctionId: "123",
        },
      ],
    };
    const lots = parseGsaItems(json);
    expect(lots).toHaveLength(1);
    expect(lots[0]!.price).toBe(88000);
    expect(lots[0]!.sourceType).toBe("auction");
    expect(lots[0]!.saleDate).toBe("2026-05-18");
    expect(lots[0]!.url).toContain("gsaauctions.gov");
  });

  it("labels an open lot's current bid as asking, not a sold comp", () => {
    const json = {
      auctions: [
        {
          description: "Wheel loader",
          currentBid: "45000",
          auctionStatus: "Open",
          url: "u",
          auctionId: "9",
        },
      ],
    };
    const lots = parseGsaItems(json);
    expect(lots[0]!.price).toBe(45000);
    expect(lots[0]!.sourceType).toBe("asking");
  });

  it("skips items with no usable price", () => {
    const json = { auctions: [{ itemName: "No price item", auctionStatus: "Open" }] };
    expect(parseGsaItems(json)).toEqual([]);
  });

  it("handles a bare array and alternate field names", () => {
    const json = [
      { title: "Excavator", salePrice: "$120,000.00", status: "closed", saleDate: "2026-04-01", id: "7" },
    ];
    const lots = parseGsaItems(json);
    expect(lots[0]!.price).toBe(120000);
    expect(lots[0]!.sourceType).toBe("auction");
    expect(lots[0]!.lotRef).toBe("7");
  });

  it("returns nothing for an unexpected envelope", () => {
    expect(parseGsaItems({ unexpected: true })).toEqual([]);
  });
});
