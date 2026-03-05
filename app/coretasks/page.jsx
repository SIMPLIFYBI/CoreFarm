"use client";
import { useEffect, useState } from "react";
import CorePage from "./CorePage";
import { AdminPage } from "./AdminPage";
import SampleDispatchPage from "./SampleDispatchPage";
import DrillholeVizPage from "../drillhole-viz/page";
import HoleDetailsTab from "./HoleDetailsTab";

const PROJECT_SCOPE_STORAGE_KEY = "coretasks:projectScope";

const TABS = [
  { key: "logging", label: "Logging" },
  { key: "addcore", label: "Add Core" },
  { key: "sampledispatch", label: "Sample Dispatch" },
  { key: "holedetails", label: "Hole Details" },
  { key: "drillholeviz", label: "Drillhole Viz" },
];

export default function CoreTasksPage() {
  const [tab, setTab] = useState("logging");
  const [projectScope, setProjectScope] = useState("own"); // 'own' | 'shared'
  const isDrillholeVizTab = tab === "drillholeviz";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(PROJECT_SCOPE_STORAGE_KEY);
    if (stored === "own" || stored === "shared") {
      setProjectScope(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PROJECT_SCOPE_STORAGE_KEY, projectScope);
  }, [projectScope]);

  return (
    <div className="p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-3 inline-flex rounded-lg border border-white/10 bg-slate-900/40 p-1 gap-1">
          <button
            type="button"
            className={`px-3 py-1.5 text-xs rounded-md transition-base ${projectScope === "own" ? "bg-indigo-600 text-white" : "text-slate-200 hover:bg-white/10"}`}
            onClick={() => setProjectScope("own")}
          >
            My projects
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 text-xs rounded-md transition-base ${projectScope === "shared" ? "bg-indigo-600 text-white" : "text-slate-200 hover:bg-white/10"}`}
            onClick={() => setProjectScope("shared")}
          >
            Client shared
          </button>
        </div>

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
      </div>

      {isDrillholeVizTab ? (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/30">
          <DrillholeVizPage projectScope={projectScope} />
        </div>
      ) : (
        <div className="max-w-6xl mx-auto">
          {tab === "holedetails" ? (
            <div className="card overflow-hidden">
              <HoleDetailsTab projectScope={projectScope} />
            </div>
          ) : (
            <div className="card overflow-hidden">
              {tab === "logging" ? (
                <CorePage projectScope={projectScope} />
              ) : tab === "addcore" ? (
                <AdminPage projectScope={projectScope} />
              ) : (
                <SampleDispatchPage projectScope={projectScope} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
