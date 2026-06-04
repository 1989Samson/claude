import { readFileSync } from "node:fs";
import { join } from "node:path";
import { withClient } from "./db";

// Loads seed_data.json (derived verbatim from reference_ui.html) into the
// database. Idempotent on classes by slug. By default it will NOT wipe existing
// data points; pass --reset to restore the exact sourced seed (mirrors the
// prototype's "Reset to sourced seed" button).
type SeedPoint = {
  price: number;
  currency: "CAD" | "USD";
  source_type: string;
  rating: number;
  hours_band: string;
  condition: string;
  packaging: string;
  config: string;
  sale_date: string;
  source_note: string;
};
type SeedClass = {
  slug: string;
  sector: string;
  category: string;
  name: string;
  unit: string;
  ref_rating: number;
  ref_spec: Record<string, unknown>;
  points: SeedPoint[];
};
type Seed = {
  assumptions: {
    fx_rate: number;
    fx_date: string;
    olv_ratio: number;
    flv_ratio: number;
    ask_to_fmv: number;
    auction_to_fmv: number;
    recency_horizon_months: number;
  };
  classes: SeedClass[];
};

async function main() {
  const reset = process.argv.includes("--reset");
  const seed = JSON.parse(
    readFileSync(join(process.cwd(), "seed_data.json"), "utf8"),
  ) as Seed;

  await withClient(async (c) => {
    await c.query("begin");
    try {
      // Single assumptions row.
      const a = seed.assumptions;
      await c.query(
        `insert into assumptions
           (fx_rate, fx_date, olv_ratio, flv_ratio, ask_to_fmv, auction_to_fmv, recency_horizon_months, singleton)
         values ($1,$2,$3,$4,$5,$6,$7,true)
         on conflict (singleton) do update set
           fx_rate = excluded.fx_rate,
           fx_date = excluded.fx_date,
           olv_ratio = excluded.olv_ratio,
           flv_ratio = excluded.flv_ratio,
           ask_to_fmv = excluded.ask_to_fmv,
           auction_to_fmv = excluded.auction_to_fmv,
           recency_horizon_months = excluded.recency_horizon_months,
           updated_at = now()`,
        [
          a.fx_rate,
          a.fx_date,
          a.olv_ratio,
          a.flv_ratio,
          a.ask_to_fmv,
          a.auction_to_fmv,
          a.recency_horizon_months,
        ],
      );

      let classCount = 0;
      let pointCount = 0;
      for (let i = 0; i < seed.classes.length; i++) {
        const cls = seed.classes[i]!;
        const res = await c.query<{ id: string }>(
          `insert into equipment_class
             (slug, seq, sector, category, name, unit, ref_rating, ref_spec)
           values ($1,$2,$3,$4,$5,$6,$7,$8)
           on conflict (slug) do update set
             seq = excluded.seq,
             sector = excluded.sector,
             category = excluded.category,
             name = excluded.name,
             unit = excluded.unit,
             ref_rating = excluded.ref_rating,
             ref_spec = excluded.ref_spec
           returning id`,
          [
            cls.slug,
            i,
            cls.sector,
            cls.category,
            cls.name,
            cls.unit,
            cls.ref_rating,
            JSON.stringify(cls.ref_spec),
          ],
        );
        const classId = res.rows[0]!.id;
        classCount++;

        if (reset) {
          await c.query(`delete from data_point where class_id = $1`, [
            classId,
          ]);
        }

        // Only (re)insert seed points when the class has none, so a normal seed
        // run never clobbers data the team has added. --reset forces the exact
        // sourced seed by deleting above first.
        const existing = await c.query<{ n: string }>(
          `select count(*)::text as n from data_point where class_id = $1`,
          [classId],
        );
        if (Number(existing.rows[0]!.n) === 0) {
          for (const p of cls.points) {
            await c.query(
              `insert into data_point
                 (class_id, price, currency, source_type, rating, hours_band, condition, packaging, config, sale_date, source_note)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
              [
                classId,
                p.price,
                p.currency,
                p.source_type,
                p.rating,
                p.hours_band,
                p.condition,
                p.packaging,
                p.config,
                p.sale_date,
                p.source_note,
              ],
            );
            pointCount++;
          }
        }
      }
      await c.query("commit");
      console.log(
        `Seed complete: ${classCount} classes upserted, ${pointCount} points inserted${reset ? " (reset)" : ""}.`,
      );
    } catch (err) {
      await c.query("rollback");
      throw err;
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
