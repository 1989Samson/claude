"use client";

import { useState } from "react";
import { findSupply, type SupplyCandidate } from "@/lib/client";

// Quick-picks from the Jerritt Canyon sheet so you can fire a real hunt in one
// click. The engine works on any equipment need you type, too.
const QUICK_PICKS: { item: string; sizeSpec: string; targetModels: string[] }[] = [
  { item: "Underground LHD / scooptram", sizeSpec: "6-10 yd3, low-profile", targetModels: ["CAT R1700", "Sandvik LH514", "Epiroc ST14"] },
  { item: "Underground haul truck", sizeSpec: "35-40 ton, low-profile", targetModels: ["CAT AD45", "Sandvik TH540", "Epiroc MT42"] },
  { item: "Development jumbo drill", sizeSpec: "2-boom", targetModels: ["Sandvik DD421", "Epiroc Boomer M2C"] },
  { item: "Track dozer", sizeSpec: "D10-D11 class", targetModels: ["CAT D10", "CAT D11"] },
  { item: "Motor grader", sizeSpec: "16M/24M class", targetModels: ["CAT 16M", "CAT 24M"] },
  { item: "Wheel loader", sizeSpec: "980-988 class", targetModels: ["CAT 980", "CAT 988", "Komatsu WA"] },
];

export default function SourcingTab() {
  const [item, setItem] = useState("");
  const [sizeSpec, setSizeSpec] = useState("");
  const [models, setModels] = useState("");
  const [region, setRegion] = useState("North America");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState<SupplyCandidate[] | null>(null);

  async function run(over?: { item: string; sizeSpec: string; targetModels: string[] }) {
    const q = over
      ? { item: over.item, sizeSpec: over.sizeSpec, targetModels: over.targetModels, region }
      : {
          item: item.trim(),
          sizeSpec: sizeSpec.trim() || undefined,
          targetModels: models.trim() ? models.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
          region,
        };
    if (!q.item || q.item.length < 2) {
      setError("Enter an equipment item first.");
      return;
    }
    if (over) {
      setItem(over.item);
      setSizeSpec(over.sizeSpec);
      setModels(over.targetModels.join(", "));
    }
    setError("");
    setCandidates(null);
    setBusy(true);
    try {
      const res = await findSupply(q);
      setCandidates(res.candidates);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Supply search failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="note">
        Your edge: for any equipment need, the engine searches the live market and
        returns real available used or rebuilt units, each with a source link. No
        listing without a source is shown. Type a need or start from a Jerritt
        Canyon quick-pick.
      </div>

      <div style={{ marginBottom: 12 }}>
        {QUICK_PICKS.map((q) => (
          <button
            key={q.item}
            className="ghost"
            style={{ marginTop: 0, marginRight: 8, marginBottom: 8, padding: "6px 12px" }}
            onClick={() => run(q)}
            disabled={busy}
          >
            {q.item}
          </button>
        ))}
      </div>

      <div className="grid2">
        <div>
          <label>Equipment item</label>
          <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. underground LHD / scooptram" />
          <label>Size / spec</label>
          <input value={sizeSpec} onChange={(e) => setSizeSpec(e.target.value)} placeholder="e.g. 6-10 yd3, low-profile" />
        </div>
        <div>
          <label>Target makes/models (comma-separated)</label>
          <input value={models} onChange={(e) => setModels(e.target.value)} placeholder="CAT R1700, Sandvik LH514" />
          <label>Preferred region</label>
          <input value={region} onChange={(e) => setRegion(e.target.value)} />
        </div>
      </div>
      <button onClick={() => run()} disabled={busy}>
        {busy ? "Hunting supply" : "Find available units"}
      </button>

      {error && (
        <div className="result warn" style={{ marginTop: 18 }}>
          {error}
        </div>
      )}

      {candidates && (
        <div className="result">
          <div className="small" style={{ marginBottom: 10 }}>
            {candidates.length > 0
              ? `${candidates.length} cited unit(s) found.`
              : "No cited units found for this spec. Try widening the spec or models."}
          </div>
          {candidates.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Year / hrs</th>
                  <th className="num">Price</th>
                  <th>Location</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c, i) => (
                  <tr key={i}>
                    <td>
                      {c.make || c.model ? <b>{[c.make, c.model].filter(Boolean).join(" ")}</b> : null}
                      <div className="small">{c.description}</div>
                      {c.condition && <div className="ptlist">{c.condition}</div>}
                    </td>
                    <td className="small">
                      {c.year ?? "--"} {c.hours ? `/ ${c.hours.toLocaleString()} h` : ""}
                    </td>
                    <td className="num">{c.priceText ?? "--"}</td>
                    <td className="small">{c.location ?? "--"}</td>
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
        </div>
      )}
    </div>
  );
}
