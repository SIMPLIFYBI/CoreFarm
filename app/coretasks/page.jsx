"use client";
import { useState } from "react";
import CorePage from "./CorePage";
import { AdminPage } from "./AdminPage";
import SampleDispatchPage from "./SampleDispatchPage";
import DrillholeVizPage from "../drillhole-viz/page";
import HoleDetailsTab from "./HoleDetailsTab";

const TABS = [
  { key: "logging", label: "Logging" },
  { key: "addcore", label: "Add Core" },
  { key: "sampledispatch", label: "Sample Dispatch" },
  { key: "holedetails", label: "Hole Details" },
  { key: "drillholeviz", label: "Drillhole Viz" },
];

export default function CoreTasksPage() {
  const [tab, setTab] = useState("logging");
  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="mb-6 flex gap-2 border-b border-white/10">
        <button
          className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm transition-base ${tab === "logging" ? "border-indigo-400 text-slate-100" : "border-transparent text-slate-300 hover:text-slate-100"}`}
          onClick={() => setTab("logging")}
        >
          Logging
        </button>
        <button
          className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm transition-base ${tab === "addcore" ? "border-indigo-400 text-slate-100" : "border-transparent text-slate-300 hover:text-slate-100"}`}
          onClick={() => setTab("addcore")}
        >
          Add Core
        </button>
        <button
          className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm transition-base ${tab === "sampledispatch" ? "border-indigo-400 text-slate-100" : "border-transparent text-slate-300 hover:text-slate-100"}`}
          onClick={() => setTab("sampledispatch")}
        >
          Sample Dispatch
        </button>
        <button
          className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm transition-base ${tab === "holedetails" ? "border-indigo-400 text-slate-100" : "border-transparent text-slate-300 hover:text-slate-100"}`}
          onClick={() => setTab("holedetails")}
        >
          Hole Details
        </button>
        <button
          className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm transition-base ${tab === "drillholeviz" ? "border-indigo-400 text-slate-100" : "border-transparent text-slate-300 hover:text-slate-100"}`}
          onClick={() => setTab("drillholeviz")}
        >
          Drillhole Viz
        </button>
      </div>
      {tab === "drillholeviz" ? (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/30">
          <DrillholeVizPage />
        </div>
      ) : tab === "holedetails" ? (
        <div className="card overflow-hidden">
          <HoleDetailsTab />
        </div>
      ) : (
        <div className="card overflow-hidden">
          {tab === "logging" ? <CorePage /> : tab === "addcore" ? <AdminPage /> : <SampleDispatchPage />}
        </div>
      )}
    </div>
  );
}
