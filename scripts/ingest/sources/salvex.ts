import { fetchLots, type FieldKeys } from "../parse-util";
import type { RawLot, SourceAdapter } from "../types";

// Salvex global asset-recovery marketplace. The most relevant source for our
// oil and gas niche: oilfield equipment, gensets, pumps, and transformers sold
// from bankruptcies, insurance claims, and asset recoveries. Listings are
// publicly viewable (membership is only required to bid or sell).
//
// Caveat to confirm on first CI run: Salvex prices are often current bids /
// asking rather than published hammer prices, so most lots normalize as
// "asking" unless a sale/closed field is present. That is honest: an asking
// signal on the right class still feeds the model, it just stays Indicative.
//
// Configure SALVEX_RESULTS_URLS with the oil & gas category/results endpoint(s).

const DEFAULT_URLS = [
  // Oil & Gas category. Override with SALVEX_RESULTS_URLS.
  "https://www.salvex.com/listings/index.cfm/catid/1294/",
];

const KEYS: FieldKeys = {
  title: ["title", "name", "itemName", "listingTitle", "description"],
  soldPrice: ["soldPrice", "winningBid", "finalPrice", "salePrice"],
  bid: ["currentBid", "bid", "price", "askingPrice", "estimatedValue"],
  date: ["bidDueDate", "endDate", "closeDate", "auctionEndDate"],
  url: ["url", "link", "listingUrl"],
  id: ["aucID", "aucid", "id", "listingId"],
  status: ["status", "state", "auctionStatus"],
};

export class SalvexSource implements SourceAdapter {
  readonly name = "Salvex";

  private urls(): string[] {
    const env = process.env.SALVEX_RESULTS_URLS;
    return env ? env.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_URLS;
  }

  async fetchRecentLots(): Promise<RawLot[]> {
    const all: RawLot[] = [];
    for (const url of this.urls()) {
      all.push(...(await fetchLots(url, this.name, KEYS, "USD")));
    }
    return all;
  }
}
