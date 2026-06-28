"use client";

import { useState } from "react";
import SourcingApp from "@/components/SourcingApp";
import TransportApp from "@/components/TransportApp";

type Tab = "sourcing" | "transport";

export default function AppShell() {
  const [tab, setTab] = useState<Tab>("sourcing");

  return (
    <>
      <header>
        <h1>AURIC AXIS</h1>
        <span className="tag">Equipment sourcing &middot; delivered cost</span>
      </header>
      <div className="wrap" style={{ paddingBottom: 0 }}>
        <div className="tabs">
          <button
            className={"tab" + (tab === "sourcing" ? " active" : "")}
            onClick={() => setTab("sourcing")}
          >
            Sourcing
          </button>
          <button
            className={"tab" + (tab === "transport" ? " active" : "")}
            onClick={() => setTab("transport")}
          >
            Transport
          </button>
        </div>
      </div>
      {tab === "sourcing" ? <SourcingApp /> : <TransportApp />}
    </>
  );
}
