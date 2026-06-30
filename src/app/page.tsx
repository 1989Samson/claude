import TimeToPower from "@/components/TimeToPower";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public front door: the Time to Power wedge. No internal data is imported here,
// so nothing private can reach the public bundle.
export default function Page() {
  return <TimeToPower />;
}
