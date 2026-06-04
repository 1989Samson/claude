import { getCalibration } from "@/lib/db/service";
import { handle, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Suggested asking/auction to FMV factors fitted to the firm's own data. The UI
// shows these next to the editable assumptions so guesses can be replaced with
// calibrated values once enough verified sold data exists.
export async function GET() {
  return handle(async () => ok(await getCalibration()));
}
