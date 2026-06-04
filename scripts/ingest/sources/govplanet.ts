import type { RawLot, SourceAdapter } from "../types";

// GovPlanet (RB Global) closed-auction results.
//
// Reality note: this container has restricted egress, so the live fetch cannot
// be exercised here. It runs in GitHub Actions, which has open internet. The
// parser below is the testable core (see govplanet.test.ts) and reads standard
// schema.org Product/Offer JSON-LD, which RB Global sites embed. If GovPlanet's
// live markup differs, only parseLotsFromHtml needs adjusting; the adapter and
// the rest of the pipeline stay the same.

const DEFAULT_RESULTS_URLS = [
  // Closed-results category pages. Override with GOVPLANET_RESULTS_URLS.
  "https://www.govplanet.com/c/heavy-equipment/generators",
  "https://www.govplanet.com/c/trucks/heavy-duty-trucks",
];

const BROWSER_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-CA,en;q=0.9",
};

// Pull every <script type="application/ld+json"> JSON blob out of an HTML page.
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
      // Skip malformed blocks rather than fail the whole pull.
    }
  }
  return blocks;
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

interface JsonLdOffer {
  price?: number | string;
  priceCurrency?: string;
  availability?: string;
  validFrom?: string;
  priceValidUntil?: string;
}
interface JsonLdProduct {
  "@type"?: string | string[];
  name?: string;
  description?: string;
  url?: string;
  sku?: string;
  offers?: JsonLdOffer | JsonLdOffer[];
}

function isProduct(node: { "@type"?: string | string[] }): boolean {
  return asArray(node["@type"]).some((t) => String(t).toLowerCase() === "product");
}

// Walk a parsed JSON-LD value (object, array, or @graph) and collect Products.
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
      const item = (el as { item?: unknown })?.item ?? el;
      collectProducts(item, out);
    }
  }
  if (isProduct(obj as { "@type"?: string | string[] })) {
    out.push(obj as JsonLdProduct);
  }
}

// Parse a results page into RawLots. Only lots with a realized price are kept
// (sold), never open listings without a number.
export function parseLotsFromHtml(
  html: string,
  sourceName: string,
): RawLot[] {
  const products: JsonLdProduct[] = [];
  for (const block of extractJsonLdBlocks(html)) collectProducts(block, products);

  const lots: RawLot[] = [];
  for (const p of products) {
    const offer = asArray(p.offers)[0];
    const priceRaw = offer?.price;
    if (priceRaw === undefined || priceRaw === null || priceRaw === "") continue;
    const priceNum = Number(String(priceRaw).replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(priceNum) || priceNum <= 0) continue;

    const currencyHint =
      offer?.priceCurrency === "USD" || offer?.priceCurrency === "CAD"
        ? offer.priceCurrency
        : undefined;

    lots.push({
      title: p.name ?? "Unknown lot",
      description: p.description,
      price: priceNum,
      priceText: `${offer?.priceCurrency ?? ""} ${priceNum}`.trim(),
      currencyHint,
      saleDate: offer?.validFrom ?? offer?.priceValidUntil,
      url: p.url ?? "",
      lotRef: p.sku,
      sourceName,
      sourceType: "auction", // GovPlanet results pages are closed/sold lots
    });
  }
  return lots;
}

export class GovPlanetSource implements SourceAdapter {
  readonly name = "GovPlanet";

  private urls(): string[] {
    const env = process.env.GOVPLANET_RESULTS_URLS;
    return env ? env.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_RESULTS_URLS;
  }

  async fetchRecentLots(): Promise<RawLot[]> {
    const all: RawLot[] = [];
    for (const url of this.urls()) {
      const res = await fetch(url, { headers: BROWSER_HEADERS });
      if (!res.ok) {
        console.warn(`GovPlanet ${url} returned ${res.status}; skipping`);
        continue;
      }
      const html = await res.text();
      all.push(...parseLotsFromHtml(html, this.name));
    }
    return all;
  }
}
