import type { RawLot, SourceAdapter } from "../types";

// GSA Auctions (gsaauctions.gov) public API. Free, ToS-permissible automated
// access via an api.data.gov key. JSON listings of federal surplus assets.
//
// Honesty about this source:
//   - It is mostly OPEN auctions (current bid), not realized sold prices. We
//     only label a lot "auction" (a hammer) when it carries an award/sale price
//     or a closed/awarded status; otherwise it is "asking" (a soft current bid).
//     So nothing masquerades as a verified sold comp.
//   - Coverage of our oil & gas / mining classes is thin. This source keeps the
//     pipeline live and legal; EquipmentWatch is the paid upgrade for real
//     auction comps across our classes.
//   - The container that built this could not reach api.data.gov (egress
//     allowlist), so the exact field names below are tolerant best-guesses keyed
//     off the documented API. The parser (parseGsaItems) is unit-tested; confirm
//     the field mapping against the first live CI response and adjust the
//     candidate key lists if needed.

const DEFAULT_BASE =
  process.env.GSA_AUCTIONS_URL ?? "https://api.gsa.gov/assets/gsaauctions/v1/auctions";

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

function toNumber(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

// Pull the array of items out of whatever envelope the API returns.
function itemsOf(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  if (json && typeof json === "object") {
    for (const key of ["auctions", "items", "results", "data", "Auctions"]) {
      const v = (json as Record<string, unknown>)[key];
      if (Array.isArray(v)) return v as Record<string, unknown>[];
    }
  }
  return [];
}

export function parseGsaItems(json: unknown, sourceName = "GSA Auctions"): RawLot[] {
  const lots: RawLot[] = [];
  for (const item of itemsOf(json)) {
    const title = pick(item, ["itemName", "description", "aucDesc", "title", "name"]);
    if (!title) continue;

    const awardPrice = toNumber(
      pick(item, ["awardPrice", "salePrice", "soldPrice", "finalPrice", "winningBid"]),
    );
    const currentBid = toNumber(
      pick(item, ["currentBid", "currentPrice", "highBid", "startBid"]),
    );
    const status = String(pick(item, ["auctionStatus", "status", "state"]) ?? "").toLowerCase();
    const closed = status.includes("close") || status.includes("award") || status.includes("sold");

    // Realized hammer when there is an award/sale price or a closed status with a
    // bid; otherwise a soft current bid.
    const realized = awardPrice ?? (closed ? currentBid : undefined);
    const price = realized ?? currentBid;
    if (!price) continue;

    lots.push({
      title: String(title),
      description: undefined,
      price,
      priceText: `USD ${price}`,
      currencyHint: "USD",
      saleDate: (pick(item, [
        "closeDate",
        "auctionCloseDate",
        "saleDate",
        "endDate",
        "closeDateTime",
      ]) as string | undefined) ?? undefined,
      url: String(pick(item, ["url", "itemUrl", "link", "detailUrl"]) ?? ""),
      lotRef: String(pick(item, ["auctionId", "aucId", "lotNumber", "id"]) ?? ""),
      sourceName,
      sourceType: realized ? "auction" : "asking",
    });
  }
  return lots;
}

export class GsaAuctionsSource implements SourceAdapter {
  readonly name = "GSA Auctions";

  async fetchRecentLots(): Promise<RawLot[]> {
    const apiKey = process.env.DATA_GOV_API_KEY ?? "DEMO_KEY";
    const url = new URL(DEFAULT_BASE);
    url.searchParams.set("api_key", apiKey);

    const res = await fetch(url.toString(), {
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(`GSA Auctions API returned ${res.status}`);
      return [];
    }
    const json = await res.json();
    return parseGsaItems(json, this.name);
  }
}
