"use client";

import { useCallback, useMemo, useState } from "react";
import { fetchMatrix } from "@/lib/client";
import type { AssumptionsView, ClassMeta, MatrixRow } from "@/lib/types";
import AddPointTab from "./tabs/AddPointTab";
import AssumptionsTab from "./tabs/AssumptionsTab";
import MatrixTab from "./tabs/MatrixTab";
import MethodTab from "./tabs/MethodTab";
import ResearchTab from "./tabs/ResearchTab";
import ValuateTab from "./tabs/ValuateTab";

const TABS = [
  { id: "matrix", label: "Matrix" },
  { id: "research", label: "Research Asset" },
  { id: "value", label: "Valuate Unit" },
  { id: "add", label: "Add Data Point" },
  { id: "settings", label: "Assumptions / FX" },
  { id: "method", label: "Method" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function MatrixApp({
  initialMatrix,
  initialAssumptions,
  classes,
  userEmail,
}: {
  initialMatrix: MatrixRow[];
  initialAssumptions: AssumptionsView;
  classes: ClassMeta[];
  userEmail: string | null;
}) {
  const [tab, setTab] = useState<TabId>("matrix");
  const [matrix, setMatrix] = useState<MatrixRow[]>(initialMatrix);
  const [assumptions, setAssumptions] =
    useState<AssumptionsView>(initialAssumptions);

  // After any mutation, refetch the computed matrix and assumptions so every
  // tab recomputes off the shared database, exactly like the prototype.
  const refresh = useCallback(async () => {
    const data = await fetchMatrix();
    setMatrix(data.matrix);
    setAssumptions(data.assumptions);
  }, []);

  const inventory = useMemo(() => {
    const totalPoints = matrix.reduce((n, c) => n + c.nPoints, 0);
    const verified = matrix.reduce((n, c) => n + c.verifiedPoints, 0);
    const withData = matrix.filter((c) => c.nPoints > 0).length;
    return { classes: matrix.length, withData, totalPoints, verified };
  }, [matrix]);

  return (
    <>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h1>AURIC IRON MATRIX</h1>
          <span className="tag">
            Heavy equipment valuation engine &middot; O&amp;G + Mining
          </span>
        </div>
        {userEmail && (
          <form action="/auth/signout" method="post" className="small">
            <span style={{ marginRight: 10 }}>{userEmail}</span>
            <button
              type="submit"
              className="ghost"
              style={{ marginTop: 0, padding: "6px 12px" }}
            >
              Sign out
            </button>
          </form>
        )}
      </header>
      <div className="wrap">
        <div className="banner">
          {inventory.verified === 0 ? (
            <>
              <b>State of this model, read before quoting.</b> It holds{" "}
              {inventory.totalPoints} data point
              {inventory.totalPoints === 1 ? "" : "s"} across{" "}
              {inventory.withData} class
              {inventory.withData === 1 ? "" : "es"} and nothing fabricated. It
              contains <b>zero verified sold prices</b> and has{" "}
              <b>not been backtested</b>, so it cannot yet state its own error.
              Every band below is indicative until verified sold or auction data
              is added and the model is validated against it. Not a certified
              appraisal.
            </>
          ) : (
            <>
              <b>State of this model.</b> It holds {inventory.verified} verified
              sold or auction point
              {inventory.verified === 1 ? "" : "s"} and{" "}
              {inventory.totalPoints - inventory.verified} asking signal
              {inventory.totalPoints - inventory.verified === 1 ? "" : "s"}.
              Classes without verified sold data stay Indicative. Run the
              backtest to report the model's own error. Not a certified
              appraisal.
            </>
          )}
        </div>

        <div className="inv">
          <div>
            Classes<span>{inventory.classes}</span>
          </div>
          <div>
            With data<span>{inventory.withData}</span>
          </div>
          <div>
            Total points<span>{inventory.totalPoints}</span>
          </div>
          <div>
            Verified sold
            <span className={inventory.verified ? "" : "warn"}>
              {inventory.verified}
            </span>
          </div>
          <div>
            FX USD&rarr;CAD<span>{assumptions.fxRate}</span>
          </div>
        </div>

        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={"tab" + (tab === t.id ? " active" : "")}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "matrix" && (
          <MatrixTab matrix={matrix} onRefresh={refresh} />
        )}
        {tab === "research" && (
          <ResearchTab classes={classes} onChanged={refresh} />
        )}
        {tab === "value" && (
          <ValuateTab classes={classes} assumptions={assumptions} />
        )}
        {tab === "add" && (
          <AddPointTab classes={classes} onChanged={refresh} />
        )}
        {tab === "settings" && (
          <AssumptionsTab
            assumptions={assumptions}
            onSaved={async (a) => {
              setAssumptions(a);
              await refresh();
            }}
          />
        )}
        {tab === "method" && <MethodTab />}
      </div>
    </>
  );
}
