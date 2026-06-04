// A raw lot as pulled from an auction source, before normalization. The source
// adapter does the fetching/parsing; the Claude normalizer turns this messy
// shape into a clean import row mapped to one of our equipment classes.
export interface RawLot {
  title: string; // headline, e.g. "2014 CAT 3516 1000kW Natural Gas Generator Set"
  description?: string; // any extra spec text
  price?: number; // realized price as a number, parsed deterministically by the source
  priceText?: string; // raw price as shown, e.g. "US $92,000" or "CAD 120,000"
  currencyHint?: "CAD" | "USD"; // when the source states it explicitly
  saleDate?: string; // ISO date if known
  url: string; // canonical lot URL, becomes part of the required source note
  lotRef?: string; // auction/lot reference, e.g. "Lot 412"
  sourceName: string; // e.g. "GovPlanet"
}

// One source of closed auction results.
export interface SourceAdapter {
  readonly name: string;
  // Pull recently closed lots with realized prices. Implementations should
  // return only lots that actually sold (have a price), never open listings.
  fetchRecentLots(): Promise<RawLot[]>;
}

// The class info handed to the normalizer so it can map a lot to a slug.
export interface ClassRef {
  slug: string;
  name: string;
  sector: string;
  category: string;
  unit: string;
}
