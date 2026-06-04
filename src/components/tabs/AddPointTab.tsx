"use client";

import { useState } from "react";
import { addPoint, importPoints } from "@/lib/client";
import type { ClassMeta } from "@/lib/types";

const SOURCE_TYPES = [
  ["own_close", "Own close"],
  ["sold_private", "Sold, private"],
  ["sisp", "SISP / receiver-reported sold"],
  ["auction", "Auction hammer (verified)"],
  ["asking", "Asking price (soft)"],
] as const;
const HOURS = [
  ["lt5k", "Under 5,000"],
  ["5to20k", "5,000 to 20,000"],
  ["20to40k", "20,000 to 40,000"],
  ["40to60k", "40,000 to 60,000"],
  ["gt60k", "Over 60,000"],
  ["unknown", "Unknown"],
  ["na", "N/A"],
] as const;
const CONDITION = [
  ["rebuilt", "Rebuilt"],
  ["running", "Running"],
  ["idle", "Idle/untested"],
  ["repair", "Needs repair"],
  ["parts", "Parts"],
  ["unknown", "Unknown"],
] as const;
const PACKAGING = [
  ["enclosed", "Enclosed"],
  ["skid", "Open skid"],
  ["none", "None"],
  ["na", "N/A"],
] as const;

const IMPORT_PLACEHOLDER =
  '[{"classId":"og_gen_g3516","price":92000,"cur":"USD","type":"auction","rating":1000,"hours":"20to40k","cond":"running","encl":"skid","date":"2026-05-01","src":"RB lot 412"}]';

export default function AddPointTab({
  classes,
  onChanged,
}: {
  classes: ClassMeta[];
  onChanged: () => Promise<void>;
}) {
  const [slug, setSlug] = useState(classes[0]?.slug ?? "");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<"CAD" | "USD">("CAD");
  const [sourceType, setSourceType] = useState("asking");
  const [saleDate, setSaleDate] = useState("");
  const [rating, setRating] = useState("");
  const [hoursBand, setHoursBand] = useState("20to40k");
  const [condition, setCondition] = useState("running");
  const [packaging, setPackaging] = useState("skid");
  const [sourceNote, setSourceNote] = useState("");
  const [addMsg, setAddMsg] = useState<{ text: string; warn?: boolean } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const [importBox, setImportBox] = useState("");
  const [importMsg, setImportMsg] = useState<{ text: string; warn?: boolean } | null>(
    null,
  );
  const [importing, setImporting] = useState(false);

  async function submit() {
    setAddMsg(null);
    if (!Number(price) || !sourceNote.trim()) {
      setAddMsg({ text: "Price and source are required.", warn: true });
      return;
    }
    setBusy(true);
    try {
      const cls = classes.find((c) => c.slug === slug);
      await addPoint({
        classSlug: slug,
        price: Number(price),
        currency,
        sourceType,
        rating: Number(rating) || cls?.refRating || null,
        hoursBand,
        condition,
        packaging,
        config: "complete",
        saleDate: saleDate || new Date().toISOString().slice(0, 10),
        sourceNote: sourceNote.trim(),
      });
      await onChanged();
      setAddMsg({ text: `Added. ${cls?.name ?? "Class"} recomputed.` });
      setPrice("");
      setSourceNote("");
    } catch (e) {
      setAddMsg({ text: e instanceof Error ? e.message : "Failed", warn: true });
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    setImportMsg(null);
    let arr: unknown;
    try {
      arr = JSON.parse(importBox);
    } catch {
      setImportMsg({ text: "Invalid JSON.", warn: true });
      return;
    }
    if (!Array.isArray(arr)) {
      setImportMsg({ text: "Expect an array.", warn: true });
      return;
    }
    setImporting(true);
    try {
      const res = await importPoints(arr);
      await onChanged();
      const note =
        res.skipped > 0
          ? ` ${res.skipped} skipped (missing source or unknown class).`
          : "";
      setImportMsg({ text: `${res.imported} point(s) imported.${note}` });
    } catch (e) {
      setImportMsg({
        text: e instanceof Error ? e.message : "Failed",
        warn: true,
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <div className="note">
        Adding a point recomputes that class instantly. Auction and verified sold
        points raise confidence above Indicative. The auction feed (see Method)
        writes here through Import.
      </div>
      <div className="grid2">
        <div>
          <label>Class</label>
          <select value={slug} onChange={(e) => setSlug(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.sector} &middot; {c.name}
              </option>
            ))}
          </select>
          <label>Price</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="amount"
          />
          <label>Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as "CAD" | "USD")}
          >
            <option value="CAD">CAD</option>
            <option value="USD">USD (converted at FX rate)</option>
          </select>
          <label>Source type</label>
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
          >
            {SOURCE_TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <label>Sale / listing date</label>
          <input
            type="date"
            value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)}
          />
        </div>
        <div>
          <label>Rating of this unit</label>
          <input
            type="number"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            placeholder="kW / HP / each"
          />
          <label>Hours</label>
          <select value={hoursBand} onChange={(e) => setHoursBand(e.target.value)}>
            {HOURS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <label>Condition</label>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
          >
            {CONDITION.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <label>Packaging</label>
          <select
            value={packaging}
            onChange={(e) => setPackaging(e.target.value)}
          >
            {PACKAGING.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <label>Source / note (required)</label>
          <input
            type="text"
            value={sourceNote}
            onChange={(e) => setSourceNote(e.target.value)}
            placeholder="e.g. RB auction 2026-05 lot 412"
          />
        </div>
      </div>
      <button onClick={submit} disabled={busy}>
        Add point
      </button>{" "}
      {addMsg && (
        <span className={addMsg.warn ? "warn" : "added"}>{addMsg.text}</span>
      )}

      <h3 style={{ marginTop: 28, fontSize: 15 }}>
        Bulk import (auction feed output)
      </h3>
      <label>JSON array</label>
      <textarea
        value={importBox}
        onChange={(e) => setImportBox(e.target.value)}
        placeholder={IMPORT_PLACEHOLDER}
      />
      <button className="ghost" onClick={runImport} disabled={importing}>
        Import
      </button>{" "}
      {importMsg && (
        <span className={importMsg.warn ? "warn" : "added"}>
          {importMsg.text}
        </span>
      )}
    </div>
  );
}
