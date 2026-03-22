"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import HorizontalScrollTabs from "@/app/components/HorizontalScrollTabs";
import CorePage from "./CorePage";
import SampleDispatchPage from "./SampleDispatchPage";
import DrillholeVizPage from "../drillhole-viz/page";
import CoreTasksManagerPage from "./CoreTasksPage";
import TestTab from "./TestTab";
import BulkUploaderTab from "./BulkUploaderTab";

const PROJECT_SCOPE_STORAGE_KEY = "coretasks:projectScope";

export default function CoreTasksPage() {
  const pathname = usePathname();
  const initialTab = pathname === "/addcore" || pathname === "/coretasks" ? "coreworkbench" : "coreworkbench";
  const [tab, setTab] = useState(initialTab);
  const [projectScope, setProjectScope] = useState("own"); // 'own' | 'shared'
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const isDrillholeVizTab = tab === "drillholeviz";

  useEffect(() => {
    setTab(pathname === "/addcore" || pathname === "/coretasks" ? "coreworkbench" : "coreworkbench");
  }, [pathname]);

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

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncViewport = (event) => {
      const matches = typeof event?.matches === "boolean" ? event.matches : mediaQuery.matches;
      setIsMobileViewport(matches);
    };

    syncViewport(mediaQuery);
    mediaQuery.addEventListener("change", syncViewport);

    return () => {
      mediaQuery.removeEventListener("change", syncViewport);
    };
  }, []);

  useEffect(() => {
    if (isMobileViewport && tab === "bulkuploader") {
      setTab("coreworkbench");
    }
  }, [isMobileViewport, tab]);

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

        <HorizontalScrollTabs className="mb-6 border-b border-white/10" hint="Swipe tabs" hintClassName="text-slate-500">
          <button
            className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm transition-base ${tab === "coreworkbench" ? "border-indigo-400 text-slate-100" : "border-transparent text-slate-300 hover:text-slate-100"}`}
            onClick={() => setTab("coreworkbench")}
          >
            Core Workbench
          </button>
          {!isMobileViewport ? (
            <button
              className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm transition-base ${tab === "bulkuploader" ? "border-indigo-400 text-slate-100" : "border-transparent text-slate-300 hover:text-slate-100"}`}
              onClick={() => setTab("bulkuploader")}
            >
              Bulk Uploader
            </button>
          ) : null}
          <button
            className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm transition-base ${tab === "logging" ? "border-indigo-400 text-slate-100" : "border-transparent text-slate-300 hover:text-slate-100"}`}
            onClick={() => setTab("logging")}
          >
            Logging
          </button>
          <button
            className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm transition-base ${tab === "sampledispatch" ? "border-indigo-400 text-slate-100" : "border-transparent text-slate-300 hover:text-slate-100"}`}
            onClick={() => setTab("sampledispatch")}
          >
            Sample Dispatch
          </button>
          <button
            className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm transition-base ${tab === "coretasks" ? "border-indigo-400 text-slate-100" : "border-transparent text-slate-300 hover:text-slate-100"}`}
            onClick={() => setTab("coretasks")}
          >
            Core Tasks
          </button>
          <button
            className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm transition-base ${tab === "drillholeviz" ? "border-indigo-400 text-slate-100" : "border-transparent text-slate-300 hover:text-slate-100"}`}
            onClick={() => setTab("drillholeviz")}
          >
            Drillhole Viz
          </button>
        </HorizontalScrollTabs>
      </div>

      {isDrillholeVizTab ? (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/30">
          <DrillholeVizPage projectScope={projectScope} />
        </div>
      ) : (
        <div className="max-w-6xl mx-auto">
          {tab === "coreworkbench" ? (
            <div className="card overflow-hidden">
              <TestTab projectScope={projectScope} />
            </div>
          ) : tab === "bulkuploader" ? (
            <div className="card overflow-hidden">
              <BulkUploaderTab projectScope={projectScope} />
            </div>
          ) : tab === "coretasks" ? (
            <div className="card overflow-hidden">
              <CoreTasksManagerPage />
            </div>
          ) : (
            <div className="card overflow-hidden">
              {tab === "logging" ? <CorePage projectScope={projectScope} /> : <SampleDispatchPage projectScope={projectScope} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
