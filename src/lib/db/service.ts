import {
  band,
  confidence,
  confidenceLabel,
  isVerifiedSold,
  valuateUnit,
  type EquipmentClass,
  type SourceType,
} from "@/lib/valuation";
import type {
  AddPointInput,
  AssumptionsInput,
  ImportRow,
  ValuateInput,
} from "@/lib/validation";
import { importRowSchema } from "@/lib/validation";
import type { AssumptionsView, ClassMeta, MatrixRow } from "@/lib/types";
import { toAssumptions, toDataPoint } from "./mappers";
import { query } from "./pool";
import type { AssumptionsRow, ClassRow, PointRow } from "./rows";

export type { AssumptionsView, ClassMeta, MatrixRow };

function metaFromRow(c: ClassRow): ClassMeta {
  return {
    id: c.id,
    slug: c.slug,
    sector: c.sector,
    category: c.category,
    name: c.name,
    unit: c.unit,
    refRating: Number(c.ref_rating),
  };
}

export async function getAssumptionsRow(): Promise<AssumptionsRow> {
  const rows = await query<AssumptionsRow>(
    `select * from assumptions order by updated_at desc limit 1`,
  );
  if (rows.length === 0) {
    throw new Error("No assumptions row found. Run the seed script.");
  }
  return rows[0]!;
}

export async function getAssumptionsView(): Promise<AssumptionsView> {
  const row = await getAssumptionsRow();
  const a = toAssumptions(row);
  return { ...a, fxDate: row.fx_date };
}

// Build the full matrix: every class with its computed band and confidence.
export async function getMatrix(asOf: string | Date = new Date()): Promise<MatrixRow[]> {
  const aRow = await getAssumptionsRow();
  const a = toAssumptions(aRow);

  const classes = await query<ClassRow>(
    `select * from equipment_class order by seq asc, created_at asc`,
  );
  const points = await query<PointRow>(
    `select * from data_point order by created_at asc`,
  );

  const byClass = new Map<string, PointRow[]>();
  for (const p of points) {
    const list = byClass.get(p.class_id) ?? [];
    list.push(p);
    byClass.set(p.class_id, list);
  }

  return classes.map((c) => {
    const ptRows = byClass.get(c.id) ?? [];
    const cls: EquipmentClass = {
      refRating: Number(c.ref_rating),
      points: ptRows.map(toDataPoint),
    };
    const b = band(cls, a, asOf);
    const level = confidence(cls, a, asOf);
    return {
      ...metaFromRow(c),
      nPoints: ptRows.length,
      verifiedPoints: ptRows.filter((p) =>
        isVerifiedSold(p.source_type as SourceType),
      ).length,
      pointTypes: [...new Set(ptRows.map((p) => p.source_type))],
      fmv: b?.fmv ?? null,
      olv: b?.olv ?? null,
      flv: b?.flv ?? null,
      confidence: level,
      confidenceLabel: confidenceLabel(level),
    };
  });
}

export async function listClasses(): Promise<ClassMeta[]> {
  const classes = await query<ClassRow>(
    `select * from equipment_class order by seq asc, created_at asc`,
  );
  return classes.map(metaFromRow);
}

async function classWithPoints(
  slug: string,
): Promise<{ meta: ClassMeta; cls: EquipmentClass } | null> {
  const rows = await query<ClassRow>(
    `select * from equipment_class where slug = $1`,
    [slug],
  );
  if (rows.length === 0) return null;
  const c = rows[0]!;
  const ptRows = await query<PointRow>(
    `select * from data_point where class_id = $1 order by created_at asc`,
    [c.id],
  );
  return {
    meta: metaFromRow(c),
    cls: { refRating: Number(c.ref_rating), points: ptRows.map(toDataPoint) },
  };
}

async function classIdForSlug(slug: string): Promise<string | null> {
  const rows = await query<{ id: string }>(
    `select id from equipment_class where slug = $1`,
    [slug],
  );
  return rows[0]?.id ?? null;
}

export async function addPoint(input: AddPointInput): Promise<{ slug: string }> {
  const classId = await classIdForSlug(input.classSlug);
  if (!classId) throw new Error(`Unknown class: ${input.classSlug}`);

  await query(
    `insert into data_point
       (class_id, price, currency, source_type, rating, hours_band, condition, packaging, config, sale_date, source_note)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      classId,
      input.price,
      input.currency,
      input.sourceType,
      input.rating ?? null,
      input.hoursBand ?? null,
      input.condition ?? null,
      input.packaging ?? null,
      input.config ?? "complete",
      input.saleDate ?? null,
      input.sourceNote,
    ],
  );
  return { slug: input.classSlug };
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

// Bulk import (auction-feed output). Validates each row; rows missing a source
// or referencing an unknown class are skipped and reported, never inserted.
export async function importPoints(rawRows: unknown[]): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rawRows.length; i++) {
    const parsed = importRowSchema.safeParse(rawRows[i]);
    if (!parsed.success) {
      result.skipped++;
      result.errors.push(`row ${i}: ${parsed.error.issues[0]?.message ?? "invalid"}`);
      continue;
    }
    const row: ImportRow = parsed.data;
    const classId = await classIdForSlug(row.classId);
    if (!classId) {
      result.skipped++;
      result.errors.push(`row ${i}: unknown class ${row.classId}`);
      continue;
    }
    await query(
      `insert into data_point
         (class_id, price, currency, source_type, rating, hours_band, condition, packaging, config, sale_date, source_note)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        classId,
        row.price,
        row.cur ?? "CAD",
        row.type ?? "auction",
        row.rating ?? null,
        row.hours ?? "unknown",
        row.cond ?? "unknown",
        row.encl ?? "na",
        row.config ?? "complete",
        row.date ?? null,
        row.src,
      ],
    );
    result.imported++;
  }
  return result;
}

export async function updateAssumptions(input: AssumptionsInput): Promise<void> {
  const current = await getAssumptionsRow();
  await query(
    `update assumptions set
       fx_rate = $1,
       fx_date = coalesce($2, fx_date),
       olv_ratio = $3,
       flv_ratio = $4,
       ask_to_fmv = $5,
       auction_to_fmv = $6,
       recency_horizon_months = $7,
       updated_at = now()
     where id = $8`,
    [
      input.fxRate,
      input.fxDate ?? null,
      input.olvRatio,
      input.flvRatio,
      input.askToFmv,
      input.auctionToFmv,
      input.recencyHorizonMonths,
      current.id,
    ],
  );
}

export async function valuate(
  input: ValuateInput,
  asOf: string | Date = new Date(),
) {
  const found = await classWithPoints(input.classSlug);
  if (!found) return null;
  const aRow = await getAssumptionsRow();
  const a = toAssumptions(aRow);
  const result = valuateUnit(
    found.cls,
    {
      rating: input.rating,
      hoursBand: input.hoursBand,
      condition: input.condition,
      packaging: input.packaging,
      config: input.config,
      transport: input.transport,
    },
    a,
    asOf,
  );
  return { meta: found.meta, valuation: result };
}
