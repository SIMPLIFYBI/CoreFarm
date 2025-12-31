"use client";
import { useState } from "react";
import CorePage from "../core/page";
import AdminPage from "../admin/page";

const TABS = [
  { key: "logging", label: "Logging" },
  { key: "addcore", label: "Add Core" },
  { key: "sampledispatch", label: "Sample Dispatch" },
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
      </div>
      <div className="card overflow-hidden">
        {tab === "logging" ? <CorePage /> : tab === "addcore" ? <AdminPage /> : (
          <div className="flex flex-col items-center justify-center h-40 text-slate-300">
            <span className="text-lg font-semibold text-slate-100">Coming soon</span>
            <span className="mt-2">Sample Dispatch will be available in a future update.</span>
          </div>
        )}
      </div>
    </div>
  );
}
