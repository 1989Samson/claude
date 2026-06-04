import MatrixApp from "@/components/MatrixApp";
import { getAssumptionsView, getMatrix, listClasses } from "@/lib/db/service";
import { currentUserEmail } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Page() {
  const asOf = new Date().toISOString();
  const [matrix, assumptions, classes, userEmail] = await Promise.all([
    getMatrix(asOf),
    getAssumptionsView(),
    listClasses(),
    currentUserEmail(),
  ]);
  return (
    <MatrixApp
      initialMatrix={matrix}
      initialAssumptions={assumptions}
      classes={classes}
      userEmail={userEmail}
    />
  );
}
