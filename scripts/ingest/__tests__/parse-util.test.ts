import { describe, expect, it } from "vitest";
import { itemsOf, mapItems, mapJsonLd, type FieldKeys } from "../parse-util";

const KEYS: FieldKeys = {
  title: ["title", "name"],
  soldPrice: ["winningBid", "salePrice"],
  bid: ["currentBid", "price"],
  date: ["endDate"],
  url: ["url"],
  id: ["id"],
  status: ["status"],
};

describe("itemsOf", () => {
  it("finds the items array in common envelopes", () => {
    expect(itemsOf([{ a: 1 }])).toHaveLength(1);
    expect(itemsOf({ results: [{ a: 1 }, { b: 2 }] })).toHaveLength(2);
    expect(itemsOf({ data: { items: [{ a: 1 }] } })).toHaveLength(1);
    expect(itemsOf({ nothing: true })).toEqual([]);
  });
});

describe("mapItems", () => {
  it("treats a winning bid / closed status as a realized auction price", () => {
    const lots = mapItems(
      [{ title: "Gen", winningBid: "88000", status: "Closed", endDate: "2026-05-01", url: "u", id: "1" }],
      "GovDeals",
      KEYS,
    );
    expect(lots[0]!.price).toBe(88000);
    expect(lots[0]!.sourceType).toBe("auction");
  });

  it("treats an open current bid as asking, not a sold comp", () => {
    const lots = mapItems([{ title: "Loader", currentBid: "45000", status: "Open", id: "2", url: "u" }], "GovDeals", KEYS);
    expect(lots[0]!.price).toBe(45000);
    expect(lots[0]!.sourceType).toBe("asking");
  });

  it("honors the currency argument (CAD for govdeals.ca)", () => {
    const lots = mapItems([{ title: "Truck", winningBid: "30000", status: "sold", id: "3", url: "u" }], "GovDeals", KEYS, "CAD");
    expect(lots[0]!.currencyHint).toBe("CAD");
  });

  it("skips items without a title or a price", () => {
    expect(mapItems([{ winningBid: "1000" }], "X", KEYS)).toEqual([]);
    expect(mapItems([{ title: "No price" }], "X", KEYS)).toEqual([]);
  });
});

describe("mapJsonLd", () => {
  it("maps Product/Offer JSON-LD, defaulting to asking for live listings", () => {
    const blocks = [
      {
        "@type": "Product",
        name: "Oilfield generator",
        url: "https://salvex.com/x",
        offers: { price: "12500", priceCurrency: "USD" },
      },
    ];
    const lots = mapJsonLd(blocks, "Salvex");
    expect(lots[0]!.price).toBe(12500);
    expect(lots[0]!.sourceType).toBe("asking");
  });

  it("marks sold when availability says so", () => {
    const blocks = [
      { "@type": "Product", name: "Pump", url: "u", offers: { price: "5000", availability: "https://schema.org/SoldOut" } },
    ];
    expect(mapJsonLd(blocks, "Salvex")[0]!.sourceType).toBe("auction");
  });
});
