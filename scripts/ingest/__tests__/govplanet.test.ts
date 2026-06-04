import { describe, expect, it } from "vitest";
import {
  extractJsonLdBlocks,
  parseLotsFromHtml,
} from "../sources/govplanet";

// A realistic results page: schema.org Product + Offer JSON-LD, the standard
// markup RB Global / e-commerce sites embed. One sold lot, one open lot with no
// price (must be skipped), wrapped in an ItemList @graph.
const FIXTURE_HTML = `
<html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Product",
      "name": "2014 CAT 3516 1000 kW Natural Gas Generator Set",
      "sku": "Lot 412",
      "url": "https://www.govplanet.com/item/412",
      "description": "Open skid, running, ~30,000 hours",
      "offers": {
        "@type": "Offer",
        "price": "92000",
        "priceCurrency": "USD",
        "validFrom": "2026-05-15"
      }
    },
    {
      "@type": "Product",
      "name": "Open listing no price yet",
      "url": "https://www.govplanet.com/item/999",
      "offers": { "@type": "Offer", "priceCurrency": "USD" }
    }
  ]
}
</script>
</head><body></body></html>`;

describe("extractJsonLdBlocks", () => {
  it("pulls and parses ld+json script blocks", () => {
    const blocks = extractJsonLdBlocks(FIXTURE_HTML);
    expect(blocks).toHaveLength(1);
  });

  it("skips malformed blocks instead of throwing", () => {
    const blocks = extractJsonLdBlocks(
      `<script type="application/ld+json">{ not json }</script>`,
    );
    expect(blocks).toHaveLength(0);
  });
});

describe("parseLotsFromHtml", () => {
  it("returns only sold lots with a realized price", () => {
    const lots = parseLotsFromHtml(FIXTURE_HTML, "GovPlanet");
    expect(lots).toHaveLength(1);
    const lot = lots[0]!;
    expect(lot.title).toContain("CAT 3516");
    expect(lot.price).toBe(92000);
    expect(lot.currencyHint).toBe("USD");
    expect(lot.saleDate).toBe("2026-05-15");
    expect(lot.url).toBe("https://www.govplanet.com/item/412");
    expect(lot.lotRef).toBe("Lot 412");
    expect(lot.sourceName).toBe("GovPlanet");
  });

  it("returns nothing when there is no JSON-LD", () => {
    expect(parseLotsFromHtml("<html><body>no data</body></html>", "GovPlanet")).toEqual([]);
  });

  it("parses prices with currency symbols and separators", () => {
    const html = `<script type="application/ld+json">
      {"@type":"Product","name":"Genset","url":"u","offers":{"price":"US $1,250,000.00","priceCurrency":"USD"}}
    </script>`;
    const lots = parseLotsFromHtml(html, "GovPlanet");
    expect(lots[0]!.price).toBe(1250000);
  });
});
