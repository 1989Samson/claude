import { z } from "zod";

export const SOURCE_TYPES = [
  "asking",
  "auction",
  "sold_private",
  "sisp",
  "own_close",
] as const;

export const sourceTypeSchema = z.enum(SOURCE_TYPES);
export const currencySchema = z.enum(["CAD", "USD"]);

const nonEmpty = z.string().trim().min(1);

// Add a single data point (Add Data Point tab). source_note is required:
// CLAUDE.md rejects any point without a source.
export const addPointSchema = z.object({
  classSlug: nonEmpty,
  price: z.number().positive(),
  currency: currencySchema,
  sourceType: sourceTypeSchema,
  rating: z.number().positive().nullable().optional(),
  hoursBand: z.string().nullable().optional(),
  condition: z.string().nullable().optional(),
  packaging: z.string().nullable().optional(),
  config: z.string().nullable().optional(),
  saleDate: z.string().nullable().optional(),
  sourceNote: nonEmpty,
});
export type AddPointInput = z.infer<typeof addPointSchema>;

// Bulk import row. Shape matches the reference import box and the auction-feed
// output (Phase 4 emits exactly this), so the paths stay compatible.
// `src` (the source string) is required; rows without one are rejected.
export const importRowSchema = z.object({
  classId: nonEmpty, // class slug, e.g. og_gen_g3516
  price: z.coerce.number().positive(),
  cur: currencySchema.optional(),
  type: sourceTypeSchema.optional(),
  rating: z.coerce.number().positive().optional(),
  hours: z.string().optional(),
  cond: z.string().optional(),
  encl: z.string().optional(),
  config: z.string().optional(),
  date: z.string().optional(),
  src: nonEmpty,
});
export type ImportRow = z.infer<typeof importRowSchema>;

export const importPayloadSchema = z.array(z.unknown());

// Update assumptions (Assumptions / FX tab). All fields required and positive,
// mirroring the prototype which saves the whole settings block.
export const assumptionsSchema = z.object({
  fxRate: z.number().positive(),
  fxDate: z.string().optional(),
  olvRatio: z.number().positive(),
  flvRatio: z.number().positive(),
  askToFmv: z.number().positive(),
  auctionToFmv: z.number().positive(),
  recencyHorizonMonths: z.number().int().positive(),
});
export type AssumptionsInput = z.infer<typeof assumptionsSchema>;

// Valuate a subject unit (Valuate Unit tab).
export const valuateSchema = z.object({
  classSlug: nonEmpty,
  rating: z.number().positive(),
  hoursBand: z.string().optional(),
  condition: z.string().optional(),
  packaging: z.string().optional(),
  config: z.string().optional(),
  transport: z.number().nonnegative().optional(),
});
export type ValuateInput = z.infer<typeof valuateSchema>;
