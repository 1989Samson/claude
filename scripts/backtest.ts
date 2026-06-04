import "dotenv/config";
import { runBacktest } from "../src/lib/db/service";

// CLI backtest harness. Runs leave-one-out per class against the live database
// and stores a backtest_run row per scored class. Prints a summary.
// Usage: npm run backtest [-- --asOf=2026-06-03]
async function main() {
  const asOfArg = process.argv.find((a) => a.startsWith("--asOf="));
  const asOf = asOfArg ? asOfArg.split("=")[1]! : new Date().toISOString();

  const summary = await runBacktest(asOf);
  console.log(`Backtest as of ${summary.asOf}`);
  console.log(`Classes scored (with verified sold points): ${summary.classesEvaluated}`);
  for (const r of summary.results) {
    if (r.nPoints === 0) continue;
    const pct =
      r.medianAbsPctError === null
        ? "n/a"
        : (r.medianAbsPctError * 100).toFixed(1) + "%";
    console.log(`  ${r.slug.padEnd(16)} n=${r.nPoints}  median abs pct error ${pct}`);
  }
  if (summary.classesEvaluated === 0) {
    console.log("No class has verified sold points yet, so the model cannot state its error.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
