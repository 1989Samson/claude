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

`SOURCE` is a comma-separated list of adapters, run in order and aggregated
(e.g. `SOURCE=govdeals,salvex,gsa`). Each adapter only labels a lot as a realized
`auction` price when it carries a sale/winning price or a closed status; open
current bids are imported as `asking`, so nothing masquerades as a sold comp.

- **GSA Auctions** (`sources/gsa.ts`, `SOURCE=gsa`, default): free official API,
  api.data.gov key. Realized awarded prices, thin coverage of our classes.
- **GovDeals** (`sources/govdeals.ts`, `SOURCE=govdeals`): government-surplus
  closed auctions with public winning bids; runs most US state/municipal surplus
  and a Canadian site. A `govdeals.ca` URL is treated as CAD. Set
  `GOVDEALS_RESULTS_URLS` to the closed-results endpoint(s).
- **Salvex** (`sources/salvex.ts`, `SOURCE=salvex`): the most oil-and-gas-relevant
  source (oilfield equipment, gensets, pumps from bankruptcy/insurance/asset
  recovery). Prices are often current bids, so most lots normalize as `asking`.
  Set `SALVEX_RESULTS_URLS`.
- GovPlanet (`SOURCE=govplanet`) remains in the registry but must not be used for
  scheduled scraping (RB terms prohibit automated access).

### Legal basis for GovDeals / Salvex

Pulling **publicly-viewable** results (no login) is legally defensible under
hiQ v. LinkedIn / Van Buren / Meta v. Bright Data: browse-wrap terms you never
clicked are generally unenforceable, and accessing public data is not CFAA
"unauthorized access". This differs from the Ritchie Bros family, which both
prohibits automated access in clickwrap terms and actively blocks. This is a
defensible gray area, not black-and-white; confirm the firm is comfortable with
the posture, and do not log in or accept clickwrap terms in the scraper.

### First-run confirmation

The build environment could not reach these sites, so the result URLs and field
mappings are best-guesses. On the first CI run (use the workflow's dry-run
input), confirm each adapter returns lots and adjust the `*_RESULTS_URLS` and the
candidate field-key lists in the adapter if the live JSON/HTML shape differs. The
parsing logic is unit-tested; only the site-specific wiring needs confirming.

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
