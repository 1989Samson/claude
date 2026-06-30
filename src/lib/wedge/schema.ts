import { z } from "zod";

// The public "Time to Power" wedge. A buyer gives the minimum a serious enquiry
// needs (MW, province, when, stage, gas), and gets an indicative read: the grid
// gap they face, and the equipment-to-pad options that beat it. No supply, no
// sources, no precise spread. Everything stays Indicative until a principal
// confirms it. The read runs on the transport engine, client side, so it costs
// nothing and exposes no internal data.

export const provinceCode = z.enum(["AB", "ON", "QC"]);
export type ProvinceCode = z.infer<typeof provinceCode>;

export const powerMode = z.enum(["bridge", "prime", "unsure"]);
export type PowerMode = z.infer<typeof powerMode>;

export const timeframe = z.enum(["asap", "6mo", "12mo", "12mo_plus"]);
export type Timeframe = z.infer<typeof timeframe>;

export const gasAccess = z.enum(["yes", "no", "unsure"]);
export type GasAccess = z.infer<typeof gasAccess>;

export const wedgeInputSchema = z.object({
  mw: z.number().positive(),
  province: provinceCode,
  mode: powerMode,
  timeframe: timeframe,
  gas: gasAccess,
});
export type WedgeInput = z.infer<typeof wedgeInputSchema>;

export type Band = [number, number];

// One stage option the buyer can see. Stage is the fit-to-project axis (a fast
// bridge vs permanent prime). Weeks is the equipment-to-pad slice of the path,
// the part McCord controls, not the full energized date. Cost is hard-rounded.
export interface StageOption {
  stage: "Bridge" | "Prime";
  headline: string;
  config: string; // e.g. "20 x containerized gas gensets"
  unitCount: number;
  weeksToPad: Band;
  deliveredBandUsd: Band;
  recommended: boolean;
  note: string;
}

export interface GridGap {
  province: string;
  headline: string;
  detail: string;
  stance: string;
  source: string | null;
  verified: boolean;
  asOf: string;
}

export interface WedgeRead {
  mw: number;
  province: ProvinceCode;
  gap: GridGap;
  options: StageOption[];
  detailsHandled: string[];
  confidence: string;
  disclaimer: string;
}
