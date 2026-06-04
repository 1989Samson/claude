"use client";

import { Fragment } from "react";
import { fmtCAD, pillClass } from "@/lib/format";
import type { MatrixRow } from "@/lib/types";

export default function MatrixTab({ matrix }: { matrix: MatrixRow[] }) {
  let lastSector: string | null = null;

  return (
    <div>
      <div className="note">
        All values in CAD. Classes with no data show a dash, not a guess.
        Confidence stays Indicative until verified sold or auction points exist
        in a class.
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
                    <td colSpan={7} className="sector">
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
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
