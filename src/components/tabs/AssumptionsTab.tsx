"use client";

import { useEffect, useState } from "react";
import { getCalibration, saveAssumptions, type Calibration } from "@/lib/client";
import type { AssumptionsView } from "@/lib/types";

export default function AssumptionsTab({
  assumptions,
  onSaved,
}: {
  assumptions: AssumptionsView;
  onSaved: (a: AssumptionsView) => Promise<void>;
}) {
  const [fxRate, setFxRate] = useState(String(assumptions.fxRate));
  const [olvRatio, setOlvRatio] = useState(String(assumptions.olvRatio));
  const [flvRatio, setFlvRatio] = useState(String(assumptions.flvRatio));
  const [askToFmv, setAskToFmv] = useState(String(assumptions.askToFmv));
  const [auctionToFmv, setAuctionToFmv] = useState(
    String(assumptions.auctionToFmv),
  );
  const [recency, setRecency] = useState(
    String(assumptions.recencyHorizonMonths),
  );
  const [msg, setMsg] = useState<{ text: string; warn?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [cal, setCal] = useState<Calibration | null>(null);

  useEffect(() => {
    getCalibration()
      .then(setCal)
      .catch(() => setCal(null));
  }, []);

  async function save() {
    setMsg(null);
    setBusy(true);
    try {
      const saved = await saveAssumptions({
        fxRate: Number(fxRate),
        olvRatio: Number(olvRatio),
        flvRatio: Number(flvRatio),
        askToFmv: Number(askToFmv),
        auctionToFmv: Number(auctionToFmv),
        recencyHorizonMonths: Number(recency),
      });
      await onSaved(saved);
      setMsg({ text: "Saved. Matrix recomputed." });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Failed", warn: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="note">
        Every assumption is visible and editable. Provenance is flagged. Change
        one and the whole matrix recomputes.
      </div>

      {cal && (cal.askToFmv !== null || cal.auctionToFmv !== null) && (
        <div className="result" style={{ marginBottom: 16 }}>
          <b style={{ color: "var(--gold)" }}>Calibrated from your data.</b>{" "}
          <span className="small">
            Fitted from {cal.nAnchor} verified sold anchor(s).
          </span>
          <div className="small" style={{ marginTop: 8 }}>
            {cal.askToFmv !== null && (
              <div style={{ marginBottom: 6 }}>
                Asking to FMV: <b>{cal.askToFmv.toFixed(3)}</b> (n={cal.nAsking},
                current {askToFmv}){" "}
                <button
                  className="ghost"
                  style={{ marginTop: 0, padding: "4px 10px" }}
                  onClick={() => setAskToFmv(cal.askToFmv!.toFixed(3))}
                >
                  Use
                </button>
              </div>
            )}
            {cal.auctionToFmv !== null && (
              <div>
                Auction to FMV: <b>{cal.auctionToFmv.toFixed(3)}</b> (n=
                {cal.nAuction}, current {auctionToFmv}){" "}
                <button
                  className="ghost"
                  style={{ marginTop: 0, padding: "4px 10px" }}
                  onClick={() => setAuctionToFmv(cal.auctionToFmv!.toFixed(3))}
                >
                  Use
                </button>
              </div>
            )}
            <div style={{ marginTop: 6 }}>
              Click Use, then Save assumptions to apply. The defaults stay until
              you do.
            </div>
          </div>
        </div>
      )}
      <label>USD to CAD rate</label>
      <input
        type="number"
        step="0.0001"
        value={fxRate}
        onChange={(e) => setFxRate(e.target.value)}
      />
      <div className="small">
        Sourced {assumptions.fxDate} at ~1.385 (TradingView, Investing, Xe
        agreement). Update as needed.
      </div>
      <div className="grid2" style={{ marginTop: 8 }}>
        <div>
          <label>OLV as fraction of FMV</label>
          <input
            type="number"
            step="0.01"
            value={olvRatio}
            onChange={(e) => setOlvRatio(e.target.value)}
          />
          <div className="small">
            Sourced: appraisal practice puts the FMV to OLV spread at 20 to 40
            percent, so OLV is 0.60 to 0.80 of FMV. Default 0.70.
          </div>
          <label>FLV as fraction of FMV</label>
          <input
            type="number"
            step="0.01"
            value={flvRatio}
            onChange={(e) => setFlvRatio(e.target.value)}
          />
          <div className="small warn">
            Assumption, not yet calibrated. FLV is the auction floor, below OLV.
            Default 0.55. Set per class as data arrives.
          </div>
        </div>
        <div>
          <label>Asking to FMV factor</label>
          <input
            type="number"
            step="0.01"
            value={askToFmv}
            onChange={(e) => setAskToFmv(e.target.value)}
          />
          <div className="small warn">
            Assumption, uncalibrated. Asks sit above realized. Default 0.85.
            Calibrate once paired ask and sold data exist.
          </div>
          <label>Auction to FMV factor</label>
          <input
            type="number"
            step="0.01"
            value={auctionToFmv}
            onChange={(e) => setAuctionToFmv(e.target.value)}
          />
          <div className="small">
            Auction hammer is near the floor, so grossed up to FMV. Default 1.43
            (inverse of 0.70).
          </div>
          <label>Recency horizon (months)</label>
          <input
            type="number"
            value={recency}
            onChange={(e) => setRecency(e.target.value)}
          />
          <div className="small">
            Points older than this decay toward a 0.3 floor weight. Default 36.
          </div>
        </div>
      </div>
      <button onClick={save} disabled={busy}>
        Save assumptions
      </button>{" "}
      {msg && <span className={msg.warn ? "warn" : "added"}>{msg.text}</span>}
    </div>
  );
}
