# McCord Transport Engine — Logic and Build Spec

Delivered-cost and time-to-site estimator for moving 60 Hz generation iron from a
global source into a Canadian data center build. This document is the reference for
the logic and the brief for building it out in Claude Code. The working prototype is
`transport_estimator.py`.

Benchmarks verified June 2026. Treat every rate as a number that moves; they live in
editable tables at the top of the prototype, not buried in the logic.

---

## What it does

Given a unit and a destination site, it returns two things:

1. An internal cost stack, the real landed logistics number plus recoverable taxes, for building your quote.
2. A buyer view, a deliberately coarse logistics band plus weeks-to-site, rounded hard so a buyer cannot back into your margin.

The split between those two outputs is the point. The precise stack is yours. The buyer sees a range and a date, never the exact figure that would expose your spread. Same discipline as price.

---

## The cost stack

Landed cost is ten components. For your lanes, two of them move the number: ocean freight and the inland heavy-haul to site. The rest are smaller or, in the case of tax, recoverable.

1. **Origin prep.** Depreservation, disassembly into shippable modules, crating, staging at the load point. Class-dependent, from low five figures for a containerized genset to low six figures for a heavy-frame turbine pulled and crated.
2. **Origin inland haul.** Heavy-haul from the unit's location to the export port. For US units moving overland to Canada this is the main inland leg and there is no ocean. For Gulf and Japan units it is short, yard to port.
3. **Origin port handling.** Crane and stevedoring to load. Cheaper when the breakbulk vessel carries its own gear.
4. **Ocean freight.** The international leg. The per-revenue-ton rate of 45 to 120 USD holds only for lighter pieces riding a scheduled vessel. It understates heavy modules badly. Any piece over about 50 tonnes exceeds a standard ship's crane and needs heavy-lift gear, which the engine adds as a surcharge on the heaviest piece. Pieces over roughly 120 tonnes push the whole move toward a dedicated or semi charter, where ocean is priced as a lumpsum, not per ton, and the per-ton math no longer applies. As a reality check, an 18-tonne wind blade ran about 42,000 USD for a single piece on a long route. Pieces at or under 55 tonnes can ride a 40-foot flat rack, which is cheaper. The Middle East conflict is adding a fuel and risk premium on Gulf lanes through 2026.
5. **Marine insurance.** Roughly 0.1 to 0.5 percent of declared cargo value. Real money on a multi-million-dollar turbine.
6. **Destination port handling.** Discharge, stevedoring, laydown at the Canadian port.
7. **Customs, duty, GST.** Duty splits by origin (below). GST at 5 percent on the landed value always applies, plus provincial tax by province of import. This is large in absolute terms on a high-value asset but it is a recoverable input tax credit, so it is not a true transport cost. The engine reports it on its own line.
8. **Destination inland haul.** Heavy-haul from the Canadian port to the site. For Alberta this is the long, expensive leg because the province is landlocked. This is where your US-corridor routing edge lives.
9. **Permits, escorts, route survey.** US-state and provincial oversize and overweight permits, pilot cars, police escorts, and route surveys on superloads. Winter surcharge on the Canadian leg.
10. **Crane and rigging at site.** Mobile crane sized to the largest piece, plus the rigging crew, to offload and set.

### Benchmark numbers the engine runs on

| Leg | Rate |
|---|---|
| Inland legal | 3.00 to 4.50 USD per mile |
| Inland oversize | 4.50 to 8.00 USD per mile |
| Inland superload | 5.00 to 15.00 USD per mile |
| Short haul under 200 mi | runs higher per mile |
| Winter surcharge (Nov to Mar) | 10 to 15 percent |
| Pilot car, each | 1.50 to 2.00 USD per mile |
| Police escort | 75 to 150 USD per hour, 4 to 8 hr minimum |
| Oversize permit | 100 to 400 USD per state |
| Superload permit | 500 to 5,000 USD per state, with route survey, 2 to 4 weeks |
| Ocean breakbulk, light pieces | 45 to 120 USD per revenue ton |
| Ocean heavy-lift, piece over 50 t | surcharge on the heaviest piece; over 120 t is charter, priced lumpsum |
| Marine insurance | 0.1 to 0.5 percent of cargo value |
| Superload threshold | over 120,000 lbs or over 16 ft wide |

---

## Transport classes

Every unit drops into one of four classes. Class sets the trailer, the vessel, the permit tier, and the crane.

- **Class A, containerized gas genset, 1 to 2.5 MW.** The MTU Series 4000 line. Roughly 40 to 70 tonnes, often in a 20 to 40 foot enclosure. Legal or mild oversize on a step-deck, can ride a flat rack or open-top for ocean. Cheapest to move, minimal escorts.
- **Class B, aeroderivative and light industrial turbine, 3.5 to 48 MW.** Centaur, SGT-500, Kawasaki, FT4, and the LM aero family. Ships as modules, largest single piece roughly 40 to 120 tonnes. Multi-axle trailer, oversize permits, often superload on the biggest module. Breakbulk or flat rack by piece weight.
- **Class C, heavy-frame turbine, 12 to 40 MW.** GT35C, GT10B, Frame 6B. Heavier per piece than the aeros. Superload likely, route survey and bridge analysis, escorts. Heavy-lift vessel. Highest cost per unit short of the barge.
- **Class D, power barge, 160 MW.** Floats. Wet tow or float-on heavy-lift ship, waterfront destination only. Separate cost basis, towage not breakbulk. Not relevant to an inland Alberta site.

The prototype carries class-default weights as placeholders. Replace them with the real spec-sheet figures per unit before any number goes to a buyer. The width of the output band collapses once real weights and known origin condition go in.

---

## Corridors

Routing is driven by origin and destination region. The lanes that matter for your matrix:

- **US to Western Canada (Alberta, BC).** Overland heavy-haul, no ocean. Roughly 85 percent of heavy freight to Alberta routes through the Pacific Northwest or the Houston corridor. West Coast US units run straight up the I-5 corridor into BC and Alberta. This is your specialty and your cheapest international-to-site lane.
- **US to Eastern Canada (Toronto, Montreal).** Overland through the Great Lakes and Northeast corridor, shorter for eastern US origins.
- **Saudi or UAE to Eastern Canada.** Ocean via Suez to Montreal, a heavy-lift port on the St. Lawrence, then short inland. Roughly four weeks transit.
- **Saudi or UAE to Alberta.** Either ocean to Houston then up the central corridor, or ocean to a West Coast port then inland. The engine picks the cheaper. The long inland leg is the cost, not the ocean.
- **Japan to Western Canada.** Ocean to Prince Rupert, the closest North American port to Asia at 7 to 10 days, then CN rail or road to Alberta. The cleanest Asian lane.
- **Japan to Eastern Canada.** West Coast land bridge, or the longer Panama route.

Canadian heavy-lift ports the engine can discharge to: Vancouver and Prince Rupert on the Pacific; Montreal, Quebec City, Trois-Rivieres, and Becancour on the St. Lawrence; Halifax and Saint John on the Atlantic; Hamilton on the Great Lakes via the Seaway. The St. Lawrence and Seaway are served by purpose-built MPV fleets with up to 500-tonne tandem lift.

---

## Duty logic

Duty is mostly a non-event, and the turbine side is now confirmed. Gas turbines over 5,000 kW, HS 8411.82, are Free at MFN and free under every preferential treatment per the CBSA 2025 tariff. So origin does not change the turbine duty at all, the Saudi and UAE turbines owe zero the same as the US ones.

Two things the engine has to get right, because they are easy to get wrong:

- **Tariff origin is country of manufacture, not where the unit sits.** A foreign-made turbine parked in the US is not US-origin for an FTA. Key duty on where it was built.
- **A complete generating set is HS 8502, a different line from the bare turbine at 8411.** The MTU gensets are German-made, so their preferential route is CETA, not CUSMA, and the 8502 rate must be confirmed per unit. Net duty is still almost certainly zero, but the basis matters and a broker should confirm the line.

GST at 5 percent on the import value always applies, plus provincial tax by province (Alberta has none). It is recoverable for a registered business. The import value is the goods plus international freight plus duty. Domestic Canadian trucking and the site crane are not part of it, they carry their own GST as services. Clear pre-arrival through the CBSA CARM portal. Some units may need an NRCan or CFIA permit, check per unit. Tools: tariffinder.ca, tariffcalc.ca, and the CBSA Customs Tariff.

The open question is who is importer of record, you or the buyer. That decides who fronts and reclaims the GST and shapes whether you quote delivered duty-paid or to the port. That is a lawyer question and it is the one structural item to settle before you transact.

---

## Lead time and the critical path

The engine returns the transport portion of the energized date in weeks: origin prep, ocean transit, port dwell and customs, permit lead including route survey on superloads, inland haul, and crane scheduling. This is the number that backs your whole pitch. Time to power is the product, and this is the part of it you control. The eventual path-to-power planner reads this output, lays it against the unit's own availability date, and produces a confidence-weighted energized date with a live critical path.

---

## Build spec for Claude Code

**Core.** A Python module, rate tables as data, functions to classify a unit, route it, cost it, and time it, returning a structured result. The prototype is that core. Keep the two-tier output enforced in code so the buyer view can never accidentally carry the precise number.

**Inputs.** Unit (model, class, MW, total and largest-piece weight, dimensions, origin, fuel, declared value) and destination (province plus nearest city or coordinates, site access: waterfront, rail spur, urban). Optional target date.

**Lookups.** The rate tables already in the prototype, plus distance. Today distance is a corridor lookup for the known lanes. Swap in a routing API (Google or HERE) so an arbitrary site address resolves to real port-to-site mileage. That single change makes the inland leg precise instead of bucketed.

**Data model.** Externalize the rate tables to JSON or YAML so they update without touching code, since rates move monthly. Version them with a date.

**Output.** A structured object that can feed three things: your quote sheet, the live supply board on the site, and the path-to-power planner. The board shows only the buyer band and weeks-to-site.

**What to build next, in order.**
1. Replace class-default weights with a per-unit spec-sheet table as supplier agreements land and real weights arrive.
2. Add the routing API for real mileage to any site.
3. Separate the importer-of-record toggle so the engine can quote delivered-duty-paid or to-port, once the legal structure is set.
4. Tighten the input ranges. The bands are wide now because origin prep and weight are bucketed. Real figures collapse them.
5. Feed the output into the supply board, buyer view only.

Build this against real supplier agreements, not before. The logic is ready to run the day supply locks.
