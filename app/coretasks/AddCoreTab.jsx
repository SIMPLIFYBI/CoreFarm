"use client";

import { useState } from "react";
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

export default function AddCoreTab({ projectScope = "own" }) {
  const [mode, setMode] = useState("quick");
  const isShared = projectScope === "shared";

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

      <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-3">
          {ADD_CORE_MODES.map((entry) => {
            const active = mode === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setMode(entry.id)}
                className={`w-full rounded-[24px] border p-4 text-left transition-base ${
                  active
                    ? "border-cyan-300/35 bg-cyan-400/10 shadow-[0_20px_60px_rgba(8,145,178,0.16)]"
                    : "border-white/10 bg-slate-950/45 hover:bg-white/[0.05]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{entry.eyebrow}</div>
                    <div className="mt-1 text-base font-semibold text-slate-100">{entry.title}</div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] ${active ? "bg-cyan-300/15 text-cyan-100" : "bg-white/[0.05] text-slate-300"}`}>
                    {entry.badge}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{entry.description}</p>
              </button>
            );
          })}

          <div className={`rounded-[24px] border p-4 text-sm ${isShared ? "border-amber-300/20 bg-amber-400/10 text-amber-100" : "border-emerald-300/15 bg-emerald-400/10 text-emerald-100"}`}>
            {isShared
              ? "You are viewing client-shared data. Creation and import stay read-only here."
              : "New holes are created directly inside your organization. Use bulk import when the dataset already exists, and quick add when the hole is still being set up."}
          </div>
        </div>

        <div className="min-w-0 rounded-[30px] border border-white/10 bg-slate-950/40 shadow-[0_28px_90px_rgba(2,6,23,0.34)] overflow-visible">
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