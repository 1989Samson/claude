// Engine constants, ported verbatim from reference_ui.html.
// These are deliberately hardcoded (not in the DB) per CLAUDE.md "keep it simple".
// Changing any value here changes model output, so treat edits as calibration.

import type { SourceType, SpecAttributes } from "./types";

// Hours / usage multiplier (reference HM).
export const HOURS_MULT: Record<string, number> = {
  lt5k: 1.15,
  "5to20k": 1.0,
  "20to40k": 0.85,
  "40to60k": 0.72,
  gt60k: 0.55,
  unknown: 0.8,
  na: 1.0,
};

// Condition multiplier (reference CM).
export const CONDITION_MULT: Record<string, number> = {
  rebuilt: 1.3,
  running: 1.0,
  idle: 0.8,
  repair: 0.55,
  parts: 0.3,
  unknown: 0.7,
  na: 1.0,
};

// Packaging / enclosure multiplier (reference EM).
export const PACKAGING_MULT: Record<string, number> = {
  enclosed: 1.1,
  skid: 1.0,
  none: 0.9,
  na: 1.0,
};

// Configuration completeness multiplier (reference FM).
export const CONFIG_MULT: Record<string, number> = {
  complete: 1.0,
  partial: 0.85,
  stripped: 0.65,
  na: 1.0,
};

// Source-quality weight (reference Q).
export const SOURCE_QUALITY: Record<SourceType, number> = {
  own_close: 1.0,
  sold_private: 0.95,
  sisp: 0.9,
  auction: 0.85,
  asking: 0.45,
};

// Source types that count as "verified sold" for confidence (reference set).
export const VERIFIED_SOLD: ReadonlySet<SourceType> = new Set<SourceType>([
  "own_close",
  "sold_private",
  "sisp",
  "auction",
]);

// Fallback weight for an unrecognized source type (reference `?? 0.4`).
export const UNKNOWN_SOURCE_QUALITY = 0.4;

// Recency floor weight and the milliseconds-per-month divisor (reference 2.63e9).
export const RECENCY_FLOOR = 0.3;
export const MS_PER_MONTH = 2.63e9;

// Combined spec multiplier (reference specMult): product of the four lookups,
// each defaulting to 1 when the key is missing. Config defaults to "na".
export function specMult(spec: SpecAttributes): number {
  const h = HOURS_MULT[spec.hoursBand ?? ""] ?? 1;
  const c = CONDITION_MULT[spec.condition ?? ""] ?? 1;
  const p = PACKAGING_MULT[spec.packaging ?? ""] ?? 1;
  const f = CONFIG_MULT[spec.config ?? "na"] ?? 1;
  return h * c * p * f;
}

export function sourceQuality(type: SourceType): number {
  return SOURCE_QUALITY[type] ?? UNKNOWN_SOURCE_QUALITY;
}

export function isVerifiedSold(type: SourceType): boolean {
  return VERIFIED_SOLD.has(type);
}
