"use client";

import { useState } from "react";
import { estimate } from "@/lib/transport/engine";
import { isInfeasible, type DestRegion } from "@/lib/transport/schema";
import { type SupplyUnit } from "@/lib/supply/schema";

// Internal view of the protected supply registry. Lists the real units you hold
// and runs any of them through the transport engine to a chosen province. You
// grow the registry by editing src/lib/supply/registry.json (version controlled,
// no database yet). sourceNote is internal and shown here only because this desk
// is access-protected; it never reaches the public wedge.

const DESTS: { v: DestRegion; label: string }[] = [
  { v: "AB", label: "Alberta" },
  { v: "ON", label: "Ontario" },
  { v: "QC", label: "Quebec" },
];

const STATUS_CLASS: Record<string, string> = {
  available: "c-high",
  pending: "c-med",
  placed: "c-none",
  watch: "c-none",
};

export default function SupplyApp({ supply }: { supply: SupplyUnit[] }) {
  const [dest, setDest] = useState<DestRegion>("AB");

  return (
    <div className="wrap">
      <div className="note">
        Protected supply registry. {supply.length} unit{supply.length === 1 ? "" : "s"} on file.
        Internal only: origin and source notes never leave this desk. Add units by
        editing <code>src/lib/supply/registry.json</code>. Run any unit to a site below.
      </div>

      <label>Estimate delivered to</label>
      <select value={dest} onChange={(e) => setDest(e.target.value as DestRegion)} style={{ maxWidth: 260 }}>
        {DESTS.map((d) => <option key={d.v} value={d.v}>{d.label}</option>)}
      </select>

      {supply.length === 0 ? (
        <div className="result warn" style={{ marginTop: 18 }}>
          Registry is empty. Add units to registry.json.
        </div>
      ) : (
        <table style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>Unit</th>
              <th>Class / MW</th>
              <th>Origin</th>
              <th>Status</th>
              <th className="num">Logistics (USD)</th>
              <th className="num">Weeks</th>
              <th>Source (internal)</th>
            </tr>
          </thead>
          <tbody>
            {supply.map((u) => {
              const res = estimate(
                { model: u.model, cls: u.cls, mw: u.mw, origin: u.origin, valueUsd: u.valueUsd, madeIn: u.madeIn, totalT: u.totalT, pieceT: u.pieceT, winter: false, waterfront: u.cls === "D" },
                dest,
              );
              const feasible = !isInfeasible(res.internal);
              return (
                <tr key={u.id}>
                  <td>
                    <b>{u.model}</b>
                    {u.notes && <div className="small">{u.notes}</div>}
                  </td>
                  <td className="small">{u.cls} / {u.mw} MW</td>
                  <td className="small">{u.origin}{u.madeIn ? ` (made ${u.madeIn})` : ""}</td>
                  <td><span className={"pill " + (STATUS_CLASS[u.status] ?? "c-none")}>{u.status}</span></td>
                  <td className="num">
                    {feasible && !isInfeasible(res.internal) ? usdBand(res.internal.logisticsUsd) : "n/a"}
                  </td>
                  <td className="num">
                    {feasible && !isInfeasible(res.internal)
                      ? `${res.internal.weeksToSite[0]}-${res.internal.weeksToSite[1]}`
                      : "n/a"}
                  </td>
                  <td className="small">{u.sourceNote}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function usd(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}
function usdBand(b: [number, number]): string {
  return `${usd(b[0])} - ${usd(b[1])}`;
}
