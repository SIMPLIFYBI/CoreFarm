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
      <div className="mb-6 flex gap-2 border-b">
        <button
          className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm ${tab === "logging" ? "border-indigo-500 text-indigo-700" : "border-transparent text-gray-500"}`}
          onClick={() => setTab("logging")}
        >
          Logging
        </button>
        <button
          className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm ${tab === "addcore" ? "border-indigo-500 text-indigo-700" : "border-transparent text-gray-500"}`}
          onClick={() => setTab("addcore")}
        >
          Add Core
        </button>
        <button
          className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm ${tab === "sampledispatch" ? "border-indigo-500 text-indigo-700" : "border-transparent text-gray-500"}`}
          onClick={() => setTab("sampledispatch")}
        >
          Sample Dispatch
        </button>
      </div>
      <div className="bg-white rounded shadow p-4">
        {tab === "logging" ? <CorePage /> : tab === "addcore" ? <AdminPage /> : (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <span className="text-lg font-semibold">Coming soon</span>
            <span className="mt-2">Sample Dispatch will be available in a future update.</span>
          </div>
        )}
      </div>
    </div>
  );
}
