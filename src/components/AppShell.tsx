"use client";

import { useState } from "react";
import SourcingApp from "@/components/SourcingApp";
import TransportApp from "@/components/TransportApp";
import SupplyApp from "@/components/SupplyApp";
import { type SupplyUnit } from "@/lib/supply/schema";

// The internal desk. Sourcing, Transport, and the protected Supply registry.
// This surface must be access-protected in deployment (e.g. Vercel Deployment
// Protection): it reads internal supply that never belongs on the public site.

type Tab = "sourcing" | "transport" | "supply";

export default function AppShell({ supply }: { supply: SupplyUnit[] }) {
  const [tab, setTab] = useState<Tab>("sourcing");

  return (
    <>
      <header>
        <h1>AURIC AXIS</h1>
        <span className="tag">Internal desk &middot; sourcing, delivered cost, supply</span>
      </header>
      <div className="wrap" style={{ paddingBottom: 0 }}>
        <div className="tabs">
          <button className={"tab" + (tab === "sourcing" ? " active" : "")} onClick={() => setTab("sourcing")}>
            Sourcing
          </button>
          <button className={"tab" + (tab === "transport" ? " active" : "")} onClick={() => setTab("transport")}>
            Transport
          </button>
          <button className={"tab" + (tab === "supply" ? " active" : "")} onClick={() => setTab("supply")}>
            Supply
          </button>
        </div>
      </div>
      {tab === "sourcing" && <SourcingApp />}
      {tab === "transport" && <TransportApp />}
      {tab === "supply" && <SupplyApp supply={supply} />}
    </>
  );
}
