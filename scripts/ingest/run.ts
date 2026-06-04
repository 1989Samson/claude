import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { normalizeLot, type NormalizedRow } from "./normalize";
import { GovPlanetSource } from "./sources/govplanet";
import type { ClassRef, SourceAdapter } from "./types";

// Scheduled ingestion entry point (run by .github/workflows/ingest.yml).
// Talks only HTTP: it reads the class list and writes results back through the
// app's API, and calls the Anthropic API to normalize each lot. No DB creds.

function env(name: string, required = true): string {
  const v = process.env[name];
  if (!v && required) throw new Error(`${name} is not set`);
  return v ?? "";
}

async function fetchClasses(appUrl: string): Promise<ClassRef[]> {
  const res = await fetch(`${appUrl}/api/classes`);
  if (!res.ok) throw new Error(`GET /api/classes failed: ${res.status}`);
  const body = (await res.json()) as {
    classes: Array<{
      slug: string;
      name: string;
      sector: string;
      category: string;
      unit: string;
    }>;
  };
  return body.classes.map((c) => ({
    slug: c.slug,
    name: c.name,
    sector: c.sector,
    category: c.category,
    unit: c.unit,
  }));
}

async function postImport(
  appUrl: string,
  token: string,
  rows: NormalizedRow[],
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const res = await fetch(`${appUrl}/api/import`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ingest-token": token,
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    throw new Error(`POST /api/import failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const appUrl = env("APP_URL").replace(/\/$/, "");
  const maxLots = Number(process.env.MAX_LOTS ?? "50");

  const source: SourceAdapter = new GovPlanetSource();
  const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
  const model = process.env.INGEST_MODEL || "claude-haiku-4-5";

  const classes = await fetchClasses(appUrl);
  console.log(`Loaded ${classes.length} classes from ${appUrl}`);

  const lots = (await source.fetchRecentLots()).slice(0, maxLots);
  console.log(`Fetched ${lots.length} lots from ${source.name}`);

  const rows: NormalizedRow[] = [];
  for (const lot of lots) {
    try {
      const row = await normalizeLot(lot, classes, { client, model });
      if (row) rows.push(row);
    } catch (err) {
      console.warn(`normalize failed for "${lot.title}": ${String(err)}`);
    }
  }
  console.log(`Normalized ${rows.length} of ${lots.length} lots to known classes`);

  if (dryRun) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  if (rows.length === 0) {
    console.log("Nothing to import.");
    return;
  }

  const result = await postImport(appUrl, env("INGEST_API_TOKEN"), rows);
  console.log(
    `Imported ${result.imported}, skipped ${result.skipped}.` +
      (result.errors.length ? ` Errors: ${result.errors.join("; ")}` : ""),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
