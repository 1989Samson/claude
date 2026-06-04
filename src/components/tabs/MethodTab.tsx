"use client";

// Static method writeup, ported from the prototype. No em dashes.
export default function MethodTab() {
  return (
    <div>
      <div className="note">
        The logic, stated so any number is defensible by derivation.
      </div>
      <p>
        <b>Three premises.</b> FLV is the forced auction floor, OLV the orderly
        90 to 180 day result, FMV the motivated-buyer value. The OLV to FMV
        spread of 20 to 40 percent is from ASA-aligned appraisal practice, not
        invented. FLV and the asking-to-FMV haircut are flagged assumptions until
        calibrated.
      </p>
      <p>
        <b>Currency.</b> Each point stores its own currency. USD points convert
        to CAD at the rate on the Assumptions tab, sourced and dated. Nothing is
        silently mixed.
      </p>
      <p>
        <b>Point to band.</b> Each point is normalized to the class reference by
        dividing out its own hours, condition, packaging, and configuration
        multipliers, converted to an FMV estimate by source type, then weighted
        by source quality and by recency, which is a real decay by point age, not
        a label. The class FMV is that weighted central. OLV and FLV follow by
        the ratios above.
      </p>
      <p>
        <b>Valuing a unit.</b> Class FMV reference, scaled by rating, re-adjusted
        for the unit's own spec. Scaling is currently linear in rating, which
        understates economies of scale on units far from the reference. Stated,
        not hidden.
      </p>
      <p>
        <b>Confidence.</b> A class stays Indicative until it holds verified sold
        or auction points. Asking-only data never reads above Indicative. This is
        deliberately strict.
      </p>
      <p>
        <b>Backtest.</b> Once a class holds verified sold points, a leave-one-out
        backtest predicts each held-out sold point from the rest and reports the
        median absolute percent error. A class that has not been backtested does
        not claim an error. That is the gating dependency on verified sold data.
      </p>
      <p>
        <b>Auto-update path.</b> A scheduled job pulls newly closed auction
        results, normalizes each lot with the Claude API into the import schema,
        and posts them to the import endpoint, which writes to the shared
        database. The matrix recomputes for the whole team. No paste step.
      </p>
      <p className="small">
        Seeded sources: CAT G3516 asking range from PowerSystemsToday and
        MachineryTrader (USD). CAT 793 asking range from MachineryTrader (USD).
        FX from TradingView, Investing, Xe, 2026-06-03.
      </p>
    </div>
  );
}
