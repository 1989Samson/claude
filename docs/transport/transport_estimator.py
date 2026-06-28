"""
McCord Investments - Delivered cost and time-to-site estimator (prototype, v2).

Estimates the landed (DDP) cost and the transport portion of the energized date
for moving 60 Hz generation iron from a global source to a Canadian data center site.

v2 corrections after fact-check and stress test (June 2026):
  - Ocean: added a heavy-lift surcharge on the heaviest piece (>50t) and a charter
    flag (>120t). The flat per-revenue-ton rate alone understated heavy modules badly.
  - Tax base: GST and duty now computed on goods value + international freight + duty
    only. Domestic Canadian legs (inland haul, crane) are out of the import value.
  - Duty: turbines (HS 8411) confirmed Free at MFN for ALL origins. Gensets are HS 8502
    and German-made (MTU), so their route is CETA, not CUSMA; flagged to verify.
  - Feasibility guard: a Class D barge to a non-waterfront site returns infeasible
    instead of a nonsense-low number.
  - Currency: all figures USD. Canadian legs are CAD in reality; carry FX in the build.

Design rules unchanged: directional not precise, two-tier output (internal stack +
margin-safe buyer band), rate tables are editable data at the top.
"""

from dataclasses import dataclass
from enum import Enum
import statistics

CURRENCY = "USD (Canadian legs are CAD in reality; add FX per line in the build)"

# ============================================================================
# RATE TABLES  -  edit these as the market moves
# ============================================================================

# Inland heavy-haul, USD per mile, by load class
INLAND_USD_PER_MILE = {"legal": (3.00, 4.50), "oversize": (4.50, 8.00), "superload": (5.00, 15.00)}
SHORT_HAUL_MILES = 200
SHORT_HAUL_MULT = 1.5
WINTER_SURCHARGE = 0.125

# Escorts
PILOT_USD_PER_MILE = 1.75
POLICE_USD_PER_HOUR = 110
POLICE_MIN_HOURS = 6

# Permits, USD, per jurisdiction crossed
PERMIT_OVERSIZE = (100, 400)
PERMIT_SUPERLOAD = (500, 5000)

# Ocean breakbulk, USD per revenue ton (per mt OR per m3, whichever greater).
# Verified base for liner breakbulk of moderate pieces; heavy pieces add the surcharge below.
OCEAN_USD_PER_RT = (45, 120)
FLAT_RACK_MAX_TONNES = 55
FLAT_RACK_DISCOUNT = 0.75
GULF_LANE_SURCHARGE = 0.15
# Heavy-lift: pieces over a standard ship crane (~50t) need heavy-lift gear / vessel.
HEAVY_LIFT_PIECE_T = 50
HEAVY_LIFT_USD_PER_T = (300, 1200)     # surcharge applied to the heaviest single piece
CHARTER_FLAG_PIECE_T = 120             # past this, ocean is a charter; per-RT model unreliable

MARINE_INSURANCE = (0.001, 0.005)

PORT_HANDLING = {"A": (2_000, 8_000), "B": (8_000, 30_000), "C": (20_000, 60_000), "D": (0, 0)}
CRANE_USD_PER_DAY = {"A": (3_000, 8_000), "B": (8_000, 20_000), "C": (15_000, 40_000), "D": (0, 0)}
RIG_DAYS = {"A": 1, "B": 2, "C": 3, "D": 0}
ORIGIN_PREP = {"A": (5_000, 25_000), "B": (30_000, 120_000), "C": (60_000, 200_000), "D": (50_000, 150_000)}

# Duty into Canada. Turbines (HS 8411.82, >5000 kW) are Free at MFN and under every
# preferential treatment, confirmed CBSA 2025, so origin does not change turbine duty.
# Generating sets are HS 8502 (a different line) and the rate must be verified per unit.
# Tariff origin is country of MANUFACTURE, not where the unit currently sits.
DUTY_RATE_TURBINE = 0.00               # HS 8411, all origins
DUTY_RATE_GENSET = 0.00                # HS 8502 placeholder; verify line + CETA origin
GST = 0.05
PROVINCIAL_TAX = {"AB": 0.00, "BC": 0.07, "ON": 0.08, "QC": 0.09975, "SK": 0.06, "MB": 0.07}

# ============================================================================
# CORRIDORS
# ============================================================================
CORRIDORS = {
    ("US", "AB"): dict(entry="overland (Pacific NW / Houston corridor)", ocean_days=0, inland_miles=1300, jurisdictions=6),
    ("US", "ON"): dict(entry="overland (Great Lakes / NE corridor)", ocean_days=0, inland_miles=700, jurisdictions=4),
    ("US", "QC"): dict(entry="overland (NE corridor)", ocean_days=0, inland_miles=600, jurisdictions=4),
    ("SA", "AB"): dict(entry="ocean to Houston, then overland", ocean_days=30, inland_miles=2400, jurisdictions=8),
    ("SA", "ON"): dict(entry="ocean via Suez to Montreal", ocean_days=28, inland_miles=340, jurisdictions=2),
    ("SA", "QC"): dict(entry="ocean via Suez to Montreal", ocean_days=28, inland_miles=80, jurisdictions=1),
    ("AE", "AB"): dict(entry="ocean to Vancouver (Pacific), then overland", ocean_days=33, inland_miles=650, jurisdictions=3),
    ("AE", "ON"): dict(entry="ocean via Suez to Montreal", ocean_days=29, inland_miles=340, jurisdictions=2),
    ("AE", "QC"): dict(entry="ocean via Suez to Montreal", ocean_days=29, inland_miles=80, jurisdictions=1),
    ("JP", "AB"): dict(entry="ocean to Prince Rupert, then CN rail / road", ocean_days=11, inland_miles=900, jurisdictions=2),
    ("JP", "ON"): dict(entry="ocean to Vancouver, then land bridge", ocean_days=12, inland_miles=2800, jurisdictions=4),
    ("JP", "QC"): dict(entry="ocean to Vancouver, then land bridge", ocean_days=12, inland_miles=2950, jurisdictions=5),
}

# ============================================================================
# UNIT MODEL
# ============================================================================
class Cls(str, Enum):
    A = "A"  # containerized gas genset (1-2.5 MW), HS 8502
    B = "B"  # aeroderivative / light industrial turbine (3.5-48 MW), HS 8411
    C = "C"  # heavy-frame turbine (12-40 MW), HS 8411
    D = "D"  # power barge (floats)

CLASS_WEIGHT = {Cls.A: (55, 45), Cls.B: (180, 90), Cls.C: (300, 140), Cls.D: (0, 0)}
CLASS_LOAD = {Cls.A: "oversize", Cls.B: "oversize", Cls.C: "superload", Cls.D: "legal"}
CLASS_PILOTS = {Cls.A: 1, Cls.B: 1, Cls.C: 2, Cls.D: 0}

@dataclass
class Unit:
    model: str
    cls: Cls
    mw: float
    origin: str                 # where the unit sits now (drives the corridor)
    value_usd: float
    made_in: str = None         # country of manufacture (drives duty); defaults to origin
    total_t: float = None       # override class default when a real spec sheet exists
    piece_t: float = None
    winter: bool = False
    waterfront: bool = False     # destination site has water access (needed for Class D)

    def weights(self):
        d = CLASS_WEIGHT[self.cls]
        return (self.total_t or d[0], self.piece_t or d[1])

# ============================================================================
# COST STACK
# ============================================================================
def _band(lo, hi):
    return (round(lo), round(hi))

def estimate(unit: Unit, dest_region: str):
    flags = []
    # feasibility guard: a floating barge cannot reach a landlocked site
    if unit.cls == Cls.D and not unit.waterfront:
        return ({"model": unit.model, "infeasible": "Class D barge needs a waterfront site; "
                 "not viable for an inland location"}, None)

    total_t, piece_t = unit.weights()
    corr = CORRIDORS.get((unit.origin, dest_region))
    if corr is None:
        raise ValueError(f"no corridor for {unit.origin} -> {dest_region}")

    stack = {}
    stack["origin_prep"] = _band(*ORIGIN_PREP[unit.cls.value])

    # ocean (overseas origins only)
    if corr["ocean_days"] > 0 and unit.cls != Cls.D:
        rt = total_t  # dense machinery: tonnes >= cubic meters, RT = tonnes
        lo, hi = OCEAN_USD_PER_RT
        if piece_t <= FLAT_RACK_MAX_TONNES:
            lo, hi = lo * FLAT_RACK_DISCOUNT, hi * FLAT_RACK_DISCOUNT
        ocean = [rt * lo, rt * hi]
        if unit.origin in ("SA", "AE"):
            ocean = [ocean[0] * (1 + GULF_LANE_SURCHARGE), ocean[1] * (1 + GULF_LANE_SURCHARGE)]
        stack["ocean_freight"] = _band(*ocean)
        # heavy-lift surcharge on the heaviest piece
        if piece_t > HEAVY_LIFT_PIECE_T:
            stack["heavy_lift_surcharge"] = _band(piece_t * HEAVY_LIFT_USD_PER_T[0],
                                                  piece_t * HEAVY_LIFT_USD_PER_T[1])
        if piece_t > CHARTER_FLAG_PIECE_T:
            flags.append(f"largest piece ~{piece_t:.0f}t: dedicated/charter likely, "
                         "price ocean as a lumpsum quote, not per-ton")
        stack["marine_insurance"] = _band(unit.value_usd * MARINE_INSURANCE[0],
                                          unit.value_usd * MARINE_INSURANCE[1])
        ph = PORT_HANDLING[unit.cls.value]
        stack["port_handling"] = _band(ph[0] * 2, ph[1] * 2)
    elif corr["ocean_days"] == 0:
        ph = PORT_HANDLING[unit.cls.value]
        stack["port_handling"] = _band(ph[0], ph[1])

    # inland heavy-haul to site
    miles = corr["inland_miles"]
    lo, hi = INLAND_USD_PER_MILE[CLASS_LOAD[unit.cls]]
    if miles < SHORT_HAUL_MILES:
        lo, hi = lo * SHORT_HAUL_MULT, hi * SHORT_HAUL_MULT
    haul = [miles * lo, miles * hi]
    if unit.winter:
        haul = [haul[0] * (1 + WINTER_SURCHARGE), haul[1] * (1 + WINTER_SURCHARGE)]
    stack["inland_haul"] = _band(*haul)

    # escorts
    pilots = CLASS_PILOTS[unit.cls]
    esc_lo = esc_hi = 0.0
    if pilots:
        esc_lo += pilots * miles * PILOT_USD_PER_MILE
        esc_hi += pilots * miles * PILOT_USD_PER_MILE
    if CLASS_LOAD[unit.cls] == "superload":
        esc_lo += POLICE_MIN_HOURS * POLICE_USD_PER_HOUR
        esc_hi += (POLICE_MIN_HOURS * 3) * POLICE_USD_PER_HOUR
    if esc_hi:
        stack["escorts"] = _band(esc_lo, esc_hi)

    # permits
    j = corr["jurisdictions"]
    p = PERMIT_SUPERLOAD if CLASS_LOAD[unit.cls] == "superload" else PERMIT_OVERSIZE
    stack["permits"] = _band(j * p[0], j * p[1])

    # crane + rigging at site
    cr = CRANE_USD_PER_DAY[unit.cls.value]
    days = RIG_DAYS[unit.cls.value]
    if days:
        stack["crane_rigging"] = _band(cr[0] * days, cr[1] * days)

    # ---- duty + GST on the IMPORT value only (goods + international freight + duty) ----
    import_keys = {"origin_prep", "ocean_freight", "heavy_lift_surcharge",
                   "marine_insurance", "port_handling"}
    import_logi = statistics.mean([sum(v[0] for k, v in stack.items() if k in import_keys),
                                   sum(v[1] for k, v in stack.items() if k in import_keys)])
    value_for_duty = unit.value_usd + import_logi
    duty_rate = DUTY_RATE_GENSET if unit.cls == Cls.A else DUTY_RATE_TURBINE
    if unit.cls == Cls.A:
        flags.append("Class A genset is HS 8502 (not 8411); confirm MFN rate and CETA "
                     "origin (MTU is German-made) with a broker")
    prov = PROVINCIAL_TAX.get(dest_region, 0.0)
    duty = value_for_duty * duty_rate
    taxes = (value_for_duty + duty) * (GST + prov)
    stack["duty"] = _band(duty, duty)
    stack["gst_provincial"] = _band(taxes, taxes)

    # ---- totals: logistics separate from recoverable taxes ----
    tax_keys = {"duty", "gst_provincial"}
    logistics = (sum(v[0] for k, v in stack.items() if k not in tax_keys),
                 sum(v[1] for k, v in stack.items() if k not in tax_keys))
    taxes_total = (sum(v[0] for k, v in stack.items() if k in tax_keys),
                   sum(v[1] for k, v in stack.items() if k in tax_keys))
    total = (logistics[0] + taxes_total[0], logistics[1] + taxes_total[1])

    # ---- lead time (weeks) ----
    prep_wk = {Cls.A: 2, Cls.B: 5, Cls.C: 7, Cls.D: 6}[unit.cls]
    ocean_wk = round(corr["ocean_days"] / 7) if corr["ocean_days"] else 0
    customs_wk = 1 if corr["ocean_days"] else 0
    permit_wk = 3 if CLASS_LOAD[unit.cls] == "superload" else 1
    haul_wk = max(1, round(miles / 500))
    weeks_lo = prep_wk + ocean_wk + customs_wk + permit_wk + haul_wk
    weeks_hi = weeks_lo + 3

    internal = {
        "model": unit.model, "class": unit.cls.value, "corridor": corr["entry"],
        "weights_t": {"total": total_t, "largest_piece": piece_t},
        "stack_usd": stack,
        "logistics_usd": _band(*logistics),
        "taxes_usd": _band(*taxes_total),
        "delivered_with_tax_usd": _band(*total),
        "weeks_to_site": (weeks_lo, weeks_hi),
        "flags": flags,
        "currency": CURRENCY,
    }
    if logistics[1] < 100_000:
        step = 10_000
    elif logistics[1] < 250_000:
        step = 25_000
    else:
        step = 50_000
    buyer_lo = max(step, (logistics[0] // step) * step)
    buyer_hi = -(-logistics[1] // step) * step
    buyer = {
        "model": unit.model,
        "indicative_logistics_band_usd": (int(buyer_lo), int(buyer_hi)),
        "estimated_weeks_to_site": (weeks_lo, weeks_hi),
        "note": "Indicative logistics only, excludes duty and taxes. "
                "Firm delivered price on request once site is confirmed.",
    }
    return internal, buyer

# ============================================================================
# WORKED EXAMPLES
# ============================================================================
def _show(internal, buyer):
    print(f"\n{'='*68}\n{internal['model']}", end="")
    if "infeasible" in internal:
        print(f"\n  INFEASIBLE: {internal['infeasible']}")
        return
    print(f"  (class {internal['class']})  ->  site")
    print(f"corridor: {internal['corridor']}")
    print(f"weights (t): total {internal['weights_t']['total']}, "
          f"largest piece {internal['weights_t']['largest_piece']}")
    print(f"{'-'*68}")
    for k, (lo, hi) in internal["stack_usd"].items():
        tag = "  (tax, recoverable)" if k in ("duty", "gst_provincial") else ""
        print(f"  {k:<20} ${lo:>10,.0f}  -  ${hi:>10,.0f}{tag}")
    llo, lhi = internal["logistics_usd"]; tlo, thi = internal["taxes_usd"]
    dlo, dhi = internal["delivered_with_tax_usd"]; wlo, whi = internal["weeks_to_site"]
    print(f"{'-'*68}")
    print(f"  LOGISTICS (transport)  ${llo:>10,.0f}  -  ${lhi:>10,.0f}   <- the real number")
    print(f"  taxes (recoverable)    ${tlo:>10,.0f}  -  ${thi:>10,.0f}")
    print(f"  delivered with tax     ${dlo:>10,.0f}  -  ${dhi:>10,.0f}   ({wlo}-{whi} wks)")
    blo, bhi = buyer["indicative_logistics_band_usd"]
    print(f"  BUYER logistics band   ${blo:>10,.0f}  -  ${bhi:>10,.0f}   ({wlo}-{whi} wks)")
    for fl in internal["flags"]:
        print(f"  ! {fl}")

if __name__ == "__main__":
    cases = [
        (Unit("MTU 20V4000 GS genset", Cls.A, 2.5, "US", value_usd=1_200_000, made_in="DE"), "AB"),
        (Unit("Siemens SGT-500 (UAE)", Cls.B, 18.5, "AE", value_usd=6_000_000, made_in="DE"), "AB"),
        (Unit("Kawasaki L30A (Japan)", Cls.B, 34, "JP", value_usd=12_000_000, made_in="JP"), "AB"),
        (Unit("GE Frame 6B (US West)", Cls.C, 40, "US", value_usd=9_000_000, made_in="US", winter=True), "AB"),
        (Unit("ABB GT10B (Saudi)", Cls.C, 24, "SA", value_usd=5_000_000, made_in="SE"), "ON"),
        (Unit("GE Frame 5 Power Barge", Cls.D, 160, "US", value_usd=15_000_000, made_in="US"), "AB"),
    ]
    for u, dest in cases:
        _show(*estimate(u, dest))
    print(f"\n{'='*68}\nDirectional model, v2. Replace class-default weights with real spec")
    print("sheet figures per unit, add the routing API and a currency layer, and have a")
    print("broker confirm the HS line per unit, before any number goes to a buyer.")
