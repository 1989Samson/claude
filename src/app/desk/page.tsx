import AppShell from "@/components/AppShell";
import registry from "@/lib/supply/registry.json";
import { parseRegistry } from "@/lib/supply/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Internal desk. Reads the protected supply registry server side and hands it to
// the shell. Protect this route in deployment (e.g. Vercel Deployment
// Protection); it is not meant for the public.
export default function DeskPage() {
  const supply = parseRegistry(registry);
  return <AppShell supply={supply} />;
}
