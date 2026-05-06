"use client";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import HorizontalScrollTabs from "@/app/components/HorizontalScrollTabs";
import CorePage from "./CorePage";
import SampleDispatchPage from "./SampleDispatchPage";
import CoreTasksManagerPage from "./CoreTasksPage";
import HoleDetailsTab from "./HoleDetailsTab";
import AddCoreTab from "./AddCoreTab";

const PROJECT_SCOPE_STORAGE_KEY = "coretasks:projectScope";
const CORETASKS_TABS = new Set(["coreworkbench", "addcore", "bulkuploader", "logging", "sampledispatch", "coretasks"]);

function normaliseCoreTasksTab(value) {
  if (value === "bulkuploader") return "addcore";
  return CORETASKS_TABS.has(value) ? value : "coreworkbench";
}

function BackToMapIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M10 7 5 12l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 12H6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17.5 6.5h1a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function CoreTasksPage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto p-6">Loading…</div>}>
      <CoreTasksPageInner />
    </Suspense>
  );
}

function CoreTasksPageInner() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab") || "";
  const requestedProjectScope = searchParams.get("scope") || "";
  const requestedHoleId = searchParams.get("holeId") || "";
  const requestedFrom = searchParams.get("from") || "";
  const initialTab = normaliseCoreTasksTab(requestedTab);
  const [tab, setTab] = useState(initialTab);
  const [projectScope, setProjectScope] = useState("own"); // 'own' | 'shared'
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    const nextTab = normaliseCoreTasksTab(requestedTab);
    setTab((current) => (current === nextTab ? current : nextTab));
  }, [pathname, requestedTab]);

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
    if (requestedProjectScope !== "own" && requestedProjectScope !== "shared") return;
    setProjectScope((current) => (current === requestedProjectScope ? current : requestedProjectScope));
  }, [requestedProjectScope]);

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

  const handleBackToMap = () => {
    const params = new URLSearchParams();
    if (requestedHoleId) {
      params.set("holeId", requestedHoleId);
    }
    if (projectScope === "own" || projectScope === "shared") {
      params.set("scope", projectScope);
    }
    router.push(`/map?${params.toString()}`);
  };

  return (
    <div className="p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {requestedFrom === "map" ? (
            <button
              type="button"
              onClick={handleBackToMap}
              className="inline-flex items-center gap-2 self-start rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/16"
            >
              <BackToMapIcon className="h-[18px] w-[18px]" />
              <span>Back to map</span>
            </button>
          ) : null}
        </div>

        <HorizontalScrollTabs className="mb-6 border-b border-white/10" hint="Swipe tabs" hintClassName="text-slate-500">
          <button
            className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm transition-base ${tab === "coreworkbench" ? "border-indigo-400 text-slate-100" : "border-transparent text-slate-300 hover:text-slate-100"}`}
            onClick={() => setTab("coreworkbench")}
          >
            Core Workbench
          </button>
          <button
            className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm transition-base ${tab === "addcore" ? "border-indigo-400 text-slate-100" : "border-transparent text-slate-300 hover:text-slate-100"}`}
            onClick={() => setTab("addcore")}
          >
            Add Core
          </button>
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
            Setup
          </button>
        </HorizontalScrollTabs>
      </div>

      <div className="max-w-6xl mx-auto">
        {tab === "coreworkbench" ? (
          <div className="card overflow-hidden">
            <HoleDetailsTab projectScope={projectScope} />
          </div>
        ) : tab === "addcore" ? (
          <div className="card">
            <AddCoreTab projectScope={projectScope} />
          </div>
        ) : tab === "coretasks" ? (
          <div className="card overflow-hidden">
            <CoreTasksManagerPage />
          </div>
        ) : (
          <div className="card overflow-hidden">
            {tab === "logging" ? <CorePage projectScope={projectScope} focusedHoleId={requestedHoleId} /> : <SampleDispatchPage projectScope={projectScope} />}
          </div>
        )}
      </div>
    </div>
  );
}
