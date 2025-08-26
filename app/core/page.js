"use client";
import { useEffect, useMemo, useState, Fragment, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import toast from "react-hot-toast";

// Compute whether a set of planned intervals is fully covered by progress intervals
function isFullyCovered(plannedIntervals, progressByTask) {
  if (!Array.isArray(plannedIntervals) || plannedIntervals.length === 0) return false;
  return plannedIntervals.every((pi) => {
    const overlaps = (progressByTask[pi.task_type] || []).filter(
      (p) => overlapLen(pi.from_m, pi.to_m, p.from_m, p.to_m) > 0
    );
    let cursor = Number(pi.from_m);
    for (const p of overlaps.sort((a, b) => Number(a.from_m) - Number(b.from_m))) {
      if (Number(p.from_m) > cursor) break; // gap
      if (Number(p.to_m) > cursor) cursor = Number(p.to_m);
    }
    return cursor >= Number(pi.to_m);
  });
}

function overlapLen(a1, a2, b1, b2) {
  const start = Math.max(Number(a1), Number(b1));
  const end = Math.min(Number(a2), Number(b2));
  return Math.max(0, end - start);
}

export default function CorePage() {
  const supabase = supabaseBrowser();
  const [holes, setHoles] = useState([]); // {id, hole_id}
  const [loading, setLoading] = useState(true);
  const [holeStatus, setHoleStatus] = useState({}); // { [holeId]: { hasPlanned: boolean, complete: boolean } }
  const [expandedHole, setExpandedHole] = useState({}); // { [holeId]: true }
  const [expandedTask, setExpandedTask] = useState({}); // { `${holeId}:${task}`: true }
  const [details, setDetails] = useState({}); // { [holeId]: { tasks: { [task]: { intervals, progress } }, order: string[], complete: boolean } }
  const [inputs, setInputs] = useState({}); // { `${holeId}:${task}:${from}-${to}`: { from_m, to_m, disabled } }
  const [savingKey, setSavingKey] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loggedOn, setLoggedOn] = useState(() => new Date().toISOString().slice(0, 10)); // yyyy-mm-dd
  const [selectedProject, setSelectedProject] = useState("");
  // Multi-select status filters; empty or all selected => show all
  const [holeFilters, setHoleFilters] = useState(['complete','in_progress','not_started']);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef(null);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const projectMenuRef = useRef(null);

  const projects = useMemo(() => {
    const set = new Set();
    (holes || []).forEach((h) => {
      if (h.project_name) set.add(h.project_name);
    });
    return Array.from(set).sort();
  }, [holes]);

  const classifyHole = (h) => {
    const s = holeStatus[h.id] || {};
    if (s.hasPlanned) {
      if (s.complete) return 'complete';
      if (s.hasProgress) return 'in_progress';
      return 'not_started';
    }
    return s.hasProgress ? 'in_progress' : 'not_started';
  };

  const filteredHoles = useMemo(() => {
    const byProject = !selectedProject ? holes : (holes || []).filter(h => h.project_name === selectedProject);
    const active = holeFilters || [];
    if (active.length === 0 || active.length === 3) return byProject; // all
    return byProject.filter(h => active.includes(classifyHole(h)));
  }, [holes, selectedProject, holeFilters, holeStatus]);

  // Click outside to close status menu
  useEffect(() => {
    if (!statusMenuOpen && !projectMenuOpen) return;
    const handler = (e) => {
      if (statusMenuOpen && statusMenuRef.current && !statusMenuRef.current.contains(e.target)) {
        setStatusMenuOpen(false);
      }
      if (projectMenuOpen && projectMenuRef.current && !projectMenuRef.current.contains(e.target)) {
        setProjectMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [statusMenuOpen, projectMenuOpen]);

  const toggleStatusFilter = (status) => {
    setHoleFilters((prev) => {
      const exists = prev.includes(status);
      let next = exists ? prev.filter(s => s !== status) : [...prev, status];
      // If none selected, treat as all (reset to all three for clarity)
      if (next.length === 0) next = ['complete','in_progress','not_started'];
      return next;
    });
  };

  const allSelected = holeFilters.length === 3;
  const summaryLabel = allSelected ? 'All' : holeFilters
    .map(s => s === 'complete' ? 'Completed' : s === 'in_progress' ? 'In progress' : 'Not started')
    .join(', ');

  useEffect(() => {
    (async () => {
      const { data: holesData } = await supabase
        .from("holes")
        .select("id, hole_id, depth, project_name");
      setHoles(holesData || []);
      const ids = (holesData || []).map((h) => h.id);
      if (ids.length > 0) {
        const [planRes, progRes] = await Promise.all([
          supabase
            .from("hole_task_intervals")
            .select("hole_id, task_type, from_m, to_m")
            .in("hole_id", ids),
          supabase
            .from("hole_task_progress")
            .select("hole_id, task_type, from_m, to_m")
            .in("hole_id", ids),
        ]);
        const intervals = planRes.data || [];
        const progress = progRes.data || [];
        const intervalsByHole = {};
        intervals.forEach((r) => {
          (intervalsByHole[r.hole_id] ||= []).push(r);
        });
        const progressByHole = {};
        progress.forEach((p) => {
          (progressByHole[p.hole_id] ||= []).push(p);
        });
        const statusMap = {};
        ids.forEach((id) => {
          const planned = intervalsByHole[id] || [];
          const progArr = progressByHole[id] || [];
          const byTask = {};
          progArr.forEach((p) => {
            (byTask[p.task_type] ||= []).push(p);
          });
          const complete = isFullyCovered(planned, byTask);
          statusMap[id] = { hasPlanned: planned.length > 0, complete, hasProgress: progArr.length > 0 };
        });
        setHoleStatus(statusMap);
      }
      setLoading(false);
    })();
  }, [supabase]);

  // current user id for labeling progress entries
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setCurrentUserId(data?.user?.id || null);
    })();
  }, [supabase]);

  const holeKey = (holeId, t) => `${holeId}:${t}`;
  const rowKey = (holeId, t, f, to) => `${holeId}:${t}:${f}-${to}`;

  const initInputsForHole = (holeId, planRows, progRows) => {
    // group progress by task and sort
    const byTask = {};
    (progRows || []).forEach((p) => {
      if (!byTask[p.task_type]) byTask[p.task_type] = [];
      byTask[p.task_type].push(p);
    });
    Object.values(byTask).forEach((arr) => arr.sort((a, b) => Number(a.from_m) - Number(b.from_m)));

    const next = { ...inputs };
    (planRows || []).forEach((pi) => {
      const key = rowKey(holeId, pi.task_type, pi.from_m, pi.to_m);
      const overlaps = (byTask[pi.task_type] || []).filter(
        (p) => overlapLen(pi.from_m, pi.to_m, p.from_m, p.to_m) > 0
      );
      let cursor = Number(pi.from_m);
      for (const p of overlaps) {
        if (Number(p.from_m) > cursor) break;
        if (Number(p.to_m) > cursor) cursor = Number(p.to_m);
      }
      const fullyCovered = cursor >= Number(pi.to_m);
      next[key] = fullyCovered
        ? { from_m: Number(pi.from_m), to_m: Number(pi.to_m), disabled: true }
        : { from_m: cursor, to_m: "", disabled: false };
    });
    setInputs(next);
  };

  const loadHoleDetails = async (holeId) => {
    try {
      const [planRes, progRes] = await Promise.all([
        supabase
          .from("hole_task_intervals")
          .select("task_type, from_m, to_m")
          .eq("hole_id", holeId)
          .order("task_type", { ascending: true })
          .order("from_m", { ascending: true }),
        supabase
          .rpc("get_hole_progress_with_email", { p_hole_id: holeId })
      ]);
      const intervals = planRes.data || [];
      const progress = (progRes.data || []).sort((a,b) => a.task_type.localeCompare(b.task_type) || Number(a.from_m)-Number(b.from_m));
      const tasks = {};
      const order = [];
      intervals.forEach((r) => {
        if (!tasks[r.task_type]) {
          tasks[r.task_type] = { intervals: [], progress: [] };
          order.push(r.task_type);
        }
        tasks[r.task_type].intervals.push({ from_m: r.from_m, to_m: r.to_m });
      });
      progress.forEach((p) => {
        if (!tasks[p.task_type]) {
          tasks[p.task_type] = { intervals: [], progress: [] };
          order.push(p.task_type);
        }
        tasks[p.task_type].progress.push(p);
      });
      // compute completion across all tasks via shared helper for consistency
      const allPlanned = intervals;
      const byTask = {};
      (progress || []).forEach((p) => {
        (byTask[p.task_type] ||= []).push(p);
      });
      const fullyCovered = isFullyCovered(allPlanned, byTask);
      setDetails((d) => ({ ...d, [holeId]: { tasks, order, complete: fullyCovered } }));
      // update status map based on detailed computation
  setHoleStatus((m) => ({ ...m, [holeId]: { hasPlanned: allPlanned.length > 0, complete: fullyCovered, hasProgress: (progress || []).length > 0 } }));
      initInputsForHole(holeId, intervals, progress);
    } catch (e) {
      // noop
    }
  };

  const toggleHole = async (holeId) => {
    setExpandedHole((m) => ({ ...m, [holeId]: !m[holeId] }));
    const willOpen = !expandedHole[holeId];
    if (willOpen && !details[holeId]) {
      await loadHoleDetails(holeId);
    }
  };

  const toggleTask = (holeId, task) => {
    const k = holeKey(holeId, task);
    setExpandedTask((m) => ({ ...m, [k]: !m[k] }));
  };

  const saveInterval = async (holeId, task, plannedFrom, plannedTo, fromOverride, toOverride) => {
    const key = rowKey(holeId, task, plannedFrom, plannedTo);
    const state = inputs[key] || {};
    const from_m = Number(fromOverride ?? state.from_m);
    const to_m = Number(toOverride ?? state.to_m);
    if (!task || isNaN(from_m) || isNaN(to_m) || to_m <= from_m) {
      toast.error("Enter a valid interval (to > from)");
      return;
    }
    if (from_m < Number(plannedFrom) || to_m > Number(plannedTo)) {
      toast.error("Interval must be within planned range");
      return;
    }
    setSavingKey(key);
    const { error } = await supabase.from("hole_task_progress").insert({
      hole_id: holeId,
      task_type: task,
      from_m,
      to_m,
  logged_on: loggedOn,
    });
    setSavingKey(null);
    if (error) {
      const msg = String(error.message || "");
      if (msg.toLowerCase().includes("exclusion") || msg.toLowerCase().includes("overlap") || msg.includes("&&")) {
        toast.error("Overlaps an existing entry for this task.");
      } else if (msg.toLowerCase().includes("row level security") || error.code === "42501") {
        toast.error("Sign in required to record progress.");
      } else {
        toast.error("Could not save progress.");
      }
      return;
    }
    toast.success("Saved");
    await loadHoleDetails(holeId);
  // Status is already refreshed via loadHoleDetails using the same logic as initial load
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <h1 className="text-2xl font-semibold mb-2">Core Logging</h1>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-700">Entering actuals for the date of</label>
        <input
          type="date"
          className="input input-sm w-auto"
          value={loggedOn}
          onChange={(e) => setLoggedOn(e.target.value)}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative" ref={projectMenuRef}>
            <button
              type="button"
              className="input input-sm w-auto flex items-center gap-1 cursor-pointer"
              onClick={() => setProjectMenuOpen(o => !o)}
            >
              <span className="text-gray-700">Project:</span>
              {selectedProject ? (
                <span className="flex items-center gap-1 text-gray-700">
                  <span className="text-gray-600">{selectedProject}</span>
                </span>
              ) : (
                <span className="text-gray-500">All</span>
              )}
              <svg className={`w-3 h-3 ml-1 transition-transform ${projectMenuOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.189l3.71-3.96a.75.75 0 111.08 1.04l-4.24 4.53a.75.75 0 01-1.08 0l-4.24-4.53a.75.75 0 01.02-1.06z" /></svg>
            </button>
            {projectMenuOpen && (
              <div className="absolute right-0 mt-1 w-56 rounded-md border bg-white shadow-lg z-30 p-2 space-y-1 text-sm max-h-64 overflow-auto">
                <button
                  type="button"
                  onClick={() => { setSelectedProject(''); setProjectMenuOpen(false); }}
                  className={`w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 text-left ${selectedProject === '' ? 'bg-gray-100' : ''}`}
                >
                  <span className="flex-1">All projects</span>
                  <span className={`w-4 h-4 inline-flex items-center justify-center text-[10px] rounded ${selectedProject === '' ? 'text-indigo-600' : 'text-transparent'}`}>✓</span>
                </button>
                {projects.map(p => {
                  const active = selectedProject === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => { setSelectedProject(p); setProjectMenuOpen(false); }}
                      className={`w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 text-left ${active ? 'bg-gray-100' : ''}`}
                    >
                      <span className="flex-1">{p}</span>
                      <span className={`w-4 h-4 inline-flex items-center justify-center text-[10px] rounded ${active ? 'text-indigo-600' : 'text-transparent'}`}>✓</span>
                    </button>
                  );
                })}
                {selectedProject && (
                  <div className="pt-1 mt-1 border-t">
                    <button
                      type="button"
                      className="text-[11px] text-gray-500 hover:underline"
                      onClick={() => { setSelectedProject(''); setProjectMenuOpen(false); }}
                    >Clear selection</button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="relative" ref={statusMenuRef}>
            <button
              type="button"
              className="input input-sm w-auto flex items-center gap-1 cursor-pointer"
              onClick={() => setStatusMenuOpen(o => !o)}
            >
              <span className="text-gray-700">Status:</span>
              <span className="flex items-center gap-1">
                {allSelected ? (
                  <span className="text-gray-600">All</span>
                ) : holeFilters.map(s => {
                  const color = s === 'complete' ? 'bg-green-500' : s === 'in_progress' ? 'bg-amber-500' : 'bg-gray-400';
                  return <span key={s} className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100">
                    <span className={`inline-block w-2 h-2 rounded-full ${color}`}></span>
                    {s === 'complete' ? 'Done' : s === 'in_progress' ? 'Progress' : 'New'}
                  </span>;
                })}
              </span>
              <svg className={`w-3 h-3 ml-1 transition-transform ${statusMenuOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.189l3.71-3.96a.75.75 0 111.08 1.04l-4.24 4.53a.75.75 0 01-1.08 0l-4.24-4.53a.75.75 0 01.02-1.06z" /></svg>
            </button>
            {statusMenuOpen && (
              <div className="absolute right-0 mt-1 w-48 rounded-md border bg-white shadow-lg z-30 p-2 space-y-1 text-sm">
                {[
                  { key: 'complete', label: 'Completed', color: 'bg-green-500' },
                  { key: 'in_progress', label: 'In progress', color: 'bg-amber-500' },
                  { key: 'not_started', label: 'Not started', color: 'bg-gray-400' },
                ].map(opt => {
                  const active = holeFilters.includes(opt.key);
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => toggleStatusFilter(opt.key)}
                      className={`w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 text-left ${active ? 'bg-gray-100' : ''}`}
                    >
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${opt.color}`}></span>
                      <span className="flex-1">{opt.label}</span>
                      <span className={`w-4 h-4 inline-flex items-center justify-center text-[10px] rounded ${active ? 'text-indigo-600' : 'text-transparent'}`}>✓</span>
                    </button>
                  );
                })}
                <div className="pt-1 mt-1 border-t flex items-center gap-2">
                  <button
                    type="button"
                    className="text-[11px] text-indigo-600 hover:underline"
                    onClick={() => setHoleFilters(['complete','in_progress','not_started'])}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className="text-[11px] text-gray-500 hover:underline"
                    onClick={() => setHoleFilters([])}
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {loading ? (
        <p>Loading…</p>
      ) : holes.length === 0 ? (
        <p className="text-sm text-gray-500">No holes available.</p>
      ) : (
        <>
          {/* Desktop/tablet table */}
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-sm border">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="text-left p-2 border w-10"></th>
                <th className="text-left p-2 border">Hole</th>
                <th className="text-left p-2 border w-32">Depth (m)</th>
              </tr>
            </thead>
            <tbody>
              {filteredHoles.map((h) => (
                <Fragment key={h.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="p-2 border align-top">
                      <button className="btn text-xs" onClick={() => toggleHole(h.id)}>
                        {expandedHole[h.id] ? "−" : "+"}
                      </button>
                    </td>
                    <td className="p-2 border">
                      <div className="flex items-center gap-2">
                        <span>{h.hole_id}</span>
                        {(holeStatus[h.id]?.hasPlanned && holeStatus[h.id]?.complete) ? (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-green-100 text-green-700">Complete</span>
                        ) : (holeStatus[h.id]?.hasPlanned) ? (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-700">In progress</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-2 border align-top">{h?.depth ?? "-"}</td>
                  </tr>
                  {expandedHole[h.id] && (
                    <tr>
                      <td className="p-0 border-l border-r" colSpan={3}>
                        <div className="bg-gray-50/50 p-3">
                          {!details[h.id] ? (
                            <p className="text-sm text-gray-500">Loading…</p>
                          ) : Object.keys(details[h.id].tasks).length === 0 ? (
                            <p className="text-sm text-gray-500">No planned logging for this hole.</p>
                          ) : (
                            <table className="w-full text-xs border">
                              <thead className="bg-white">
                                <tr>
                                  <th className="text-left p-2 border w-10"></th>
                                  <th className="text-left p-2 border">Task</th>
                                </tr>
                              </thead>
                              <tbody>
                                {details[h.id].order.map((task) => (
                                  <Fragment key={task}>
                                    <tr className="hover:bg-white">
                                      <td className="p-2 border align-top">
                                        <button
                                          className="btn text-[10px]"
                                          onClick={() => toggleTask(h.id, task)}
                                        >
                                          {expandedTask[holeKey(h.id, task)] ? "−" : "+"}
                                        </button>
                                      </td>
                                      <td className="p-2 border">{task.replace(/_/g, " ")}</td>
                                    </tr>
                                    {expandedTask[holeKey(h.id, task)] && (
                                      <tr>
                                        <td className="p-0 border-l border-r" colSpan={2}>
                                          <div className="p-2">
                                            <table className="w-full text-xs border">
                                              <thead className="bg-gray-50 sticky top-12 z-10">
                                                <tr>
                                                  <th className="text-left p-2 border">Planned Interval (m)</th>
                                                  <th className="text-left p-2 border">Existing Progress</th>
                                                  <th className="text-left p-2 border">Enter Actuals</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {details[h.id].tasks[task].intervals.map((pi, idx) => {
                                                  const key = rowKey(h.id, task, pi.from_m, pi.to_m);
                                                  const state = inputs[key] || { from_m: pi.from_m, to_m: "", disabled: false };
                                                  const overlaps = (details[h.id].tasks[task].progress || []).filter(
                                                    (p) => overlapLen(pi.from_m, pi.to_m, p.from_m, p.to_m) > 0
                                                  );
                                                  const fullyCovered = state.disabled;
                                                  return (
                                                    <tr key={key} className="hover:bg-white">
                                                      <td className="p-2 border whitespace-nowrap">{pi.from_m}–{pi.to_m}</td>
                                                          <td className="p-2 border">
                                                            {overlaps.length === 0 ? (
                                                              <span className="text-gray-500">None</span>
                                                            ) : (
                                                              overlaps.map((o, i) => (
                                                                <span key={o.id} className="inline-block mr-3">
                                                                  {o.from_m}–{o.to_m}
                                                                  <span className="text-gray-500"> {o.user_id === currentUserId ? "(you)" : `by ${o.name || o.email || String(o.user_id || "").slice(0, 8)}`}</span>
                                                                  {i < overlaps.length - 1 ? "," : ""}
                                                                </span>
                                                              ))
                                                            )}
                                                          </td>
                                                      <td className="p-2 border">
                                                        {fullyCovered ? (
                                                          <span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded">Complete</span>
                                                        ) : (
                              <div className="flex items-center gap-1 md:gap-2">
                                                            <input
                                                              type="number"
                                                              step="0.1"
                                                              maxLength={4}
                                                              inputMode="decimal"
                                className="input input-xs w-14 md:input-sm md:w-20 text-[10px] md:text-xs"
                                                              value={state.from_m}
                                                              onChange={(e) =>
                                                                setInputs((m) => ({ ...m, [key]: { ...state, from_m: e.target.value } }))
                                                              }
                                                            />
                                                            <span className="text-[10px] md:text-xs text-gray-500">to</span>
                                                            <input
                                                              type="number"
                                                              step="0.1"
                                                              maxLength={4}
                                                              inputMode="decimal"
                                className="input input-xs w-14 md:input-sm md:w-20 text-[10px] md:text-xs"
                                                              value={state.to_m}
                                                              placeholder={pi.to_m}
                                                              onChange={(e) =>
                                                                setInputs((m) => ({ ...m, [key]: { ...state, to_m: e.target.value } }))
                                                              }
                                                            />
                                                            <button
                                                              type="button"
                                className="btn btn-primary text-[10px] md:text-xs shrink-0 whitespace-nowrap px-2"
                                                              onClick={() => saveInterval(h.id, task, pi.from_m, pi.to_m)}
                                                              disabled={savingKey === key}
                                                            >
                                                              {savingKey === key ? "Saving…" : "Save"}
                                                            </button>
                                                            <button
                                                              type="button"
                                className="btn text-[10px] md:text-xs shrink-0 whitespace-nowrap px-2"
                                                              onClick={() => saveInterval(h.id, task, pi.from_m, pi.to_m, state.from_m, pi.to_m)}
                                                              disabled={savingKey === key}
                                                            >
                                                              Fill to end
                                                            </button>
                                                          </div>
                                                        )}
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden space-y-3">
            {filteredHoles.map((h) => (
              <div key={h.id} className="card p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-700">Hole ID: {h.hole_id}</span>
                    <span className="text-gray-500">· Depth {h?.depth ?? "-"} m</span>
                  </div>
                  {(holeStatus[h.id]?.hasPlanned && holeStatus[h.id]?.complete) ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-green-100 text-green-700">Complete</span>
                  ) : (holeStatus[h.id]?.hasPlanned) ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-700">In progress</span>
                  ) : null}
                </div>
                <button
                  className="mt-2 w-full btn btn-primary text-xs"
                  onClick={() => toggleHole(h.id)}
                >
                  {expandedHole[h.id] ? "Hide tasks" : "Show tasks"}
                </button>
                {expandedHole[h.id] && (
                  <div className="mt-2">
                    {!details[h.id] ? (
                      <p className="text-sm text-gray-500">Loading…</p>
                    ) : Object.keys(details[h.id].tasks).length === 0 ? (
                      <p className="text-sm text-gray-500">No planned logging for this hole.</p>
                    ) : (
                      <div className="space-y-2">
                        {details[h.id].order.map((task) => (
                          <div key={task} className="border rounded">
                            <button
                              className="w-full p-2 text-xs flex items-center justify-between"
                              onClick={() => toggleTask(h.id, task)}
                              aria-expanded={!!expandedTask[holeKey(h.id, task)]}
                              aria-controls={`task-${h.id}-${task}`}
                            >
                              <span>{task.replace(/_/g, " ")}</span>
                              <span className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded bg-gray-100 text-gray-600 text-[11px]">
                                {expandedTask[holeKey(h.id, task)] ? '−' : '+'}
                              </span>
                            </button>
                            {expandedTask[holeKey(h.id, task)] && (
                              <div id={`task-${h.id}-${task}`} className="p-2 border-t space-y-2">
                                {details[h.id].tasks[task].intervals.map((pi) => {
                                  const key = rowKey(h.id, task, pi.from_m, pi.to_m);
                                  const state = inputs[key] || { from_m: pi.from_m, to_m: "", disabled: false };
                                  const overlaps = (details[h.id].tasks[task].progress || []).filter(
                                    (p) => overlapLen(pi.from_m, pi.to_m, p.from_m, p.to_m) > 0
                                  );
                                  const fullyCovered = state.disabled;
                                  return (
                                    <div key={key} className="text-[11px] md:text-xs">
                                      <div className="text-gray-700 mb-1 text-[11px] md:text-xs">Planned {pi.from_m}–{pi.to_m} m</div>
                                      <div className="mb-1 text-[10px] md:text-[11px]">
                                        {overlaps.length === 0 ? (
                                          <span className="text-gray-500">No progress yet</span>
                                        ) : (
                                          overlaps.map((p, i) => (
                                            <span key={`${p.id}-${i}`} className="inline-block mr-2">
                                              {p.from_m}–{p.to_m} m by {p.name}
                                            </span>
                                          ))
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1 md:gap-2">
                                        <input
                                          type="number"
                                          step="0.1"
                                          maxLength={4}
                                          inputMode="decimal"
                                          className="input input-xs w-8 md:input-sm md:w-20 text-[10px] md:text-xs"
                                          value={state.from_m}
                                          onChange={(e) => setInputs((m) => ({ ...m, [key]: { ...state, from_m: e.target.value } }))}
                                          disabled={state.disabled}
                                        />
                                        <span className="text-[10px] md:text-xs">to</span>
                                        <input
                                          type="number"
                                          step="0.1"
                                          maxLength={4}
                                          inputMode="decimal"
                                          className="input input-xs w-8 md:input-sm md:w-20 text-[10px] md:text-xs"
                                          value={state.to_m}
                                          onChange={(e) => setInputs((m) => ({ ...m, [key]: { ...state, to_m: e.target.value } }))}
                                          disabled={state.disabled}
                                        />
                                        <button
                                          className="btn btn-primary text-[10px] md:text-xs px-2"
                                          onClick={() => saveInterval(h.id, task, pi.from_m, pi.to_m)}
                                          disabled={state.disabled || savingKey === key}
                                        >
                                          {savingKey === key ? "Saving…" : fullyCovered ? "Saved" : "Save"}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
