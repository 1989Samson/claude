"use client";

import { useState } from "react";
import { planRead } from "@/lib/wedge/plan";
import {
  type GasAccess,
  type PowerMode,
  type ProvinceCode,
  type Timeframe,
  type WedgeRead,
} from "@/lib/wedge/schema";

// The public front door. Buyer gives the minimum; gets an indicative,
// engine-backed read of the grid gap and the equipment-to-pad options that beat
// it; then hands a structured enquiry straight to a principal. No supply, no
// sources, no precise spread. Runs entirely client side.

const PRINCIPAL_EMAIL = "sam@mccordinvestments.com";

const PROVINCES: { v: ProvinceCode; label: string }[] = [
  { v: "AB", label: "Alberta" },
  { v: "ON", label: "Ontario" },
  { v: "QC", label: "Quebec" },
];
const MODES: { v: PowerMode; label: string }[] = [
  { v: "unsure", label: "Not sure yet" },
  { v: "bridge", label: "Bridge power (fastest)" },
  { v: "prime", label: "Prime power (permanent)" },
];
const TIMEFRAMES: { v: Timeframe; label: string }[] = [
  { v: "asap", label: "As soon as possible" },
  { v: "6mo", label: "Within 6 months" },
  { v: "12mo", label: "Within 12 months" },
  { v: "12mo_plus", label: "12 months or more" },
];
const GAS: { v: GasAccess; label: string }[] = [
  { v: "unsure", label: "Not sure" },
  { v: "yes", label: "Yes, gas on site" },
  { v: "no", label: "No gas on site" },
];

export default function TimeToPower() {
  const [mw, setMw] = useState("");
  const [province, setProvince] = useState<ProvinceCode>("AB");
  const [mode, setMode] = useState<PowerMode>("unsure");
  const [tf, setTf] = useState<Timeframe>("asap");
  const [gas, setGas] = useState<GasAccess>("unsure");
  const [read, setRead] = useState<WedgeRead | null>(null);
  const [err, setErr] = useState("");

  function run() {
    setErr("");
    const n = Number(mw);
    if (!Number.isFinite(n) || n <= 0) {
      setErr("Enter the power you need, in MW.");
      setRead(null);
      return;
    }
    setRead(planRead({ mw: n, province, mode, timeframe: tf, gas }));
  }

  return (
    <>
      <div className="hero">
        <div className="brand">McCORD INVESTMENTS</div>
        <div className="eyebrow" style={{ marginTop: 14 }}>Sourced globally, placed in Canada</div>
        <div className="lede">We move the power that builds what comes next.</div>
        <div className="sub">
          Grid connection is the constraint on every Canadian build. We bring power
          in from global supply the domestic queue cannot reach in time, matched to
          your project, with the customs, logistics and compliance already solved.
          Tell us what you are building.
        </div>
      </div>

      <div className="wrap">
        <div className="eyebrow">Time to Power</div>
        <h3 style={{ fontSize: 16, margin: "8px 0 14px", fontFamily: "Georgia, serif" }}>
          What do you need, and where?
        </h3>

        <div className="grid2">
          <div>
            <label>Power needed (MW)</label>
            <input value={mw} onChange={(e) => setMw(e.target.value)} inputMode="decimal" placeholder="e.g. 50" />
            <label>Province</label>
            <select value={province} onChange={(e) => setProvince(e.target.value as ProvinceCode)}>
              {PROVINCES.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
            </select>
            <label>Gas available on site</label>
            <select value={gas} onChange={(e) => setGas(e.target.value as GasAccess)}>
              {GAS.map((g) => <option key={g.v} value={g.v}>{g.label}</option>)}
            </select>
          </div>
          <div>
            <label>Power type</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as PowerMode)}>
              {MODES.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
            </select>
            <label>When do you need it energized</label>
            <select value={tf} onChange={(e) => setTf(e.target.value as Timeframe)}>
              {TIMEFRAMES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <button onClick={run}>See the read</button>
        {err && <div className="result warn" style={{ marginTop: 14 }}>{err}</div>}

        {read && <Read read={read} contactDefaults={{ mw: read.mw }} />}
      </div>
    </>
  );
}

function Read({ read }: { read: WedgeRead; contactDefaults: { mw: number } }) {
  return (
    <div style={{ marginTop: 26 }}>
      {/* The gap: the constraint the buyer is up against, stated honestly. */}
      <div className="gap">
        <div className="eyebrow">{read.gap.province}, the grid position</div>
        <h4>{read.gap.headline}</h4>
        <p>{read.gap.detail}</p>
        <div className="stance">{read.gap.stance}</div>
        <div className="small" style={{ marginTop: 10 }}>
          As of {read.gap.asOf}.{" "}
          {read.gap.verified && read.gap.source ? (
            <a href={read.gap.source} target="_blank" rel="noreferrer">Source</a>
          ) : (
            "Position confirmed per project."
          )}
        </div>
      </div>

      <div className="eyebrow" style={{ marginTop: 8 }}>Options to fit the stage</div>
      <div className="grid2" style={{ marginTop: 10 }}>
        {read.options.map((o) => (
          <div key={o.stage} className={"opt" + (o.recommended ? " rec" : "")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h4>{o.headline}</h4>
              {o.recommended && <span className="pill c-med">suggested</span>}
            </div>
            <div className="cfg">{o.config}</div>
            <div className="metrics">
              <div className="metric">
                <div className="lbl">Equipment to pad</div>
                <div className="val">{o.weeksToPad[0]} to {o.weeksToPad[1]} wks</div>
              </div>
              <div className="metric">
                <div className="lbl">Delivered, indicative</div>
                <div className="val">{usdBand(o.deliveredBandUsd)}</div>
              </div>
            </div>
            <div className="small">{o.note}</div>
          </div>
        ))}
      </div>

      <div className="eyebrow" style={{ marginTop: 20 }}>The annoying details, already handled</div>
      <ul className="handled">
        {read.detailsHandled.map((d) => <li key={d}>{d}</li>)}
      </ul>

      <div className="note" style={{ marginTop: 18 }}>{read.confidence}</div>
      <div className="small">{read.disclaimer}</div>

      <Handoff read={read} />
    </div>
  );
}

function Handoff({ read }: { read: WedgeRead }) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");

  function mailto() {
    const subject = `Power enquiry: ${read.mw} MW, ${read.gap.province}`;
    const lines = [
      "New enquiry from the Time to Power tool.",
      "",
      `Need: ${read.mw} MW in ${read.gap.province}`,
      ...read.options.map(
        (o) =>
          `- ${o.stage}: ${o.config}, ${o.weeksToPad[0]} to ${o.weeksToPad[1]} weeks to pad, indicative ${usdBand(o.deliveredBandUsd)}`,
      ),
      "",
      `Contact: ${name || "(name)"}, ${company || "(company)"}, ${email || "(email)"}`,
      "",
      "All figures indicative; please confirm the firm position and the full critical path.",
    ];
    const href = `mailto:${PRINCIPAL_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
    window.location.href = href;
  }

  return (
    <div className="result" style={{ marginTop: 22 }}>
      <div className="eyebrow">Delivered, not introduced</div>
      <h3 style={{ fontSize: 16, margin: "8px 0 6px", fontFamily: "Georgia, serif" }}>
        Take it to a principal.
      </h3>
      <div className="small" style={{ marginBottom: 8 }}>
        We confirm the firm delivered position, the matched supply, and the full
        critical path. Your details go straight to a principal, not a queue.
      </div>
      <div className="row3">
        <div>
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label>Company</label>
          <input value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
        <div>
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" />
        </div>
      </div>
      <button onClick={mailto}>Send to a principal</button>
    </div>
  );
}

function usd(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}
function usdBand(b: [number, number]): string {
  return `${usd(b[0])} to ${usd(b[1])}`;
}
