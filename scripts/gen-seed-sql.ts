import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Generates supabase/seed.sql from seed_data.json so the database can be seeded
// by pasting SQL into the Supabase SQL editor, with no Node required.
interface SeedPoint {
  price: number;
  currency: string;
  source_type: string;
  rating: number;
  hours_band: string;
  condition: string;
  packaging: string;
  config: string;
  sale_date: string;
  source_note: string;
}
interface SeedClass {
  slug: string;
  sector: string;
  category: string;
  name: string;
  unit: string;
  ref_rating: number;
  ref_spec: Record<string, unknown>;
  points: SeedPoint[];
}
interface Seed {
  assumptions: Record<string, number | string>;
  classes: SeedClass[];
}

const q = (s: string) => "'" + s.replace(/'/g, "''") + "'";

function main() {
  const seed = JSON.parse(
    readFileSync(join(process.cwd(), "seed_data.json"), "utf8"),
  ) as Seed;

  const lines: string[] = [
    "-- Auric Iron Matrix seed. Generated from seed_data.json by scripts/gen-seed-sql.ts.",
    "-- Paste into the Supabase SQL editor after 0001_init.sql. Idempotent on class slug.",
    "begin;",
    "",
    "-- Assumptions (single shared row).",
    `insert into assumptions (fx_rate, fx_date, olv_ratio, flv_ratio, ask_to_fmv, auction_to_fmv, recency_horizon_months, singleton)`,
    `values (${seed.assumptions.fx_rate}, '${seed.assumptions.fx_date}', ${seed.assumptions.olv_ratio}, ${seed.assumptions.flv_ratio}, ${seed.assumptions.ask_to_fmv}, ${seed.assumptions.auction_to_fmv}, ${seed.assumptions.recency_horizon_months}, true)`,
    `on conflict (singleton) do update set fx_rate = excluded.fx_rate, fx_date = excluded.fx_date, olv_ratio = excluded.olv_ratio, flv_ratio = excluded.flv_ratio, ask_to_fmv = excluded.ask_to_fmv, auction_to_fmv = excluded.auction_to_fmv, recency_horizon_months = excluded.recency_horizon_months, updated_at = now();`,
    "",
  ];

  seed.classes.forEach((c, i) => {
    lines.push(
      `insert into equipment_class (slug, seq, sector, category, name, unit, ref_rating, ref_spec)`,
      `values (${q(c.slug)}, ${i}, ${q(c.sector)}, ${q(c.category)}, ${q(c.name)}, ${q(c.unit)}, ${c.ref_rating}, ${q(JSON.stringify(c.ref_spec))}::jsonb)`,
      `on conflict (slug) do update set seq = excluded.seq, sector = excluded.sector, category = excluded.category, name = excluded.name, unit = excluded.unit, ref_rating = excluded.ref_rating, ref_spec = excluded.ref_spec;`,
    );
    for (const p of c.points) {
      lines.push(
        `insert into data_point (class_id, price, currency, source_type, rating, hours_band, condition, packaging, config, sale_date, source_note)`,
        `select id, ${p.price}, ${q(p.currency)}, ${q(p.source_type)}, ${p.rating}, ${q(p.hours_band)}, ${q(p.condition)}, ${q(p.packaging)}, ${q(p.config)}, '${p.sale_date}', ${q(p.source_note)}`,
        `from equipment_class where slug = ${q(c.slug)}`,
        `and not exists (select 1 from data_point d where d.class_id = equipment_class.id and d.source_note = ${q(p.source_note)});`,
      );
    }
    lines.push("");
  });

  lines.push("commit;", "");
  writeFileSync(join(process.cwd(), "supabase", "seed.sql"), lines.join("\n"));
  console.log("Wrote supabase/seed.sql");
}

main();
