"use client";

import { useState } from "react";
import { buildUniverse, findSupply, type DemandItem, type SupplyCandidate } from "@/lib/client";

type SupplyState = {
  status: "idle" | "loading" | "done" | "error";
  candidates?: SupplyCandidate[];
  error?: string;
};

const TIER_LABEL: Record<string, string> = {
  local: "Local",
  regional: "Regional",
  national: "National",
  international: "Intl",
};

function tierClass(tier?: string) {
  switch ((tier ?? "").toLowerCase()) {
    case "local":
      return "c-high";
    case "regional":
    case "national":
      return "c-med";
    default:
      return "c-none";
  }
}

export default function SourcingApp() {
  const [project, setProject] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [building, setBuilding] = useState(false);
  const [buildErr, setBuildErr] = useState("");
  const [items, setItems] = useState<DemandItem[] | null>(null);
  const [supply, setSupply] = useState<Record<number, SupplyState>>({});
  const [runningAll, setRunningAll] = useState(false);

  function prefillJerritt() {
    setProject("Jerritt Canyon gold mine restart");
    setLocation("Elko County, Nevada");
    setNotes(
      "First Majestic restart, H2 2027. Underground (Smith/SSX) + open-pit studies, owner-operator fleet, 4,000 tpd roaster plant upgrade, dewatering. ~US$75M 2026 budget.",
    );
  }

  async function build() {
    if (project.trim().length < 2) {
      setBuildErr("Enter a project name.");
      return;
    }
    setBuildErr("");
    setItems(null);
    setSupply({});
    setBuilding(true);
    try {
      const u = await buildUniverse({
        project: project.trim(),
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setItems(u.items);
    } catch (e) {
      setBuildErr(humanError(e));
    } finally {
      setBuilding(false);
    }
  }

  async function hunt(idx: number, item: DemandItem) {
    setSupply((s) => ({ ...s, [idx]: { status: "loading" } }));
    try {
      const res = await findSupply({
        item: item.item,
        sizeSpec: item.sizeSpec,
        targetModels: item.targetModels,
        location: location.trim() || undefined,
      });
      setSupply((s) => ({ ...s, [idx]: { status: "done", candidates: res.candidates } }));
    } catch (e) {
      setSupply((s) => ({ ...s, [idx]: { status: "error", error: humanError(e) } }));
    }
  }

  // Run every line ONE AT A TIME. Anthropic's low usage tiers cap input tokens
  // per minute, and web search ingests a lot; serial + server-side retry keeps
  // it under the cap instead of erroring out.
  async function huntAll() {
    if (!items) return;
    setRunningAll(true);
    for (let idx = 0; idx < items.length; idx++) {
      await hunt(idx, items[idx]!);
    }
    setRunningAll(false);
  }

  const grouped = groupByCategory(items ?? []);
  const doneCount = Object.values(supply).filter((s) => s.status === "done").length;
  const rateLimited = Object.values(supply).some((s) =>
    /rate limit/i.test(s.error ?? ""),
  );

  return (
    <>
      <header>
        <h1>AURIC AXIS</h1>
        <span className="tag">Equipment sourcing &middot; mine restarts</span>
      </header>
      <div className="wrap">
        <div className="note">
          Build the complete equipment universe a restart needs, then hunt the live
          market for every available used or rebuilt unit, nearest the site first,
          each with a source link. Your job: work the reps and win the spread.
        </div>

        <h3 style={{ fontSize: 15, marginBottom: 6 }}>1. The project</h3>
        <div className="grid2">
          <div>
            <label>Mine / restart / project</label>
            <input value={project} onChange={(e) => setProject(e.target.value)} placeholder="e.g. Jerritt Canyon gold mine restart" />
            <label>Location (drives local-first supply search)</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Elko County, Nevada" />
          </div>
          <div>
            <label>Details (commodity, throughput, scope, or paste disclosure)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="underground + open pit, 4,000 tpd, owner-operator fleet, plant upgrade..." />
          </div>
        </div>
        <button onClick={build} disabled={building}>
          {building ? "Building universe" : "Build equipment universe"}
        </button>{" "}
        <button className="ghost" onClick={prefillJerritt} disabled={building}>
          Load Jerritt Canyon example
        </button>
        {buildErr && <div className="result warn" style={{ marginTop: 14 }}>{buildErr}</div>}

        {items && items.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 15, marginBottom: 6 }}>
              2. Equipment universe &middot; {items.length} items
            </h3>
            <div style={{ marginBottom: 14 }}>
              <button onClick={huntAll} disabled={runningAll}>
                {runningAll ? `Hunting all (${doneCount}/${items.length})` : "Find supply for all"}
              </button>{" "}
              <span className="small">or hunt any single line below</span>
            </div>

            {rateLimited && (
              <div className="banner" style={{ marginBottom: 14 }}>
                <b>Anthropic rate limit hit.</b> Your account is on a low usage
                tier (50k input tokens/min) and web search uses a lot. The app
                retries automatically, so single hunts still work - just pace
                them. For full-speed "find all", raise your tier at{" "}
                <a href="https://console.anthropic.com/settings/limits" target="_blank" rel="noreferrer">
                  console.anthropic.com/settings/limits
                </a>
                .
              </div>
            )}

            {grouped.map(([cat, list]) => (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div className="sector">{cat}</div>
                {list.map(({ item, idx }) => {
                  const st = supply[idx];
                  return (
                    <div key={idx} style={{ borderBottom: "1px solid var(--line)", padding: "10px 0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                        <div>
                          <b>{item.item}</b>
                          {item.usedSuitability && (
                            <span className={"pill " + suitClass(item.usedSuitability)} style={{ marginLeft: 8 }}>
                              used: {item.usedSuitability}
                            </span>
                          )}
                          <div className="small">{item.sizeSpec}</div>
                          {item.targetModels && item.targetModels.length > 0 && (
                            <div className="ptlist">{item.targetModels.join(", ")}</div>
                          )}
                        </div>
                        <button
                          className="ghost"
                          style={{ marginTop: 0, padding: "6px 12px", whiteSpace: "nowrap" }}
                          onClick={() => hunt(idx, item)}
                          disabled={st?.status === "loading"}
                        >
                          {st?.status === "loading" ? "Hunting" : "Find supply"}
                        </button>
                      </div>
                      {st?.status === "error" && <div className="small warn" style={{ marginTop: 6 }}>{st.error}</div>}
                      {st?.status === "done" && <SupplyTable candidates={st.candidates ?? []} />}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {items && items.length === 0 && (
          <div className="result warn" style={{ marginTop: 18 }}>
            No equipment list came back. Try adding a bit more detail and rebuild.
          </div>
        )}
      </div>
    </>
  );
}

function SupplyTable({ candidates }: { candidates: SupplyCandidate[] }) {
  if (candidates.length === 0) {
    return <div className="small" style={{ marginTop: 6 }}>No cited units found. Widen the spec or models.</div>;
  }
  return (
    <table style={{ marginTop: 8 }}>
      <thead>
        <tr>
          <th>Unit</th>
          <th>Year / hrs</th>
          <th className="num">Price</th>
          <th>Where</th>
          <th>Source</th>
        </tr>
      </thead>
      <tbody>
        {candidates.map((c, i) => (
          <tr key={i}>
            <td>
              {(c.make || c.model) && <b>{[c.make, c.model].filter(Boolean).join(" ")}</b>}
              <div className="small">{c.description}</div>
            </td>
            <td className="small">
              {c.year ?? "--"} {c.hours ? `/ ${c.hours.toLocaleString()} h` : ""}
            </td>
            <td className="num">{c.priceText ?? "--"}</td>
            <td className="small">
              {c.tier && <span className={"pill " + tierClass(c.tier)} style={{ marginRight: 6 }}>{TIER_LABEL[c.tier.toLowerCase()] ?? c.tier}</span>}
              {c.location ?? ""}
            </td>
            <td className="small">
              <a href={c.url} target="_blank" rel="noreferrer">{c.sourceName}</a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function suitClass(s: string) {
  switch (s.toLowerCase()) {
    case "high":
      return "c-high";
    case "medium":
      return "c-med";
    default:
      return "c-low";
  }
}

function groupByCategory(items: DemandItem[]): [string, { item: DemandItem; idx: number }[]][] {
  const map = new Map<string, { item: DemandItem; idx: number }[]>();
  items.forEach((item, idx) => {
    const cat = prettyCat(item.category);
    const list = map.get(cat) ?? [];
    list.push({ item, idx });
    map.set(cat, list);
  });
  return [...map.entries()];
}

function prettyCat(c?: string): string {
  if (!c) return "Other";
  return c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function humanError(e: unknown): string {
  const msg = e instanceof Error ? e.message : "Something went wrong";
  return /failed to fetch|networkerror|load failed/i.test(msg)
    ? "That request timed out or dropped. Try again, or narrow it."
    : msg;
}
