import { afterEach, describe, expect, it, vi } from "vitest";
import { getSource, getSources } from "../sources";
import { GovDealsSource } from "../sources/govdeals";
import { SalvexSource } from "../sources/salvex";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GOVDEALS_RESULTS_URLS;
  delete process.env.SALVEX_RESULTS_URLS;
});

function stubFetch(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok,
      status: ok ? 200 : 503,
      text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    })),
  );
}

describe("source registry", () => {
  it("parses a comma-separated SOURCE list in order", () => {
    const s = getSources("govdeals,salvex,gsa");
    expect(s.map((x) => x.name)).toEqual(["GovDeals", "Salvex", "GSA Auctions"]);
  });
  it("rejects an unknown source", () => {
    expect(() => getSource("nope")).toThrow(/Unknown SOURCE/);
  });
});

describe("GovDealsSource", () => {
  it("maps a closed-auction JSON response and tags CAD for govdeals.ca", async () => {
    process.env.GOVDEALS_RESULTS_URLS = "https://www.govdeals.ca/api/search?status=closed";
    stubFetch({
      results: [
        { title: "Generator 500kW", winningBid: "42000", status: "Closed", endDate: "2026-05-10", url: "https://govdeals.ca/asset/1", id: "1" },
      ],
    });
    const lots = await new GovDealsSource().fetchRecentLots();
    expect(lots).toHaveLength(1);
    expect(lots[0]!.price).toBe(42000);
    expect(lots[0]!.sourceType).toBe("auction");
    expect(lots[0]!.currencyHint).toBe("CAD");
  });

  it("returns nothing on a non-OK response", async () => {
    process.env.GOVDEALS_RESULTS_URLS = "https://api.govdeals.com/search";
    stubFetch("error", false);
    expect(await new GovDealsSource().fetchRecentLots()).toEqual([]);
  });
});

describe("SalvexSource", () => {
  it("parses JSON-LD from an HTML listing page (asking-grade)", async () => {
    process.env.SALVEX_RESULTS_URLS = "https://www.salvex.com/listings/index.cfm/catid/1294/";
    stubFetch(
      `<html><script type="application/ld+json">
        {"@type":"Product","name":"Surplus Oilfield Generator Set","url":"https://salvex.com/x","offers":{"price":"15000","priceCurrency":"USD"}}
      </script></html>`,
    );
    const lots = await new SalvexSource().fetchRecentLots();
    expect(lots).toHaveLength(1);
    expect(lots[0]!.title).toContain("Oilfield");
    expect(lots[0]!.sourceType).toBe("asking");
  });
});
