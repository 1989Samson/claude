# Live sold-data sources

Research summary and the decision behind the ingestion source. Grounded in web
search (June 2026); the build container could not open vendor pages directly, so
confirm exact endpoints/fields against each vendor's docs when keys are issued.

## The honest conclusion

No free, ToS-clean, API-accessible source provides verified realized sold prices
across our oil and gas / mining classes. The free auction sites either prohibit
automated access or have no API. Real sold comps are a paid data license. Two
ways to get the model producing defensible, backtested bands:

1. **Your own deal data (no vendor, available today).** As a distressed-asset
   firm, your own closes, private sales, and SISP / receiver-reported results are
   the highest-quality verified sold points (engine weights: own_close 1.0,
   sold_private 0.95, sisp 0.90). Enter them on the Add Data Point tab or via the
   bulk import / `/api/import` endpoint. This is the fastest path to leaving
   Indicative and getting a backtested error.
2. **Licensed external comps (paid).** EquipmentWatch or Sandhills / Rouse, to
   augment with broad auction comps. See ranking below.

## Ranking

| Rank | Source | Realized sold data | Access | Cost | Coverage of our classes |
| --- | --- | --- | --- | --- | --- |
| 1 (paid primary) | EquipmentWatch (Values + Market Data API) | Yes: raw auction transactions + channel-specific FMV/OLV/FLV | Documented REST API; also AWS Marketplace | Paid, quote-based | Strong on construction-class (excavators, loaders, gensets, haul trucks); gaps on O&G process units and crushers/mills |
| 2 (paid, Canadian) | Sandhills Auction Values / VIP | Yes: aggregates auction results US + Canada | Enterprise data feed (no public self-serve API found) | Paid, quote-based | Broadest market, best Canadian relevance |
| 3 (paid, appraisal) | Rouse (RB Global) | Yes: observed sales adjusted for hours/config/region | Subscription DaaS, enterprise | Paid | Appraisal-grade; construction-centric |
| 4 (free stopgap) | GSA Auctions API | Partial: mostly current bids; some awarded sales | Free public API + api.data.gov key | Free | Thin for our classes |
| avoid | RB / IronPlanet / GovPlanet / Marketplace-E | Yes | Scraping prohibited by ToS / no API | n/a | n/a |

IronPlanet's Terms explicitly prohibit "any robot, spider, scraper, data mining
tool ... or any other automated means to access" the services, which covers the
whole Ritchie Bros family (GovPlanet, IronPlanet, rbauction Price Results,
Marketplace-E). That is why the original GovPlanet scrape is off the table on
compliance grounds, not just anti-bot.

## What is wired now

- **Default source: GSA Auctions** (`scripts/ingest/sources/gsa.ts`), selected by
  `SOURCE=gsa`. Free and ToS-permissible. It only labels a lot as a realized
  `auction` price when it carries an award/sale price or closed status; open
  current bids are imported as `asking`, so nothing masquerades as a sold comp.
  Coverage of our classes is thin; this keeps the pipeline live and legal.
- GovPlanet adapter remains in the registry (`SOURCE=govplanet`) but is not the
  default and should not be used for scheduled scraping per the ToS above.

## Adding EquipmentWatch (the paid upgrade)

Implement an `EquipmentWatchSource` in `scripts/ingest/sources/` against the
Market Data API (raw auction transactions by channel/serial), returning
`RawLot`s, and register it in `sources/index.ts`. The rest of the pipeline
(normalizer, import endpoint, backtest) is unchanged. Procurement questions to
send their sales team:

- API access to raw realized auction transactions (not just blended values), by
  make/model and date, with hours/condition/spec fields.
- Coverage of: CAT gas gensets, Waukesha gensets, recip gas compression,
  injection pumps, TEG/amine/separators/tanks, CAT 785/793 haul trucks, large
  excavators/loaders, cone crushers, ball mills.
- Canadian / North American transactions and currency handling.
- Cost model (seat vs API call vs annual license) and AWS Marketplace option.
