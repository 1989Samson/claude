"use client";

import { useState } from "react";
import { valuate } from "@/lib/client";
import { fmtCAD } from "@/lib/format";
import type { AssumptionsView, ClassMeta } from "@/lib/types";
import { confidenceLabel, type UnitValuation } from "@/lib/valuation";

const HOURS = [
  ["lt5k", "Under 5,000"],
  ["5to20k", "5,000 to 20,000"],
  ["20to40k", "20,000 to 40,000"],
  ["40to60k", "40,000 to 60,000"],
  ["gt60k", "Over 60,000"],
  ["unknown", "Unknown"],
  ["na", "Not applicable"],
] as const;
const CONDITION = [
  ["rebuilt", "Rebuilt / zero-hour"],
  ["running", "Running, tested"],
  ["idle", "Idle, complete, untested"],
  ["repair", "Needs repair"],
  ["parts", "Non-running / parts"],
  ["unknown", "Unknown"],
] as const;
const PACKAGING = [
  ["enclosed", "Enclosed / packaged"],
  ["skid", "Open skid"],
  ["none", "No package"],
  ["na", "Not applicable"],
] as const;
const CONFIG = [
  ["complete", "Complete"],
  ["partial", "Partial"],
  ["stripped", "Stripped"],
  ["na", "Not applicable"],
] as const;

export default function ValuateTab({
  classes,
  assumptions,
}: {
  classes: ClassMeta[];
  assumptions: AssumptionsView;
}) {
  const [slug, setSlug] = useState(classes[0]?.slug ?? "");
  const cls = classes.find((c) => c.slug === slug) ?? classes[0];
  const [rating, setRating] = useState<string>(String(cls?.refRating ?? ""));
  const [hoursBand, setHoursBand] = useState("5to20k");
  const [condition, setCondition] = useState("running");
  const [packaging, setPackaging] = useState("skid");
  const [config, setConfig] = useState("complete");
  const [transport, setTransport] = useState<string>("");
  const [result, setResult] = useState<
    { meta: ClassMeta; valuation: UnitValuation | null } | null
  >(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function onClassChange(next: string) {
    setSlug(next);
    const c = classes.find((x) => x.slug === next);
    if (c) setRating(String(c.refRating));
    setResult(null);
  }

  async function compute() {
    setError("");
    setBusy(true);
    try {
      const res = await valuate({
        classSlug: slug,
        rating: Number(rating) || cls?.refRating || 1,
        hoursBand,
        condition,
        packaging,
        config,
        transport: Number(transport) || 0,
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const v = result?.valuation ?? null;

  return (
    <div>
      <div className="grid2">
        <div>
          <label>Class</label>
          <select value={slug} onChange={(e) => onClassChange(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.sector} &middot; {c.name}
              </option>
            ))}
          </select>
          <label>Rating</label>
          <div className="row3">
            <input
              type="number"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              placeholder="value"
            />
            <input disabled value={cls?.unit ?? ""} />
            <input disabled value={cls ? "ref " + cls.refRating : ""} />
          </div>
          <label>Hours / usage</label>
          <select value={hoursBand} onChange={(e) => setHoursBand(e.target.value)}>
            {HOURS.map(([v2, l]) => (
              <option key={v2} value={v2}>
                {l}
              </option>
            ))}
          </select>
          <label>Condition</label>
          <select value={condition} onChange={(e) => setCondition(e.target.value)}>
            {CONDITION.map(([v2, l]) => (
              <option key={v2} value={v2}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Packaging</label>
          <select value={packaging} onChange={(e) => setPackaging(e.target.value)}>
            {PACKAGING.map(([v2, l]) => (
              <option key={v2} value={v2}>
                {l}
              </option>
            ))}
          </select>
          <label>Configuration completeness</label>
          <select value={config} onChange={(e) => setConfig(e.target.value)}>
            {CONFIG.map(([v2, l]) => (
              <option key={v2} value={v2}>
                {l}
              </option>
            ))}
          </select>
          <label>Transport drag to buyer (CAD, deducted in spread only)</label>
          <input
            type="number"
            value={transport}
            onChange={(e) => setTransport(e.target.value)}
            placeholder="estimate"
          />
        </div>
      </div>
      <button onClick={compute} disabled={busy}>
        {busy ? "Computing" : "Compute band"}
      </button>

      {error && (
        <div className="result warn" style={{ marginTop: 18 }}>
          {error}
        </div>
      )}

      {result && v === null && (
        <div className="result warn">
          No data in this class. Add verified sales or auction results before it
          can produce a number.
        </div>
      )}

      {result && v && cls && (
        <div className="result">
          <h3 style={{ fontSize: 15 }}>
            {result.meta.name} &middot; {v.rating} {result.meta.unit}
          </h3>
          <div className="premise">
            <div className="box">
              <div className="lbl">Forced liq</div>
              <div className="val">{fmtCAD(v.flv)}</div>
            </div>
            <div className="box">
              <div className="lbl">Orderly liq</div>
              <div className="val">{fmtCAD(v.olv)}</div>
            </div>
            <div className="box fmv">
              <div className="lbl">Fair market</div>
              <div className="val">{fmtCAD(v.fmv)}</div>
            </div>
          </div>
          <div style={{ textAlign: "center" }} className="small">
            Indicative spread, OLV acquire to FMV sale
            {v.transport ? `, less ${fmtCAD(v.transport)} transport` : ""}:{" "}
            <b style={{ color: "var(--gold)" }}>{fmtCAD(v.spread)}</b>
          </div>
          <div className="trail">
            <b>Method.</b> Class FMV ref {fmtCAD(v.classFmvRef)} at{" "}
            {result.meta.refRating} {result.meta.unit}, scaled &times;
            {v.scale.toFixed(2)} for rating, &times;{v.specMult.toFixed(2)} for
            spec. OLV=FMV&times;{assumptions.olvRatio}, FLV=FMV&times;
            {assumptions.flvRatio}. Confidence {confidenceLabel(v.confidence)}.
            {v.askOnly && (
              <>
                <br />
                <b className="warn">Indicative only.</b> Built on asking signals
                with no verified sold data. Do not quote to a receiver until sold
                data and a backtest exist.
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
