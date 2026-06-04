export * from "./types";
export * from "./factors";
export * from "./engine";
export * from "./backtest";

import type { ConfidenceLevel } from "./types";

// UI label for a confidence level (reference pill text). No em dashes.
export function confidenceLabel(level: ConfidenceLevel): string {
  switch (level) {
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "indicative":
      return "Indicative";
    case "none":
      return "No data";
  }
}
