"use client";

import { Fragment, useState } from "react";
import { runBacktest } from "@/lib/client";
import { fmtCAD, pillClass } from "@/lib/format";
import type { MatrixRow } from "@/lib/types";

function errorCell(row: MatrixRow): string {
  if (row.backtestError === null) {
    return row.verifiedPoints > 0 ? "not backtested" : "--";
  }
  return `${(row.backtestError * 100).toFixed(1)}% (n=${row.backtestN})`;
}

export default function MatrixTab({
  matrix,
  onRefresh,
}: {
  matrix: MatrixRow[];
  onRefresh: () => Promise<void>;
}) {
  let lastSector: string | null = null;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function backtest() {
    setBusy(true);
    setMsg("");
    try {
      const res = await runBacktest();
      await onRefresh();
      setMsg(
        res.classesEvaluated > 0
          ? `Backtested ${res.classesEvaluated} class(es) with verified sold data.`
          : "No class has verified sold points yet, so the model cannot state its error.",
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="note">
        All values in CAD. Classes with no data show a dash, not a guess.
        Confidence stays Indicative until verified sold or auction points exist
        in a class. Model error is the leave-one-out median absolute percent
        error on verified sold points, blank until a class has been backtested.
      </div>
      <div style={{ marginBottom: 12 }}>
        <button className="ghost" onClick={backtest} disabled={busy}>
          {busy ? "Running" : "Run backtest"}
        </button>{" "}
        {msg && <span className="small">{msg}</span>}
      </div>
      <table>
        <thead>
          <tr>
            <th>Class</th>
            <th>Reference</th>
            <th className="num">FLV</th>
            <th className="num">OLV</th>
            <th className="num">FMV</th>
            <th className="num">Pts</th>
            <th>Confidence</th>
            <th className="num">Model error</th>
          </tr>
        </thead>
        <tbody>
          {matrix.map((c) => {
            const showSector = c.sector !== lastSector;
            lastSector = c.sector;
            return (
              <Fragment key={c.id}>
                {showSector && (
                  <tr>
                    <td colSpan={8} className="sector">
                      {c.sector}
                    </td>
                  </tr>
                )}
                <tr>
                  <td>
                    {c.name}
                    <div className="small">{c.category}</div>
                    {c.nPoints > 0 && (
                      <div className="ptlist">
                        {c.nPoints} pt: {c.pointTypes.join(", ")}
                      </div>
                    )}
                  </td>
                  <td className="small">
                    {c.refRating} {c.unit}
                  </td>
                  <td className="num">{fmtCAD(c.flv)}</td>
                  <td className="num">{fmtCAD(c.olv)}</td>
                  <td className="num">{fmtCAD(c.fmv)}</td>
                  <td className="num">{c.nPoints}</td>
                  <td>
                    <span className={"pill " + pillClass(c.confidence)}>
                      {c.confidenceLabel}
                    </span>
                  </td>
                  <td className="num small">{errorCell(c)}</td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
