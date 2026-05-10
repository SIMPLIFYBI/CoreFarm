"use client";

import { useEffect, useState } from "react";
import AdminPage from "./AdminPage";
import BulkUploaderTab from "./BulkUploaderTab";
import CoreTaskPanelHeader from "./CoreTaskPanelHeader";

const ADD_CORE_MODES = [
  {
    id: "quick",
    eyebrow: "Quick add",
    title: "Create one core at a time",
    description: "Best when you are setting up an individual drillhole, assigning its project, and planning intervals right after creation.",
    badge: "Single hole",
  },
  {
    id: "bulk",
    eyebrow: "Bulk import",
    title: "Upload batches from Excel or CSV",
    description: "Paste a full dataset, validate headers and descriptors, then import many holes into a project in one pass.",
    badge: "High volume",
  },
];

export default function AddCoreTab({ projectScope = "own", requestedMode = "quick" }) {
  const [mode, setMode] = useState(requestedMode === "bulk" ? "bulk" : "quick");
  const isShared = projectScope === "shared";

  useEffect(() => {
    setMode(requestedMode === "bulk" ? "bulk" : "quick");
  }, [requestedMode]);

  return (
    <div className="space-y-5 p-4 md:p-5">
      <CoreTaskPanelHeader
        eyebrow="Add Core"
        title="Bring new drillholes into your org"
        description="Use one workspace for both manual setup and batch imports. Start with quick add for individual holes or switch to bulk import when the dataset is ready."
        stats={[
          { label: "modes", value: ADD_CORE_MODES.length },
          { label: "workflow", value: isShared ? "read-only" : "write-ready" },
        ]}
      />

      <section className="space-y-4">
        <div className="rounded-[28px] border border-white/10 bg-slate-950/45 p-3 shadow-[0_20px_70px_rgba(2,6,23,0.24)]">
          <div className="flex flex-wrap gap-2">
            {ADD_CORE_MODES.map((entry) => {
              const active = mode === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setMode(entry.id)}
                  className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition-base ${
                    active
                      ? "border-cyan-300/35 bg-cyan-400/10 text-cyan-100 shadow-[0_18px_40px_rgba(8,145,178,0.16)]"
                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-slate-100"
                  }`}
                >
                  <span>{entry.id === "quick" ? "Add Holes" : "Bulk Upload"}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${active ? "bg-cyan-300/15 text-cyan-100" : "bg-white/[0.05] text-slate-400"}`}>
                    {entry.badge}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-col gap-3 rounded-[22px] border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.94),rgba(8,47,73,0.28),rgba(30,41,59,0.58))] p-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{ADD_CORE_MODES.find((entry) => entry.id === mode)?.eyebrow}</div>
              <div className="mt-1 text-base font-semibold text-slate-100">{ADD_CORE_MODES.find((entry) => entry.id === mode)?.title}</div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{ADD_CORE_MODES.find((entry) => entry.id === mode)?.description}</p>
            </div>
            <div className={`shrink-0 rounded-[20px] border px-4 py-3 text-sm ${isShared ? "border-amber-300/20 bg-amber-400/10 text-amber-100" : "border-emerald-300/15 bg-emerald-400/10 text-emerald-100"}`}>
              {isShared
                ? "You are viewing client-shared data. Creation and import stay read-only here."
                : "Create one hole at a time or switch to bulk upload when the dataset is ready."}
            </div>
          </div>
        </div>

        <div className="min-w-0 overflow-visible rounded-[30px] border border-white/10 bg-slate-950/40 shadow-[0_28px_90px_rgba(2,6,23,0.34)]">
          {mode === "quick" ? (
            <AdminPage projectScope={projectScope} embedded />
          ) : (
            <BulkUploaderTab projectScope={projectScope} showHeader={false} />
          )}
        </div>
      </section>
    </div>
  );
}