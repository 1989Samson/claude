"use client";

import { useState } from "react";
import { researchAsset, type ResearchResponse } from "@/lib/client";
import { fmtCAD } from "@/lib/format";
import type { ClassMeta } from "@/lib/types";

export default function ResearchTab({
  classes,
  onChanged,
}: {
  classes: ClassMeta[];
  onChanged: () => Promise<void>;
}) {
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [persist, setPersist] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ResearchResponse | null>(null);

  async function run() {
    setError("");
    setResult(null);
    if (description.trim().length < 3) {
      setError("Describe the asset first.");
      return;
    }
    setBusy(true);
    try {
      const res = await researchAsset({
        description: description.trim(),
        classSlug: slug || undefined,
        persist: persist && Boolean(slug),
      });
      setResult(res);
      if (res.persisted && res.persisted.imported > 0) await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Research failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="note">
        The agent searches the live market (asks, auction results, and Canadian
        oil and gas receivership sales) and returns a cited FLV / OLV / FMV band
        in CAD. Every comp carries a source link. If it cannot find real
        evidence it says so and shows no band, rather than guessing. Save to a
        class to store the comps as sourced points that feed the matrix and
        backtest.
      </div>
      <label>Class (optional, enables saving comps)</label>
      <select value={slug} onChange={(e) => setSlug(e.target.value)}>
        <option value="">No class</option>
        {classes.map((c) => (
          <option key={c.id} value={c.slug}>
            {c.sector} &middot; {c.name}
          </option>
        ))}
      </select>
      <label>Asset description</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="e.g. CAT G3516 1000 kW natural gas genset, 2014, ~30,000 hrs, running, open skid, Alberta"
        style={{ minHeight: 70 }}
      />
      <label style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "none", letterSpacing: 0 }}>
        <input
          type="checkbox"
          checked={persist}
          onChange={(e) => setPersist(e.target.checked)}
          style={{ width: "auto" }}
          disabled={!slug}
        />
        Save cited comps to the selected class
      </label>
      <button onClick={run} disabled={busy}>
        {busy ? "Researching" : "Research asset"}
      </button>

      {error && (
        <div className="result warn" style={{ marginTop: 18 }}>
          {error}
        </div>
      )}

      {result && (
        <div className="result">
          {result.band ? (
            <div className="premise">
              <div className="box">
                <div className="lbl">Forced liq</div>
                <div className="val">{fmtCAD(result.band.flvCAD)}</div>
              </div>
              <div className="box">
                <div className="lbl">Orderly liq</div>
                <div className="val">{fmtCAD(result.band.olvCAD)}</div>
              </div>
              <div className="box fmv">
                <div className="lbl">Fair market</div>
                <div className="val">{fmtCAD(result.band.fmvCAD)}</div>
              </div>
            </div>
          ) : (
            <div className="warn" style={{ marginBottom: 10 }}>
              No defensible band: the agent did not find enough cited evidence.
            </div>
          )}

          <div className="small" style={{ marginBottom: 10 }}>
            Confidence: <b>{result.confidence}</b>
            {result.persisted &&
              ` · saved ${result.persisted.imported} comp(s) to the class`}
          </div>

          {result.comps.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Comp</th>
                  <th>Type</th>
                  <th className="num">Price</th>
                  <th>Date</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {result.comps.map((c, i) => (
                  <tr key={i}>
                    <td>{c.description}</td>
                    <td className="small">{c.type}</td>
                    <td className="num">
                      {c.currency} {Math.round(c.price).toLocaleString("en-CA")}
                    </td>
                    <td className="small">{c.date ?? "--"}</td>
                    <td className="small">
                      <a href={c.url} target="_blank" rel="noreferrer">
                        {c.sourceName}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="trail">
            <b>Reasoning.</b> {result.reasoning}
            {result.caveats && (
              <>
                <br />
                <b className="warn">Caveats.</b> {result.caveats}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
