// Shared, tolerant parsing helpers for source adapters. Because the build
// container cannot reach these sites, the adapters fetch a configurable URL and
// run these parsers, which handle either a JSON search-API response or HTML with
// schema.org JSON-LD. The exact field names are best-guesses keyed off public
// pages; confirm and adjust the candidate key lists against the first live CI
// response. The parsing logic itself is unit-tested.

import type { RawLot } from "./types";

export const BROWSER_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
  "accept-language": "en-CA,en;q=0.9",
};

export function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

export function toNumber(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

// Find the array of items in whatever envelope an API returns.
export function itemsOf(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    for (const key of ["items", "results", "auctions", "data", "listings", "hits", "records"]) {
      const v = obj[key];
      if (Array.isArray(v)) return v as Record<string, unknown>[];
      // one nested level (e.g. { results: { items: [...] } })
      if (v && typeof v === "object") {
        for (const k2 of ["items", "results", "hits", "records"]) {
          const inner = (v as Record<string, unknown>)[k2];
          if (Array.isArray(inner)) return inner as Record<string, unknown>[];
        }
      }
    }
  }
  return [];
}

export interface FieldKeys {
  title: string[];
  soldPrice: string[]; // realized: winning bid / sale / award price
  bid: string[]; // current/high/start bid (soft, asking-grade)
  date: string[];
  url: string[];
  id: string[];
  status?: string[]; // closed/awarded/sold indicator
}

const CLOSED_RE = /clos|award|sold|settl|won|complete|ended/;

// Map a JSON array of items to RawLots. A lot is a realized "auction" price only
// when it has a sale/winning price, or a closed status with a bid; otherwise the
// price is treated as "asking" so nothing fake-passes as a sold comp.
export function mapItems(
  items: Record<string, unknown>[],
  sourceName: string,
  keys: FieldKeys,
  currency: "USD" | "CAD" = "USD",
): RawLot[] {
  const lots: RawLot[] = [];
  for (const item of items) {
    const title = pick(item, keys.title);
    if (!title) continue;

    const sold = toNumber(pick(item, keys.soldPrice));
    const bid = toNumber(pick(item, keys.bid));
    const status = String(pick(item, keys.status ?? []) ?? "").toLowerCase();
    const closed = CLOSED_RE.test(status);

    const realized = sold ?? (closed ? bid : undefined);
    const price = realized ?? bid;
    if (!price) continue;

    lots.push({
      title: String(title),
      price,
      priceText: `${currency} ${price}`,
      currencyHint: currency,
      saleDate: (pick(item, keys.date) as string | undefined) ?? undefined,
      url: String(pick(item, keys.url) ?? ""),
      lotRef: String(pick(item, keys.id) ?? ""),
      sourceName,
      sourceType: realized ? "auction" : "asking",
    });
  }
  return lots;
}

// --- JSON-LD fallback (schema.org Product/Offer) -------------------------------

export function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1]?.trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      /* skip malformed */
    }
  }
  return blocks;
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

interface JsonLdProduct {
  "@type"?: string | string[];
  name?: string;
  url?: string;
  sku?: string;
  offers?: { price?: unknown; priceCurrency?: string; availability?: string; validFrom?: string }[] | { price?: unknown; priceCurrency?: string; availability?: string; validFrom?: string };
}

function collectProducts(node: unknown, out: JsonLdProduct[]): void {
  if (Array.isArray(node)) {
    for (const n of node) collectProducts(n, out);
    return;
  }
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  if (Array.isArray(obj["@graph"])) collectProducts(obj["@graph"], out);
  if (Array.isArray(obj.itemListElement)) {
    for (const el of obj.itemListElement as unknown[]) {
      collectProducts((el as { item?: unknown })?.item ?? el, out);
    }
  }
  if (asArray(obj["@type"] as string | string[]).some((t) => String(t).toLowerCase() === "product")) {
    out.push(obj as JsonLdProduct);
  }
}

// Map JSON-LD products to RawLots. JSON-LD usually marks live listings, so the
// default is "asking" unless availability explicitly says sold.
export function mapJsonLd(
  blocks: unknown[],
  sourceName: string,
  currency: "USD" | "CAD" = "USD",
): RawLot[] {
  const products: JsonLdProduct[] = [];
  for (const b of blocks) collectProducts(b, products);

  const lots: RawLot[] = [];
  for (const p of products) {
    const offer = asArray(p.offers)[0];
    const price = toNumber(offer?.price);
    if (!price) continue;
    const sold = /sold/.test(String(offer?.availability ?? "").toLowerCase());
    const cur =
      offer?.priceCurrency === "CAD" || offer?.priceCurrency === "USD"
        ? offer.priceCurrency
        : currency;
    lots.push({
      title: p.name ?? "Unknown lot",
      price,
      priceText: `${cur} ${price}`,
      currencyHint: cur,
      saleDate: offer?.validFrom,
      url: p.url ?? "",
      lotRef: p.sku,
      sourceName,
      sourceType: sold ? "auction" : "asking",
    });
  }
  return lots;
}

// Fetch a URL and parse it as JSON (search API) or HTML (JSON-LD).
export async function fetchLots(
  url: string,
  sourceName: string,
  keys: FieldKeys,
  currency: "USD" | "CAD" = "USD",
): Promise<RawLot[]> {
  const res = await fetch(url, { headers: BROWSER_HEADERS });
  if (!res.ok) {
    console.warn(`${sourceName}: ${url} returned ${res.status}`);
    return [];
  }
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return mapItems(itemsOf(json), sourceName, keys, currency);
  } catch {
    return mapJsonLd(extractJsonLdBlocks(text), sourceName, currency);
  }
}
