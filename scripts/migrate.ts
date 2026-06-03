import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { withClient } from "./db";

// Applies every .sql file in supabase/migrations in filename order.
// Each migration is written to be idempotent (if not exists / drop-create),
// so re-running is safe.
async function main() {
  const dir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("No migrations found.");
    return;
  }

  await withClient(async (c) => {
    for (const file of files) {
      const sql = readFileSync(join(dir, file), "utf8");
      process.stdout.write(`Applying ${file} ... `);
      await c.query(sql);
      console.log("ok");
    }
  });
  console.log("Migrations complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
