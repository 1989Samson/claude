"use client";

import { useState } from "react";
import { estimate, RATES_AS_OF, RATES_VERSION } from "@/lib/transport/engine";
import {
  isInfeasible,
  type BuyerEstimate,
  type DestRegion,
  type EstimateResult,
  type InternalEstimate,
  type OriginCode,
  type TransportClass,
  type UnitInput,
} from "@/lib/transport/schema";

// The transport tab is a pure, deterministic calculator: the engine runs in the
// browser, so there is no API key, no rate limit, and no cost. It returns the
// two-tier view from the spec, a buyer band by default and the full internal
// cost stack on request. The buyer band can never carry the precise number
// because the engine builds it as a separate object.

const CLASSES: { value: TransportClass; label: string }[] = [
  { value: "A", label: "A - containerized gas genset (1-2.5 MW)" },
  { value: "B", label: "B - aeroderivative / light turbine (3.5-48 MW)" },
  { value: "C", label: "C - heavy-frame turbine (12-40 MW)" },
  { value: "D", label: "D - power barge (floats, waterfront only)" },
];

const ORIGINS: { value: OriginCode; label: string }[] = [
  { value: "US", label: "United States" },
  { value: "SA", label: "Saudi Arabia" },
  { value: "AE", label: "United Arab Emirates" },
  { value: "JP", label: "Japan" },
];

// Destinations the engine has a routed corridor for. BC, SK, MB carry a tax rate
// but no corridor yet, so they are out until the routing API lands.
const DESTS: { value: DestRegion; label: string }[] = [
  { value: "AB", label: "Alberta" },
  { value: "ON", label: "Ontario" },
  { value: "QC", label: "Quebec" },
];

interface FormState {
  model: string;
  cls: TransportClass;
  origin: OriginCode;
  dest: DestRegion;
  valueUsd: string;
  madeIn: string;
  mw: string;
  totalT: string;
  pieceT: string;
  winter: boolean;
  waterfront: boolean;
}

const BLANK: FormState = {
  model: "",
  cls: "B",
  origin: "US",
  dest: "AB",
  valueUsd: "",
  madeIn: "",
  mw: "",
  totalT: "",
  pieceT: "",
  winter: false,
  waterfront: false,
};

// The worked examples from the prototype, as one-click loads.
const PRESETS: (Partial<FormState> & { label: string })[] = [
  { label: "MTU genset (US)", model: "MTU 20V4000 GS genset", cls: "A", origin: "US", dest: "AB", valueUsd: "1200000", madeIn: "DE", mw: "2.5" },
  { label: "Siemens SGT-500 (UAE)", model: "Siemens SGT-500", cls: "B", origin: "AE", dest: "AB", valueUsd: "6000000", madeIn: "DE", mw: "18.5" },
  { label: "Kawasaki L30A (Japan)", model: "Kawasaki L30A", cls: "B", origin: "JP", dest: "AB", valueUsd: "12000000", madeIn: "JP", mw: "34" },
  { label: "GE Frame 6B (US, winter)", model: "GE Frame 6B", cls: "C", origin: "US", dest: "AB", valueUsd: "9000000", madeIn: "US", mw: "40", winter: true },
];

export default function TransportApp() {
  const [f, setF] = useState<FormState>(BLANK);
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [err, setErr] = useState("");
  const [showStack, setShowStack] = useState(false);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setF((s) => ({ ...s, [k]: v }));
  }

  function load(p: Partial<FormState>) {
    setF({ ...BLANK, ...p });
    setResult(null);
    setErr("");
  }

  function run() {
    setErr("");
    const value = Number(f.valueUsd);
    if (!f.model.trim()) return setErr("Enter a unit model.");
    if (!Number.isFinite(value) || value <= 0)
      return setErr("Enter the declared value in USD (a positive number).");

    const unit: UnitInput = {
      model: f.model.trim(),
      cls: f.cls,
      mw: numOr(f.mw, 0),
      origin: f.origin,
      valueUsd: value,
      madeIn: f.madeIn.trim() || undefined,
      totalT: optNum(f.totalT),
      pieceT: optNum(f.pieceT),
      winter: f.winter,
      waterfront: f.waterfront,
    };
    try {
      setResult(estimate(unit, f.dest));
      setShowStack(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not estimate this lane.");
      setResult(null);
    }
  }

  return (
    <div className="wrap">
      <div className="note">
        Delivered cost and time to site for moving 60 Hz generation iron to a
        Canadian build. Directional, not a firm quote: it returns a buyer band and
        weeks to site by default, with the full internal cost stack on request.
        Rate tables {RATES_VERSION}, as of {RATES_AS_OF}. All figures USD.
      </div>

      <h3 style={{ fontSize: 15, marginBottom: 6 }}>1. The unit</h3>
      <div style={{ marginBottom: 12 }}>
        {PRESETS.map((p) => (
          <button key={p.label} className="ghost" style={{ marginRight: 8, marginTop: 6, padding: "6px 12px" }} onClick={() => load(p)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid2">
        <div>
          <label>Model</label>
          <input value={f.model} onChange={(e) => set("model", e.target.value)} placeholder="e.g. GE Frame 6B" />
          <label>Transport class</label>
          <select value={f.cls} onChange={(e) => set("cls", e.target.value as TransportClass)}>
            {CLASSES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <label>Declared value (USD)</label>
          <input value={f.valueUsd} onChange={(e) => set("valueUsd", e.target.value)} inputMode="numeric" placeholder="e.g. 9000000" />
          <label>Rating MW (optional)</label>
          <input value={f.mw} onChange={(e) => set("mw", e.target.value)} inputMode="decimal" placeholder="e.g. 40" />
        </div>
        <div>
          <label>Origin (where the unit sits, drives the corridor)</label>
          <select value={f.origin} onChange={(e) => set("origin", e.target.value as OriginCode)}>
            {ORIGINS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <label>Country of manufacture (drives duty, optional)</label>
          <input value={f.madeIn} onChange={(e) => set("madeIn", e.target.value)} placeholder="e.g. DE, defaults to origin" />
          <label>Total weight, tonnes (optional, overrides class default)</label>
          <input value={f.totalT} onChange={(e) => set("totalT", e.target.value)} inputMode="decimal" placeholder="from the spec sheet" />
          <label>Largest piece, tonnes (optional)</label>
          <input value={f.pieceT} onChange={(e) => set("pieceT", e.target.value)} inputMode="decimal" placeholder="from the spec sheet" />
        </div>
      </div>

      <h3 style={{ fontSize: 15, margin: "18px 0 6px" }}>2. The site</h3>
      <div className="grid2">
        <div>
          <label>Destination province</label>
          <select value={f.dest} onChange={(e) => set("dest", e.target.value as DestRegion)}>
            {DESTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label>Conditions</label>
          <label style={{ textTransform: "none", letterSpacing: 0, marginTop: 8, color: "var(--ink)" }}>
            <input type="checkbox" style={{ width: "auto", marginRight: 8 }} checked={f.winter} onChange={(e) => set("winter", e.target.checked)} />
            Winter haul (Nov to Mar surcharge on the Canadian leg)
          </label>
          <label style={{ textTransform: "none", letterSpacing: 0, marginTop: 4, color: "var(--ink)" }}>
            <input type="checkbox" style={{ width: "auto", marginRight: 8 }} checked={f.waterfront} onChange={(e) => set("waterfront", e.target.checked)} />
            Site has water access (required for a Class D barge)
          </label>
        </div>
      </div>

      <button onClick={run}>Estimate delivered cost</button>
      {err && <div className="result warn" style={{ marginTop: 14 }}>{err}</div>}

      {result && <Output result={result} showStack={showStack} onToggle={() => setShowStack((s) => !s)} />}
    </div>
  );
}

function Output({ result, showStack, onToggle }: { result: EstimateResult; showStack: boolean; onToggle: () => void }) {
  const { internal, buyer } = result;
  if (isInfeasible(internal)) {
    return (
      <div className="result warn" style={{ marginTop: 18 }}>
        <b>Infeasible.</b> {internal.infeasible}.
      </div>
    );
  }
  return (
    <div style={{ marginTop: 22 }}>
      <h3 style={{ fontSize: 15, marginBottom: 6 }}>3. Buyer view</h3>
      <BuyerView buyer={buyer!} />

      <div className="small" style={{ marginTop: 10 }}>
        <span className={"pill " + (internal.confidence.weightsBasis === "spec sheet" ? "c-med" : "c-none")} style={{ marginRight: 8 }}>
          {internal.confidence.weightsBasis === "spec sheet" ? "real weights" : "default weights"}
        </span>
        {internal.confidence.note} Band spread {internal.confidence.spreadRatio}x.
      </div>

      <div style={{ marginTop: 16 }}>
        <button className="ghost" style={{ marginTop: 0 }} onClick={onToggle}>
          {showStack ? "Hide internal cost stack" : "Show internal cost stack"}
        </button>
      </div>

      {showStack && <InternalView internal={internal} />}
    </div>
  );
}

function BuyerView({ buyer }: { buyer: BuyerEstimate }) {
  return (
    <>
      <div className="premise">
        <div className="box">
          <div className="lbl">Indicative logistics (USD)</div>
          <div className="val">{fmtBand(buyer.indicativeLogisticsBandUsd)}</div>
        </div>
        <div className="box fmv">
          <div className="lbl">Weeks to site</div>
          <div className="val">{buyer.estimatedWeeksToSite[0]} to {buyer.estimatedWeeksToSite[1]}</div>
        </div>
        <div className="box">
          <div className="lbl">Basis</div>
          <div className="val" style={{ fontSize: 13 }}>Transport only</div>
        </div>
      </div>
      <div className="small">{buyer.note}</div>
    </>
  );
}

const TAX_KEYS = new Set(["duty", "gst_provincial"]);

function InternalView({ internal }: { internal: InternalEstimate }) {
  return (
    <div className="result" style={{ marginTop: 16 }}>
      <div className="trail" style={{ borderTop: "none", marginTop: 0, paddingTop: 0 }}>
        <b>{internal.model}</b> &middot; class {internal.cls} &middot; {internal.corridor}
        <div className="small" style={{ marginTop: 4 }}>
          Weights (t): total {internal.weightsT.total}, largest piece {internal.weightsT.largestPiece}
        </div>
      </div>

      <table style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Cost component</th>
            <th className="num">Low</th>
            <th className="num">High</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(internal.stackUsd).map(([k, band]) => (
            <tr key={k}>
              <td>
                {prettyKey(k)}
                {TAX_KEYS.has(k) && <span className="pill c-none" style={{ marginLeft: 8 }}>tax, recoverable</span>}
              </td>
              <td className="num">{usd(band[0])}</td>
              <td className="num">{usd(band[1])}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="premise" style={{ marginTop: 16 }}>
        <div className="box fmv">
          <div className="lbl">Logistics (the real number)</div>
          <div className="val" style={{ fontSize: 15 }}>{fmtBand(internal.logisticsUsd)}</div>
        </div>
        <div className="box">
          <div className="lbl">Taxes (recoverable)</div>
          <div className="val" style={{ fontSize: 15 }}>{fmtBand(internal.taxesUsd)}</div>
        </div>
        <div className="box">
          <div className="lbl">Delivered with tax</div>
          <div className="val" style={{ fontSize: 15 }}>{fmtBand(internal.deliveredWithTaxUsd)}</div>
        </div>
      </div>

      {internal.flags.length > 0 && (
        <div className="banner" style={{ marginTop: 14, marginBottom: 0 }}>
          {internal.flags.map((fl, i) => (
            <div key={i}>! {fl}</div>
          ))}
        </div>
      )}
      <div className="small" style={{ marginTop: 12 }}>{internal.currency}</div>
    </div>
  );
}

function usd(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}
function fmtBand(b: [number, number]): string {
  return `${usd(b[0])} - ${usd(b[1])}`;
}
function prettyKey(k: string): string {
  return k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
function optNum(s: string): number | undefined {
  const n = Number(s);
  return s.trim() && Number.isFinite(n) && n > 0 ? n : undefined;
}
function numOr(s: string, d: number): number {
  const n = Number(s);
  return s.trim() && Number.isFinite(n) ? n : d;
}
