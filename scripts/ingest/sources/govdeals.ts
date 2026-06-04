import { fetchLots, type FieldKeys } from "../parse-util";
import type { RawLot, SourceAdapter } from "../types";

// GovDeals (Liquidity Services) government-surplus auctions. Closed auctions show
// the winning bid publicly, and GovDeals runs most US state/municipal surplus
// plus a Canadian site (govdeals.ca). Pulling publicly-viewable closed-auction
// results (no login) is legally defensible under hiQ v. LinkedIn; this is a
// different posture from the Ritchie Bros family, which prohibits automated
// access in clickwrap terms and actively blocks.
//
// Configure GOVDEALS_RESULTS_URLS with the closed-results endpoint(s) once
// confirmed (the modern site is backed by a JSON search API). A .ca host is
// treated as CAD; everything else USD. The field-key guesses below are adjusted
// on the first live CI run if needed.

const DEFAULT_URLS = [
  // Placeholder closed-results search endpoint; override with GOVDEALS_RESULTS_URLS.
  "https://api.govdeals.com/search?status=closed&category=heavy-equipment",
];

const KEYS: FieldKeys = {
  title: ["title", "itemName", "name", "shortDescription", "description"],
  soldPrice: ["winningBid", "soldPrice", "salePrice", "currentPrice", "finalPrice", "highBid"],
  bid: ["currentBid", "highBid", "startingBid", "currentPrice"],
  date: ["endDate", "closeDate", "auctionEndDate", "saleDate", "endDateTime"],
  url: ["url", "itemUrl", "link", "detailUrl"],
  id: ["id", "itemId", "auctionId", "assetId"],
  status: ["status", "auctionStatus", "state", "saleStatus"],
};

export class GovDealsSource implements SourceAdapter {
  readonly name = "GovDeals";

  private urls(): string[] {
    const env = process.env.GOVDEALS_RESULTS_URLS;
    return env ? env.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_URLS;
  }

  async fetchRecentLots(): Promise<RawLot[]> {
    const all: RawLot[] = [];
    for (const url of this.urls()) {
      const currency = /\.ca(\/|$|\?)/i.test(url) || /govdeals\.ca/i.test(url) ? "CAD" : "USD";
      all.push(...(await fetchLots(url, this.name, KEYS, currency)));
    }
    return all;
  }
}
