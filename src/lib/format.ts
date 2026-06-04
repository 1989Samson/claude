import type { ConfidenceLevel } from "@/lib/valuation";

// reference fmt: round to dollars, thousands separators, CAD suffix. No data
// renders as "--" (never a guess, never an em dash).
export function fmtCAD(n: number | null | undefined): string {
  if (n === null || n === undefined) return "--";
  return "$" + Math.round(n).toLocaleString("en-CA") + " CAD";
}

export function pillClass(level: ConfidenceLevel): string {
  switch (level) {
    case "high":
      return "c-high";
    case "medium":
      return "c-med";
    case "indicative":
      return "c-low";
    case "none":
      return "c-none";
  }
}
